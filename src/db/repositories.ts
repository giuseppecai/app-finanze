// Funzioni che leggono e scrivono il database. Ogni scrittura su più tabelle è in una transazione.
// Le scritture di chiusura, inizio mese, confronto e prestiti arrivano con le rispettive schermate (M3–M6).
import { nowISO } from '../domain/clock';
import { currentPeriod } from '../domain/periods';
import { chargeToTransaction, dueCharges } from '../domain/recurring';
import type { ISODate, Period, Settings, Transaction } from '../domain/types';
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
