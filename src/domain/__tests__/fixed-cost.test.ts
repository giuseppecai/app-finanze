import { describe, expect, it } from 'vitest';
import { monthlyFixedCost } from '../insights';
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
