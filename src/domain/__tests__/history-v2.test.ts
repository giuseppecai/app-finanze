import { describe, expect, it } from 'vitest';
import { buildDemoData, DEMO_TODAY, ENV } from '../../db/fixtures';
import { diffDays } from '../dates';
import { summarizePeriod } from '../envelopes';
import { cumulativeSpending, historyForCurrent, monthPace, recentHistory, whereItWent } from '../stats';

const data = buildDemoData();
const nov = data.periods.find((p) => p.id === '2026-11')!;
const novTxs = data.transactions.filter((t) => t.periodId === '2026-11');
const days = diffDays(nov.calendarStart, nov.calendarEnd) + 1;

describe('Storico · spesa cumulata', () => {
  it('Novembre (27 ott – 26 nov, 31 giorni): a fine curva € 448,50, prestiti ed entrate esclusi', () => {
    const c = cumulativeSpending(novTxs, nov.calendarStart, days);
    expect(c).toHaveLength(31);
    expect(c[30]).toBe(44850);
    expect(c[0]).toBe(0); // 27 ott: solo il prestito a Mamma
    expect(c.every((v, i) => i === 0 || v >= c[i - 1]!)).toBe(true);
  });

  it('oggi 19 nov = giorno 24 di 31; al giorno € 18,69; senza movimenti del mese prima niente confronto', () => {
    const day = diffDays(nov.calendarStart, DEMO_TODAY) + 1;
    const p = monthPace({ spent: 44850, day, days, previous: null, closedSpent: [65200, 73100, 68800, 64000, 60400] });
    expect(p).toMatchObject({ day: 24, days: 31, perDay: 1869, previousSameDay: null, diff: null, average: 66300 });
  });

  it('con il mese prima: differenza allo stesso giorno (negativa = meno)', () => {
    const prev = Array.from({ length: 30 }, (_, i) => (i + 1) * 2167);
    const p = monthPace({ spent: 44850, day: 24, days: 31, previous: prev, closedSpent: [] });
    expect(p.previousSameDay).toBe(24 * 2167);
    expect(p.diff).toBe(44850 - 24 * 2167);
    expect(p.average).toBeNull();
  });
});

describe('Storico · dove sono andati', () => {
  it('buste dalla più spesa: Vita 131 (29%), Rate 89,50, Casa 63, Trasporti 62, Spesa 58, Shopping 45', () => {
    const h = historyForCurrent(nov, summarizePeriod(data.envelopes, nov, novTxs).balances);
    const rows = whereItWent(h.rows);
    expect(rows.map((r) => r.envelopeId)).toEqual([ENV.vita, ENV.rate, ENV.casa, ENV.trasporti, ENV.spesa, ENV.shopping]);
    expect(Math.round(rows[0]!.share * 100)).toBe(29);
    expect(rows[0]!.scale).toBe(1);
    expect(rows.find((r) => r.envelopeId === ENV.spesa)!.final).toBe(-800);
  });

  it('gli ultimi 6 mesi restano quelli di prima', () => {
    const h = recentHistory(data.periods, data.envelopes.map((e) => e.id), { period: nov, balances: summarizePeriod(data.envelopes, nov, novTxs).balances });
    expect(h.map((x) => x.periodId)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  });
});
