import { describe, expect, it } from 'vitest';
import { barFill, barState, summarizePeriod } from '../envelopes';
import type { Envelope, Transaction } from '../types';
import { buildDemoData, ENV } from '../../db/fixtures';

const data = buildDemoData();
const nov = data.periods.find((p) => p.id === '2026-11')!;
const novTxs = data.transactions.filter((t) => t.periodId === '2026-11');
const withoutIncome = novTxs.filter((t) => t.type !== 'income');

describe('R3 · residuo delle buste (fixture Novembre, oggi 19 nov)', () => {
  const summary = summarizePeriod(data.envelopes, nov, withoutIncome);
  const byId = Object.fromEntries(summary.balances.map((b) => [b.envelope.id, b]));

  it.each([
    [ENV.trasporti, 10000, 6200, 3800],
    [ENV.vita, 20000, 13100, 6900],
    [ENV.spesa, 5000, 5800, -800],
    [ENV.shopping, 12000, 4500, 7500],
    [ENV.casa, 12000, 6300, 5700],
    [ENV.rate, 11000, 8950, 2050],
  ])('%s: tetto %i, speso %i → residuo %i', (id, cap, spent, remaining) => {
    expect(byId[id]).toMatchObject({ allocated: cap, put: cap, spent, remaining });
  });

  it('Puoi ancora spendere = 38 + 69 − 8 + 75 + 57 + 0 = € 231', () => {
    expect(summary.unassigned).toBe(0);
    expect(summary.spendable).toBe(23100);
  });
  it('Impegnate · rimasti = € 20,50 (solo Rate & Abbonamenti)', () => {
    expect(summary.committedRemaining).toBe(2050);
  });
  it('Totale buste = € 251,50', () => {
    expect(summary.envelopesTotal).toBe(25150);
  });

  it('con l\'entrata "Interessi" da € 1,12 → € 232,12', () => {
    const full = summarizePeriod(data.envelopes, nov, novTxs);
    expect(full.unassigned).toBe(112);
    expect(full.spendable).toBe(23212);
  });

  it('i rimborsi aumentano il residuo', () => {
    const refund: Transaction = { ...withoutIncome[0]!, id: 'r', type: 'refund', amount: 480, envelopeId: ENV.vita };
    const s = summarizePeriod(data.envelopes, nov, [...withoutIncome, refund]);
    expect(s.balances.find((b) => b.envelope.id === ENV.vita)?.remaining).toBe(7380);
  });

  it('il riporto (opzione B) si somma a quanto messo', () => {
    const s = summarizePeriod(data.envelopes, { ...nov, carryIn: { [ENV.spesa]: -1200 } }, withoutIncome);
    expect(s.balances.find((b) => b.envelope.id === ENV.spesa)).toMatchObject({ put: 3800, remaining: -2000 });
  });

  it('prestiti e restituzioni non toccano le buste', () => {
    const loans = data.transactions.filter((t) => t.type === 'loan');
    expect(loans.length).toBeGreaterThan(0);
    expect(summarizePeriod(data.envelopes, nov, [...withoutIncome, ...loans]).envelopesTotal).toBe(25150);
  });
});

describe('R3 · colore della barra', () => {
  const s = summarizePeriod(data.envelopes, nov, withoutIncome);
  const state = (id: string) => barState(s.balances.find((b) => b.envelope.id === id)!);

  it('residuo < 0 → arancione (oltre il tetto)', () => {
    expect(state(ENV.spesa)).toBe('over');
  });
  it('impegnata → grigio, anche sotto il 20% (Rate: 20,50 su 110)', () => {
    expect(state(ENV.rate)).toBe('committed');
  });
  it('residuo esattamente zero → grigio chiaro (busta svuotata), anche per le impegnate', () => {
    expect(barState({ envelope: { kind: 'spendable' }, put: 4500, remaining: 0 })).toBe('empty');
    expect(barState({ envelope: { kind: 'committed' }, put: 11000, remaining: 0 })).toBe('empty');
    expect(barState({ envelope: { kind: 'spendable' }, put: 0, remaining: 0 })).toBe('low');
  });
  it('Casa & Servizi ora è da spendere: 57 su 120 → accento', () => {
    expect(state(ENV.casa)).toBe('ok');
  });
  it('impegnata sforata → arancione', () => {
    const env: Pick<Envelope, 'kind'> = { kind: 'committed' };
    expect(barState({ envelope: env, put: 11000, remaining: -100 })).toBe('over');
  });
  it('da spendere sotto il 20% → ambra, altrimenti accento', () => {
    const env: Pick<Envelope, 'kind'> = { kind: 'spendable' };
    expect(barState({ envelope: env, put: 10000, remaining: 1999 })).toBe('low');
    expect(barState({ envelope: env, put: 10000, remaining: 2000 })).toBe('ok');
    expect(state(ENV.trasporti)).toBe('ok');
  });
  it('larghezza = speso / messo, massimo 100%', () => {
    expect(barFill({ spent: 6200, put: 10000 })).toBeCloseTo(0.62);
    expect(barFill({ spent: 5800, put: 5000 })).toBe(1);
    expect(barFill({ spent: -500, put: 5000 })).toBe(0);
  });
});
