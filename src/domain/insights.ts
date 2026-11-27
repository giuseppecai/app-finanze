// M10 · Capire dove vanno i soldi: R18 (il mese intero), R19 (cerca), R20 (ritmo), R22 (impulso),
// R23 (costo annuo), R24 (proposito), R25 (tetto: tenere). R21 (prima i risparmi) è in opening.ts.
import { expectedShare, isPeriodic } from './bills';
import { addDays, diffDays, weekday } from './dates';
import { frequencyOf, recurringStatus } from './recurring';
import type {
  Bill, Cents, ISODate, MonthlyItem, Period, PeriodId, Recurring, SalarySplit, Transaction,
} from './types';

// ── R18 · Il mese intero ──────────────────────────────────────────────────────

type SplitPeriod = Pick<Period, 'salary' | 'allocations' | 'quotas' | 'billsQuota'> & Partial<Pick<Period, 'split' | 'otherAccounts'>>;

/**
 * Lo stipendio diviso in cinque parti. Dal periodo se l'ha salvato a "Inizia il mese"; per i periodi
 * creati prima si ricostruisce (una voce che non c'è più conta come pagamento).
 */
export function periodSplit(period: SplitPeriod, items: readonly Pick<MonthlyItem, 'id' | 'kind'>[]): SalarySplit {
  if (period.split) return period.split;
  let payments = 0;
  let pots = 0;
  for (const [id, amount] of Object.entries(period.quotas ?? {})) {
    if (items.find((i) => i.id === id)?.kind === 'pot') pots += amount;
    else payments += amount;
  }
  const fixed = period.billsQuota + (period.otherAccounts ?? 0);
  const envelopes = Object.values(period.allocations).reduce((s, v) => s + v, 0);
  return { fixed, payments, pots, envelopes, savings: period.salary - fixed - payments - pots - envelopes };
}

type ClosingPeriod = Pick<Period, 'closedAt' | 'leftoverChoice' | 'leftovers' | 'unassigned'> & Partial<Pick<Period, 'closingSavings'>>;

/**
 * Variazione di Risparmi alla chiusura (R6): salvata dal periodo o ricostruita dagli avanzi fotografati.
 * null per un periodo ancora aperto.
 */
export function closingSavingsOf(period: ClosingPeriod): Cents | null {
  if (period.closedAt === null) return null;
  if (period.closingSavings !== undefined) return period.closingSavings;
  const net = Object.values(period.leftovers ?? {}).reduce((s, v) => s + v, period.unassigned);
  switch (period.leftoverChoice) {
    case 'toSavings':
      return net;
    case 'half':
      return Math.floor(net / 2);
    case 'deficit':
      return Math.min(0, net);
    default:
      return 0;
  }
}

export interface MonthSavings {
  split: SalarySplit;
  /** Risparmi a inizio mese + variazione alla chiusura (periodo aperto: solo inizio mese) */
  saved: Cents;
  /** % dello stipendio, arrotondata all'intero; null senza stipendio */
  rate: number | null;
  /** R21: obiettivo del mese (0 = nessuno) e se la parte di inizio mese lo raggiunge */
  goal: Cents;
  goalReached: boolean;
}

export function monthSavings(period: SplitPeriod & ClosingPeriod & Partial<Pick<Period, 'savingsGoal'>>, items: readonly Pick<MonthlyItem, 'id' | 'kind'>[]): MonthSavings {
  const split = periodSplit(period, items);
  const saved = split.savings + (closingSavingsOf(period) ?? 0);
  const goal = period.savingsGoal ?? 0;
  return {
    split,
    saved,
    rate: period.salary > 0 ? Math.round((saved * 100) / period.salary) || 0 : null,
    goal,
    goalReached: goal > 0 && split.savings >= goal,
  };
}

// ── R19 · Cerca nei movimenti ─────────────────────────────────────────────────

/** Minuscole, senza accenti, spazi ripetuti ridotti. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Parole della ricerca; null sotto i 2 caratteri. */
export function searchTerms(query: string): string[] | null {
  const q = normalizeText(query);
  return q.length < 2 ? null : q.split(' ');
}

export interface SearchLookups {
  envelopes: readonly { id: string; name: string; shortName: string }[];
  people: readonly { id: string; name: string }[];
  bills: readonly { id: string; name: string }[];
}

/** Ogni parola deve comparire nella nota, nel nome della busta, della persona o della bolletta. */
export function matchesSearch(tx: Pick<Transaction, 'note' | 'envelopeId' | 'personId' | 'billId'>, terms: readonly string[], lookups: SearchLookups): boolean {
  const env = tx.envelopeId ? lookups.envelopes.find((e) => e.id === tx.envelopeId) : undefined;
  const fields = [
    tx.note,
    env?.name ?? '',
    env?.shortName ?? '',
    tx.personId ? lookups.people.find((p) => p.id === tx.personId)?.name ?? '' : '',
    tx.billId ? lookups.bills.find((b) => b.id === tx.billId)?.name ?? '' : '',
  ].map(normalizeText);
  return terms.every((t) => fields.some((f) => f.includes(t)));
}

export function searchMovements<T extends Pick<Transaction, 'note' | 'envelopeId' | 'personId' | 'billId'>>(
  txs: readonly T[],
  query: string,
  lookups: SearchLookups,
): T[] | null {
  const terms = searchTerms(query);
  if (!terms) return null;
  return txs.filter((t) => matchesSearch(t, terms, lookups));
}

export interface SearchSummary {
  count: number;
  /** spese − rimborsi */
  total: Cents;
  /** periodi diversi tra spese e rimborsi */
  months: number;
}

export function searchSummary(txs: readonly Pick<Transaction, 'type' | 'amount' | 'periodId' | 'potId'>[]): SearchSummary {
  let total = 0;
  const months = new Set<string>();
  for (const t of txs) {
    if (t.type !== 'expense' && t.type !== 'refund') continue;
    // Un rimborso messo in una Pocket (un regalo) non riduce le spese.
    if (t.type === 'refund' && t.potId) continue;
    total += t.type === 'expense' ? t.amount : -t.amount;
    months.add(t.periodId);
  }
  return { count: txs.length, total, months: months.size };
}

// ── R20 · Il ritmo ────────────────────────────────────────────────────────────

type SpendTx = Pick<Transaction, 'date' | 'type' | 'amount' | 'envelopeId'>;

function net(t: SpendTx): Cents {
  if (t.envelopeId === null) return 0;
  return t.type === 'expense' ? t.amount : t.type === 'refund' ? -t.amount : 0;
}

/** Spese − rimborsi delle buste tra due date (incluse); `envelopeIds` limita a quelle buste. */
export function spentBetween(txs: readonly SpendTx[], from: ISODate, to: ISODate, envelopeIds?: ReadonlySet<string>): Cents {
  return txs.reduce((s, t) => {
    if (t.date < from || t.date > to) return s;
    if (envelopeIds && (t.envelopeId === null || !envelopeIds.has(t.envelopeId))) return s;
    return s + net(t);
  }, 0);
}

export interface TodayAllowance {
  daysLeft: number;
  /** quota di oggi: non cambia spendendo durante il giorno */
  quota: Cents;
  spentToday: Cents;
  /** quota − speso oggi (negativo = oltre) */
  left: Cents;
  /** "Puoi ancora spendere" ≤ 0 */
  nothing: boolean;
}

export function todayAllowance(input: { spendable: Cents; spentToday: Cents; today: ISODate; calendarEnd: ISODate }): TodayAllowance {
  const daysLeft = Math.max(1, diffDays(input.today, input.calendarEnd) + 1);
  const quota = Math.floor((Math.max(0, input.spendable) + input.spentToday) / daysLeft);
  return { daysLeft, quota, spentToday: input.spentToday, left: quota - input.spentToday, nothing: input.spendable <= 0 };
}

/** Lunedì della settimana di `date`. */
export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -((weekday(date) + 6) % 7));
}

export interface WeekSpending {
  thisWeek: Cents;
  /** settimana scorsa, da lunedì allo stesso giorno */
  lastWeek: Cents;
}

export function weekSpending(txs: readonly SpendTx[], today: ISODate): WeekSpending {
  const monday = mondayOf(today);
  return {
    thisWeek: spentBetween(txs, monday, today),
    lastWeek: spentBetween(txs, addDays(monday, -7), addDays(today, -7)),
  };
}

export interface WeekdaySpending {
  /** lunedì → domenica */
  days: Cents[];
  total: Cents;
  /** indice (0 = lunedì) del giorno più caro, null se non si è speso */
  top: number | null;
  /** giorni diversi con movimenti delle buste: sotto 7 la sezione non compare */
  activeDays: number;
}

export function weekdaySpending(txs: readonly SpendTx[]): WeekdaySpending {
  const days = new Array<Cents>(7).fill(0);
  const dates = new Set<string>();
  for (const t of txs) {
    if (t.envelopeId === null || (t.type !== 'expense' && t.type !== 'refund')) continue;
    days[(weekday(t.date) + 6) % 7]! += net(t);
    dates.add(t.date);
  }
  const total = days.reduce((s, v) => s + v, 0);
  const max = Math.max(...days);
  return { days, total, top: max > 0 ? days.indexOf(max) : null, activeDays: dates.size };
}

// ── R22 · Spese d'impulso ─────────────────────────────────────────────────────

export interface ImpulseSummary {
  total: Cents;
  /** % di quanto speso nel periodo, arrotondata */
  share: number;
  /** busta con più spese d'impulso */
  top: { envelopeId: string; amount: Cents } | null;
}

export function impulseSummary(txs: readonly Pick<Transaction, 'type' | 'amount' | 'envelopeId' | 'impulse'>[], spent: Cents): ImpulseSummary | null {
  const by = new Map<string, Cents>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !t.impulse || t.envelopeId === null) continue;
    total += t.amount;
    by.set(t.envelopeId, (by.get(t.envelopeId) ?? 0) + t.amount);
  }
  if (total === 0) return null;
  let top: ImpulseSummary['top'] = null;
  for (const [envelopeId, amount] of by) if (!top || amount > top.amount) top = { envelopeId, amount };
  return { total, share: spent > 0 ? Math.round((total * 100) / spent) : 0, top };
}

// ── R23 · Spese fisse in un anno ──────────────────────────────────────────────

export interface AnnualCost {
  subscriptions: Cents;
  bills: Cents;
  /** pagamenti come l'affitto (voci 'payment' non sospese) */
  payments: Cents;
  total: Cents;
  /** abbonamenti attivi dal più caro all'anno */
  list: { recurring: Recurring; yearly: Cents }[];
}

export function annualCost(
  recurrings: readonly Recurring[],
  bills: readonly Bill[],
  items: readonly Pick<MonthlyItem, 'kind' | 'amount' | 'archived'>[] = [],
): AnnualCost {
  const list = recurrings
    .filter((r) => r.active)
    .map((recurring) => ({ recurring, yearly: (recurring.amount * 12) / frequencyOf(recurring) }))
    .sort((a, b) => b.yearly - a.yearly || a.recurring.name.localeCompare(b.recurring.name, 'it'));
  const subscriptions = list.reduce((s, x) => s + x.yearly, 0);
  const billsTotal = bills.filter((b) => b.active).reduce((s, b) => s + (expectedShare(b) * 12) / b.frequency, 0);
  const payments = items.filter((i) => i.kind === 'payment' && !i.archived).reduce((s, i) => s + i.amount * 12, 0);
  return { subscriptions, bills: billsTotal, payments, total: subscriptions + billsTotal + payments, list };
}

/**
 * R23 · Quanto costano le spese fisse in un mese normale: il costo di un anno diviso 12 (le annuali
 * pesano un dodicesimo, le bimestrali metà). Non dipende da quello che è già nella Pocket: è il
 * costo, non il giroconto del mese. `fromSalary` = pagamenti (affitto) e abbonamenti pagati da un
 * altro conto; `fromPocket` = il resto, che passa dalla Pocket Spese fisse.
 */
export function monthlyFixedCost(
  recurrings: readonly Recurring[],
  bills: readonly Bill[],
  items: readonly Pick<MonthlyItem, 'kind' | 'amount' | 'archived'>[] = [],
): { total: Cents; fromPocket: Cents; fromSalary: Cents } {
  const a = annualCost(recurrings, bills, items);
  const otherAccounts = a.list.filter((x) => x.recurring.payFrom).reduce((s, x) => s + x.yearly, 0);
  const total = Math.round(a.total / 12);
  const fromSalary = Math.round((a.payments + otherAccounts) / 12);
  return { total, fromPocket: total - fromSalary, fromSalary };
}

export interface FixedMonth {
  /** escono ancora dalla Pocket Spese fisse in questo periodo (addebiti e bollette non ancora passati) */
  dueThisMonth: Cents;
  /** restano nella Pocket per le scadenze dei mesi dopo (negativo = mancano soldi per questo mese) */
  forLater: Cents;
  /** voci a cui appartengono i soldi per dopo, dalla parte più grande */
  laterNames: string[];
  /** escono questo mese dallo stipendio o da altri conti: pagamenti (affitto) e abbonamenti da altri conti */
  fromSalary: Cents;
}

/**
 * Spese fisse · la Pocket divisa in due: quello che esce ancora QUESTO mese e quello che resta per
 * le scadenze dopo (Acqua, Metro…). Questo mese: abbonamenti dalla Pocket con addebito ancora da
 * venire, bollette mensili non registrate, periodiche attese ora (tua quota prevista). Per dopo:
 * il resto della Pocket, che a "Inizia il mese" resta lì (R13: non riduce il giroconto).
 */
export function fixedThisMonth(input: {
  recurrings: readonly Recurring[];
  bills: readonly Bill[];
  items: readonly Pick<MonthlyItem, 'kind' | 'amount' | 'archived'>[];
  period: { id: PeriodId; calendarStart: ISODate; calendarEnd: ISODate };
  periodTxs: readonly Transaction[];
  today: ISODate;
  pocket: Cents;
}): FixedMonth {
  const { recurrings, bills, items, period, periodTxs, today, pocket } = input;
  let dueThisMonth = 0;
  let fromSalary = items.filter((i) => i.kind === 'payment' && !i.archived).reduce((s, i) => s + i.amount, 0);
  const dueIds = new Set<string>();
  for (const r of recurrings) {
    const status = recurringStatus(r, period, periodTxs, today);
    if (r.payFrom) {
      if (status.kind === 'upcoming' || status.kind === 'charged') fromSalary += r.amount;
      continue;
    }
    if (status.kind === 'upcoming') dueThisMonth += r.amount;
    if (status.kind === 'upcoming' || status.kind === 'charged') dueIds.add(r.id);
  }
  for (const b of bills) {
    if (!b.active) continue;
    const registered = periodTxs.some((t) => t.billId === b.id && t.type === 'expense');
    const dueNow = isPeriodic(b) ? !!b.nextDue && b.nextDue <= period.id : !registered;
    if (dueNow) dueThisMonth += expectedShare(b);
    if (dueNow || !isPeriodic(b)) dueIds.add(b.id);
  }
  const later = [
    ...recurrings.filter((r) => r.active && !r.payFrom && !dueIds.has(r.id)).map((r) => ({ name: r.name, fund: r.fund ?? 0 })),
    ...bills.filter((b) => b.active && !dueIds.has(b.id)).map((b) => ({ name: b.name, fund: b.fund })),
  ].filter((x) => x.fund > 0).sort((a, b) => b.fund - a.fund);
  return { dueThisMonth, forLater: pocket - dueThisMonth, laterNames: later.map((x) => x.name), fromSalary };
}

export const REVIEW_DAYS = 183;

/** "Li usi ancora tutti?": con abbonamenti attivi, se il controllo manca o ha 6 mesi (183 giorni). */
export function reviewDue(recurrings: readonly Pick<Recurring, 'active'>[], reviewedAt: ISODate | null | undefined, today: ISODate): boolean {
  if (!recurrings.some((r) => r.active)) return false;
  return !reviewedAt || diffDays(reviewedAt, today) >= REVIEW_DAYS;
}

// ── R24 · Proposito ───────────────────────────────────────────────────────────

export const INTENTION_MAX = 140;

/** Testo del proposito da salvare: senza spazi ai lati, al massimo 140 caratteri; vuoto = null. */
export function cleanIntention(text: string | null | undefined): string | null {
  const t = (text ?? '').trim().slice(0, INTENTION_MAX).trim();
  return t === '' ? null : t;
}

// ── R25 · Tetto: tenere ───────────────────────────────────────────────────────

/** Le `n` spese più grandi della busta nei periodi dati (a parità, la più recente). */
export function biggestExpenses<T extends Pick<Transaction, 'type' | 'amount' | 'envelopeId' | 'periodId' | 'date' | 'createdAt'>>(
  txs: readonly T[],
  envelopeId: string,
  periodIds: readonly PeriodId[],
  n = 3,
): T[] {
  const ids = new Set(periodIds);
  return txs
    .filter((t) => t.type === 'expense' && t.envelopeId === envelopeId && ids.has(t.periodId))
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, n);
}

/** Id degli ultimi `n` periodi chiusi, dal più recente. */
export function recentClosedIds(periods: readonly Pick<Period, 'id' | 'closedAt'>[], n: number): PeriodId[] {
  return periods.filter((p) => p.closedAt !== null).map((p) => p.id).sort().reverse().slice(0, n);
}

/** Dopo "Tieni il tetto" il suggerimento resta nascosto finché non si chiude un altro periodo. */
export function capKeptHides(capKept: Readonly<Record<string, PeriodId>> | undefined, envelopeId: string, latestClosedId: PeriodId | null): boolean {
  const kept = capKept?.[envelopeId];
  return kept !== undefined && latestClosedId !== null && kept >= latestClosedId;
}
