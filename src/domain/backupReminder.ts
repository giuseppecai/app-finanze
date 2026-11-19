// R14 · Promemoria backup: i dati vivono solo sul telefono.
import { diffDays } from './dates';
import type { ISODate } from './types';

export const BACKUP_MAX_DAYS = 30;
export const FIRST_BACKUP_AFTER_DAYS = 7;
export const SNOOZE_DAYS = 7;

export interface BackupReminderInput {
  /** data dell'ultimo backup (ISODate locale) o null se mai fatto */
  lastBackup: ISODate | null;
  /** inizio del primo periodo (quando l'app ha cominciato a contenere dati veri), null se nessuno */
  firstUse: ISODate | null;
  /** "Più tardi" fino a questa data (esclusa) */
  snoozedUntil: ISODate | null;
  today: ISODate;
}

/**
 * Mostra il promemoria se l'ultimo backup ha più di 30 giorni, oppure se non ne hai mai fatto uno
 * e usi l'app da almeno 7 giorni. "Più tardi" lo nasconde per 7 giorni.
 */
export function backupReminder(input: BackupReminderInput): { show: boolean; daysSince: number | null } {
  if (input.snoozedUntil && input.today < input.snoozedUntil) return { show: false, daysSince: null };
  if (input.lastBackup) {
    const days = diffDays(input.lastBackup, input.today);
    return { show: days > BACKUP_MAX_DAYS, daysSince: days };
  }
  if (!input.firstUse) return { show: false, daysSince: null };
  return { show: diffDays(input.firstUse, input.today) >= FIRST_BACKUP_AFTER_DAYS, daysSince: null };
}
