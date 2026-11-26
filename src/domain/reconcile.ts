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

/** Le Pocket nel Confronta: per ognuna il saldo ricopiato da Revolut e quello che risulta nell'app. */
export interface PotsComparison {
  revolut: Cents;
  app: Cents;
}

/**
 * `envelopesTotal` = Σ residui di tutte le buste, `unassigned` = da assegnare, `pots` = Σ delle Pocket
 * (tutte quelle di "Messi da parte": Revolut contro app). Si confronta il totale di tutto Revolut con
 * il totale dell'app. Con `cardReserve` null è il primo confronto: la differenza diventa la riserva delle carte.
 */
export function reconcile(
  balances: RevolutBalances,
  envelopesTotal: Cents,
  unassigned: Cents,
  cardReserve: Cents | null,
  pots: PotsComparison = { revolut: 0, app: 0 },
): ReconcileResult {
  const real = balances.budgetPocket + balances.quotidiano + balances.extra + pots.revolut;
  const base = envelopesTotal + unassigned + pots.app;
  if (cardReserve === null) {
    const reserve = real - base;
    return { real, expected: real, diff: 0, outcome: 'calibrated', cardReserve: reserve };
  }
  const expected = base + cardReserve;
  const diff = real - expected;
  const outcome = diff === 0 ? 'ok' : diff < 0 ? 'missingExpense' : 'extraIncome';
  return { real, expected, diff, outcome, cardReserve };
}
