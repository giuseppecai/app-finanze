// R8 · Abbonamenti (ricorrenze) che si scalano da soli.
import { clampedDate, diffDays, parseISODate } from './dates';
import type { Cents, ISODate, Period, Recurring, Transaction } from './types';

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
    const date = chargeDateInPeriod(recurring.dayOfMonth, period);
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
    createdAt,
  };
}

/** Totale mensile delle ricorrenze attive (quelle in pausa non contano). */
export function monthlyTotal(recurrings: readonly Recurring[]): Cents {
  return recurrings.reduce((s, r) => (r.active ? s + r.amount : s), 0);
}

export type RecurringStatus =
  | { kind: 'paused' }
  | { kind: 'charged'; date: ISODate }
  | { kind: 'upcoming'; date: ISODate; inDays: number }
  | { kind: 'none' };

/** Stato nel periodo corrente: scalato, tra N giorni (1 = domani), in pausa. */
export function recurringStatus(
  recurring: Recurring,
  period: PeriodRange & Pick<Period, 'id'>,
  periodTxs: readonly Transaction[],
  today: ISODate,
): RecurringStatus {
  if (!recurring.active) return { kind: 'paused' };
  const date = chargeDateInPeriod(recurring.dayOfMonth, period);
  if (date === null) return { kind: 'none' };
  const charged = periodTxs.find((t) => t.recurringId === recurring.id && t.periodId === period.id);
  if (charged) return { kind: 'charged', date: charged.date };
  if (date <= today) return { kind: 'charged', date };
  return { kind: 'upcoming', date, inDays: diffDays(today, date) };
}

export interface RecurringRow {
  recurring: Recurring;
  /** data dell'addebito nel periodo (null se quel giorno non cade nel periodo) */
  date: ISODate | null;
  status: RecurringStatus;
}

/** Righe della schermata Abbonamenti: in ordine di addebito nel periodo, le pause in fondo. */
export function recurringRows(
  recurrings: readonly Recurring[],
  period: PeriodRange & Pick<Period, 'id'>,
  periodTxs: readonly Transaction[],
  today: ISODate,
): RecurringRow[] {
  return recurrings
    .map((recurring) => ({
      recurring,
      date: chargeDateInPeriod(recurring.dayOfMonth, period),
      status: recurringStatus(recurring, period, periodTxs, today),
    }))
    .sort((a, b) => {
      const pa = a.recurring.active ? 0 : 1;
      const pb = b.recurring.active ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const da = a.date ?? '9999';
      const dbb = b.date ?? '9999';
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
