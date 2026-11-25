import { describe, expect, it } from 'vitest';
import {
  dueCharges,
  isChargeMonth,
  monthlyTotal,
  nextChargeDate,
  periodTotal,
  recurringDateInPeriod,
  recurringRows,
  recurringStatus,
} from '../recurring';
import { calendarPeriodById } from '../periods';
import type { Recurring } from '../types';
import { buildDemoData, DEMO_TODAY, ENV } from '../../db/fixtures';

const base = { envelopeId: ENV.rate, card: 'extra', active: true, createdAt: '2026-01-01T00:00:00Z' } as const;
// Esempi di R8 · "Abbonamenti non mensili" (startDay 27)
const dominio: Recurring = { ...base, id: 'dom', name: 'Dominio', amount: 1200, dayOfMonth: 14, frequency: 12, anchorMonth: '2027-03' };
const palestra: Recurring = { ...base, id: 'pal', name: 'Palestra', amount: 3000, dayOfMonth: 27, frequency: 2, anchorMonth: '2026-10' };

const nov = calendarPeriodById('2026-11', 27); // 27 ott – 26 nov
const dic = calendarPeriodById('2026-12', 27); // 27 nov – 26 dic
const gen = calendarPeriodById('2027-01', 27); // 27 dic – 26 gen
const mar = calendarPeriodById('2027-03', 27); // 27 feb – 26 mar

describe('R8 · abbonamenti non mensili', () => {
  it('mesi di addebito: ogni N mesi dal mese di riferimento, anche all’indietro', () => {
    expect(isChargeMonth(dominio, '2027-03')).toBe(true);
    expect(isChargeMonth(dominio, '2026-03')).toBe(true);
    expect(isChargeMonth(dominio, '2027-02')).toBe(false);
    expect(isChargeMonth(palestra, '2026-12')).toBe(true);
    expect(isChargeMonth(palestra, '2026-11')).toBe(false);
    // senza frequenza o senza mese di riferimento = ogni mese
    expect(isChargeMonth({ frequency: 12, anchorMonth: null }, '2026-11')).toBe(true);
    expect(isChargeMonth({}, '2026-11')).toBe(true);
  });

  it('annuale: si scala solo nel periodo che contiene il 14 marzo', () => {
    expect(recurringDateInPeriod(dominio, nov)).toBeNull();
    expect(recurringDateInPeriod(dominio, mar)).toBe('2027-03-14');
  });

  it('bimestrale il 27: novembre sì (27 ott), dicembre no, gennaio sì (27 dic)', () => {
    expect(recurringDateInPeriod(palestra, nov)).toBe('2026-10-27');
    expect(recurringDateInPeriod(palestra, dic)).toBeNull();
    expect(recurringDateInPeriod(palestra, gen)).toBe('2026-12-27');
  });

  it('generazione automatica: l’annuale non si scala a novembre, una volta sola a marzo', () => {
    const novP = { ...nov, id: '2026-11' };
    expect(dueCharges([dominio, palestra], novP, [], DEMO_TODAY).map((d) => d.recurring.name)).toEqual(['Palestra']);
    const marP = { ...mar, id: '2027-03' };
    const due = dueCharges([dominio], marP, [], '2027-03-20');
    expect(due.map((d) => d.date)).toEqual(['2027-03-14']);
  });

  it('prossimo addebito e stato "più avanti"', () => {
    expect(nextChargeDate(dominio, '2026-11-19')).toBe('2027-03-14');
    expect(nextChargeDate(dominio, '2027-03-14')).toBe('2027-03-14');
    expect(nextChargeDate(dominio, '2027-03-15')).toBe('2028-03-14');
    expect(recurringStatus(dominio, { ...nov, id: '2026-11' }, [], DEMO_TODAY)).toEqual({ kind: 'later', date: '2027-03-14' });
    expect(recurringStatus(palestra, { ...dic, id: '2026-12' }, [], '2026-12-01')).toEqual({ kind: 'later', date: '2026-12-27' });
  });

  it('totali: ogni mese 90,50 (solo mensili); questo mese 120,50 con la Palestra', () => {
    const data = buildDemoData();
    const list = [...data.recurring, dominio, palestra];
    expect(monthlyTotal(list)).toBe(9050);
    const novP = data.periods.find((p) => p.id === '2026-11')!;
    const rows = recurringRows(list, novP, data.transactions.filter((t) => t.periodId === novP.id), DEMO_TODAY);
    expect(periodTotal(rows, novP.id)).toBe(12050);
    expect(11000 - periodTotal(rows, novP.id)).toBe(-1050); // sfori la busta di 10,50
    // Dominio è l'unico fuori dal periodo: in fondo, con la data del prossimo addebito
    const later = rows.filter((r) => r.date === null);
    expect(later.map((r) => [r.recurring.name, r.shownDate])).toEqual([['Dominio', '2027-03-14']]);
  });
});
