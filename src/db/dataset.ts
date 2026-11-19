// Scrittura di un intero insieme di dati (seed, demo, e in futuro l'import del backup).
import type { DataSet } from './fixtures';
import { allTables, type FinanzeDB } from './schema';

/** Sostituisce tutto il contenuto del database con `data`, in una sola transazione. */
export async function replaceAll(db: FinanzeDB, data: DataSet): Promise<void> {
  await db.transaction('rw', allTables(db), async () => {
    await Promise.all(allTables(db).map((t) => t.clear()));
    await db.settings.put(data.settings);
    await db.envelopes.bulkPut(data.envelopes);
    await db.periods.bulkPut(data.periods);
    await db.transactions.bulkPut(data.transactions);
    await db.recurring.bulkPut(data.recurring);
    await db.people.bulkPut(data.people);
    await db.loans.bulkPut(data.loans);
    await db.pots.bulkPut(data.pots);
    await db.reconciliations.bulkPut(data.reconciliations);
  });
}

/** Legge tutto il database (per il backup e per le verifiche). */
export async function readAll(db: FinanzeDB): Promise<DataSet> {
  return db.transaction('r', allTables(db), async () => {
    const settings = await db.settings.get('settings');
    if (!settings) throw new Error('Impostazioni mancanti');
    return {
      settings,
      envelopes: await db.envelopes.orderBy('order').toArray(),
      periods: await db.periods.toArray(),
      transactions: await db.transactions.toArray(),
      recurring: await db.recurring.toArray(),
      people: await db.people.toArray(),
      loans: await db.loans.toArray(),
      pots: await db.pots.toArray(),
      reconciliations: await db.reconciliations.toArray(),
    };
  });
}
