// R10 · Spesa media, R11 · Storico, R6 · Suggerimento tetto.
import type { EnvelopeBalance } from './envelopes';
import type { Cents, Envelope, Period } from './types';

type ClosedPeriod = Pick<Period, 'id' | 'allocations' | 'carryIn' | 'leftovers' | 'closedAt'>;

/** Periodi chiusi, dal più recente. */
export function closedPeriodsRecentFirst<P extends ClosedPeriod>(periods: readonly P[]): P[] {
  return periods.filter((p) => p.closedAt !== null && p.leftovers !== null).sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** messo = assegnato + riportato */
export function putIn(period: Pick<Period, 'allocations' | 'carryIn'>, envelopeId: string): Cents {
  return (period.allocations[envelopeId] ?? 0) + (period.carryIn[envelopeId] ?? 0);
}

/** Speso netto (spese − rimborsi) di una busta in un periodo chiuso, dalla fotografia degli avanzi. */
export function spentInClosed(period: ClosedPeriod, envelopeId: string): Cents | null {
  if (!period.leftovers || !(envelopeId in period.leftovers)) return null;
  return putIn(period, envelopeId) - (period.leftovers[envelopeId] ?? 0);
}

/** Arrotonda all'euro (centesimi → centesimi multipli di 100). */
export function roundToEuro(cents: Cents): Cents {
  return Math.round(cents / 100) * 100;
}

/** Arrotonda per eccesso ai 5 €. */
export function ceilToFiveEuro(cents: Cents): Cents {
  return Math.ceil(cents / 500) * 500;
}

export interface AverageSpending {
  /** media arrotondata all'euro */
  average: Cents;
  periods: number;
  aboveCap: boolean;
}

/**
 * R10 · Spesa media netta della busta negli ultimi 6 periodi chiusi (meno se non ce ne sono).
 * null se non c'è ancora nessun periodo chiuso con quella busta.
 */
export function averageSpending(envelope: Pick<Envelope, 'id' | 'cap'>, periods: readonly ClosedPeriod[], window = 6): AverageSpending | null {
  const spent = closedPeriodsRecentFirst(periods)
    .map((p) => spentInClosed(p, envelope.id))
    .filter((v): v is Cents => v !== null)
    .slice(0, window);
  if (spent.length === 0) return null;
  const average = roundToEuro(spent.reduce((s, v) => s + v, 0) / spent.length);
  return { average, periods: spent.length, aboveCap: average > envelope.cap };
}

export interface CapSuggestion {
  envelopeId: string;
  /** mesi sforati */
  overMonths: number;
  /** mesi considerati */
  months: number;
  /** sforo medio sui mesi sforati (in centesimi, la UI lo arrotonda all'euro) */
  averageOver: Cents;
  /** spesa media dei mesi considerati */
  averageSpent: Cents;
  /** tetto suggerito = spesa media arrotondata per eccesso ai 5 € */
  suggestedCap: Cents;
}

/**
 * R6 · Una busta da spendere sotto zero in almeno 3 degli ultimi 5 periodi chiusi
 * genera "‹Busta› ha sforato in N mesi su M, in media di € X".
 */
export function capSuggestion(
  envelope: Pick<Envelope, 'id' | 'kind'>,
  periods: readonly ClosedPeriod[],
  window = 5,
  threshold = 3,
): CapSuggestion | null {
  if (envelope.kind !== 'spendable') return null;
  const recent = closedPeriodsRecentFirst(periods)
    .filter((p) => p.leftovers && envelope.id in p.leftovers)
    .slice(0, window);
  if (recent.length === 0) return null;
  const leftovers = recent.map((p) => p.leftovers?.[envelope.id] ?? 0);
  const overs = leftovers.filter((v) => v < 0);
  if (overs.length < threshold) return null;
  const spent = recent.map((p) => spentInClosed(p, envelope.id) ?? 0);
  const averageSpent = spent.reduce((s, v) => s + v, 0) / spent.length;
  return {
    envelopeId: envelope.id,
    overMonths: overs.length,
    months: recent.length,
    averageOver: Math.round(-overs.reduce((s, v) => s + v, 0) / overs.length),
    averageSpent: Math.round(averageSpent),
    suggestedCap: ceilToFiveEuro(averageSpent),
  };
}

export interface HistoryRow {
  envelopeId: string;
  put: Cents;
  spent: Cents;
  /** Avanzo (periodo chiuso) o Resta (periodo in corso) */
  final: Cents;
}

export interface HistoryPeriod {
  periodId: string;
  inProgress: boolean;
  rows: HistoryRow[];
  spent: Cents;
  final: Cents;
  /** somma dei tetti del periodo */
  capsTotal: Cents;
  overBudget: boolean;
}

/** R11 · Tabella Messo / Speso / Avanzo di un periodo chiuso. */
export function historyForClosed(period: ClosedPeriod, envelopeOrder: readonly string[]): HistoryPeriod {
  const ids = envelopeOrder.filter((id) => period.leftovers && id in period.leftovers);
  const rows = ids.map((envelopeId) => {
    const put = putIn(period, envelopeId);
    const final = period.leftovers?.[envelopeId] ?? 0;
    return { envelopeId, put, spent: put - final, final };
  });
  return totals(period, rows, false);
}

/** R11 · Periodo in corso: colonna "Resta" dai residui attuali. */
export function historyForCurrent(period: Pick<Period, 'id' | 'allocations'>, balances: readonly EnvelopeBalance[]): HistoryPeriod {
  const rows = balances.map((b) => ({ envelopeId: b.envelope.id, put: b.put, spent: b.spent, final: b.remaining }));
  return totals(period, rows, true);
}

function totals(period: Pick<Period, 'id' | 'allocations'>, rows: HistoryRow[], inProgress: boolean): HistoryPeriod {
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const final = rows.reduce((s, r) => s + r.final, 0);
  const capsTotal = Object.values(period.allocations).reduce((s, v) => s + v, 0);
  return { periodId: period.id, inProgress, rows, spent, final, capsTotal, overBudget: spent > capsTotal };
}

/**
 * R11 · Gli ultimi `count` periodi per lo Storico, dal più vecchio: i chiusi con gli avanzi
 * fotografati e, per ultimo, quello in corso (con i residui attuali).
 */
export function recentHistory(
  periods: readonly (ClosedPeriod & Pick<Period, 'id' | 'allocations'>)[],
  envelopeOrder: readonly string[],
  current: { period: Pick<Period, 'id' | 'allocations'>; balances: readonly EnvelopeBalance[] } | null,
  count = 6,
): HistoryPeriod[] {
  const closed = closedPeriodsRecentFirst(periods)
    .slice(0, current ? count - 1 : count)
    .reverse()
    .map((p) => historyForClosed(p, envelopeOrder));
  return current ? [...closed, historyForCurrent(current.period, current.balances)] : closed;
}
