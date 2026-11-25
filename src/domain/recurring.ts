// R8 · Abbonamenti (ricorrenze) che si scalano da soli.
import { addMonthsId, clampedDate, diffDays, monthsBetween, parseISODate } from './dates';
import type { Cents, ISODate, Period, Recurring, RecurringFrequency, Transaction } from './types';

export const RECURRING_FREQUENCIES: readonly RecurringFrequency[] = [1, 2, 3, 6, 12];

type PeriodRange = Pick<Period, 'calendarStart' | 'calendarEnd'>;

/**
 * Data dell'addebito nel periodo: l'unica data dell'intervallo di calendario con quel giorno del mese
 * (l'ultimo giorno se il mese è più corto). Con inizio il 27: giorni 27–31 nel primo mese, 1–26 nel secondo.
 */
export function chargeDateInPeriod(dayOfMonth: number, period: PeriodRange): ISODate | null {
  const start = parseISODate(period.calendarStart);
  for (let offset = 0; offset <= 1; offset++) {
    const date = clampedDate(start.y, start.m + offset, dayOfMonth);
    if (date >= period.calendarStart && date <= period.calendarEnd) return date;
  }
  return null;
}

/** Ogni quanti mesi (1 se non indicato o senza mese di riferimento). */
export function frequencyOf(recurring: Pick<Recurring, 'frequency' | 'anchorMonth'>): RecurringFrequency {
  return recurring.frequency && recurring.frequency > 1 && recurring.anchorMonth ? recurring.frequency : 1;
}

/** Il mese di calendario 'YYYY-MM' è un mese di addebito? (ogni N mesi a partire da `anchorMonth`) */
export function isChargeMonth(recurring: Pick<Recurring, 'frequency' | 'anchorMonth'>, month: string): boolean {
  const freq = frequencyOf(recurring);
  if (freq === 1) return true;
  const diff = monthsBetween(recurring.anchorMonth!, month);
  return ((diff % freq) + freq) % freq === 0;
}

/**
 * Data dell'addebito di un abbonamento nel periodo: come `chargeDateInPeriod`, ma per quelli non
 * mensili solo se quel mese di calendario è un mese di addebito; altrimenti null.
 */
export function recurringDateInPeriod(
  recurring: Pick<Recurring, 'dayOfMonth' | 'frequency' | 'anchorMonth'>,
  period: PeriodRange,
): ISODate | null {
  const date = chargeDateInPeriod(recurring.dayOfMonth, period);
  return date !== null && isChargeMonth(recurring, date.slice(0, 7)) ? date : null;
}

/** Primo addebito con data ≥ `from` (per mostrare quando arriva un annuale). */
export function nextChargeDate(recurring: Pick<Recurring, 'dayOfMonth' | 'frequency' | 'anchorMonth'>, from: ISODate): ISODate {
  let month = from.slice(0, 7);
  for (let i = 0; i <= 12; i++, month = addMonthsId(month, 1)) {
    if (!isChargeMonth(recurring, month)) continue;
    const [y, m] = month.split('-').map(Number) as [number, number];
    const date = clampedDate(y, m, recurring.dayOfMonth);
    if (date >= from) return date;
  }
  return from; // non succede: entro 13 mesi c'è sempre un mese di addebito
}

export interface DueCharge {
  recurring: Recurring;
  date: ISODate;
}

/**
 * Addebiti da generare nel periodo: ricorrenze attive con data ≤ `upTo` e senza un movimento
 * con la stessa coppia (recurringId, periodId). Idempotente: dopo averli creati restituisce [].
 * `upTo` è oggi; alla chiusura si passa la fine del periodo per non perdere gli ultimi addebiti.
 */
export function dueCharges(
  recurrings: readonly Recurring[],
  period: PeriodRange & Pick<Period, 'id'>,
  periodTxs: readonly Transaction[],
  upTo: ISODate,
): DueCharge[] {
  const done = new Set(
    periodTxs.filter((t) => t.recurringId !== null && t.periodId === period.id).map((t) => t.recurringId),
  );
  const due: DueCharge[] = [];
  for (const recurring of recurrings) {
    if (!recurring.active || done.has(recurring.id)) continue;
    const date = recurringDateInPeriod(recurring, period);
    if (date !== null && date <= upTo) due.push({ recurring, date });
  }
  return due.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Il movimento 'expense' generato da un addebito automatico. */
export function chargeToTransaction(charge: DueCharge, periodId: string, id: string, createdAt: string): Transaction {
  return {
    id,
    periodId,
    date: charge.date,
    type: 'expense',
    amount: charge.recurring.amount,
    envelopeId: charge.recurring.envelopeId,
    note: charge.recurring.name,
    card: charge.recurring.card,
    source: 'recurring',
    recurringId: charge.recurring.id,
    personId: null,
    loanAllocations: null,
    billId: null,
    createdAt,
  };
}

/** Totale mensile delle ricorrenze attive mensili (quelle in pausa e quelle non mensili non contano). */
export function monthlyTotal(recurrings: readonly Recurring[]): Cents {
  return recurrings.reduce((s, r) => (r.active && frequencyOf(r) === 1 ? s + r.amount : s), 0);
}

/** Totale degli addebiti attivi che cadono in questo periodo (mensili + annuali/bimestrali di questo mese). */
export function periodTotal(rows: readonly RecurringRow[]): Cents {
  return rows.reduce((s, r) => (r.recurring.active && r.date !== null ? s + r.recurring.amount : s), 0);
}

/** Media mensile degli abbonamenti non mensili attivi (un annuale da 60 € = 5 € al mese). */
export function nonMonthlyAverage(recurrings: readonly Recurring[]): Cents {
  return recurrings.reduce((s, r) => (r.active && frequencyOf(r) > 1 ? s + Math.round(r.amount / frequencyOf(r)) : s), 0);
}

export type RecurringStatus =
  | { kind: 'paused' }
  | { kind: 'charged'; date: ISODate }
  | { kind: 'upcoming'; date: ISODate; inDays: number }
  /** non mensile, non tocca questo periodo: il prossimo addebito è più avanti */
  | { kind: 'later'; date: ISODate }
  | { kind: 'none' };

/** Stato nel periodo corrente: scalato, tra N giorni (1 = domani), in pausa. */
export function recurringStatus(
  recurring: Recurring,
  period: PeriodRange & Pick<Period, 'id'>,
  periodTxs: readonly Transaction[],
  today: ISODate,
): RecurringStatus {
  if (!recurring.active) return { kind: 'paused' };
  const date = recurringDateInPeriod(recurring, period);
  if (date === null) {
    if (frequencyOf(recurring) === 1) return { kind: 'none' };
    return { kind: 'later', date: nextChargeDate(recurring, period.calendarEnd > today ? period.calendarEnd : today) };
  }
  const charged = periodTxs.find((t) => t.recurringId === recurring.id && t.periodId === period.id);
  if (charged) return { kind: 'charged', date: charged.date };
  if (date <= today) return { kind: 'charged', date };
  return { kind: 'upcoming', date, inDays: diffDays(today, date) };
}

export interface RecurringRow {
  recurring: Recurring;
  /** data dell'addebito nel periodo (null se quel giorno non cade nel periodo) */
  date: ISODate | null;
  /** data da mostrare: quella nel periodo, altrimenti il prossimo addebito */
  shownDate: ISODate;
  status: RecurringStatus;
}

/**
 * Righe della schermata Abbonamenti: in ordine di addebito, le pause in fondo.
 * Le righe con `date === null` (non mensili che non toccano il periodo) vanno nel gruppo "Più avanti".
 */
export function recurringRows(
  recurrings: readonly Recurring[],
  period: PeriodRange & Pick<Period, 'id'>,
  periodTxs: readonly Transaction[],
  today: ISODate,
): RecurringRow[] {
  return recurrings
    .map((recurring) => {
      const date = recurringDateInPeriod(recurring, period);
      const status = recurringStatus(recurring, period, periodTxs, today);
      const after = period.calendarEnd > today ? period.calendarEnd : today;
      const shownDate = date ?? (status.kind === 'later' ? status.date : nextChargeDate(recurring, after));
      return { recurring, date, shownDate, status };
    })
    .sort((a, b) => {
      const pa = a.recurring.active ? 0 : 1;
      const pb = b.recurring.active ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const da = a.shownDate;
      const dbb = b.shownDate;
      return da < dbb ? -1 : da > dbb ? 1 : a.recurring.name.localeCompare(b.recurring.name, 'it');
    });
}

/** La busta da cui si scalano (quella con più abbonamenti). */
export function mainRecurringEnvelope(recurrings: readonly Recurring[]): string | null {
  const counts = new Map<string, number>();
  for (const r of recurrings) counts.set(r.envelopeId, (counts.get(r.envelopeId) ?? 0) + 1);
  let best: string | null = null;
  for (const [id, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = id;
  return best;
}

/** Il prossimo addebito del periodo (Home, sotto Rate & Abbonamenti): il primo "tra N giorni". */
export function nextUpcomingCharge(rows: readonly RecurringRow[]): (RecurringRow & { status: Extract<RecurringStatus, { kind: 'upcoming' }> }) | null {
  const upcoming = rows.filter((r): r is RecurringRow & { status: Extract<RecurringStatus, { kind: 'upcoming' }> } => r.status.kind === 'upcoming');
  return upcoming.sort((a, b) => (a.status.date < b.status.date ? -1 : a.status.date > b.status.date ? 1 : 0))[0] ?? null;
}
