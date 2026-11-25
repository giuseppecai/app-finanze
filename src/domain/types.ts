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
  /** voci fisse dell'inizio del mese: salvadanai (Viaggi, Regali…) e uscite (Affitto), R7 · v3 */
  monthlyItems: MonthlyItem[];
  lastEnvelopeId: string | null;
  onboardingDone: boolean;
  /** data dell'ultimo backup esportato (promemoria dopo 30 giorni, M8) */
  lastBackupAt?: string | null;
  /** promemoria backup rimandato fino a questa data (esclusa) */
  backupSnoozedUntil?: ISODate | null;
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
  /** simbolo (nome icona Lucide, vedi domain/symbols.ts); assente = predefinito per nome */
  icon?: string;
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
  /** importi delle voci fisse usati a inizio periodo (id voce → importo), R7 · v3 */
  quotas: Record<string, Cents>;
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
  /** ogni quanti mesi si paga (assente = 1, ogni mese), R8 */
  frequency?: RecurringFrequency;
  /** non mensili: mese di calendario ('YYYY-MM') di un addebito, da cui si contano i cicli */
  anchorMonth?: string | null;
  /** non mensili: si accantona ogni mese nella Pocket Spese fisse (R15); assente/false = tutto nel giroconto del mese della scadenza */
  saving?: boolean;
  /** primo periodo in cui si accantona ('YYYY-MM'); null = da subito */
  saveFrom?: PeriodId | null;
  /** soldi di questo abbonamento nella Pocket Spese fisse (R16) */
  fund?: Cents;
  envelopeId: string;
  card: Card;
  active: boolean;
  createdAt: string;
}

export type RecurringFrequency = 1 | 2 | 3 | 6 | 12;

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

/** 'savings' e 'bills' fissi; gli altri sono gli id delle voci fisse di tipo salvadanaio ('travel', 'gifts', …) */
export type PotId = string;

/** Voce fissa dell'inizio del mese (R7): un salvadanaio da alimentare o un'uscita da pagare (es. affitto). */
export interface MonthlyItem {
  id: string;
  name: string;
  /** 'pot': va nel salvadanaio con lo stesso id (compare in Messi da parte); 'payment': esce (affitto) */
  kind: 'pot' | 'payment';
  /** importo proposto a inizio mese (l'ultimo usato) */
  amount: Cents;
  archived: boolean;
  /** simbolo (nome icona Lucide); per le voci-salvadanaio è lo stesso del salvadanaio */
  icon?: string;
}

export interface Pot {
  id: PotId;
  name: string;
  balance: Cents;
  /** simbolo (nome icona Lucide) */
  icon?: string;
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
  /** accantonato finora (solo periodiche), può andare sotto zero */
  fund: Cents;
  /** periodiche: periodo ('YYYY-MM') in cui arriva la prossima bolletta; null = non si sa (quota fissa) */
  nextDue?: PeriodId | null;
  /** periodiche: false = niente accantonamento, tutta la quota nel giroconto del mese in cui arriva (R15); assente = true */
  saving?: boolean;
  /** periodiche: primo periodo in cui si accantona; null = da subito */
  saveFrom?: PeriodId | null;
  active: boolean;
  order: number;
  createdAt: string;
}
