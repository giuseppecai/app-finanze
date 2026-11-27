import { describe, expect, it } from 'vitest';
import { validateEntry } from '../entry';
import { netSpent } from '../envelopes';
import { searchSummary, spentBetween } from '../insights';
import { dayTotalKind, groupByDay } from '../movements';
import { DEFAULT_MONTHLY_ITEMS, isPotRefund, potDeltaOf, potLines, refundPots } from '../pots';
import type { Pot, Transaction } from '../types';

const gift: Transaction = {
  id: 'g', periodId: '2026-11', date: '2026-11-20', type: 'refund', amount: 5000, envelopeId: null, potId: 'travel',
  note: 'Regalo di compleanno', card: null, source: 'manual', recurringId: null, personId: null, loanAllocations: null,
  billId: null, createdAt: '',
};

describe('R4 · rimborso in una Pocket', () => {
  it('Viaggi € 180, regalo € 50 → Viaggi € 230; portato a € 60 → € 240; eliminato → € 180', () => {
    let travel = 18000;
    const add = potDeltaOf(gift)!;
    expect(add).toEqual({ potId: 'travel', delta: 5000 });
    travel += add.delta;
    expect(travel).toBe(23000);
    // modifica: tolgo l'effetto di prima, metto il nuovo
    travel += -add.delta + potDeltaOf({ ...gift, amount: 6000 })!.delta;
    expect(travel).toBe(24000);
    travel -= potDeltaOf({ ...gift, amount: 6000 })!.delta;
    expect(travel).toBe(18000);
  });

  it('solo i rimborsi con una Pocket toccano i salvadanai', () => {
    expect(potDeltaOf({ ...gift, potId: null })).toBeNull();
    expect(potDeltaOf({ ...gift, type: 'expense' })).toBeNull();
    expect(isPotRefund(gift)).toBe(true);
    expect(isPotRefund({ ...gift, potId: undefined })).toBe(false);
  });

  it('non tocca buste, ritmo né ricerca', () => {
    const shop: Transaction = { ...gift, id: 's', type: 'expense', amount: 1200, envelopeId: 'vita', potId: null };
    expect(netSpent('vita', [shop, gift])).toBe(1200);
    expect(spentBetween([shop, gift], '2026-11-01', '2026-11-30')).toBe(1200);
    expect(searchSummary([shop, gift])).toEqual({ count: 2, total: 1200, months: 1 });
    const [day] = groupByDay([shop, gift]);
    expect(day!.total).toBe(-1200);
    expect(dayTotalKind(day!)).toBe('spent');
    expect(dayTotalKind(groupByDay([gift])[0]!)).toBe('none');
  });

  it('il rimborso vuole una busta o una Pocket; la spesa sempre una busta', () => {
    expect(validateEntry({ type: 'refund', amount: 5000, envelopeId: null, potId: 'travel', personId: null })).toEqual([]);
    expect(validateEntry({ type: 'refund', amount: 5000, envelopeId: null, potId: null, personId: null })).toEqual(['envelopeRequired']);
    expect(validateEntry({ type: 'expense', amount: 5000, envelopeId: null, potId: 'travel', personId: null })).toEqual(['envelopeRequired']);
  });

  it('Pocket per il rimborso: tutte quelle di Messi da parte tranne Spese fisse', () => {
    const pots: Pot[] = [
      { id: 'savings', name: 'Risparmi', balance: 124000 },
      { id: 'travel', name: 'Viaggi', balance: 18000 },
      { id: 'gifts', name: 'Regali & Imprevisti', balance: 7500 },
      { id: 'bills', name: 'Spese fisse', balance: 13400 },
    ];
    expect(refundPots(potLines(pots, DEFAULT_MONTHLY_ITEMS)).map((l) => l.id)).toEqual(['savings', 'travel', 'gifts']);
  });
});
