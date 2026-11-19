import { describe, expect, it } from 'vitest';
import {
  applyRepayment, balanceWith, canDeleteLoan, createLoanEntry, deleteLoanEntry, personBalances, savingsEffect,
  totalDebt, totalOwed, undoRepayment,
} from '../loans';
import type { Loan, LoanDirection } from '../types';

const ELISA = 'person-elisa';
const MARCO = 'person-marco';

function replace(loans: Loan[], updated: Loan[]): Loan[] {
  const byId = new Map(updated.map((l) => [l.id, l]));
  return loans.map((l) => byId.get(l.id) ?? l);
}

/** Aggiunge una voce con compensazione, come fa il repository. */
function add(loans: Loan[], id: string, direction: LoanDirection, date: string, amount: number, personId = ELISA): Loan[] {
  const { loan, updated } = createLoanEntry(loans, {
    id, personId, direction, date, reason: id, amount, transactionId: `tx-${id}`, createdAt: `${date}T10:00:00.000Z`,
  });
  return [...replace(loans, updated), loan];
}

describe('R9-bis · Esempio Elisa (novembre)', () => {
  let loans: Loan[] = [];
  loans = add(loans, 'luce', 'lent', '2026-11-01', 4000);
  const afterLuce = loans;
  loans = add(loans, 'internet', 'lent', '2026-11-03', 1400);
  const afterInternet = loans;
  loans = add(loans, 'gas', 'borrowed', '2026-11-10', 3000);
  const afterGas = loans;

  it('1 · luce: saldo +40', () => {
    expect(balanceWith(afterLuce, ELISA)).toBe(4000);
  });

  it('2 · internet: saldo +54', () => {
    expect(balanceWith(afterInternet, ELISA)).toBe(5400);
  });

  it('3 · gas da 30 compensato sul prestito più vecchio: luce resta 10, debito chiuso, saldo +24', () => {
    const gas = afterGas.find((l) => l.id === 'gas')!;
    expect(gas).toMatchObject({ remaining: 0, offsets: [{ loanId: 'luce', amount: 3000 }] });
    expect(gas.closedAt).not.toBeNull();
    expect(afterGas.find((l) => l.id === 'luce')!.remaining).toBe(1000);
    expect(balanceWith(afterGas, ELISA)).toBe(2400);
    expect(totalDebt(afterGas)).toBe(0);
  });

  it('4 · Elisa ti dà 24 → saldo 0; annulla → +24', () => {
    const r = applyRepayment(afterGas, ELISA, 2400, '2026-11-20T10:00:00.000Z');
    expect(r.direction).toBe('lent');
    expect(r.allocations).toEqual([{ loanId: 'luce', amount: 1000 }, { loanId: 'internet', amount: 1400 }]);
    const paid = replace(afterGas, r.updated);
    expect(balanceWith(paid, ELISA)).toBe(0);
    expect(personBalances(paid)).toEqual([]);
    const undone = replace(paid, undoRepayment(paid, r.allocations));
    expect(balanceWith(undone, ELISA)).toBe(2400);
  });

  it('eliminando il gas la luce torna a 40 e il saldo a +54', () => {
    const gas = afterGas.find((l) => l.id === 'gas')!;
    expect(canDeleteLoan(gas)).toBe(true);
    const restored = replace(afterGas.filter((l) => l.id !== 'gas'), deleteLoanEntry(afterGas, gas));
    expect(restored.find((l) => l.id === 'luce')!.remaining).toBe(4000);
    expect(balanceWith(restored, ELISA)).toBe(5400);
  });

  it('Risparmi: −40 −14 +30 +24 = 0', () => {
    expect(savingsEffect('loan', 4000) + savingsEffect('loan', 1400) + savingsEffect('debt', 3000) + savingsEffect('loanRepayment', 2400)).toBe(0);
  });
});

describe('R9-bis · Debiti', () => {
  it('debito senza prestiti aperti: saldo negativo, "Devi € 30"', () => {
    const loans = add([], 'gas', 'borrowed', '2026-11-10', 3000);
    expect(balanceWith(loans, ELISA)).toBe(-3000);
    expect(personBalances(loans)).toMatchObject([{ personId: ELISA, balance: -3000 }]);
    expect(totalOwed(loans)).toBe(0);
    expect(totalDebt(loans)).toBe(3000);
  });

  it('debito più grande dei prestiti: chiude i prestiti e resta un debito', () => {
    let loans = add([], 'luce', 'lent', '2026-11-01', 1000);
    loans = add(loans, 'gas', 'borrowed', '2026-11-10', 3000);
    expect(loans.find((l) => l.id === 'luce')).toMatchObject({ remaining: 0 });
    expect(loans.find((l) => l.id === 'gas')).toMatchObject({ remaining: 2000, closedAt: null });
    expect(balanceWith(loans, ELISA)).toBe(-2000);
  });

  it('paghi il debito: "Le hai dato" chiude i debiti FIFO', () => {
    let loans = add([], 'gas', 'borrowed', '2026-11-10', 3000);
    loans = add(loans, 'spesa', 'borrowed', '2026-11-12', 1000);
    const r = applyRepayment(loans, ELISA, 3500, 'x');
    expect(r.direction).toBe('borrowed');
    expect(r.allocations).toEqual([{ loanId: 'gas', amount: 3000 }, { loanId: 'spesa', amount: 500 }]);
    expect(balanceWith(replace(loans, r.updated), ELISA)).toBe(-500);
    expect(savingsEffect('debtRepayment', 3500)).toBe(-3500);
  });

  it('non si restituisce più del saldo', () => {
    const loans = add([], 'gas', 'borrowed', '2026-11-10', 3000);
    expect(() => applyRepayment(loans, ELISA, 3001, 'x')).toThrow();
  });

  it('le persone non si compensano tra loro', () => {
    let loans = add([], 'a', 'lent', '2026-11-01', 1000, MARCO);
    loans = add(loans, 'b', 'borrowed', '2026-11-02', 500, ELISA);
    expect(balanceWith(loans, MARCO)).toBe(1000);
    expect(balanceWith(loans, ELISA)).toBe(-500);
    expect(personBalances(loans).map((p) => p.personId)).toEqual([MARCO, ELISA]);
  });

  it('una voce già restituita in parte non si elimina', () => {
    let loans = add([], 'luce', 'lent', '2026-11-01', 4000);
    const r = applyRepayment(loans, ELISA, 1000, 'x');
    loans = replace(loans, r.updated);
    expect(canDeleteLoan(loans[0]!)).toBe(false);
    expect(() => deleteLoanEntry(loans, loans[0]!)).toThrow();
  });
});
