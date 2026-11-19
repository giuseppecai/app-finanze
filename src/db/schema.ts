// Schema IndexedDB (docs/03-modello-dati.md). Ogni modifica futura = nuova version(n) con upgrade():
// non modificare mai una versione già rilasciata.
import Dexie, { type EntityTable } from 'dexie';
import type {
  Bill, Envelope, Loan, Period, Person, Pot, Reconciliation, Recurring, Settings, Transaction,
} from '../domain/types';

export const SCHEMA_VERSION = 2;

export type FinanzeDB = Dexie & {
  settings: EntityTable<Settings, 'id'>;
  envelopes: EntityTable<Envelope, 'id'>;
  periods: EntityTable<Period, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  recurring: EntityTable<Recurring, 'id'>;
  people: EntityTable<Person, 'id'>;
  loans: EntityTable<Loan, 'id'>;
  pots: EntityTable<Pot, 'id'>;
  reconciliations: EntityTable<Reconciliation, 'id'>;
  bills: EntityTable<Bill, 'id'>;
};

export function openDatabase(name: string): FinanzeDB {
  const db = new Dexie(name) as FinanzeDB;
  db.version(1).stores({
    settings: 'id',
    envelopes: 'id, order',
    periods: 'id, closedAt',
    transactions: 'id, periodId, date, envelopeId, type, personId, [recurringId+periodId]',
    recurring: 'id',
    people: 'id',
    loans: 'id, personId, closedAt, date',
    pots: 'id',
    reconciliations: 'id, date',
  });
  // v2 (M6 · debiti, M6b · bollette): prestiti nei due sensi, bollette, salvadanaio Bollette.
  db.version(2)
    .stores({
      loans: 'id, personId, closedAt, date, direction',
      transactions: 'id, periodId, date, envelopeId, type, personId, billId, [recurringId+periodId]',
      bills: 'id, order',
    })
    .upgrade(async (tx) => {
      await tx.table('loans').toCollection().modify((l: Partial<Loan>) => {
        l.direction ??= 'lent';
        l.offsets ??= null;
      });
      await tx.table('transactions').toCollection().modify((t: Partial<Transaction>) => {
        t.billId ??= null;
      });
      await tx.table('periods').toCollection().modify((p: Partial<Period>) => {
        p.billsQuota ??= 0;
      });
      const pots = tx.table('pots');
      if (!(await pots.get('bills'))) await pots.add({ id: 'bills', name: 'Bollette', balance: 0 });
    });
  return db;
}

/** Tutte le tabelle, per transazioni che le toccano tutte (seed, demo, backup). */
export function allTables(db: FinanzeDB) {
  return [db.settings, db.envelopes, db.periods, db.transactions, db.recurring, db.people, db.loans, db.pots, db.reconciliations, db.bills];
}
