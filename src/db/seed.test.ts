import { describe, expect, it } from 'vitest';
import { capsTotal } from '../domain/opening';
import { monthlyTotal } from '../domain/recurring';
import { buildSeed } from './seed';
import { buildDemoData } from './fixtures';

describe('dati iniziali', () => {
  let n = 0;
  const seed = buildSeed(() => `id-${++n}`, '2026-11-19T10:00:00.000Z');

  it('6 buste per € 700, nell\'ordine dei documenti', () => {
    expect(seed.envelopes.map((e) => [e.shortName, e.kind, e.cap])).toEqual([
      ['Trasporti', 'spendable', 10000],
      ['Vita', 'spendable', 20000],
      ['Spesa', 'spendable', 5000],
      ['Shopping', 'spendable', 12000],
      ['Casa', 'committed', 12000],
      ['Rate', 'committed', 11000],
    ]);
    expect(capsTotal(seed.envelopes)).toBe(70000);
  });

  it('abbonamenti su Rate & Abbonamenti, carta Extra, € 90,50 al mese', () => {
    const rate = seed.envelopes.find((e) => e.shortName === 'Rate')!;
    expect(seed.recurring.every((r) => r.envelopeId === rate.id && r.card === 'extra' && r.active)).toBe(true);
    expect(monthlyTotal(seed.recurring)).toBe(9050);
  });

  it('impostazioni di default, salvadanai a zero, nessun periodo', () => {
    expect(seed.settings).toEqual({
      id: 'settings', periodStartDay: 27, cardReserve: null, giftsQuota: 2500,
      lastTravelQuota: 5000, lastEnvelopeId: null, onboardingDone: false,
    });
    expect(seed.pots.map((p) => [p.id, p.balance])).toEqual([['savings', 0], ['travel', 0], ['gifts', 0], ['bills', 0]]);
    expect(seed.periods).toEqual([]);
  });

  it('id tutti diversi', () => {
    const ids = [...seed.envelopes, ...seed.recurring].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('fixture demo', () => {
  const demo = buildDemoData();
  it('salvadanai come nella Home: € 1.495 messi da parte', () => {
    expect(demo.pots.filter((p) => p.id !== 'bills').reduce((s, p) => s + p.balance, 0)).toBe(149500);
    expect(demo.pots.find((p) => p.id === 'bills')?.balance).toBe(8000);
  });
  it('Novembre: 16 spese per € 448,50', () => {
    const spese = demo.transactions.filter((t) => t.periodId === '2026-11' && t.type === 'expense');
    expect(spese).toHaveLength(16);
    expect(spese.reduce((s, t) => s + t.amount, 0)).toBe(44850);
  });
  it('ogni movimento automatico punta a una ricorrenza esistente', () => {
    const ids = new Set(demo.recurring.map((r) => r.id));
    expect(demo.transactions.filter((t) => t.source === 'recurring').every((t) => t.recurringId && ids.has(t.recurringId))).toBe(true);
  });
});
