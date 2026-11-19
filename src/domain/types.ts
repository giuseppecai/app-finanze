// Entità del dominio (docs/03-modello-dati.md). Importi in centesimi interi, date 'YYYY-MM-DD'.

export type Cents = number;
export type ISODate = string;
/** 'YYYY-MM' del mese in cui il periodo finisce */
export type PeriodId = string;

export interface Settings {
  id: 'settings';
  periodStartDay: number;
  /** null finché non calibrata al primo confronto (R5) */
  cardReserve: Cents | null;
  giftsQuota: Cents;
  lastTravelQuota: Cents;
  lastEnvelopeId: string | null;
  onboardingDone: boolean;
}

export type EnvelopeKind = 'spendable' | 'committed';

export interface Envelope {
  id: string;
  name: string;
  shortName: string;
  kind: EnvelopeKind;
  cap: Cents;
  order: number;
  archived: boolean;
}

export type LeftoverChoice = 'toSavings' | 'carryOver' | 'half' | 'deficit';

export interface Period {
  id: PeriodId;
  name: string;
  calendarStart: ISODate;
  calendarEnd: ISODate;
  startedAt: ISODate;
  salary: Cents;
  allocations: Record<string, Cents>;
  carryIn: Record<string, Cents>;
  unassigned: Cents;
  travelQuota: Cents;
  giftsQuota: Cents;
  closedAt: string | null;
  leftoverChoice: LeftoverChoice | null;
  leftovers: Record<string, Cents> | null;
  /** giroconto → Bollette fatto a inizio periodo (R13, v2) */
  billsQuota: Cents;
}

export type TxType = 'expense' | 'refund' | 'income' | 'loan' | 'loanRepayment' | 'debt' | 'debtRepayment';
export type Card = 'quotidiano' | 'extra';
export type TxSource = 'manual' | 'recurring' | 'reconcile' | 'inbox';

export interface LoanAllocation {
  loanId: string;
  amount: Cents;
}

export interface Transaction {
  id: string;
  periodId: PeriodId;
  date: ISODate;
  type: TxType;
  /** sempre positivo; il segno lo dà il tipo */
  amount: Cents;
  envelopeId: string | null;
  note: string;
  card: Card | null;
  source: TxSource;
  recurringId: string | null;
  personId: string | null;
  loanAllocations: LoanAllocation[] | null;
  /** movimento nato da una bolletta (R13, v2) */
  billId: string | null;
  createdAt: string;
}

export interface Recurring {
  id: string;
  name: string;
  amount: Cents;
  dayOfMonth: number;
  envelopeId: string;
  card: Card;
  active: boolean;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  createdAt: string;
}

/** 'lent' = prestito (ti deve), 'borrowed' = debito (devi tu), R9-bis */
export type LoanDirection = 'lent' | 'borrowed';

export interface Loan {
  id: string;
  personId: string;
  direction: LoanDirection;
  date: ISODate;
  reason: string;
  amount: Cents;
  remaining: Cents;
  closedAt: string | null;
  transactionId: string;
  /** compensazioni fatte alla nascita di questa voce (R9-bis) */
  offsets: LoanAllocation[] | null;
  createdAt: string;
}

export type PotId = 'savings' | 'travel' | 'gifts' | 'bills';

export interface Pot {
  id: PotId;
  name: string;
  balance: Cents;
}

export type ReconciliationOutcome = 'ok' | 'calibrated' | 'missingExpense' | 'extraIncome' | 'ignored';

export interface Reconciliation {
  id: string;
  date: ISODate;
  periodId: PeriodId;
  budgetPocket: Cents;
  quotidiano: Cents;
  extra: Cents;
  expected: Cents;
  diff: Cents;
  outcome: ReconciliationOutcome;
}

export type BillFrequency = 1 | 2 | 3 | 6 | 12;

/** Bolletta di Casa & Servizi (R13, v2) */
export interface Bill {
  id: string;
  name: string;
  frequency: BillFrequency;
  /** importo previsto della bolletta intera */
  estimate: Cents;
  split: 'half' | 'mine';
  payer: 'me' | 'roommate';
  personId: string | null;
  envelopeId: string;
  /** accantonato finora (solo periodiche), può andare sotto zero */
  fund: Cents;
  active: boolean;
  order: number;
  createdAt: string;
}
