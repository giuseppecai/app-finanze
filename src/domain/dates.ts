// Helper per le date ISO 'YYYY-MM-DD' (ora locale). Nessuna libreria: calcoli su UTC per evitare l'ora legale.
import type { ISODate } from './types';
import { it } from '../i18n/it';

export interface YMD {
  y: number;
  m: number; // 1..12
  d: number;
}

export function parseISODate(date: ISODate): YMD {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Data non valida: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function toISODate(y: number, m: number, d: number): ISODate {
  // Normalizza mesi fuori intervallo (m = 0 → dicembre dell'anno prima, m = 13 → gennaio dopo)
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Giorno `day` del mese, oppure l'ultimo giorno se il mese è più corto. `m` può uscire da 1..12. */
export function clampedDate(y: number, m: number, day: number): ISODate {
  const first = parseISODate(toISODate(y, m, 1));
  return toISODate(first.y, first.m, Math.min(day, daysInMonth(first.y, first.m)));
}

function toUTC(date: ISODate): number {
  const { y, m, d } = parseISODate(date);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: ISODate, days: number): ISODate {
  const t = new Date(toUTC(date) + days * 86_400_000);
  return toISODate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Giorni da `from` a `to` (positivo se `to` è dopo). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

/** Data locale di un istante (Europe/Rome sul telefono dell'utente). */
export function localISODate(now: Date): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** 'YYYY-MM' → 'YYYY-MM' del mese successivo */
export function nextMonthId(id: string): string {
  const [y, m] = id.split('-').map(Number) as [number, number];
  return toISODate(y, m + 1, 1).slice(0, 7);
}

/** 'YYYY-MM' spostato di n mesi (anche negativi) */
export function addMonthsId(id: string, n: number): string {
  const [y, m] = id.split('-').map(Number) as [number, number];
  return toISODate(y, m + n, 1).slice(0, 7);
}

/** Mesi da `from` a `to` ('YYYY-MM'): positivo se `to` viene dopo */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
}

/** 0 = domenica … 6 = sabato */
export function weekday(date: ISODate): number {
  return new Date(toUTC(date)).getUTCDay();
}

/** "27 ott" */
export function formatShortDate(date: ISODate): string {
  const { m, d } = parseISODate(date);
  return `${d} ${it.months.short[m - 1]}`;
}

/** "27 ott – 26 nov" */
export function formatShortRange(start: ISODate, end: ISODate): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** "27 settembre – 26 ottobre" */
export function formatLongRange(start: ISODate, end: ISODate): string {
  const a = parseISODate(start);
  const b = parseISODate(end);
  return `${a.d} ${it.months.long[a.m - 1]} – ${b.d} ${it.months.long[b.m - 1]}`;
}

/** "Lunedì 16 novembre" */
export function formatDayHeading(date: ISODate): string {
  const { m, d } = parseISODate(date);
  const wd = it.weekdays[weekday(date)] ?? '';
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d} ${it.months.long[m - 1]}`;
}
