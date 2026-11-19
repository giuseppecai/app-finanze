import { describe, expect, it } from 'vitest';
import { mainRecurringEnvelope, recurringRows } from '../recurring';
import { buildDemoData, DEMO_TODAY, ENV } from '../../db/fixtures';

const data = buildDemoData();
const nov = data.periods.find((p) => p.id === '2026-11')!;
const novTxs = data.transactions.filter((t) => t.periodId === nov.id);

describe('Schermata Abbonamenti (oggi 19 nov)', () => {
  it('4 scalati e iCloud tra 5 giorni, in ordine di addebito', () => {
    const rows = recurringRows(data.recurring, nov, novTxs, DEMO_TODAY);
    expect(rows.map((r) => [r.recurring.name, r.status.kind])).toEqual([
      ['Rata iPhone', 'charged'],
      ['Spotify', 'charged'],
      ['Disney+', 'charged'],
      ['Prime', 'charged'],
      ['iCloud', 'upcoming'],
    ]);
    expect(rows[4]!.status).toMatchObject({ inDays: 5 });
  });

  it('le voci in pausa vanno in fondo', () => {
    const paused = data.recurring.map((r) => (r.name === 'Spotify' ? { ...r, active: false } : r));
    const rows = recurringRows(paused, nov, novTxs, DEMO_TODAY);
    expect(rows.at(-1)).toMatchObject({ recurring: { name: 'Spotify' }, status: { kind: 'paused' } });
  });

  it('la busta degli abbonamenti è Rate & Abbonamenti', () => {
    expect(mainRecurringEnvelope(data.recurring)).toBe(ENV.rate);
    expect(mainRecurringEnvelope([])).toBeNull();
  });
});
