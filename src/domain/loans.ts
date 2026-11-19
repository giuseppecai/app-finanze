// R9 · Prestiti con restituzione FIFO. R9-bis · Debiti, saldo unico per persona, compensazione.
import type { Cents, ISODate, Loan, LoanAllocation, LoanDirection } from './types';

export function isOpen(loan: Loan): boolean {
  return loan.closedAt === null && loan.remaining > 0;
}

function byAge(a: Loan, b: Loan): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** Voci aperte di una persona in un senso, dalla più vecchia (data, poi createdAt). */
export function openLoansOf(loans: readonly Loan[], personId: string, direction: LoanDirection = 'lent'): Loan[] {
  return loans.filter((l) => l.personId === personId && l.direction === direction && isOpen(l)).sort(byAge);
}

/** Quanto ti deve una persona (Σ remaining dei suoi prestiti aperti). */
export function owedBy(loans: readonly Loan[], personId: string): Cents {
  return openLoansOf(loans, personId, 'lent').reduce((s, l) => s + l.remaining, 0);
}

/** Quanto devi tu a una persona (Σ remaining dei debiti aperti). */
export function owedTo(loans: readonly Loan[], personId: string): Cents {
  return openLoansOf(loans, personId, 'borrowed').reduce((s, l) => s + l.remaining, 0);
}

/** Saldo con una persona: positivo = ti deve, negativo = devi tu. */
export function balanceWith(loans: readonly Loan[], personId: string): Cents {
  return owedBy(loans, personId) - owedTo(loans, personId);
}

/** Totale da riavere (Σ prestiti aperti). */
export function totalOwed(loans: readonly Loan[]): Cents {
  return loans.reduce((s, l) => (isOpen(l) && l.direction === 'lent' ? s + l.remaining : s), 0);
}

/** Totale che devi (Σ debiti aperti). */
export function totalDebt(loans: readonly Loan[]): Cents {
  return loans.reduce((s, l) => (isOpen(l) && l.direction === 'borrowed' ? s + l.remaining : s), 0);
}

export interface PersonBalance {
  personId: string;
  /** positivo = ti deve, negativo = devi tu */
  balance: Cents;
  /** voci aperte nel senso del saldo, dalla più vecchia */
  openLoans: Loan[];
}

/** Persone con saldo diverso da zero: prima chi ti deve (di più in alto), poi a chi devi. */
export function personBalances(loans: readonly Loan[]): PersonBalance[] {
  const ids = [...new Set(loans.filter(isOpen).map((l) => l.personId))];
  return ids
    .map((personId) => {
      const balance = balanceWith(loans, personId);
      return { personId, balance, openLoans: openLoansOf(loans, personId, balance >= 0 ? 'lent' : 'borrowed') };
    })
    .filter((p) => p.balance !== 0)
    .sort((a, b) => (a.balance > 0) !== (b.balance > 0) ? (a.balance > 0 ? -1 : 1) : Math.abs(b.balance) - Math.abs(a.balance));
}

/** "Chi ti deve": solo i saldi positivi (compatibile con R9). */
export function debtors(loans: readonly Loan[]): { personId: string; owed: Cents; openLoans: Loan[] }[] {
  return personBalances(loans)
    .filter((p) => p.balance > 0)
    .map((p) => ({ personId: p.personId, owed: p.balance, openLoans: p.openLoans }));
}

/** Copre `amount` sulle voci date (già in ordine FIFO). */
function coverFifo(open: readonly Loan[], amount: Cents, closedAt: string) {
  let left = amount;
  const allocations: LoanAllocation[] = [];
  const updated: Loan[] = [];
  let closedCount = 0;
  for (const loan of open) {
    if (left === 0) break;
    const covered = Math.min(left, loan.remaining);
    left -= covered;
    const remaining = loan.remaining - covered;
    allocations.push({ loanId: loan.id, amount: covered });
    if (remaining === 0) closedCount++;
    updated.push({ ...loan, remaining, closedAt: remaining === 0 ? closedAt : null });
  }
  return { allocations, updated, closedCount, left };
}

export interface RepaymentResult {
  /** 'lent' = la persona ti ha restituito; 'borrowed' = hai pagato il tuo debito */
  direction: LoanDirection;
  allocations: LoanAllocation[];
  /** voci modificate (remaining ridotto, closedAt impostato se chiuse) */
  updated: Loan[];
  closedCount: number;
}

/**
 * Restituzione di `amount` nel senso del saldo: se la persona ti deve, chiude i suoi prestiti;
 * se devi tu, chiude i tuoi debiti. Sempre dal più vecchio; massimo = saldo.
 */
export function applyRepayment(loans: readonly Loan[], personId: string, amount: Cents, closedAt: string): RepaymentResult {
  const balance = balanceWith(loans, personId);
  const direction: LoanDirection = balance >= 0 ? 'lent' : 'borrowed';
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('La restituzione deve essere maggiore di zero');
  if (amount > Math.abs(balance)) throw new Error('La restituzione supera il saldo');
  const { allocations, updated, closedCount } = coverFifo(openLoansOf(loans, personId, direction), amount, closedAt);
  return { direction, allocations, updated, closedCount };
}

/** Annulla una restituzione (o una compensazione): ripristina i remaining e riapre le voci. */
export function undoRepayment(loans: readonly Loan[], allocations: readonly LoanAllocation[]): Loan[] {
  const byId = new Map(loans.map((l) => [l.id, l]));
  return allocations.map(({ loanId, amount }) => {
    const loan = byId.get(loanId);
    if (!loan) throw new Error(`Prestito non trovato: ${loanId}`);
    return { ...loan, remaining: loan.remaining + amount, closedAt: null };
  });
}

export interface NewLoanInput {
  id: string;
  personId: string;
  direction: LoanDirection;
  date: ISODate;
  reason: string;
  amount: Cents;
  transactionId: string;
  createdAt: string;
}

export interface NewLoanResult {
  /** la voce nuova, già ridotta dalla compensazione (chiusa se compensata del tutto) */
  loan: Loan;
  /** voci del senso opposto ridotte o chiuse dalla compensazione */
  updated: Loan[];
}

/**
 * Crea un prestito o un debito. Se con quella persona ci sono voci aperte nel senso opposto,
 * le compensa subito dal più vecchio: per ogni persona resta aperto un solo senso.
 */
export function createLoanEntry(loans: readonly Loan[], input: NewLoanInput): NewLoanResult {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Importo non valido');
  const opposite: LoanDirection = input.direction === 'lent' ? 'borrowed' : 'lent';
  const { allocations, updated, left } = coverFifo(openLoansOf(loans, input.personId, opposite), input.amount, input.createdAt);
  const loan: Loan = {
    id: input.id,
    personId: input.personId,
    direction: input.direction,
    date: input.date,
    reason: input.reason,
    amount: input.amount,
    remaining: left,
    closedAt: left === 0 ? input.createdAt : null,
    transactionId: input.transactionId,
    offsets: allocations.length > 0 ? allocations : null,
    createdAt: input.createdAt,
  };
  return { loan, updated };
}

/**
 * Una voce si può eliminare solo se nessuno l'ha ancora toccata dopo la nascita
 * (né restituzioni né compensazioni successive): remaining = importo − sue compensazioni.
 */
export function canDeleteLoan(loan: Loan): boolean {
  const offset = (loan.offsets ?? []).reduce((s, a) => s + a.amount, 0);
  return loan.remaining === loan.amount - offset;
}

/** Eliminare una voce: le voci compensate tornano come prima. Restituisce quelle da ripristinare. */
export function deleteLoanEntry(loans: readonly Loan[], loan: Loan): Loan[] {
  if (!canDeleteLoan(loan)) throw new Error('Questa voce è già stata restituita in parte: annulla prima le restituzioni');
  return undoRepayment(loans, loan.offsets ?? []);
}

/** Effetto sul salvadanaio Risparmi di un movimento di prestito (R4). */
export function savingsEffect(type: 'loan' | 'debt' | 'loanRepayment' | 'debtRepayment', amount: Cents): Cents {
  return type === 'loan' || type === 'debtRepayment' ? -amount : amount;
}
