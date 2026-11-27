import { describe, expect, it } from 'vitest';
import { fixedThisMonth, monthlyFixedCost } from '../insights';
import type { Bill, MonthlyItem, Recurring } from '../types';

const sub = (name: string, amount: number, extra: Partial<Recurring> = {}): Recurring => ({
  id: name, name, amount, dayOfMonth: 1, envelopeId: 'x', card: 'extra', active: true, createdAt: '', fund: amount, ...extra,
});
const bill = (name: string, estimate: number, split: Bill['split'], frequency: Bill['frequency']): Bill => ({
  id: name, name, frequency, estimate, split, payer: 'me', personId: null, fund: 0, active: true, order: 0, createdAt: '',
});

describe('R23 · quanto costano le spese fisse al mese', () => {
  // Caso reale di fine novembre: a metà mese i fondi delle mensili sono già pieni, ma il costo resta.
  const recurrings = [
    sub('iCloud', 99), sub('Prime', 4990, { frequency: 12, anchorMonth: '2027-09' }), sub('Disney+', 399), sub('Spotify', 850),
    sub('Metro', 25000, { frequency: 12, anchorMonth: '2027-09' }), sub('Fastweb Mobile', 995), sub('Nintendo', 1999, { frequency: 12, anchorMonth: '2027-09' }),
    sub('Claude', 2196), sub('Fire Emblem', 1600),
    sub('Rata iPhone', 6824, { payFrom: 'isybank', fund: 0 }),
    sub('Netflix', 799, { active: false }),
  ];
  const bills = [bill('Luce', 4500, 'half', 1), bill('Fastweb', 2600, 'half', 1), bill('Gas', 4200, 'half', 2), bill('Acqua', 30000, 'mine', 12), bill('Auto', 1887, 'mine', 1)];
  const items: MonthlyItem[] = [
    { id: 'travel', name: 'Viaggi', kind: 'pot', amount: 5000, archived: false },
    { id: 'rent', name: 'Affitto', kind: 'payment', amount: 58200, archived: false, payFrom: 'isybank' },
  ];

  it('€ 828,16 al mese: € 177,92 dalla Pocket, € 650,24 dallo stipendio (affitto + rata da Isybank)', () => {
    expect(monthlyFixedCost(recurrings, bills, items)).toEqual({ total: 82816, fromPocket: 17792, fromSalary: 65024 });
  });

  it('non dipende da quanto è già nella Pocket', () => {
    const empty = recurrings.map((r) => ({ ...r, fund: 0 }));
    expect(monthlyFixedCost(empty, bills, items)).toEqual(monthlyFixedCost(recurrings, bills, items));
  });
});

describe('Spese fisse · questo mese e per dopo', () => {
  // Fine novembre, appena iniziato dicembre (27 nov – 26 dic): Pocket € 350,48.
  const r = (name: string, amount: number, dayOfMonth: number, fund: number, extra: Partial<Recurring> = {}): Recurring => ({
    id: name, name, amount, dayOfMonth, envelopeId: 'x', card: 'extra', active: true, createdAt: '', fund, ...extra,
  });
  const recurrings = [
    r('iCloud', 99, 22, 99), r('Prime', 4990, 22, 1039, { frequency: 12, anchorMonth: '2027-09', saving: true }),
    r('Disney+', 399, 17, 399), r('Spotify', 850, 7, 850),
    r('Metro', 25000, 1, 8334, { frequency: 12, anchorMonth: '2027-02', saving: true }),
    r('Fastweb Mobile', 995, 25, 995), r('Rata iPhone', 6824, 5, 0, { payFrom: 'isybank' }),
    r('Nintendo', 1999, 12, 1999, { frequency: 12, anchorMonth: '2026-12' }),
    r('Netflix', 799, 15, 0, { active: false }), r('Claude', 2196, 29, 2196), r('Fire Emblem', 1600, 16, 1600),
  ];
  const b = (name: string, estimate: number, split: Bill['split'], frequency: Bill['frequency'], fund: number, nextDue: string | null = null): Bill => ({
    id: name, name, frequency, estimate, split, payer: 'me', personId: null, fund, nextDue, active: true, order: 0, createdAt: '',
  });
  const bills = [
    b('Luce', 4500, 'half', 1, 2250), b('Fastweb WiFi', 2600, 'half', 1, 1300), b('Gas', 4200, 'half', 2, 2100, '2026-12'),
    b('Acqua', 30000, 'mine', 12, 10000, '2027-02'), b('Auto', 1887, 'mine', 1, 1887),
  ];
  const items: MonthlyItem[] = [{ id: 'rent', name: 'Affitto', kind: 'payment', amount: 58200, archived: false }];
  const period = { id: '2026-12', calendarStart: '2026-11-27', calendarEnd: '2026-12-26' };

  it('€ 350,48 = € 156,75 escono questo mese + € 193,73 per Acqua, Metro e Prime; € 650,24 dallo stipendio', () => {
    const m = fixedThisMonth({ recurrings, bills, items, period, periodTxs: [], today: '2026-11-27', pocket: 35048 });
    expect(m).toEqual({ dueThisMonth: 15675, forLater: 19373, laterNames: ['Acqua', 'Metro', 'Prime'], fromSalary: 65024 });
  });

  it('dopo l\'addebito di Claude la Pocket scende e il "per dopo" non cambia', () => {
    const charged = { id: 'c', periodId: '2026-12', date: '2026-11-29', type: 'expense' as const, amount: 2196, envelopeId: null,
      note: '', card: null, source: 'recurring' as const, recurringId: 'Claude', personId: null, loanAllocations: null, billId: null, createdAt: '' };
    const m = fixedThisMonth({ recurrings, bills, items, period, periodTxs: [charged], today: '2026-11-29', pocket: 35048 - 2196 });
    expect(m.dueThisMonth).toBe(15675 - 2196);
    expect(m.forLater).toBe(19373);
  });
});
