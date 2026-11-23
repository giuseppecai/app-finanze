// R2 · Periodi da stipendio a stipendio.
import { addDays, clampedDate, diffDays, nextMonthId, parseISODate } from './dates';
import type { ISODate, Period, PeriodId } from './types';
import { it } from '../i18n/it';

export const DEFAULT_PERIOD_START_DAY = 27;

export interface CalendarPeriod {
  id: PeriodId;
  name: string;
  calendarStart: ISODate;
  calendarEnd: ISODate;
}

/** "Novembre" per '2026-11' */
export function periodName(id: PeriodId): string {
  const m = Number(id.slice(5, 7));
  const name = it.months.long[m - 1] ?? id;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Periodo "di calendario" di una data: dallo `startDay` al giorno prima dello `startDay` successivo.
 * Prende id e nome del mese in cui finisce. Se `startDay` supera i giorni del mese, vale l'ultimo giorno.
 */
export function calendarPeriodFor(date: ISODate, startDay: number): CalendarPeriod {
  const { y, m } = parseISODate(date);
  const startThisMonth = clampedDate(y, m, startDay);
  const start = date >= startThisMonth ? startThisMonth : clampedDate(y, m - 1, startDay);
  const { y: sy, m: sm } = parseISODate(start);
  const end = addDays(clampedDate(sy, sm + 1, startDay), -1);
  const id = end.slice(0, 7);
  return { id, name: periodName(id), calendarStart: start, calendarEnd: end };
}

/** Il periodo di calendario con un certo id ('2026-11' → 27 ott – 26 nov). */
export function calendarPeriodById(id: PeriodId, startDay: number): CalendarPeriod {
  // Il primo giorno del mese finale cade sempre nel periodo che finisce in quel mese.
  return calendarPeriodFor(`${id}-01`, startDay);
}

/** Periodo corrente: l'ultimo iniziato e non chiuso. */
export function currentPeriod(periods: readonly Period[]): Period | null {
  const open = periods.filter((p) => p.closedAt === null);
  if (open.length === 0) return null;
  return open.reduce((a, b) => (b.id > a.id ? b : a));
}

/**
 * Quale periodo crea "Inizio del mese". È il successivo dell'ultimo periodo; se però è passato
 * più tempo (app non usata per mesi), è il periodo di domani. Per il primo periodo in assoluto:
 * il periodo di domani (così lo stipendio arrivato il 26 apre già il periodo nuovo).
 */
export function nextPeriodToStart(lastPeriod: Pick<Period, 'id'> | null, today: ISODate, startDay: number): CalendarPeriod {
  const byTomorrow = calendarPeriodFor(addDays(today, 1), startDay);
  if (!lastPeriod) return byTomorrow;
  const successor = calendarPeriodById(nextMonthId(lastPeriod.id), startDay);
  return byTomorrow.id > successor.id ? byTomorrow : successor;
}

/** Id del periodo del prossimo "Inizio del mese" (dove andrà il prossimo giroconto). */
export function nextOpeningId(periods: readonly Pick<Period, 'id'>[], today: ISODate, startDay: number): PeriodId {
  const last = periods.reduce<Pick<Period, 'id'> | null>((a, p) => (!a || p.id > a.id ? p : a), null);
  return nextPeriodToStart(last, today, startDay).id;
}

/**
 * È ora di chiudere? Dal giorno prima dello stipendio (la fine di calendario del periodo) in poi.
 * Così il link compare il 26 nov, non subito dopo l'inizio del periodo.
 */
export function isTimeToClose(period: Pick<Period, 'calendarEnd'>, today: ISODate): boolean {
  return today >= period.calendarEnd;
}

/** "Stipendio tra 8 giorni": giorni da oggi al giorno dopo la fine di calendario. */
export function daysUntilSalary(period: Pick<Period, 'calendarEnd'>, today: ISODate): number {
  return diffDays(today, addDays(period.calendarEnd, 1));
}
