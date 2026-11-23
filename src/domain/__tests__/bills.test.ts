import { describe, expect, it } from 'vitest';
import {
  billsAsEnvelope, billsQuotaTotal, depositsLeft, nextDueAfterPayment, expectedShare, fundStatus, monthlyQuota, myShare, otherShare, planBillPayment,
} from '../bills';
import { planOpening, type ItemQuota } from '../opening';
import { DEFAULT_MONTHLY_ITEMS } from '../pots';
import type { Bill } from '../types';
import { buildDemoData } from '../../db/fixtures';

const bill = (over: Partial<Bill>): Bill => ({
  id: 'b', name: 'B', frequency: 1, estimate: 0, split: 'half', payer: 'me', personId: 'person-elisa',
  fund: 0, active: true, order: 1, createdAt: '2026-11-01T00:00:00.000Z', ...over,
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

  it('quote mensili: luce 40, internet 14 (mensili, tutta la quota), gas 15, acqua 10 → € 79', () => {
    expect(all.map((b) => monthlyQuota(b))).toEqual([4000, 1400, 1500, 1000]);
    expect(billsQuotaTotal(all)).toBe(7900);
  });

  it('le bollette in pausa non contano', () => {
    expect(billsQuotaTotal([gas, { ...acqua, active: false }])).toBe(1500);
  });

  const items: ItemQuota[] = DEFAULT_MONTHLY_ITEMS.map((item) => ({ item, amount: item.amount }));

  it('Inizio del mese: S 1.500, buste 700, Viaggi 50, Regali 25, Bollette 79 → Risparmi 646', () => {
    const plan = planOpening(150000, buildDemoData().envelopes, items, billsQuotaTotal(all));
    expect(plan).toMatchObject({ budget: 70000, bills: 7900, savings: 64600 });
  });

  it('con Casa & Servizi abbassata a 66 (le bollette mensili non passano più da lì) → Risparmi 700', () => {
    const envs = buildDemoData().envelopes.map((e) => (e.name === 'Casa & Servizi' ? { ...e, cap: 6600 } : e));
    expect(planOpening(150000, envs, items, billsQuotaTotal(all))).toMatchObject({ budget: 64600, savings: 70000 });
  });
});

describe('R13 · registrare una bolletta', () => {
  it('luce € 80,01 pagata da te, fondo 40 → 40,01 dal fondo (Mancano 0,01), prestito 40 a Elisa', () => {
    const l = { ...luce, fund: 4000 };
    const p = planBillPayment(l, 8001, 'me');
    expect(p).toMatchObject({
      myShare: 4001, otherShare: 4000,
      expense: { amount: 4001, envelopeId: null },
      loan: { direction: 'lent', amount: 4000 },
      fundDelta: -4001, potDeltas: { bills: -4001 },
      transfers: [{ from: 'bills', to: 'card', amount: 4001 }, { from: 'savings', to: 'card', amount: 4000 }],
    });
    expect(fundStatus({ ...l, fund: l.fund + p.fundDelta })).toEqual({ fund: -1, target: 4000, missing: 1 });
  });

  it('mensile pagata da lei → spesa dal fondo + debito, Bollette → Risparmi', () => {
    const p = planBillPayment({ ...internet, fund: 1400 }, 2800, 'roommate');
    expect(p).toMatchObject({
      expense: { amount: 1400, envelopeId: null },
      loan: { direction: 'borrowed', amount: 1400 },
      fundDelta: -1400,
      transfers: [{ from: 'bills', to: 'savings', amount: 1400 }],
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

describe('R13 · Bollette in Home tra le Impegnate', () => {
  const list = [
    bill({ id: 'luce', estimate: 8000 }),
    bill({ id: 'internet', estimate: 2800 }),
    bill({ id: 'gas', frequency: 2, estimate: 6000 }),
    bill({ id: 'acqua', frequency: 12, estimate: 12000, split: 'mine' }),
    bill({ id: 'vecchia', estimate: 5000, active: false }),
  ];
  it('€ 134 nella Pocket su € 204 di quote previste (40 + 14 + 30 + 120): manca 70', () => {
    expect(billsAsEnvelope(list, 13400)).toMatchObject({ put: 20400, remaining: 13400, spent: 7000 });
  });
  it('Pocket più piena del necessario: barra vuota', () => {
    expect(billsAsEnvelope(list, 30000).spent).toBe(0);
  });
  it('Pocket sotto zero: residuo negativo (arancione)', () => {
    expect(billsAsEnvelope(list, -500)).toMatchObject({ remaining: -500, spent: 20900 });
  });
});

describe('R13 · quota con la prossima bolletta nota', () => {
  const acqua = bill({ id: 'acqua', frequency: 12, estimate: 30000, split: 'mine', fund: 0, nextDue: '2027-02' });

  it('acqua € 300, niente da parte, a novembre: 3 giroconti (dic, gen, feb) → € 100 al mese', () => {
    expect(depositsLeft('2027-02', '2026-12')).toBe(3);
    expect(monthlyQuota(acqua, '2026-12')).toBe(10000);
  });
  it('senza data: quota fissa € 300 / 12 = € 25', () => {
    expect(monthlyQuota({ ...acqua, nextDue: null }, '2026-12')).toBe(2500);
    expect(monthlyQuota(acqua)).toBe(2500);
  });
  it('dopo un giroconto (fondo 100, prossimo giroconto gennaio): (300 − 100) / 2 = € 100', () => {
    expect(monthlyQuota({ ...acqua, fund: 10000 }, '2027-01')).toBe(10000);
  });
  it('dopo il pagamento la prossima è tra 12 mesi: si torna a € 25', () => {
    expect(nextDueAfterPayment(acqua, '2027-02')).toBe('2028-02');
    expect(monthlyQuota({ ...acqua, fund: 0, nextDue: '2028-02' }, '2027-03')).toBe(2500);
  });
  it('divisa a metà: tua quota 150 → € 50 al mese', () => {
    expect(monthlyQuota({ ...acqua, split: 'half' }, '2026-12')).toBe(5000);
  });
  it('fondo già pieno → 0; bolletta in ritardo → tutto quello che manca al prossimo giroconto', () => {
    expect(monthlyQuota({ ...acqua, fund: 30000 }, '2026-12')).toBe(0);
    expect(monthlyQuota({ ...acqua, fund: 20000 }, '2027-04')).toBe(10000);
  });
  it('le mensili ignorano la data', () => {
    expect(monthlyQuota(bill({ estimate: 8000, nextDue: '2027-02' }), '2026-12')).toBe(4000);
  });
  it('totale: con la data conta la quota ricalcolata', () => {
    expect(billsQuotaTotal([bill({ estimate: 8000 }), acqua], '2026-12')).toBe(4000 + 10000);
  });
});
