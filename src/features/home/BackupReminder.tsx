import { Link } from 'react-router-dom';
import { routes } from '../../app/routes';
import { db } from '../../db/database';
import { updateSettings } from '../../db/repositories';
import { backupReminder, SNOOZE_DAYS } from '../../domain/backupReminder';
import { today } from '../../domain/clock';
import { addDays, localISODate } from '../../domain/dates';
import type { Period, Settings } from '../../domain/types';
import { it } from '../../i18n/it';

/** In Home: "Fai un backup" quando l'ultimo ha più di 30 giorni (R14). */
export function BackupReminder({ settings, periods }: { settings: Settings; periods: Period[] }) {
  const now = today();
  const firstUse = periods.reduce<string | null>((m, p) => (!m || p.startedAt < m ? p.startedAt : m), null);
  const { show, daysSince } = backupReminder({
    lastBackup: settings.lastBackupAt ? localISODate(new Date(settings.lastBackupAt)) : null,
    firstUse,
    snoozedUntil: settings.backupSnoozedUntil ?? null,
    today: now,
  });
  if (!show) return null;
  return (
    <section className="backup-reminder" aria-labelledby="backup-reminder-title">
      <p id="backup-reminder-title" className="backup-reminder__title">
        {daysSince === null ? it.backupReminder.never : it.backupReminder.old(daysSince)}
      </p>
      <p className="backup-reminder__text">{it.backupReminder.text}</p>
      <div className="backup-reminder__actions">
        <Link to={`${routes.settings}?backup=1`} className="outcome__button outcome__button--accent backup-reminder__go">{it.backupReminder.go}</Link>
        <button
          type="button"
          className="outcome__button outcome__button--secondary"
          onClick={() => void updateSettings(db, { backupSnoozedUntil: addDays(now, SNOOZE_DAYS) })}
        >
          {it.backupReminder.later}
        </button>
      </div>
    </section>
  );
}
