// "Oggi" iniettabile: i test e la demo possono fissare la data.
import { localISODate } from './dates';
import type { ISODate } from './types';

let fixedToday: ISODate | null = null;

export function today(): ISODate {
  return fixedToday ?? localISODate(new Date());
}

/** Fissa "oggi" (null per tornare alla data reale). */
export function setToday(date: ISODate | null): void {
  fixedToday = date;
}

/** Timestamp ISO completo (createdAt, closedAt). */
export function nowISO(): string {
  return new Date().toISOString();
}
