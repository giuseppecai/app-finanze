// R5 · Confronta con Revolut.
import type { Cents, ReconciliationOutcome } from './types';

export interface RevolutBalances {
  budgetPocket: Cents;
  quotidiano: Cents;
  extra: Cents;
}

export interface ReconcileResult {
  /** Su Revolut: Budget del mese + Quotidiano + Extra */
  real: Cents;
  /** Nell'app: Σ residui di tutte le buste + da assegnare + riserva carte */
  expected: Cents;
  /** reale − atteso */
  diff: Cents;
  outcome: Exclude<ReconciliationOutcome, 'ignored'>;
  /** Riserva carte da salvare (solo alla calibrazione), altrimenti quella attuale */
  cardReserve: Cents;
}

/**
 * `envelopesTotal` = Σ residui di tutte le buste, `unassigned` = da assegnare.
 * Con `cardReserve` null è il primo confronto: la differenza diventa la riserva delle carte.
 */
export function reconcile(
  balances: RevolutBalances,
  envelopesTotal: Cents,
  unassigned: Cents,
  cardReserve: Cents | null,
): ReconcileResult {
  const real = balances.budgetPocket + balances.quotidiano + balances.extra;
  const base = envelopesTotal + unassigned;
  if (cardReserve === null) {
    const reserve = real - base;
    return { real, expected: real, diff: 0, outcome: 'calibrated', cardReserve: reserve };
  }
  const expected = base + cardReserve;
  const diff = real - expected;
  const outcome = diff === 0 ? 'ok' : diff < 0 ? 'missingExpense' : 'extraIncome';
  return { real, expected, diff, outcome, cardReserve };
}
