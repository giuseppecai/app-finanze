// Funzioni che leggono e scrivono il database. Ogni scrittura su più tabelle è in una transazione.
import { nowISO } from '../domain/clock';
import { planClosing, type ClosingOption, type ClosingPlan } from '../domain/closing';
import { closingPreview } from '../domain/monthEnd';
import { billsTransfer, monthlyQuota, nextDueAfterPayment, planBillPayment, type BillPaymentPlan } from '../domain/bills';
import { addMonthsId } from '../domain/dates';
import { it } from '../i18n/it';
import { buildNewPeriod, itemQuotas } from '../domain/opening';
import {
  allocationAfterRemoval, defaultShortName, envelopeInUse, planCapsChange, planPotRemoval, recurringOnEnvelope,
  DEFAULT_DESTINATION, UNASSIGNED, type CapsChange, type FundsDestination, type PotRemoval,
} from '../domain/settings';
import { currentPeriod, nextPeriodToStart } from '../domain/periods';
import { chargeToTransaction, dueCharges, recurringQuota, savedSubscriptions } from '../domain/recurring';
import { otherAccountsRecurring } from '../domain/accounts';
import {
  applyRepayment, canDeleteLoan, createLoanEntry, deleteLoanEntry, savingsEffect, undoRepayment as undoLoanAllocations,
} from '../domain/loans';
import type {
  Bill, Card, Cents, Envelope, ISODate, Loan, LoanDirection, MonthlyItem, OtherAccount, Period, Person, Pot, PotId, Reconciliation, Recurring, Settings, Transaction,
} from '../domain/types';
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
  await db.transaction('rw', [db.transactions, db.recurring, db.pots], async () => {
    const tx = await db.transactions.get(id);
    // Addebito di un abbonamento accantonato: i soldi tornano nel suo fondo e nella Pocket Bollette (R15).
    if (tx && tx.type === 'expense' && tx.recurringId && tx.envelopeId === null) await applyFundCharges(db, [tx], +1);
    await db.transactions.delete(id);
  });
}

/**
 * Addebiti di abbonamenti accantonati (senza busta): escono dal fondo dell'abbonamento e dalla
 * Pocket Bollette (`sign` = −1). Con `sign` = +1 li rimette (movimento eliminato).
 */
async function applyFundCharges(db: FinanzeDB, txs: readonly Transaction[], sign: 1 | -1 = -1): Promise<void> {
  for (const t of txs) {
    if (t.type !== 'expense' || !t.recurringId || t.envelopeId !== null) continue;
    const r = await db.recurring.get(t.recurringId);
    // Pagato da un altro conto (rata iPhone da Isybank): la Pocket Spese fisse non c'entra.
    if (r?.payFrom) continue;
    if (r) await db.recurring.update(r.id, { fund: (r.fund ?? 0) + sign * t.amount });
    await adjustPot(db, 'bills', sign * t.amount);
  }
}

// ── Abbonamenti ───────────────────────────────────────────────────────────────

/**
 * Genera gli addebiti automatici maturati nel periodo corrente (R8). Idempotente:
 * chiamarla più volte (avvio, ritorno in primo piano) non crea duplicati.
 * Restituisce i movimenti creati.
 */
export async function runRecurringCharges(db: FinanzeDB, today: ISODate): Promise<Transaction[]> {
  return db.transaction('rw', [db.periods, db.transactions, db.recurring, db.pots], async () => {
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
    await applyFundCharges(db, created);
    return created;
  });
}

// ── Chiusura e inizio del mese ────────────────────────────────────────────────

export interface StartPeriodInput {
  salary: Cents;
  /** importi delle voci fisse scelti per questo mese (id voce → importo); le voci assenti usano l'importo proposto */
  quotas: Record<string, Cents>;
  /** scelta per l'avanzo del periodo aperto; ignorata se non c'è un periodo da chiudere */
  closingOption: ClosingOption;
  /** tetti delle buste scelti per questo mese: diventano anche i tetti di Imposta */
  caps?: Record<string, Cents>;
  /** saldi delle Pocket ricopiati da Revolut prima dei giroconti (id salvadanaio → saldo) */
  potBalances?: Record<string, Cents>;
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
 * 3. aggiorna i salvadanai (Bollette compresa), il fondo di ogni bolletta e gli importi proposti delle voci fisse.
 * Così non resta mai un momento senza periodo aperto.
 */
export async function startPeriod(db: FinanzeDB, input: StartPeriodInput): Promise<StartPeriodResult> {
  if (!Number.isInteger(input.salary) || input.salary <= 0) throw new Error('Stipendio non valido');
  for (const v of Object.values(input.quotas)) {
    if (!Number.isInteger(v) || v < 0) throw new Error('Importo di una voce non valido');
  }
  for (const v of Object.values(input.caps ?? {})) {
    if (!Number.isInteger(v) || v < 0) throw new Error('Tetto non valido');
  }
  for (const v of Object.values(input.potBalances ?? {})) {
    if (!Number.isInteger(v)) throw new Error('Saldo di una Pocket non valido');
  }
  return db.transaction(
    'rw',
    [db.settings, db.envelopes, db.periods, db.transactions, db.recurring, db.pots, db.bills],
    async () => {
      const [settings, envelopes, periods, recurrings, bills] = await Promise.all([
        getSettings(db),
        db.envelopes.orderBy('order').toArray(),
        db.periods.toArray(),
        db.recurring.toArray(),
        db.bills.toArray(),
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
        await applyFundCharges(db, generated);
        closing = planClosing(preview.leftovers, preview.unassigned, input.closingOption);
        closed = { ...open, closedAt, leftoverChoice: closing.choice, leftovers: closing.leftovers };
        await db.periods.put(closed);
      }

      // Saldi delle Pocket come su Revolut adesso (prima dei giroconti di questo inizio mese).
      for (const [id, balance] of Object.entries(input.potBalances ?? {})) {
        if (await db.pots.get(id)) await db.pots.update(id, { balance });
      }
      // Tetti scelti per questo mese: valgono anche per i prossimi (sono quelli di Imposta).
      for (const [id, cap] of Object.entries(input.caps ?? {})) await db.envelopes.update(id, { cap });
      const envelopesNow = input.caps ? await db.envelopes.orderBy('order').toArray() : envelopes;

      const last = periods.reduce<Period | null>((a, p) => (!a || p.id > a.id ? p : a), null);
      const target = nextPeriodToStart(last, input.today, settings.periodStartDay);
      if (await db.periods.get(target.id)) throw new Error(`Il periodo ${target.id} esiste già`);

      const { period, potDeltas } = buildNewPeriod({
        target,
        today: input.today,
        salary: input.salary,
        envelopes: envelopesNow,
        items: itemQuotas(settings.monthlyItems, input.quotas),
        otherAccounts: otherAccountsRecurring(await db.recurring.toArray(), target),
        billsQuota: billsTransfer(
          bills,
          (await db.pots.get('bills'))?.balance ?? 0,
          target.id,
          savedSubscriptions(await db.recurring.toArray(), target.id, settings.periodStartDay),
        ).amount,
        closing,
      });
      await db.periods.add(period);

      // Ogni bolletta attiva accantona la sua quota (R13).
      for (const bill of bills) {
        const quota = bill.active ? monthlyQuota(bill, target.id) : 0;
        if (quota > 0) await db.bills.update(bill.id, { fund: bill.fund + quota });
      }
      // …e ogni abbonamento la sua (R16: tutti si pagano dalla Pocket Spese fisse).
      for (const r of await db.recurring.toArray()) {
        const quota = recurringQuota(r, target.id, settings.periodStartDay);
        if (quota > 0) await db.recurring.update(r.id, { fund: (r.fund ?? 0) + quota });
      }

      const potsNow = await db.pots.toArray(); // la chiusura può aver già toccato la Pocket Bollette
      for (const [id, delta] of Object.entries(potDeltas)) {
        const pot = potsNow.find((p) => p.id === id);
        if (pot) await db.pots.update(id, { balance: pot.balance + delta });
        else {
          const item = settings.monthlyItems.find((i) => i.id === id);
          await db.pots.add({ id, name: item?.name ?? id, balance: delta });
        }
      }
      // L'importo usato diventa quello proposto il mese prossimo.
      const monthlyItems = settings.monthlyItems.map((i) => (input.quotas[i.id] !== undefined ? { ...i, amount: input.quotas[i.id]! } : i));
      await db.settings.update('settings', { monthlyItems });

      // Abbonamenti già maturati nel periodo nuovo (es. un addebito il 27).
      const due = dueCharges(await db.recurring.toArray(), period, [], input.today);
      const dueTxs = due.map((c) => chargeToTransaction(c, period.id, newId(), closedAt));
      if (dueTxs.length > 0) await db.transactions.bulkAdd(dueTxs);
      await applyFundCharges(db, dueTxs);

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

/**
 * Crea o aggiorna una voce fissa dell'inizio del mese. Una voce-salvadanaio ha il suo salvadanaio
 * (stesso id, stesso nome); archiviare una voce non tocca i soldi già messi da parte.
 */
export async function saveMonthlyItem(db: FinanzeDB, item: MonthlyItem): Promise<void> {
  const name = item.name.trim();
  if (name === '') throw new Error('Nome mancante');
  if (!Number.isInteger(item.amount) || item.amount < 0) throw new Error('Importo non valido');
  if (item.id === 'savings' || item.id === 'bills') throw new Error('Id riservato');
  await db.transaction('rw', [db.settings, db.pots], async () => {
    const settings = await getSettings(db);
    const exists = settings.monthlyItems.some((i) => i.id === item.id);
    const next = { ...item, name };
    const monthlyItems = exists ? settings.monthlyItems.map((i) => (i.id === item.id ? next : i)) : [...settings.monthlyItems, next];
    await db.settings.update('settings', { monthlyItems });
    if (item.kind === 'pot') {
      const pot = await db.pots.get(item.id);
      const icon = item.icon ? { icon: item.icon } : {};
      if (pot) await db.pots.update(item.id, { name, ...icon });
      else await db.pots.add({ id: item.id, name, balance: 0, ...icon });
    }
  });
}

// ── Altri conti (Isybank…) ─────────────────────────────────────────────────

/** Crea o rinomina un altro conto; `salary` = qui arriva lo stipendio (uno solo alla volta). */
export async function saveAccount(db: FinanzeDB, account: OtherAccount, salary: boolean): Promise<void> {
  const name = account.name.trim();
  if (name === '') throw new Error('Nome mancante');
  await db.transaction('rw', db.settings, async () => {
    const settings = await getSettings(db);
    const list = settings.accounts ?? [];
    const cards = (account.cards ?? []).map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name !== '');
    const next = { id: account.id, name, cards };
    const accounts = list.some((a) => a.id === account.id) ? list.map((a) => (a.id === account.id ? next : a)) : [...list, next];
    const salaryAccountId = salary ? account.id : settings.salaryAccountId === account.id ? null : settings.salaryAccountId ?? null;
    await db.settings.update('settings', { accounts, salaryAccountId });
  });
}

/** Toglie un conto: i pagamenti che partivano da lì tornano a Revolut, lo stipendio torna su Revolut. */
export async function removeAccount(db: FinanzeDB, id: string): Promise<void> {
  await db.transaction('rw', [db.settings, db.recurring], async () => {
    const settings = await getSettings(db);
    await db.settings.update('settings', {
      accounts: (settings.accounts ?? []).filter((a) => a.id !== id),
      salaryAccountId: settings.salaryAccountId === id ? null : settings.salaryAccountId ?? null,
      monthlyItems: settings.monthlyItems.map((i) => (i.payFrom === id ? { ...i, payFrom: null } : i)),
    });
    await db.recurring.toCollection().modify((r) => {
      if (r.payFrom === id) {
        r.payFrom = null;
        r.payCard = null;
      }
    });
  });
}

/** Sposta una voce fissa su o giù nell'elenco. */
export async function moveMonthlyItem(db: FinanzeDB, id: string, delta: -1 | 1): Promise<void> {
  const settings = await getSettings(db);
  const list = [...settings.monthlyItems];
  const i = list.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.settings.update('settings', { monthlyItems: list });
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
        billId: null,
        createdAt: nowISO(),
      });
    }
  });
}

// ── Abbonamenti ──────────────────────────────────────────────────────────────

/** Crea o aggiorna un abbonamento. L'importo nuovo vale dai prossimi addebiti. */
export async function saveRecurring(db: FinanzeDB, recurring: Recurring): Promise<void> {
  if (recurring.name.trim() === '') throw new Error('Nome mancante');
  if (!Number.isInteger(recurring.amount) || recurring.amount <= 0) throw new Error('Importo non valido');
  if (!Number.isInteger(recurring.dayOfMonth) || recurring.dayOfMonth < 1 || recurring.dayOfMonth > 31) {
    throw new Error('Giorno non valido');
  }
  const freq = recurring.frequency ?? 1;
  if (![1, 2, 3, 6, 12].includes(freq)) throw new Error('Frequenza non valida');
  if (freq > 1 && !/^\d{4}-\d{2}$/.test(recurring.anchorMonth ?? '')) throw new Error('Mese del prossimo addebito mancante');
  const saving = freq > 1 && recurring.saving === true;
  if (saving && recurring.saveFrom && !/^\d{4}-\d{2}$/.test(recurring.saveFrom)) throw new Error('Mese di inizio non valido');
  if (!Number.isInteger(recurring.fund ?? 0)) throw new Error('Fondo non valido');
  const clean: Recurring = {
    ...recurring,
    name: recurring.name.trim(),
    frequency: freq,
    anchorMonth: freq > 1 ? recurring.anchorMonth : null,
    saving,
    saveFrom: saving ? recurring.saveFrom ?? null : null,
    fund: recurring.fund ?? 0,
  };
  await db.transaction('rw', [db.recurring, db.pots], async () => {
    const old = await db.recurring.get(clean.id);
    await db.recurring.put(clean);
    // "Già messo da parte" in più (popup R15): sono soldi che stanno nella Pocket Spese fisse.
    await adjustPot(db, 'bills', Math.max(0, (clean.fund ?? 0) - (old?.fund ?? 0)));
  });
}

/** Elimina un abbonamento. I movimenti già creati restano (e i suoi soldi restano nella Pocket). */
export async function deleteRecurring(db: FinanzeDB, id: string): Promise<void> {
  await db.recurring.delete(id);
}

// ── Prestiti e debiti (R9, R9-bis) ───────────────────────────────────────────

async function adjustPot(db: FinanzeDB, id: PotId, delta: Cents): Promise<void> {
  if (delta === 0) return;
  const pot = await db.pots.get(id);
  if (!pot) throw new Error(`Salvadanaio mancante: ${id}`);
  await db.pots.update(id, { balance: pot.balance + delta });
}

async function putLoans(db: FinanzeDB, loans: Loan[]): Promise<void> {
  if (loans.length > 0) await db.loans.bulkPut(loans);
}

export async function addPerson(db: FinanzeDB, name: string): Promise<Person> {
  const clean = name.trim();
  if (clean === '') throw new Error('Nome mancante');
  const person: Person = { id: newId(), name: clean, createdAt: nowISO() };
  await db.people.add(person);
  return person;
}

export interface LoanEntryInput {
  personId: string;
  /** 'lent' = presti tu, 'borrowed' = ti presta lei/lui (debito) */
  direction: LoanDirection;
  amount: Cents;
  date: ISODate;
  reason: string;
  card: Card | null;
  billId?: string | null;
  /** stesso createdAt per i movimenti nati da una bolletta */
  createdAt?: string;
}

/**
 * Registra un prestito o un debito: movimento, voce (con compensazione automatica sulle voci
 * opposte della stessa persona) e salvadanaio Risparmi, in un'unica transazione.
 */
export async function addLoanEntry(db: FinanzeDB, input: LoanEntryInput): Promise<Transaction> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Importo non valido');
  return db.transaction('rw', [db.periods, db.transactions, db.loans, db.pots, db.people], async () => {
    const period = await getCurrentPeriod(db);
    if (!period) throw new Error('Nessun periodo aperto: fai prima "Inizio del mese"');
    if (!(await db.people.get(input.personId))) throw new Error('Persona non trovata');
    const createdAt = input.createdAt ?? nowISO();
    const type = input.direction === 'lent' ? 'loan' : 'debt';
    const tx: Transaction = {
      id: newId(), periodId: period.id, date: input.date, type, amount: input.amount, envelopeId: null,
      note: input.reason.trim(), card: input.card, source: 'manual', recurringId: null, personId: input.personId,
      loanAllocations: null, billId: input.billId ?? null, createdAt,
    };
    const loans = await db.loans.where('personId').equals(input.personId).toArray();
    const { loan, updated } = createLoanEntry(loans, {
      id: newId(), personId: input.personId, direction: input.direction, date: input.date,
      reason: input.reason.trim(), amount: input.amount, transactionId: tx.id, createdAt,
    });
    await db.transactions.add(tx);
    await putLoans(db, [...updated, loan]);
    await adjustPot(db, 'savings', savingsEffect(type, input.amount));
    return tx;
  });
}

/** Si può eliminare il movimento di un prestito/debito? (nessuna restituzione o compensazione successiva) */
export async function canDeleteLoanTransaction(db: FinanzeDB, txId: string): Promise<boolean> {
  const loan = await db.loans.filter((l) => l.transactionId === txId).first();
  return loan ? canDeleteLoan(loan) : true;
}

/** Elimina un prestito o un debito: ripristina le voci compensate e il salvadanaio Risparmi. */
export async function deleteLoanTransaction(db: FinanzeDB, txId: string): Promise<void> {
  await db.transaction('rw', [db.transactions, db.loans, db.pots], async () => {
    const tx = await db.transactions.get(txId);
    if (!tx || (tx.type !== 'loan' && tx.type !== 'debt')) throw new Error('Movimento di prestito non trovato');
    const loan = await db.loans.filter((l) => l.transactionId === txId).first();
    if (loan) {
      const all = await db.loans.where('personId').equals(loan.personId).toArray();
      await putLoans(db, deleteLoanEntry(all, loan));
      await db.loans.delete(loan.id);
    }
    await db.transactions.delete(txId);
    await adjustPot(db, 'savings', -savingsEffect(tx.type, tx.amount));
  });
}

export interface RepaymentEntryResult {
  transaction: Transaction;
  closedCount: number;
}

/**
 * "Ti ha restituito" / "Le hai dato": restituzione nel senso del saldo, FIFO.
 * Salva le allocazioni sul movimento per poterla annullare.
 */
export async function registerRepayment(
  db: FinanzeDB,
  input: { personId: string; amount: Cents; date: ISODate },
): Promise<RepaymentEntryResult> {
  return db.transaction('rw', [db.periods, db.transactions, db.loans, db.pots], async () => {
    const period = await getCurrentPeriod(db);
    if (!period) throw new Error('Nessun periodo aperto');
    const createdAt = nowISO();
    const loans = await db.loans.where('personId').equals(input.personId).toArray();
    const r = applyRepayment(loans, input.personId, input.amount, createdAt);
    const type = r.direction === 'lent' ? 'loanRepayment' : 'debtRepayment';
    const tx: Transaction = {
      id: newId(), periodId: period.id, date: input.date, type, amount: input.amount, envelopeId: null, note: '',
      card: null, source: 'manual', recurringId: null, personId: input.personId,
      loanAllocations: r.allocations, billId: null, createdAt,
    };
    await db.transactions.add(tx);
    await putLoans(db, r.updated);
    await adjustPot(db, 'savings', savingsEffect(type, input.amount));
    return { transaction: tx, closedCount: r.closedCount };
  });
}

/** Annulla una restituzione: ripristina le voci e il salvadanaio, elimina il movimento. */
export async function undoRepaymentTransaction(db: FinanzeDB, txId: string): Promise<void> {
  await db.transaction('rw', [db.transactions, db.loans, db.pots], async () => {
    const tx = await db.transactions.get(txId);
    if (!tx || (tx.type !== 'loanRepayment' && tx.type !== 'debtRepayment')) throw new Error('Restituzione non trovata');
    const loans = await db.loans.toArray();
    await putLoans(db, undoLoanAllocations(loans, tx.loanAllocations ?? []));
    await db.transactions.delete(txId);
    await adjustPot(db, 'savings', -savingsEffect(tx.type, tx.amount));
  });
}

// ── Bollette (R13) ────────────────────────────────────────────────────────────

/** Crea o aggiorna una bolletta (il fondo accantonato resta quello che è). */
export async function saveBill(db: FinanzeDB, bill: Bill): Promise<void> {
  if (bill.name.trim() === '') throw new Error('Nome mancante');
  if (!Number.isInteger(bill.estimate) || bill.estimate <= 0) throw new Error('Importo previsto non valido');
  if (![1, 2, 3, 6, 12].includes(bill.frequency)) throw new Error('Frequenza non valida');
  if ((bill.split === 'half' || bill.payer === 'roommate') && !bill.personId) throw new Error('Manca la coinquilina');
  if (!Number.isInteger(bill.fund)) throw new Error('Fondo non valido');
  await db.transaction('rw', [db.bills, db.pots], async () => {
    const old = await db.bills.get(bill.id);
    await db.bills.put({ ...bill, name: bill.name.trim() });
    // "Già messo da parte" in più (popup R15): sono soldi che stanno nella Pocket Bollette.
    await adjustPot(db, 'bills', Math.max(0, bill.fund - (old?.fund ?? 0)));
  });
}

/** Elimina una bolletta. I movimenti già registrati e i soldi nella Pocket Bollette restano. */
export async function deleteBill(db: FinanzeDB, id: string): Promise<void> {
  await db.bills.delete(id);
}

export interface RegisterBillInput {
  billId: string;
  amount: Cents;
  date: ISODate;
  payer: Bill['payer'];
}

export interface RegisterBillResult {
  plan: BillPaymentPlan;
  transactionIds: string[];
}

/**
 * Registra una bolletta arrivata (tabella di R13), in un'unica transazione: la tua spesa
 * (nella busta o dal fondo), il prestito o il debito con la coinquilina (con compensazione),
 * il fondo della bolletta e il salvadanaio Bollette. Tutti i movimenti condividono createdAt
 * e billId, così si possono eliminare insieme.
 */
export async function registerBill(db: FinanzeDB, input: RegisterBillInput): Promise<RegisterBillResult> {
  return db.transaction('rw', [db.periods, db.transactions, db.loans, db.pots, db.people, db.bills], async () => {
    const bill = await db.bills.get(input.billId);
    if (!bill) throw new Error('Bolletta non trovata');
    const period = await getCurrentPeriod(db);
    if (!period) throw new Error('Nessun periodo aperto: fai prima "Inizio del mese"');
    const plan = planBillPayment(bill, input.amount, input.payer);
    if (plan.loan && !bill.personId) throw new Error('Manca la coinquilina');
    const createdAt = nowISO();
    const month = it.months.long[Number(input.date.slice(5, 7)) - 1] ?? '';

    const expense: Transaction = {
      id: newId(), periodId: period.id, date: input.date, type: 'expense', amount: plan.expense.amount,
      envelopeId: plan.expense.envelopeId, note: `${bill.name} · ${month}`,
      card: input.payer === 'me' ? 'extra' : null, source: 'manual', recurringId: null, personId: null,
      loanAllocations: null, billId: bill.id, createdAt,
    };
    await db.transactions.add(expense);
    const ids = [expense.id];

    if (plan.loan && bill.personId) {
      const reason = plan.loan.direction === 'lent' ? `${bill.name} · ${month}` : `${bill.name} · ${it.casa.yourHalf}`;
      const loanTx = await addLoanEntry(db, {
        personId: bill.personId, direction: plan.loan.direction, amount: plan.loan.amount, date: input.date,
        reason, card: input.payer === 'me' ? 'extra' : null, billId: bill.id, createdAt,
      });
      ids.push(loanTx.id);
    }
    // Le periodiche passano alla bolletta successiva: un ciclo dopo il periodo di questo pagamento.
    const nextDue = nextDueAfterPayment(bill, period.id);
    await db.bills.update(bill.id, { fund: bill.fund + plan.fundDelta, ...(nextDue ? { nextDue } : {}) });
    await adjustPot(db, 'bills', plan.potDeltas.bills ?? 0);
    return { plan, transactionIds: ids };
  });
}

/** Movimenti nati dalla stessa registrazione di una bolletta. */
export async function billPaymentSiblings(db: FinanzeDB, txId: string): Promise<Transaction[]> {
  const tx = await db.transactions.get(txId);
  if (!tx || !tx.billId) return tx ? [tx] : [];
  return db.transactions.where('billId').equals(tx.billId).filter((t) => t.createdAt === tx.createdAt).toArray();
}

/**
 * Elimina una registrazione di bolletta: spesa, prestito/debito (se non ancora restituito),
 * fondo e salvadanaio Bollette tornano come prima.
 */
export async function deleteBillPayment(db: FinanzeDB, txId: string): Promise<void> {
  await db.transaction('rw', [db.transactions, db.loans, db.pots, db.bills], async () => {
    const siblings = await billPaymentSiblings(db, txId);
    if (siblings.length === 0) throw new Error('Movimento non trovato');
    for (const t of siblings) {
      if ((t.type === 'loan' || t.type === 'debt') && !(await canDeleteLoanTransaction(db, t.id))) {
        throw new Error('La parte della coinquilina è già stata restituita: annulla prima le restituzioni');
      }
    }
    for (const t of siblings) {
      if (t.type === 'loan' || t.type === 'debt') {
        await deleteLoanTransaction(db, t.id);
      } else {
        if (t.type === 'expense' && t.envelopeId === null && t.billId) {
          const bill = await db.bills.get(t.billId);
          // La bolletta torna "da pagare": la scadenza torna indietro di un ciclo.
          const nextDue = bill && bill.frequency > 1 && bill.nextDue ? addMonthsId(bill.nextDue, -bill.frequency) : bill?.nextDue;
          if (bill) await db.bills.update(bill.id, { fund: bill.fund + t.amount, nextDue: nextDue ?? null });
          await adjustPot(db, 'bills', t.amount);
        }
        await db.transactions.delete(t.id);
      }
    }
  });
}

// ── Imposta (M7) ──────────────────────────────────────────────────────────────

export interface SaveEnvelopesInput {
  /** tetti nuovi delle buste esistenti */
  caps: Record<string, Cents>;
  /** buste nuove da creare (con il loro tetto) */
  added: Omit<Envelope, 'order' | 'archived'>[];
  /** buste da togliere: le usate si archiviano (restano nello storico), le mai usate si cancellano */
  removed?: string[];
  /** dove va il residuo di ogni busta tolta a mese aperto (default Risparmi) */
  destinations?: Record<string, FundsDestination>;
  /** simboli cambiati delle buste esistenti (id → nome icona) */
  icons?: Record<string, string>;
  periodStartDay: number;
}

/**
 * "Salva le buste": tetti, buste nuove e buste tolte valgono da questo mese. Se c'è un mese aperto,
 * aggiorna le sue allocazioni e il salvadanaio Risparmi (il giroconto lo fa l'utente su Revolut).
 */
export async function saveEnvelopes(db: FinanzeDB, input: SaveEnvelopesInput): Promise<CapsChange> {
  if (!Number.isInteger(input.periodStartDay) || input.periodStartDay < 1 || input.periodStartDay > 31) {
    throw new Error('Giorno di inizio non valido');
  }
  for (const cap of [...Object.values(input.caps), ...input.added.map((e) => e.cap)]) {
    if (!Number.isInteger(cap) || cap < 0) throw new Error('Tetto non valido');
  }
  const removedIds = input.removed ?? [];
  return db.transaction('rw', [db.envelopes, db.periods, db.pots, db.settings, db.transactions, db.recurring], async () => {
    const envelopes = await db.envelopes.orderBy('order').toArray();
    const recurring = await db.recurring.toArray();
    for (const id of removedIds) {
      if (recurringOnEnvelope(id, recurring).length > 0) throw new Error('La busta ha abbonamenti attivi');
    }
    let order = envelopes.reduce((m, e) => Math.max(m, e.order), 0);
    const newEnvelopes: Envelope[] = input.added.map((e) => ({ ...e, name: e.name.trim(), shortName: e.shortName.trim() || defaultShortName(e.name), order: ++order, archived: false }));
    const current = await getCurrentPeriod(db);
    const currentTxs = current ? await getPeriodTransactions(db, current.id) : [];
    const removed = current
      ? Object.fromEntries(removedIds.map((id) => [id, allocationAfterRemoval(id, current, currentTxs)]))
      : Object.fromEntries(removedIds.map((id) => [id, null]));
    const caps = { ...input.caps, ...Object.fromEntries(newEnvelopes.map((e) => [e.id, e.cap])) };
    for (const id of removedIds) delete caps[id];
    const change = planCapsChange([...envelopes, ...newEnvelopes], caps, current, removed, input.destinations ?? {});
    for (const [id, cap] of Object.entries(caps)) if (id in input.caps) await db.envelopes.update(id, { cap });
    for (const [id, icon] of Object.entries(input.icons ?? {})) if (!removedIds.includes(id)) await db.envelopes.update(id, { icon });
    if (newEnvelopes.length > 0) await db.envelopes.bulkAdd(newEnvelopes);
    if (removedIds.length > 0) {
      const periods = await db.periods.toArray();
      const allocationsNow = change.allocations;
      for (const id of removedIds) {
        // Il mese aperto conta con le allocazioni aggiornate: se la busta ci resta, è "usata".
        const periodsAfter = current && allocationsNow ? periods.map((p) => (p.id === current.id ? { ...p, allocations: allocationsNow } : p)) : periods;
        const used = envelopeInUse(id, periodsAfter, await db.transactions.where('envelopeId').equals(id).toArray(), recurring);
        if (used) await db.envelopes.update(id, { archived: true });
        else await db.envelopes.delete(id);
      }
      const settings = await getSettings(db);
      if (settings.lastEnvelopeId && removedIds.includes(settings.lastEnvelopeId)) {
        await db.settings.update('settings', { lastEnvelopeId: null });
      }
    }
    if (current && change.allocations) await db.periods.update(current.id, { allocations: change.allocations });
    await adjustPot(db, 'savings', change.savingsDelta);
    for (const m of change.moves) await moveFunds(db, m.to, m.amount);
    await db.settings.update('settings', { periodStartDay: input.periodStartDay });
    return change;
  });
}

/** Sposta soldi in un salvadanaio o, con UNASSIGNED, nel "da assegnare" del mese aperto. */
async function moveFunds(db: FinanzeDB, to: FundsDestination, amount: Cents): Promise<void> {
  if (amount === 0) return;
  if (to !== UNASSIGNED) return adjustPot(db, to, amount);
  const current = await getCurrentPeriod(db);
  if (!current) throw new Error('Nessun mese aperto');
  await db.periods.update(current.id, { unassigned: current.unassigned + amount });
}

/** Cancella una voce fissa dell'inizio del mese. Se è un salvadanaio, lo toglie e il saldo va dove sceglie l'utente. */
export async function deleteMonthlyItem(db: FinanzeDB, id: string, to: FundsDestination = DEFAULT_DESTINATION): Promise<PotRemoval | null> {
  return db.transaction('rw', [db.settings, db.pots, db.periods], async () => {
    const settings = await getSettings(db);
    const item = settings.monthlyItems.find((i) => i.id === id);
    if (!item) return null;
    await db.settings.update('settings', { monthlyItems: settings.monthlyItems.filter((i) => i.id !== id) });
    if (item.kind !== 'pot') return { amount: 0, to, item };
    const plan = planPotRemoval(id, await db.pots.toArray(), settings.monthlyItems, to);
    await db.pots.delete(id);
    await moveFunds(db, plan.to, plan.amount);
    return plan;
  });
}

/** Nuovo salvadanaio libero (una Pocket Revolut senza giroconto mensile), con il saldo che ha adesso. */
export async function addPot(db: FinanzeDB, name: string, balance: Cents, icon?: string): Promise<Pot> {
  const clean = name.trim();
  if (clean === '') throw new Error('Nome mancante');
  if (!Number.isInteger(balance)) throw new Error('Saldo non valido');
  const pot: Pot = { id: newId(), name: clean, balance, ...(icon ? { icon } : {}) };
  await db.pots.add(pot);
  return pot;
}

/** Rinomina un salvadanaio (e la voce fissa collegata, se c'è). */
export async function renamePot(db: FinanzeDB, id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (clean === '') throw new Error('Nome mancante');
  await db.transaction('rw', [db.settings, db.pots], async () => {
    await db.pots.update(id, { name: clean });
    const settings = await getSettings(db);
    if (settings.monthlyItems.some((i) => i.id === id)) {
      await db.settings.update('settings', { monthlyItems: settings.monthlyItems.map((i) => (i.id === id ? { ...i, name: clean } : i)) });
    }
  });
}

/** Cambia il simbolo di un salvadanaio (e della voce fissa collegata, se c'è). Si salva subito. */
export async function setPotIcon(db: FinanzeDB, id: string, icon: string): Promise<void> {
  await db.transaction('rw', [db.settings, db.pots], async () => {
    await db.pots.update(id, { icon });
    const settings = await getSettings(db);
    if (settings.monthlyItems.some((i) => i.id === id)) {
      await db.settings.update('settings', { monthlyItems: settings.monthlyItems.map((i) => (i.id === id ? { ...i, icon } : i)) });
    }
  });
}

/** Toglie un salvadanaio: il saldo va dove sceglie l'utente (default Risparmi), l'eventuale voce fissa sparisce. */
export async function removePot(db: FinanzeDB, id: string, to: FundsDestination = DEFAULT_DESTINATION): Promise<PotRemoval> {
  return db.transaction('rw', [db.settings, db.pots, db.periods], async () => {
    const settings = await getSettings(db);
    const plan = planPotRemoval(id, await db.pots.toArray(), settings.monthlyItems, to);
    await db.pots.delete(id);
    await moveFunds(db, plan.to, plan.amount);
    if (plan.item) await db.settings.update('settings', { monthlyItems: settings.monthlyItems.filter((i) => i.id !== id) });
    return plan;
  });
}

export async function setCardReserve(db: FinanzeDB, cardReserve: Cents | null): Promise<void> {
  if (cardReserve !== null && !Number.isInteger(cardReserve)) throw new Error('Riserva non valida');
  await db.settings.update('settings', { cardReserve });
}
