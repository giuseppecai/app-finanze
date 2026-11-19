// Funzioni che leggono e scrivono il database. Ogni scrittura su più tabelle è in una transazione.
// Le scritture dei prestiti arrivano con la loro schermata (M6).
import { nowISO } from '../domain/clock';
import { planClosing, type ClosingOption, type ClosingPlan } from '../domain/closing';
import { closingPreview } from '../domain/monthEnd';
import { buildNewPeriod } from '../domain/opening';
import { currentPeriod, nextPeriodToStart } from '../domain/periods';
import { chargeToTransaction, dueCharges } from '../domain/recurring';
import type { Cents, ISODate, Period, PotId, Reconciliation, Recurring, Settings, Transaction } from '../domain/types';
import type { FinanzeDB } from './schema';

export function newId(): string {
  return crypto.randomUUID();
}

// ── Impostazioni ──────────────────────────────────────────────────────────────

export async function getSettings(db: FinanzeDB): Promise<Settings> {
  const settings = await db.settings.get('settings');
  if (!settings) throw new Error('Impostazioni mancanti: il database non è stato inizializzato');
  return settings;
}

export async function updateSettings(db: FinanzeDB, patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.settings.update('settings', patch);
}

// ── Periodi ───────────────────────────────────────────────────────────────────

/** Il periodo corrente: l'ultimo iniziato e non chiuso. */
export async function getCurrentPeriod(db: FinanzeDB): Promise<Period | null> {
  return currentPeriod(await db.periods.toArray());
}

export async function getPeriodTransactions(db: FinanzeDB, periodId: string): Promise<Transaction[]> {
  return db.transactions.where('periodId').equals(periodId).toArray();
}

// ── Movimenti ─────────────────────────────────────────────────────────────────

export type NewTransaction = Omit<Transaction, 'id' | 'periodId' | 'createdAt'>;

/**
 * Registra un movimento nel periodo corrente (il periodId si salva sul movimento e non si ricalcola
 * dalla data). Ricorda l'ultima busta usata per la preselezione.
 */
export async function addTransaction(db: FinanzeDB, input: NewTransaction): Promise<Transaction> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Importo non valido');
  return db.transaction('rw', [db.periods, db.transactions, db.settings], async () => {
    const period = await getCurrentPeriod(db);
    if (!period) throw new Error('Nessun periodo aperto: fai prima "Inizio del mese"');
    const tx: Transaction = { ...input, id: newId(), periodId: period.id, createdAt: nowISO() };
    await db.transactions.add(tx);
    if (tx.envelopeId && (tx.type === 'expense' || tx.type === 'refund')) {
      await db.settings.update('settings', { lastEnvelopeId: tx.envelopeId });
    }
    return tx;
  });
}

/** Modifica un movimento esistente (resta nel suo periodo). */
export async function updateTransaction(
  db: FinanzeDB,
  id: string,
  patch: Partial<Omit<Transaction, 'id' | 'periodId' | 'createdAt'>>,
): Promise<void> {
  if (patch.amount !== undefined && (!Number.isInteger(patch.amount) || patch.amount <= 0)) {
    throw new Error('Importo non valido');
  }
  const changed = await db.transactions.update(id, patch);
  if (changed === 0 && !(await db.transactions.get(id))) throw new Error(`Movimento non trovato: ${id}`);
}

export async function deleteTransaction(db: FinanzeDB, id: string): Promise<void> {
  await db.transactions.delete(id);
}

// ── Abbonamenti ───────────────────────────────────────────────────────────────

/**
 * Genera gli addebiti automatici maturati nel periodo corrente (R8). Idempotente:
 * chiamarla più volte (avvio, ritorno in primo piano) non crea duplicati.
 * Restituisce i movimenti creati.
 */
export async function runRecurringCharges(db: FinanzeDB, today: ISODate): Promise<Transaction[]> {
  return db.transaction('rw', [db.periods, db.transactions, db.recurring], async () => {
    const period = await getCurrentPeriod(db);
    if (!period) return [];
    const [recurrings, periodTxs] = await Promise.all([
      db.recurring.toArray(),
      getPeriodTransactions(db, period.id),
    ]);
    const createdAt = nowISO();
    const created = dueCharges(recurrings, period, periodTxs, today).map((charge) =>
      chargeToTransaction(charge, period.id, newId(), createdAt),
    );
    if (created.length > 0) await db.transactions.bulkAdd(created);
    return created;
  });
}

// ── Chiusura e inizio del mese ────────────────────────────────────────────────

export interface StartPeriodInput {
  salary: Cents;
  travel: Cents;
  /** scelta per l'avanzo del periodo aperto; ignorata se non c'è un periodo da chiudere */
  closingOption: ClosingOption;
  today: ISODate;
}

export interface StartPeriodResult {
  closed: Period | null;
  started: Period;
}

/**
 * "Fatto: inizia il mese". In un'unica transazione:
 * 1. se c'è un periodo aperto lo chiude (genera gli abbonamenti mancanti fino alla fine del periodo,
 *    salva avanzi, scelta e data di chiusura);
 * 2. crea il periodo nuovo fotografando i tetti e applicando riporti / da assegnare;
 * 3. aggiorna i salvadanai e la quota Viaggi usata.
 * Così non resta mai un momento senza periodo aperto.
 */
export async function startPeriod(db: FinanzeDB, input: StartPeriodInput): Promise<StartPeriodResult> {
  if (!Number.isInteger(input.salary) || input.salary <= 0) throw new Error('Stipendio non valido');
  if (!Number.isInteger(input.travel) || input.travel < 0) throw new Error('Quota Viaggi non valida');
  return db.transaction(
    'rw',
    [db.settings, db.envelopes, db.periods, db.transactions, db.recurring, db.pots],
    async () => {
      const [settings, envelopes, periods, recurrings, pots] = await Promise.all([
        getSettings(db),
        db.envelopes.orderBy('order').toArray(),
        db.periods.toArray(),
        db.recurring.toArray(),
        db.pots.toArray(),
      ]);
      const open = currentPeriod(periods);
      const closedAt = nowISO();

      let closing: ClosingPlan | null = null;
      let closed: Period | null = null;
      if (open) {
        const periodTxs = await getPeriodTransactions(db, open.id);
        const preview = closingPreview(envelopes, open, periodTxs, recurrings, closedAt);
        const generated = preview.pending.map((c) => chargeToTransaction(c, open.id, newId(), closedAt));
        if (generated.length > 0) await db.transactions.bulkAdd(generated);
        closing = planClosing(preview.leftovers, preview.unassigned, input.closingOption);
        closed = { ...open, closedAt, leftoverChoice: closing.choice, leftovers: closing.leftovers };
        await db.periods.put(closed);
      }

      const last = periods.reduce<Period | null>((a, p) => (!a || p.id > a.id ? p : a), null);
      const target = nextPeriodToStart(last, input.today, settings.periodStartDay);
      if (await db.periods.get(target.id)) throw new Error(`Il periodo ${target.id} esiste già`);

      const { period, potDeltas } = buildNewPeriod({
        target,
        today: input.today,
        salary: input.salary,
        envelopes,
        travel: input.travel,
        gifts: settings.giftsQuota,
        closing,
      });
      await db.periods.add(period);

      for (const pot of pots) {
        await db.pots.update(pot.id, { balance: pot.balance + potDeltas[pot.id] });
      }
      await db.settings.update('settings', { lastTravelQuota: input.travel });

      // Abbonamenti già maturati nel periodo nuovo (es. un addebito il 27).
      const due = dueCharges(recurrings, period, [], input.today);
      if (due.length > 0) await db.transactions.bulkAdd(due.map((c) => chargeToTransaction(c, period.id, newId(), closedAt)));

      return { closed, started: period };
    },
  );
}

// ── Buste, abbonamenti, salvadanai (onboarding; Imposta e Abbonamenti in M5/M7) ──

/** Cambia i tetti. Valgono dal prossimo "Inizio del mese" (il periodo aperto non cambia). */
export async function setEnvelopeCaps(db: FinanzeDB, caps: Record<string, Cents>): Promise<void> {
  for (const cap of Object.values(caps)) {
    if (!Number.isInteger(cap) || cap < 0) throw new Error('Tetto non valido');
  }
  await db.transaction('rw', db.envelopes, async () => {
    for (const [id, cap] of Object.entries(caps)) await db.envelopes.update(id, { cap });
  });
}

/** Sostituisce l'elenco degli abbonamenti (crea, aggiorna, elimina). I movimenti già creati restano. */
export async function replaceRecurring(db: FinanzeDB, list: Recurring[]): Promise<void> {
  for (const r of list) {
    if (!Number.isInteger(r.amount) || r.amount <= 0) throw new Error(`Importo non valido: ${r.name}`);
    if (!Number.isInteger(r.dayOfMonth) || r.dayOfMonth < 1 || r.dayOfMonth > 31) throw new Error(`Giorno non valido: ${r.name}`);
  }
  await db.transaction('rw', db.recurring, async () => {
    const keep = new Set(list.map((r) => r.id));
    const existing = await db.recurring.toArray();
    await db.recurring.bulkDelete(existing.filter((r) => !keep.has(r.id)).map((r) => r.id));
    await db.recurring.bulkPut(list);
  });
}

export async function setPotBalances(db: FinanzeDB, balances: Partial<Record<PotId, Cents>>): Promise<void> {
  await db.transaction('rw', db.pots, async () => {
    for (const [id, balance] of Object.entries(balances)) {
      if (!Number.isInteger(balance)) throw new Error('Saldo non valido');
      await db.pots.update(id as PotId, { balance });
    }
  });
}

// ── Confronta con Revolut ─────────────────────────────────────────────────────

export interface SaveReconciliationInput {
  reconciliation: Omit<Reconciliation, 'id'>;
  /** primo confronto: la riserva delle carte da registrare in Impostazioni */
  calibrateReserve?: Cents;
  /** "Registra come entrata": crea il movimento income nel periodo corrente */
  income?: { amount: Cents; date: ISODate; note: string };
}

/** Salva un confronto (e, se serve, la riserva carte o l'entrata) in un'unica transazione. */
export async function saveReconciliation(db: FinanzeDB, input: SaveReconciliationInput): Promise<void> {
  await db.transaction('rw', [db.reconciliations, db.settings, db.periods, db.transactions], async () => {
    await db.reconciliations.add({ ...input.reconciliation, id: newId() });
    if (input.calibrateReserve !== undefined) {
      await db.settings.update('settings', { cardReserve: input.calibrateReserve });
    }
    if (input.income) {
      if (!Number.isInteger(input.income.amount) || input.income.amount <= 0) throw new Error('Entrata non valida');
      const period = await getCurrentPeriod(db);
      if (!period) throw new Error('Nessun periodo aperto');
      await db.transactions.add({
        id: newId(),
        periodId: period.id,
        date: input.income.date,
        type: 'income',
        amount: input.income.amount,
        envelopeId: null,
        note: input.income.note,
        card: null,
        source: 'reconcile',
        recurringId: null,
        personId: null,
        loanAllocations: null,
        createdAt: nowISO(),
      });
    }
  });
}
