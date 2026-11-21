// Schema IndexedDB (docs/03-modello-dati.md). Ogni modifica futura = nuova version(n) con upgrade():
// non modificare mai una versione già rilasciata.
import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_MONTHLY_ITEMS } from '../domain/pots';
import type {
  Bill, Envelope, Loan, Period, Person, Pot, Reconciliation, Recurring, Settings, Transaction,
} from '../domain/types';

export const SCHEMA_VERSION = 3;

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
  // v3: voci fisse dell'inizio del mese (Viaggi, Regali, Affitto…) al posto delle quote Viaggi/Regali;
  // tutte le bollette, anche le mensili, si accantonano nella Pocket Bollette. Nessun indice nuovo.
  db.version(3)
    .stores({})
    .upgrade(async (tx) => {
      await tx.table('settings').toCollection().modify((s: Record<string, unknown>) => {
        Object.assign(s, migrateSettingsV3(s));
        delete s.giftsQuota;
        delete s.lastTravelQuota;
      });
      await tx.table('periods').toCollection().modify((p: Record<string, unknown>) => Object.assign(p, migratePeriodV3(p)));
      await tx.table('periods').toCollection().modify((p: Record<string, unknown>) => {
        delete p.travelQuota;
        delete p.giftsQuota;
      });
      await tx.table('bills').toCollection().modify((b: Record<string, unknown>) => {
        delete b.envelopeId;
      });
    });
  return db;
}

/** v2 → v3: le quote Viaggi e Regali diventano voci fisse (usato anche dall'import dei backup). */
export function migrateSettingsV3(s: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(s.monthlyItems)) return s;
  const amount = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) ? v : d);
  const [travel, gifts] = DEFAULT_MONTHLY_ITEMS;
  const { giftsQuota, lastTravelQuota, ...rest } = s;
  return {
    ...rest,
    monthlyItems: [
      { ...travel!, amount: amount(lastTravelQuota, travel!.amount) },
      { ...gifts!, amount: amount(giftsQuota, gifts!.amount) },
    ],
  };
}

export function migratePeriodV3(p: Record<string, unknown>): Record<string, unknown> {
  if (p.quotas && typeof p.quotas === 'object') return p;
  const { travelQuota, giftsQuota, ...rest } = p;
  return { ...rest, quotas: { travel: Number(travelQuota ?? 0), gifts: Number(giftsQuota ?? 0) } };
}

/** Tutte le tabelle, per transazioni che le toccano tutte (seed, demo, backup). */
export function allTables(db: FinanzeDB) {
  return [db.settings, db.envelopes, db.periods, db.transactions, db.recurring, db.people, db.loans, db.pots, db.reconciliations, db.bills];
}
