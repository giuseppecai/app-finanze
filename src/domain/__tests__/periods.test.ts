import { describe, expect, it } from 'vitest';
import {
  calendarPeriodById, calendarPeriodFor, currentPeriod, daysUntilSalary, isTimeToClose, nextPeriodToStart,
} from '../periods';
import { formatShortRange, formatDayHeading, formatLongRange } from '../dates';
import { buildDemoData, DEMO_TODAY } from '../../db/fixtures';

describe('R2 · periodo di calendario (inizio il 27)', () => {
  it.each([
    ['2026-11-19', '2026-11', 'Novembre', '2026-10-27', '2026-11-26'],
    ['2026-11-27', '2026-12', 'Dicembre', '2026-11-27', '2026-12-26'],
    ['2026-12-27', '2027-01', 'Gennaio', '2026-12-27', '2027-01-26'],
    ['2026-02-26', '2026-02', 'Febbraio', '2026-01-27', '2026-02-26'],
  ])('%s → %s %s (%s – %s)', (date, id, name, start, end) => {
    expect(calendarPeriodFor(date, 27)).toEqual({ id, name, calendarStart: start, calendarEnd: end });
  });

  it('formatta l\'intervallo come nei mockup', () => {
    const p = calendarPeriodFor('2026-11-19', 27);
    expect(formatShortRange(p.calendarStart, p.calendarEnd)).toBe('27 ott – 26 nov');
    const ott = calendarPeriodById('2026-10', 27);
    expect(formatLongRange(ott.calendarStart, ott.calendarEnd)).toBe('27 settembre – 26 ottobre');
    expect(formatDayHeading('2026-11-16')).toBe('Lunedì 16 novembre');
  });

  it('startDay oltre i giorni del mese → ultimo giorno del mese', () => {
    expect(calendarPeriodFor('2026-02-28', 30)).toMatchObject({ id: '2026-03', calendarStart: '2026-02-28', calendarEnd: '2026-03-29' });
    expect(calendarPeriodFor('2026-02-27', 30)).toMatchObject({ id: '2026-02', calendarStart: '2026-01-30', calendarEnd: '2026-02-27' });
  });

  it('inizio il 1 → mese solare', () => {
    expect(calendarPeriodFor('2026-11-19', 1)).toMatchObject({ id: '2026-11', calendarStart: '2026-11-01', calendarEnd: '2026-11-30' });
  });

  it('periodo per id', () => {
    expect(calendarPeriodById('2026-11', 27)).toMatchObject({ calendarStart: '2026-10-27', calendarEnd: '2026-11-26' });
    expect(calendarPeriodById('2027-01', 27)).toMatchObject({ calendarStart: '2026-12-27', calendarEnd: '2027-01-26' });
    expect(calendarPeriodById('2026-11', 1)).toMatchObject({ calendarStart: '2026-11-01', calendarEnd: '2026-11-30' });
  });
});

describe('R2 · periodo reale', () => {
  const data = buildDemoData();
  const nov = data.periods.find((p) => p.id === '2026-11')!;

  it('il periodo corrente è l\'ultimo iniziato e non chiuso', () => {
    expect(currentPeriod(data.periods)?.id).toBe('2026-11');
    expect(currentPeriod([])).toBeNull();
  });

  it('Stipendio tra 8 giorni il 19 novembre', () => {
    expect(daysUntilSalary(nov, DEMO_TODAY)).toBe(8);
  });

  it('il link "Chiudi il mese" compare dal 26 (fine del periodo) in poi, non il 27–31 dopo l\'inizio', () => {
    expect(isTimeToClose(nov, '2026-10-28')).toBe(false);
    expect(isTimeToClose(nov, '2026-11-19')).toBe(false);
    expect(isTimeToClose(nov, '2026-11-25')).toBe(false);
    expect(isTimeToClose(nov, '2026-11-26')).toBe(true);
    expect(isTimeToClose(nov, '2026-11-27')).toBe(true);
    expect(isTimeToClose(nov, '2026-12-05')).toBe(true);
  });

  it('lo stipendio arrivato il 26 apre il periodo successivo', () => {
    expect(nextPeriodToStart(nov, '2026-11-26', 27).id).toBe('2026-12');
    expect(nextPeriodToStart(nov, '2026-11-27', 27).id).toBe('2026-12');
    expect(nextPeriodToStart(nov, '2026-11-24', 27).id).toBe('2026-12');
  });

  it('dopo mesi senza usare l\'app si riparte dal periodo di domani', () => {
    expect(nextPeriodToStart(nov, '2027-02-10', 27).id).toBe('2027-02');
  });

  it('il primo periodo è quello di domani', () => {
    expect(nextPeriodToStart(null, '2026-11-19', 27).id).toBe('2026-11');
    expect(nextPeriodToStart(null, '2026-11-26', 27).id).toBe('2026-12');
    expect(nextPeriodToStart(null, '2026-11-27', 27).id).toBe('2026-12');
  });
});
