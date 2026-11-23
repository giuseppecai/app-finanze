// R10 · Spesa media, R11 · Storico, R6 · Suggerimento tetto.
import { diffDays } from './dates';
import type { EnvelopeBalance } from './envelopes';
import type { Cents, Envelope, ISODate, Period, Transaction } from './types';

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

// ── Storico (redesign v2): il "racconto del mese" ─────────────────────────────

/**
 * Spesa cumulata giorno per giorno di un periodo: indice 0 = primo giorno (il 27). Conta come
 * "Speso" dello Storico: spese meno rimborsi delle buste; prestiti, entrate e bollette pagate dalla
 * Pocket restano fuori. `days` = durata del periodo.
 */
export function cumulativeSpending(
  txs: readonly Pick<Transaction, 'date' | 'type' | 'amount' | 'envelopeId'>[],
  calendarStart: ISODate,
  days: number,
): Cents[] {
  const daily = new Array<Cents>(days).fill(0);
  for (const t of txs) {
    if (t.envelopeId === null) continue;
    const i = diffDays(calendarStart, t.date);
    if (i < 0 || i >= days) continue;
    if (t.type === 'expense') daily[i]! += t.amount;
    else if (t.type === 'refund') daily[i]! -= t.amount;
  }
  let run = 0;
  return daily.map((d) => (run += d));
}

export interface MonthPace {
  /** giorno del periodo (1 = il 27), per il periodo in corso; per un periodo chiuso = durata */
  day: number;
  days: number;
  /** speso al giorno = speso ÷ giorni passati */
  perDay: Cents;
  /** il mese prima allo stesso giorno (null se non ci sono i suoi movimenti) */
  previousSameDay: Cents | null;
  /** differenza con il mese prima allo stesso giorno: negativa = hai speso meno */
  diff: Cents | null;
  /** media della spesa dei periodi chiusi (fino a 6) */
  average: Cents | null;
}

/** Numeri della card "Speso a novembre": ritmo, confronto con il mese prima, media dei 6 mesi. */
export function monthPace(input: {
  spent: Cents;
  day: number;
  days: number;
  previous: readonly Cents[] | null;
  closedSpent: readonly Cents[];
}): MonthPace {
  const day = Math.max(1, Math.min(input.day, input.days));
  const prev = input.previous && input.previous.length > 0 ? input.previous[Math.min(day, input.previous.length) - 1] ?? null : null;
  const closed = input.closedSpent.slice(-6);
  return {
    day,
    days: input.days,
    perDay: Math.round(input.spent / day),
    previousSameDay: prev,
    diff: prev === null ? null : input.spent - prev,
    average: closed.length === 0 ? null : Math.round(closed.reduce((s, v) => s + v, 0) / closed.length),
  };
}

export interface WhereRow extends HistoryRow {
  /** quota sul totale speso, 0–1 */
  share: number;
  /** larghezza della barra: speso ÷ speso della busta più grande */
  scale: number;
}

/** "Dove sono andati": buste dalla più spesa, con la quota sul totale. */
export function whereItWent(rows: readonly HistoryRow[]): WhereRow[] {
  const spent = rows.filter((r) => r.spent > 0);
  const total = spent.reduce((s, r) => s + r.spent, 0);
  const max = spent.reduce((m, r) => Math.max(m, r.spent), 0);
  return spent
    .slice()
    .sort((a, b) => b.spent - a.spent)
    .map((r) => ({ ...r, share: total > 0 ? r.spent / total : 0, scale: max > 0 ? r.spent / max : 0 }));
}
