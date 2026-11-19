import { describe, expect, it } from 'vitest';
import {
  billsQuotaTotal, expectedShare, fundStatus, monthlyBillsShare, monthlyQuota, myShare, otherShare, planBillPayment,
} from '../bills';
import { planOpening } from '../opening';
import type { Bill } from '../types';
import { buildDemoData } from '../../db/fixtures';

const CASA = 'env-casa';
const bill = (over: Partial<Bill>): Bill => ({
  id: 'b', name: 'B', frequency: 1, estimate: 0, split: 'half', payer: 'me', personId: 'person-elisa',
  envelopeId: CASA, fund: 0, active: true, order: 1, createdAt: '2026-11-01T00:00:00.000Z', ...over,
});

const luce = bill({ id: 'luce', name: 'Luce', estimate: 8000 });
const internet = bill({ id: 'internet', name: 'Internet', estimate: 2800 });
const gas = bill({ id: 'gas', name: 'Gas', frequency: 2, estimate: 6000, payer: 'roommate' });
const acqua = bill({ id: 'acqua', name: 'Acqua', frequency: 12, estimate: 12000, split: 'mine', personId: null });
const all = [luce, internet, gas, acqua];

describe('R13 · quote', () => {
  it('tua quota: metà con il centesimo dispari tuo, oppure tutta', () => {
    expect(myShare(8001, 'half')).toBe(4001);
    expect(otherShare(8001, 'half')).toBe(4000);
    expect(myShare(12000, 'mine')).toBe(12000);
    expect(otherShare(12000, 'mine')).toBe(0);
  });

  it('tabella di esempio: tue quote previste 40, 14, 30, 120', () => {
    expect(all.map(expectedShare)).toEqual([4000, 1400, 3000, 12000]);
  });

  it('quote mensili: gas 15, acqua 10; le mensili non accantonano', () => {
    expect(all.map(monthlyQuota)).toEqual([0, 0, 1500, 1000]);
    expect(billsQuotaTotal(all)).toBe(2500);
  });

  it('bollette mensili nella busta Casa: € 54', () => {
    expect(monthlyBillsShare(all, CASA)).toBe(5400);
  });

  it('le bollette in pausa non contano', () => {
    expect(billsQuotaTotal([gas, { ...acqua, active: false }])).toBe(1500);
  });

  it('Inizio del mese: S 1.500, buste 700, Viaggi 50, Regali 25, Bollette 25 → Risparmi 700', () => {
    const plan = planOpening(150000, buildDemoData().envelopes, 5000, 2500, billsQuotaTotal(all));
    expect(plan).toMatchObject({ budget: 70000, bills: 2500, savings: 70000 });
    expect(plan.transfers.map((t) => t.id)).toEqual(['budget', 'travel', 'gifts', 'bills', 'savings']);
  });
});

describe('R13 · registrare una bolletta', () => {
  it('luce € 80,01 pagata da te → 40,01 in Casa, prestito 40 a Elisa', () => {
    const p = planBillPayment(luce, 8001, 'me');
    expect(p).toMatchObject({
      myShare: 4001, otherShare: 4000,
      expense: { amount: 4001, envelopeId: CASA },
      loan: { direction: 'lent', amount: 4000 },
      fundDelta: 0, potDeltas: {},
      transfers: [{ from: 'savings', to: 'card', amount: 4000 }],
    });
  });

  it('mensile pagata da lei → spesa in Casa + debito, Budget del mese → Risparmi', () => {
    const p = planBillPayment(internet, 2800, 'roommate');
    expect(p).toMatchObject({
      expense: { amount: 1400, envelopeId: CASA },
      loan: { direction: 'borrowed', amount: 1400 },
      transfers: [{ from: 'budget', to: 'savings', amount: 1400 }],
    });
  });

  it('gas € 62 pagato da Elisa con fondo 30 → quota 31, debito 31, fondo − 1', () => {
    const g = { ...gas, fund: 3000 };
    const p = planBillPayment(g, 6200, 'roommate');
    expect(p).toMatchObject({
      myShare: 3100,
      expense: { amount: 3100, envelopeId: null },
      loan: { direction: 'borrowed', amount: 3100 },
      fundDelta: -3100,
      potDeltas: { bills: -3100 },
      transfers: [{ from: 'bills', to: 'savings', amount: 3100 }],
    });
    expect(fundStatus({ ...g, fund: g.fund + p.fundDelta })).toEqual({ fund: -100, target: 3000, missing: 100 });
  });

  it('acqua € 114 con fondo 120 → restano € 6 per l’anno dopo, Bollette → carta', () => {
    const a = { ...acqua, fund: 12000 };
    const p = planBillPayment(a, 11400, 'me');
    expect(p).toMatchObject({ loan: null, fundDelta: -11400, transfers: [{ from: 'bills', to: 'card', amount: 11400 }] });
    expect(a.fund + p.fundDelta).toBe(600);
  });

  it('periodica a metà pagata da te → dal fondo la tua parte, prestito la sua', () => {
    const p = planBillPayment({ ...gas, payer: 'me', fund: 3000 }, 6000, 'me');
    expect(p.transfers).toEqual([
      { from: 'bills', to: 'card', amount: 3000 },
      { from: 'savings', to: 'card', amount: 3000 },
    ]);
    expect(p.loan).toEqual({ direction: 'lent', amount: 3000 });
  });

  it('importo zero non valido', () => {
    expect(() => planBillPayment(luce, 0, 'me')).toThrow();
  });
});
