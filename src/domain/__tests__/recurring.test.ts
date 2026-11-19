import { describe, expect, it } from 'vitest';
import { chargeDateInPeriod, chargeToTransaction, dueCharges, monthlyTotal, recurringStatus } from '../recurring';
import { calendarPeriodById } from '../periods';
import type { Transaction } from '../types';
import { buildDemoData, DEMO_TODAY } from '../../db/fixtures';

const data = buildDemoData();
const nov = data.periods.find((p) => p.id === '2026-11')!;
const novNoAuto = data.transactions.filter((t) => t.periodId === '2026-11' && t.source !== 'recurring');

describe('R8 · data dell\'addebito nel periodo', () => {
  it('giorni 1–26 nel secondo mese, 27–31 nel primo', () => {
    expect(chargeDateInPeriod(1, nov)).toBe('2026-11-01');
    expect(chargeDateInPeriod(24, nov)).toBe('2026-11-24');
    expect(chargeDateInPeriod(26, nov)).toBe('2026-11-26');
    expect(chargeDateInPeriod(27, nov)).toBe('2026-10-27');
    expect(chargeDateInPeriod(31, nov)).toBe('2026-10-31');
  });
  it('mese più corto → ultimo giorno', () => {
    const dic = calendarPeriodById('2026-12', 27); // 27 nov – 26 dic
    expect(chargeDateInPeriod(31, dic)).toBe('2026-11-30');
    const mar = calendarPeriodById('2026-03', 27); // 27 feb – 26 mar
    expect(chargeDateInPeriod(29, mar)).toBe('2026-02-28');
    expect(chargeDateInPeriod(30, mar)).toBe('2026-02-28');
  });
});

describe('R8 · generazione automatica (oggi 19 nov)', () => {
  const due = dueCharges(data.recurring, nov, novNoAuto, DEMO_TODAY);

  it('4 addebiti scalati, iCloud no', () => {
    expect(due.map((d) => d.recurring.name)).toEqual(['Rata iPhone', 'Spotify', 'Disney+', 'Prime']);
    expect(due.reduce((s, d) => s + d.recurring.amount, 0)).toBe(8950);
  });

  it('idempotente: eseguirla due volte non duplica', () => {
    const created: Transaction[] = due.map((d, i) => chargeToTransaction(d, nov.id, `auto-${i}`, '2026-11-19T08:00:00.000Z'));
    expect(created[0]).toMatchObject({ type: 'expense', source: 'recurring', recurringId: 'rec-iphone', amount: 7000, card: 'extra', date: '2026-11-01' });
    expect(dueCharges(data.recurring, nov, [...novNoAuto, ...created], DEMO_TODAY)).toEqual([]);
  });

  it('con la fixture completa non c\'è niente da generare', () => {
    expect(dueCharges(data.recurring, nov, data.transactions.filter((t) => t.periodId === nov.id), DEMO_TODAY)).toEqual([]);
  });

  it('il 24 compare iCloud', () => {
    const novAll = data.transactions.filter((t) => t.periodId === nov.id);
    expect(dueCharges(data.recurring, nov, novAll, '2026-11-24').map((d) => d.recurring.name)).toEqual(['iCloud']);
  });

  it('in pausa → non genera', () => {
    const paused = data.recurring.map((r) => (r.name === 'Spotify' ? { ...r, active: false } : r));
    expect(dueCharges(paused, nov, novNoAuto, DEMO_TODAY).map((d) => d.recurring.name)).not.toContain('Spotify');
  });

  it('alla chiusura si generano gli addebiti fino alla fine del periodo', () => {
    const novAll = data.transactions.filter((t) => t.periodId === nov.id);
    expect(dueCharges(data.recurring, nov, novAll, nov.calendarEnd).map((d) => d.date)).toEqual(['2026-11-24']);
  });
});

describe('R8 · totale mensile e stati', () => {
  it('totale attivi € 90,50; margine sulla busta 110 → avanzano € 19,50', () => {
    expect(monthlyTotal(data.recurring)).toBe(9050);
    expect(11000 - monthlyTotal(data.recurring)).toBe(1950);
  });
  it('mettendo in pausa iCloud: totale 89,50, margine 20,50', () => {
    const paused = data.recurring.map((r) => (r.name === 'iCloud' ? { ...r, active: false } : r));
    expect(monthlyTotal(paused)).toBe(8950);
    expect(11000 - monthlyTotal(paused)).toBe(2050);
  });
  it('stati: scalato, tra 5 giorni, domani, in pausa', () => {
    const novAll = data.transactions.filter((t) => t.periodId === nov.id);
    const byName = (n: string) => data.recurring.find((r) => r.name === n)!;
    expect(recurringStatus(byName('Spotify'), nov, novAll, DEMO_TODAY)).toEqual({ kind: 'charged', date: '2026-11-05' });
    expect(recurringStatus(byName('iCloud'), nov, novAll, DEMO_TODAY)).toEqual({ kind: 'upcoming', date: '2026-11-24', inDays: 5 });
    expect(recurringStatus(byName('iCloud'), nov, novAll, '2026-11-23')).toMatchObject({ inDays: 1 });
    expect(recurringStatus({ ...byName('iCloud'), active: false }, nov, novAll, DEMO_TODAY)).toEqual({ kind: 'paused' });
  });
});
