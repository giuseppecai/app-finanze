import { describe, expect, it } from 'vitest';
import { buildDemoData, ENV } from '../../db/fixtures';
import { envelopeBalances, netSpent } from '../envelopes';
import { potLines } from '../pots';
import { allocationAfterRemoval, envelopeInUse, fundsDestinations, planCapsChange, planPotRemoval, recurringOnEnvelope, UNASSIGNED } from '../settings';
import type { MonthlyItem, Pot, Transaction } from '../types';

const data = buildDemoData();
const nov = data.periods.find((p) => p.id === '2026-11')!;
const novTxs = data.transactions.filter((t) => t.periodId === '2026-11');

const tx = (envelopeId: string, type: Transaction['type'], amount: number): Transaction => ({
  id: `t-${envelopeId}-${amount}`, periodId: 'p', date: '2026-11-01', type, amount, envelopeId, note: '', card: null,
  source: 'manual', recurringId: null, personId: null, loanAllocations: null, billId: null, createdAt: '',
});

describe('Imposta · togliere una busta', () => {
  it('a mese aperto il residuo torna in Risparmi e la busta resta con il solo speso', () => {
    const p = { allocations: { a: 5000 }, carryIn: {} };
    expect(allocationAfterRemoval('a', p, [tx('a', 'expense', 1200), tx('a', 'refund', 200)])).toBe(1000);
    const c = planCapsChange([{ id: 'a', name: 'A', shortName: 'A', kind: 'spendable', cap: 5000, order: 1, archived: false }], {}, p, { a: 1000 });
    expect(c).toMatchObject({ diff: -4000, savingsDelta: 4000, transfer: { from: 'budget', to: 'savings', amount: 4000 } });
    expect(c.allocations).toEqual({ a: 1000 });
  });

  it('residuo mandato a un altro salvadanaio: niente giroconto verso Risparmi, una mossa verso Viaggi', () => {
    const p = { allocations: { a: 5000 }, carryIn: {} };
    const env = [{ id: 'a', name: 'A', shortName: 'A', kind: 'spendable' as const, cap: 5000, order: 1, archived: false }];
    const c = planCapsChange(env, {}, p, { a: 1000 }, { a: 'travel' });
    expect(c).toMatchObject({ savingsDelta: 0, transfer: null, moves: [{ to: 'travel', amount: 4000 }] });
    const u = planCapsChange(env, { }, p, { a: 1000 }, { a: UNASSIGNED });
    expect(u.moves).toEqual([{ to: UNASSIGNED, amount: 4000 }]);
  });

  it('residuo in Risparmi insieme a un tetto alzato: si compensano', () => {
    const p = { allocations: { a: 5000, b: 3000 }, carryIn: {} };
    const env = ['a', 'b'].map((id, i) => ({ id, name: id, shortName: id, kind: 'spendable' as const, cap: p.allocations[id as 'a' | 'b'], order: i, archived: false }));
    const c = planCapsChange(env, { b: 4000 }, p, { a: null }, { a: 'travel' });
    // a libera 5000 verso Viaggi, b chiede 1000 a Risparmi
    expect(c).toMatchObject({ savingsDelta: -1000, transfer: { from: 'savings', to: 'budget', amount: 1000 }, moves: [{ to: 'travel', amount: 5000 }] });
  });

  it('senza movimenti né riporti sparisce dal mese e tutto il tetto torna in Risparmi', () => {
    const p = { allocations: { a: 5000, b: 3000 }, carryIn: {} };
    expect(allocationAfterRemoval('a', p, [])).toBeNull();
    const c = planCapsChange([], {}, p, { a: null });
    expect(c.allocations).toEqual({ b: 3000 });
    expect(c.savingsDelta).toBe(5000);
  });

  it('con un riporto, il riporto copre lo speso prima dell\'assegnato', () => {
    expect(allocationAfterRemoval('a', { allocations: { a: 5000 }, carryIn: { a: 800 } }, [tx('a', 'expense', 1000)])).toBe(200);
  });

  it('una busta sforata non cambia: nessun soldo da spostare', () => {
    expect(allocationAfterRemoval('a', { allocations: { a: 5000 }, carryIn: {} }, [tx('a', 'expense', 7000)])).toBe(5000);
  });

  it('Spesa alimentare nel mese demo: dopo la rimozione il residuo è zero', () => {
    const left = allocationAfterRemoval(ENV.spesa, nov, novTxs)!;
    expect(left).toBe(Math.min(nov.allocations[ENV.spesa]!, netSpent(ENV.spesa, novTxs) - (nov.carryIn[ENV.spesa] ?? 0)));
    const c = planCapsChange(data.envelopes, {}, nov, { [ENV.spesa]: left });
    const archived = data.envelopes.map((e) => (e.id === ENV.spesa ? { ...e, archived: true } : e));
    const spesa = envelopeBalances(archived, { ...nov, allocations: c.allocations! }, novTxs).find((b) => b.envelope.id === ENV.spesa)!;
    expect(spesa.remaining).toBe(Math.min(0, spesa.remaining));
  });

  it('senza mese aperto il totale scende del tetto tolto, nessun giroconto', () => {
    const c = planCapsChange(data.envelopes, {}, null, { [ENV.spesa]: null });
    expect(c).toMatchObject({ before: 70000, after: 65000, transfer: null });
  });

  it('usata → si archivia; mai usata → si cancella', () => {
    expect(envelopeInUse(ENV.spesa, data.periods, data.transactions, data.recurring)).toBe(true);
    expect(envelopeInUse('nuova', data.periods, data.transactions, data.recurring)).toBe(false);
  });

  it('R16: gli abbonamenti non tengono legata nessuna busta (si pagano dalla Pocket Spese fisse)', () => {
    expect(recurringOnEnvelope(ENV.rate, data.recurring)).toEqual([]);
    expect(recurringOnEnvelope(ENV.vita, data.recurring)).toEqual([]);
  });
});

describe('Imposta · salvadanai', () => {
  const pots: Pot[] = [
    { id: 'savings', name: 'Risparmi', balance: 100000 },
    { id: 'bills', name: 'Bollette', balance: 0 },
    { id: 'travel', name: 'Viaggi', balance: 30000 },
    { id: 'old', name: 'Vecchio', balance: 0 },
    { id: 'car', name: 'Auto', balance: 0 },
  ];
  const items: MonthlyItem[] = [
    { id: 'travel', name: 'Viaggi', kind: 'pot', amount: 5000, archived: false },
    { id: 'old', name: 'Vecchio', kind: 'pot', amount: 1000, archived: true },
  ];

  it('un salvadanaio libero compare anche vuoto; quello di una voce tolta no', () => {
    expect(potLines(pots, items).map((l) => l.id)).toEqual(['savings', 'travel', 'car', 'bills']);
  });

  it('togliere un salvadanaio: di default il saldo va in Risparmi e la voce collegata sparisce', () => {
    expect(planPotRemoval('travel', pots, items)).toEqual({ amount: 30000, to: 'savings', item: items[0] });
    expect(planPotRemoval('car', pots, items)).toEqual({ amount: 0, to: 'savings', item: null });
  });

  it('si può scegliere un altro salvadanaio o "da assegnare", non sé stesso né uno che non esiste', () => {
    expect(planPotRemoval('travel', pots, items, 'car').to).toBe('car');
    expect(planPotRemoval('travel', pots, items, UNASSIGNED).to).toBe(UNASSIGNED);
    expect(() => planPotRemoval('travel', pots, items, 'travel')).toThrow();
    expect(() => planPotRemoval('travel', pots, items, 'boh')).toThrow();
  });

  it('destinazioni: Risparmi prima, poi gli altri salvadanai, poi da assegnare se il mese è aperto', () => {
    const lines = potLines(pots, items);
    expect(fundsDestinations(lines, 'travel', true, 'Da assegnare').map((d) => d.value)).toEqual(['savings', 'car', 'bills', UNASSIGNED]);
    expect(fundsDestinations(lines, 'travel', false, 'Da assegnare').map((d) => d.value)).toEqual(['savings', 'car', 'bills']);
  });

  it('Risparmi e Bollette non si tolgono', () => {
    expect(() => planPotRemoval('savings', pots, items)).toThrow();
    expect(() => planPotRemoval('bills', pots, items)).toThrow();
  });
});
