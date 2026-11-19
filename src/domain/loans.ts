// R9 · Prestiti con restituzione FIFO.
import type { Cents, Loan, LoanAllocation } from './types';

export function isOpen(loan: Loan): boolean {
  return loan.closedAt === null && loan.remaining > 0;
}

/** Prestiti aperti di una persona, dal più vecchio (data, poi createdAt). */
export function openLoansOf(loans: readonly Loan[], personId: string): Loan[] {
  return loans
    .filter((l) => l.personId === personId && isOpen(l))
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/** Totale che una persona deve = Σ remaining dei suoi prestiti aperti. */
export function owedBy(loans: readonly Loan[], personId: string): Cents {
  return openLoansOf(loans, personId).reduce((s, l) => s + l.remaining, 0);
}

/** Totale generale da riavere. */
export function totalOwed(loans: readonly Loan[]): Cents {
  return loans.reduce((s, l) => (isOpen(l) ? s + l.remaining : s), 0);
}

export interface DebtorSummary {
  personId: string;
  owed: Cents;
  openLoans: Loan[];
}

/** "Chi ti deve": persone con totale > 0, chi deve di più per primo. */
export function debtors(loans: readonly Loan[]): DebtorSummary[] {
  const ids = [...new Set(loans.filter(isOpen).map((l) => l.personId))];
  return ids
    .map((personId) => ({ personId, owed: owedBy(loans, personId), openLoans: openLoansOf(loans, personId) }))
    .filter((d) => d.owed > 0)
    .sort((a, b) => b.owed - a.owed);
}

export interface RepaymentResult {
  allocations: LoanAllocation[];
  /** prestiti modificati (remaining ridotto, closedAt impostato se chiusi) */
  updated: Loan[];
  closedCount: number;
}

/**
 * Restituzione di `amount` da una persona: copre i prestiti aperti dal più vecchio.
 * Ogni prestito coperto per intero si chiude; l'ultimo coperto in parte riduce il remaining.
 */
export function applyRepayment(loans: readonly Loan[], personId: string, amount: Cents, closedAt: string): RepaymentResult {
  const open = openLoansOf(loans, personId);
  const owed = open.reduce((s, l) => s + l.remaining, 0);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('La restituzione deve essere maggiore di zero');
  if (amount > owed) throw new Error('La restituzione supera quanto dovuto');

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
  return { allocations, updated, closedCount };
}

/** Annulla una restituzione: ripristina i remaining e riapre i prestiti chiusi da quella restituzione. */
export function undoRepayment(loans: readonly Loan[], allocations: readonly LoanAllocation[]): Loan[] {
  const byId = new Map(loans.map((l) => [l.id, l]));
  return allocations.map(({ loanId, amount }) => {
    const loan = byId.get(loanId);
    if (!loan) throw new Error(`Prestito non trovato: ${loanId}`);
    return { ...loan, remaining: loan.remaining + amount, closedAt: null };
  });
}
