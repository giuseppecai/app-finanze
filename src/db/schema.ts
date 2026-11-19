// Schema IndexedDB (docs/03-modello-dati.md). Ogni modifica futura = nuova version(n) con upgrade():
// non modificare mai una versione già rilasciata.
import Dexie, { type EntityTable } from 'dexie';
import type {
  Envelope, Loan, Period, Person, Pot, Reconciliation, Recurring, Settings, Transaction,
} from '../domain/types';

export const SCHEMA_VERSION = 1;

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
  return db;
}

/** Tutte le tabelle, per transazioni che le toccano tutte (seed, demo, backup). */
export function allTables(db: FinanzeDB) {
  return [db.settings, db.envelopes, db.periods, db.transactions, db.recurring, db.people, db.loans, db.pots, db.reconciliations];
}
