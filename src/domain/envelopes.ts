// R3 · Residuo delle buste, "Puoi ancora spendere", colore delle barre.
import type { Cents, Envelope, EnvelopeKind, Period, Transaction } from './types';

export interface EnvelopeBalance {
  envelope: Envelope;
  /** tetto fotografato all'inizio del periodo */
  allocated: Cents;
  /** avanzo portato dal mese prima (solo opzione "Lascia nel Budget del mese"), anche negativo */
  carryIn: Cents;
  /** messo = assegnato + riportato */
  put: Cents;
  /** spese − rimborsi */
  spent: Cents;
  /** residuo = messo − speso */
  remaining: Cents;
}

export type BarState = 'over' | 'low' | 'committed' | 'ok';

type PeriodAmounts = Pick<Period, 'allocations' | 'carryIn' | 'unassigned'>;

/** Spese − rimborsi di una busta tra i movimenti dati. */
export function netSpent(envelopeId: string, txs: readonly Transaction[]): Cents {
  let spent = 0;
  for (const tx of txs) {
    if (tx.envelopeId !== envelopeId) continue;
    if (tx.type === 'expense') spent += tx.amount;
    else if (tx.type === 'refund') spent -= tx.amount;
  }
  return spent;
}

/** Buste visibili nel periodo: quelle con un tetto fotografato e quelle non archiviate, in ordine. */
export function envelopesForPeriod(envelopes: readonly Envelope[], period: Pick<Period, 'allocations' | 'carryIn'>): Envelope[] {
  return envelopes
    .filter((e) => !e.archived || e.id in period.allocations || e.id in period.carryIn)
    .slice()
    .sort((a, b) => a.order - b.order);
}

/** residuo(busta) = assegnato + riportato − Σ spese + Σ rimborsi. `txs` = movimenti del periodo. */
export function envelopeBalances(
  envelopes: readonly Envelope[],
  period: PeriodAmounts,
  txs: readonly Transaction[],
): EnvelopeBalance[] {
  return envelopesForPeriod(envelopes, period).map((envelope) => {
    const allocated = period.allocations[envelope.id] ?? 0;
    const carryIn = period.carryIn[envelope.id] ?? 0;
    const put = allocated + carryIn;
    const spent = netSpent(envelope.id, txs);
    return { envelope, allocated, carryIn, put, spent, remaining: put - spent };
  });
}

/** "Da assegnare": quota iniziale del periodo (opzione Metà e metà) + entrate registrate. */
export function unassignedAmount(period: PeriodAmounts, txs: readonly Transaction[]): Cents {
  return txs.reduce((sum, tx) => (tx.type === 'income' ? sum + tx.amount : sum), period.unassigned);
}

function sumRemaining(balances: readonly EnvelopeBalance[], kind?: EnvelopeKind): Cents {
  return balances.reduce((s, b) => (kind && b.envelope.kind !== kind ? s : s + b.remaining), 0);
}

export interface PeriodSummary {
  balances: EnvelopeBalance[];
  unassigned: Cents;
  /** Puoi ancora spendere = Σ residui delle buste da spendere + da assegnare (i negativi riducono) */
  spendable: Cents;
  /** Impegnate · rimasti */
  committedRemaining: Cents;
  /** Σ residui di tutte le buste */
  envelopesTotal: Cents;
}

export function summarizePeriod(
  envelopes: readonly Envelope[],
  period: PeriodAmounts,
  txs: readonly Transaction[],
): PeriodSummary {
  const balances = envelopeBalances(envelopes, period, txs);
  const unassigned = unassignedAmount(period, txs);
  return {
    balances,
    unassigned,
    spendable: sumRemaining(balances, 'spendable') + unassigned,
    committedRemaining: sumRemaining(balances, 'committed'),
    envelopesTotal: sumRemaining(balances),
  };
}

/**
 * Colore della barra. Sforata → arancione; impegnata → grigio (si scala da sola, l'ambra
 * sarebbe quasi sempre accesa); sotto il 20% di quanto messo → ambra; altrimenti accento.
 */
export function barState(balance: Pick<EnvelopeBalance, 'remaining' | 'put'> & { envelope: Pick<Envelope, 'kind'> }): BarState {
  if (balance.remaining < 0) return 'over';
  if (balance.envelope.kind === 'committed') return 'committed';
  if (balance.put > 0 && balance.remaining * 5 < balance.put) return 'low';
  if (balance.put <= 0) return 'low';
  return 'ok';
}

/** Larghezza della barra: speso / messo, tra 0 e 1. */
export function barFill(balance: Pick<EnvelopeBalance, 'spent' | 'put'>): number {
  if (balance.spent <= 0) return 0;
  if (balance.put <= 0) return 1;
  return Math.min(1, balance.spent / balance.put);
}
