import { describe, expect, it } from 'vitest';
import { backupReminder } from '../backupReminder';

const base = { lastBackup: null, firstUse: null, snoozedUntil: null, today: '2026-12-20' };

describe('R14 · promemoria backup', () => {
  it('ultimo backup 30 giorni fa: ancora niente; 31 giorni: sì', () => {
    expect(backupReminder({ ...base, lastBackup: '2026-11-20' })).toEqual({ show: false, daysSince: 30 });
    expect(backupReminder({ ...base, lastBackup: '2026-11-19' })).toEqual({ show: true, daysSince: 31 });
  });

  it('mai fatto un backup: dopo 7 giorni d’uso', () => {
    expect(backupReminder({ ...base, firstUse: '2026-12-14' }).show).toBe(false);
    expect(backupReminder({ ...base, firstUse: '2026-12-13' }).show).toBe(true);
  });

  it('senza dati veri (nessun periodo) niente promemoria', () => {
    expect(backupReminder(base).show).toBe(false);
  });

  it('"Più tardi" lo nasconde fino alla data indicata', () => {
    const late = { ...base, lastBackup: '2026-10-01' };
    expect(backupReminder({ ...late, snoozedUntil: '2026-12-21' }).show).toBe(false);
    expect(backupReminder({ ...late, snoozedUntil: '2026-12-20' }).show).toBe(true);
  });
});
