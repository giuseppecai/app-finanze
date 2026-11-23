// Dati di esempio dei documenti (oggi = 2026-11-19, Novembre aperto, Giugno–Ottobre chiusi).
// Solo dati: niente Dexie, così li usano anche i test di dominio.
import { calendarPeriodById } from '../domain/periods';
import { withDefaultSymbol } from '../domain/symbols';
import type {
  Bill, Card, Cents, Envelope, Loan, Period, Person, Pot, Reconciliation, Recurring, Settings, Transaction,
} from '../domain/types';

export const DEMO_TODAY = '2026-11-19';
const START_DAY = 27;

export interface DataSet {
  settings: Settings;
  envelopes: Envelope[];
  periods: Period[];
  transactions: Transaction[];
  recurring: Recurring[];
  people: Person[];
  loans: Loan[];
  pots: Pot[];
  reconciliations: Reconciliation[];
  bills: Bill[];
}

const eur = (v: number): Cents => Math.round(v * 100);

export const ENV = {
  trasporti: 'env-trasporti',
  vita: 'env-vita',
  spesa: 'env-spesa',
  shopping: 'env-shopping',
  casa: 'env-casa',
  rate: 'env-rate',
} as const;

function demoEnvelopes(): Envelope[] {
  return [
    { id: ENV.trasporti, name: 'Trasporti', shortName: 'Trasporti', kind: 'spendable', cap: eur(100), order: 1, archived: false },
    { id: ENV.vita, name: 'Vita', shortName: 'Vita', kind: 'spendable', cap: eur(200), order: 2, archived: false },
    { id: ENV.spesa, name: 'Spesa alimentare', shortName: 'Spesa', kind: 'spendable', cap: eur(50), order: 3, archived: false },
    { id: ENV.shopping, name: 'Shopping', shortName: 'Shopping', kind: 'spendable', cap: eur(120), order: 4, archived: false },
    { id: ENV.casa, name: 'Casa & Servizi', shortName: 'Casa', kind: 'spendable', cap: eur(120), order: 5, archived: false },
    { id: ENV.rate, name: 'Rate & Abbonamenti', shortName: 'Rate', kind: 'committed', cap: eur(110), order: 6, archived: false },
  ];
}

const REC = { iphone: 'rec-iphone', spotify: 'rec-spotify', disney: 'rec-disney', prime: 'rec-prime', icloud: 'rec-icloud' } as const;

function demoRecurring(): Recurring[] {
  const r = (id: string, name: string, amount: number, dayOfMonth: number): Recurring => ({
    id, name, amount: eur(amount), dayOfMonth, envelopeId: ENV.rate, card: 'extra', active: true,
    createdAt: '2026-05-27T09:00:00.000Z',
  });
  return [
    r(REC.iphone, 'Rata iPhone', 70, 1),
    r(REC.spotify, 'Spotify', 8.5, 5),
    r(REC.disney, 'Disney+', 6, 12),
    r(REC.prime, 'Prime', 5, 15),
    r(REC.icloud, 'iCloud', 1, 24),
  ];
}

function caps(): Record<string, Cents> {
  return Object.fromEntries(demoEnvelopes().map((e) => [e.id, e.cap]));
}

/** Avanzi dello Storico (R11), in ordine Casa, Rate, Trasporti, Vita, Spesa, Shopping. */
const CLOSED: [string, number[]][] = [
  ['2026-06', [10, 0.5, 8, 20, -6, 15.5]],
  ['2026-07', [5, 0.5, -20, -30, -8, 21.5]],
  ['2026-08', [15, 0.5, -10, 5, -4, 5.5]],
  ['2026-09', [18, 0.5, 6, 25, -9, 19.5]],
  ['2026-10', [22, 0.5, 14, 31, -12, 40.5]],
];
const CLOSED_ORDER = [ENV.casa, ENV.rate, ENV.trasporti, ENV.vita, ENV.spesa, ENV.shopping];

function period(id: string, closed: number[] | null): Period {
  const cal = calendarPeriodById(id, START_DAY);
  return {
    ...cal,
    startedAt: cal.calendarStart,
    salary: eur(1500),
    allocations: caps(),
    carryIn: {},
    unassigned: 0,
    quotas: { travel: eur(50), gifts: eur(25) },
    closedAt: closed ? `${cal.calendarEnd}T19:00:00.000Z` : null,
    leftoverChoice: closed ? 'toSavings' : null,
    leftovers: closed ? Object.fromEntries(CLOSED_ORDER.map((envId, i) => [envId, eur(closed[i] ?? 0)])) : null,
    billsQuota: 0,
  };
}

function demoPeriods(): Period[] {
  return [...CLOSED.map(([id, av]) => period(id, av)), period('2026-11', null)];
}

type Row = [day: number, note: string, envelope: string | null, card: Card | null, amount: number, recurringId?: string];

/** Movimenti di Novembre (04-schermate.md § Movimenti), dal più recente. */
const NOVEMBER: Row[] = [
  [19, 'Pranzo con colleghi', ENV.vita, 'quotidiano', -22],
  [19, 'Conad', ENV.spesa, 'quotidiano', -24],
  [18, 'Aperitivo', ENV.vita, 'quotidiano', -24],
  [17, 'Interessi conto risparmio', null, null, 1.12],
  [16, 'Cinema', ENV.vita, 'quotidiano', -18],
  [15, 'Prime', ENV.rate, 'extra', -5, REC.prime],
  [15, 'Treno Roma – Capaccio', ENV.trasporti, 'quotidiano', -46],
  [14, 'Zalando', ENV.shopping, 'quotidiano', -45],
  [12, 'Cena fuori', ENV.vita, 'quotidiano', -42],
  [12, 'Disney+', ENV.rate, 'extra', -6, REC.disney],
  [10, 'Lampadine e prese', ENV.casa, 'extra', -38],
  [8, 'Carrefour', ENV.spesa, 'quotidiano', -34],
  [6, 'Detersivi e casa', ENV.casa, 'quotidiano', -25],
  [5, 'Caffè della settimana', ENV.vita, 'quotidiano', -25],
  [5, 'Spotify', ENV.rate, 'extra', -8.5, REC.spotify],
  [3, 'ATAC', ENV.trasporti, 'quotidiano', -16],
  [1, 'Rata iPhone', ENV.rate, 'extra', -70, REC.iphone],
];

const PEOPLE = { mamma: 'person-mamma', marco: 'person-marco', elisa: 'person-elisa' } as const;

function demoTransactions(): Transaction[] {
  const n = NOVEMBER.length;
  const txs: Transaction[] = NOVEMBER.map(([day, note, envelopeId, card, amount, recurringId], i) => {
    const date = `2026-11-${String(day).padStart(2, '0')}`;
    const income = amount > 0;
    return {
      id: `tx-nov-${String(n - i).padStart(2, '0')}`,
      periodId: '2026-11',
      date,
      type: income ? 'income' : 'expense',
      amount: eur(Math.abs(amount)),
      envelopeId,
      note,
      card,
      source: recurringId ? 'recurring' : income ? 'reconcile' : 'manual',
      recurringId: recurringId ?? null,
      personId: null,
      loanAllocations: null,
      billId: null,
      // createdAt crescente dal più vecchio al più recente
      createdAt: `${date}T${String(8 + ((n - i) % 12)).padStart(2, '0')}:00:00.000Z`,
    };
  });
  for (const loan of demoLoanRows()) {
    txs.push({
      id: loan.txId,
      periodId: loan.periodId,
      date: loan.date,
      type: 'loan',
      amount: eur(loan.amount),
      envelopeId: null,
      note: loan.reason,
      card: 'quotidiano',
      source: 'manual',
      recurringId: null,
      personId: loan.personId,
      loanAllocations: null,
      billId: null,
      createdAt: `${loan.date}T18:00:00.000Z`,
    });
  }
  return txs;
}

function demoLoanRows() {
  return [
    { id: 'loan-1', txId: 'tx-loan-1', personId: PEOPLE.mamma, date: '2026-10-23', periodId: '2026-10', reason: 'Monete Homescapes', amount: 10 },
    { id: 'loan-2', txId: 'tx-loan-2', personId: PEOPLE.mamma, date: '2026-10-26', periodId: '2026-10', reason: 'Monete Homescapes', amount: 10 },
    { id: 'loan-3', txId: 'tx-loan-3', personId: PEOPLE.mamma, date: '2026-10-27', periodId: '2026-11', reason: 'Monete Homescapes', amount: 20 },
    { id: 'loan-4', txId: 'tx-loan-4', personId: PEOPLE.marco, date: '2026-11-12', periodId: '2026-11', reason: 'Biglietto concerto', amount: 15 },
  ];
}

function demoLoans(): Loan[] {
  return demoLoanRows().map((l) => ({
    id: l.id,
    personId: l.personId,
    direction: 'lent' as const,
    date: l.date,
    reason: l.reason,
    amount: eur(l.amount),
    remaining: eur(l.amount),
    closedAt: null,
    transactionId: l.txId,
    offsets: null,
    createdAt: `${l.date}T18:00:00.000Z`,
  }));
}

export function buildDemoData(): DataSet {
  const data = buildDemoDataRaw();
  // Simboli predefiniti (v5) su buste, salvadanai e voci fisse.
  return {
    ...data,
    settings: { ...data.settings, monthlyItems: data.settings.monthlyItems.map(withDefaultSymbol) },
    envelopes: data.envelopes.map(withDefaultSymbol),
    pots: data.pots.map(withDefaultSymbol),
  };
}

function buildDemoDataRaw(): DataSet {
  return {
    settings: {
      id: 'settings',
      periodStartDay: START_DAY,
      cardReserve: eur(200),
      monthlyItems: [
        { id: 'travel', name: 'Viaggi', kind: 'pot', amount: eur(50), archived: false },
        { id: 'gifts', name: 'Regali & Imprevisti', kind: 'pot', amount: eur(25), archived: false },
        { id: 'rent', name: 'Affitto', kind: 'payment', amount: eur(400), archived: false },
      ],
      lastEnvelopeId: ENV.vita,
      onboardingDone: true,
      lastBackupAt: '2026-11-10T20:00:00.000Z',
      backupSnoozedUntil: null,
    },
    envelopes: demoEnvelopes(),
    periods: demoPeriods(),
    transactions: demoTransactions(),
    recurring: demoRecurring(),
    people: [
      { id: PEOPLE.mamma, name: 'Mamma', createdAt: '2026-10-23T18:00:00.000Z' },
      { id: PEOPLE.marco, name: 'Marco', createdAt: '2026-11-12T18:00:00.000Z' },
      { id: PEOPLE.elisa, name: 'Elisa', createdAt: '2026-06-01T09:00:00.000Z' },
    ],
    loans: demoLoans(),
    pots: [
      { id: 'savings', name: 'Risparmi', balance: eur(1240) },
      { id: 'travel', name: 'Viaggi', balance: eur(180) },
      { id: 'gifts', name: 'Regali & Imprevisti', balance: eur(75) },
      { id: 'bills', name: 'Bollette', balance: eur(134) },
    ],
    reconciliations: [
      {
        id: 'rec-2026-11-16', date: '2026-11-16', periodId: '2026-11',
        budgetPocket: eur(398.6), quotidiano: eur(100), extra: eur(43.12),
        expected: eur(541.72), diff: 0, outcome: 'ok',
      },
    ],
    bills: demoBills(),
  };
}

/** Le bollette di esempio di R13: luce e internet accantonate per questo mese, gas per 2 mesi (30), acqua per 5 (50). */
function demoBills(): Bill[] {
  const b = (id: string, name: string, frequency: Bill['frequency'], estimate: number, split: Bill['split'], payer: Bill['payer'], fund: number, order: number): Bill => ({
    id, name, frequency, estimate: eur(estimate), split, payer, personId: split === 'half' ? PEOPLE.elisa : null,
    fund: eur(fund), active: true, order, createdAt: '2026-06-01T09:00:00.000Z',
  });
  return [
    b('bill-luce', 'Luce', 1, 80, 'half', 'me', 40, 1),
    b('bill-internet', 'Internet', 1, 28, 'half', 'me', 14, 2),
    b('bill-gas', 'Gas', 2, 60, 'half', 'roommate', 30, 3),
    b('bill-acqua', 'Acqua', 12, 120, 'mine', 'me', 50, 4),
  ];
}
