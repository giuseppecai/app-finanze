import { describe, expect, it } from 'vitest';
import { closingNet, planClosing } from '../closing';
import { buildNewPeriod, itemQuotas, planOpening } from '../opening';
import { DEFAULT_MONTHLY_ITEMS } from '../pots';

const items = itemQuotas(DEFAULT_MONTHLY_ITEMS);
const rent = { item: { id: 'rent', name: 'Affitto', kind: 'payment' as const }, amount: 40000 };
import { calendarPeriodById } from '../periods';
import { reconcile } from '../reconcile';
import { buildDemoData, ENV } from '../../db/fixtures';

const data = buildDemoData();

describe('R5 · Confronta con Revolut', () => {
  it('riserva 200, residui 251,50 → atteso 451,50; saldi 339,10 + 62 + 38 → manca una spesa da € 12,40', () => {
    const r = reconcile({ budgetPocket: 33910, quotidiano: 6200, extra: 3800 }, 25150, 0, 20000);
    expect(r).toMatchObject({ real: 43910, expected: 45150, diff: -1240, outcome: 'missingExpense', cardReserve: 20000 });
  });
  it('diff 0 → tutto in ordine', () => {
    expect(reconcile({ budgetPocket: 35150, quotidiano: 6200, extra: 3800 }, 25150, 0, 20000).outcome).toBe('ok');
  });
  it('diff > 0 → soldi in più su Revolut', () => {
    const r = reconcile({ budgetPocket: 35262, quotidiano: 6200, extra: 3800 }, 25150, 0, 20000);
    expect(r).toMatchObject({ diff: 112, outcome: 'extraIncome' });
  });
  it('il da assegnare entra nell\'atteso', () => {
    expect(reconcile({ budgetPocket: 35262, quotidiano: 6200, extra: 3800 }, 25150, 112, 20000).outcome).toBe('ok');
  });
  it('primo confronto: calibra la riserva = reale − (Σ residui + da assegnare)', () => {
    const r = reconcile({ budgetPocket: 33910, quotidiano: 6200, extra: 3800 }, 25150, 0, null);
    expect(r).toMatchObject({ outcome: 'calibrated', diff: 0, cardReserve: 18760 });
  });
});

describe('R6 · Chiusura del mese (esempio Ottobre)', () => {
  const ott = data.periods.find((p) => p.id === '2026-10')!;
  const leftovers = ott.leftovers!;

  it('avanzi +22, +0,50, +14, +31, −12, +40,50 → netto € 96', () => {
    expect(closingNet(leftovers, 0)).toBe(9600);
  });
  it('A · Tutto in Risparmi → Risparmi + 96, giroconto Budget → Risparmi', () => {
    expect(planClosing(leftovers, 0, 'toSavings')).toMatchObject({
      choice: 'toSavings', net: 9600, savingsDelta: 9600,
      transfer: { from: 'budget', to: 'savings', amount: 9600 }, nextCarryIn: {}, nextUnassigned: 0,
    });
  });
  it('B · Lascia nel Budget del mese → riporti per busta (anche negativi), nessun giroconto', () => {
    const plan = planClosing(leftovers, 0, 'carryOver');
    expect(plan).toMatchObject({ choice: 'carryOver', savingsDelta: 0, transfer: null, nextUnassigned: 0 });
    expect(plan.nextCarryIn[ENV.spesa]).toBe(-1200);
    expect(plan.nextCarryIn[ENV.shopping]).toBe(4050);
  });
  it('C · Metà e metà → 48 in Risparmi, 48 da assegnare', () => {
    expect(planClosing(leftovers, 0, 'half')).toMatchObject({
      choice: 'half', savingsDelta: 4800, transfer: { from: 'budget', to: 'savings', amount: 4800 }, nextUnassigned: 4800,
    });
  });
  it('C con centesimi dispari: floor in Risparmi, il resto da assegnare', () => {
    const plan = planClosing({ a: 9601 }, 0, 'half');
    expect(plan.savingsDelta).toBe(4800);
    expect(plan.nextUnassigned).toBe(4801);
  });
  it('il da assegnare del periodo entra nel netto', () => {
    expect(planClosing(leftovers, 112, 'toSavings').net).toBe(9712);
  });
  it('netto ≤ 0 → niente scelta: copri da Risparmi', () => {
    const plan = planClosing({ a: -2000, b: 500 }, 0, 'toSavings');
    expect(plan).toMatchObject({
      choice: 'deficit', net: -1500, savingsDelta: -1500,
      transfer: { from: 'savings', to: 'budget', amount: 1500 }, nextCarryIn: {}, nextUnassigned: 0,
    });
  });
  it('netto esattamente 0 → deficit senza giroconto', () => {
    expect(planClosing({ a: 0 }, 0, 'half')).toMatchObject({ choice: 'deficit', transfer: null, savingsDelta: 0 });
  });
});

describe('R7 · Inizio del mese', () => {
  it('S = 1.500 → Budget 700, Viaggi 50, Regali 25, Risparmi 725', () => {
    const plan = planOpening(150000, data.envelopes, items);
    expect(plan).toMatchObject({ budget: 70000, savings: 72500, short: false });
    expect(plan.items.map((q) => [q.item.id, q.amount])).toEqual([['travel', 5000], ['gifts', 2500]]);
  });
  it('affitto € 400 come uscita fissa → Risparmi 325', () => {
    expect(planOpening(150000, data.envelopes, [...items, rent])).toMatchObject({ savings: 32500 });
  });
  it('importo cambiato solo per questo mese: Viaggi 80 → Risparmi 695', () => {
    expect(planOpening(150000, data.envelopes, itemQuotas(DEFAULT_MONTHLY_ITEMS, { travel: 8000 }))).toMatchObject({ savings: 69500 });
  });
  it('le voci archiviate non compaiono', () => {
    const list = itemQuotas([...DEFAULT_MONTHLY_ITEMS, { id: 'gym', name: 'Palestra', kind: 'payment', amount: 3000, archived: true }]);
    expect(list.map((q) => q.item.id)).toEqual(['travel', 'gifts']);
  });
  it('stipendio che non copre le buste → Risparmi negativo', () => {
    expect(planOpening(70000, data.envelopes, items)).toMatchObject({ savings: -7500, short: true });
  });
  it('le buste archiviate non entrano nel budget', () => {
    const envs = data.envelopes.map((e) => (e.id === ENV.shopping ? { ...e, archived: true } : e));
    expect(planOpening(150000, envs, items).budget).toBe(58000);
  });
  it('crea il periodo: fotografa i tetti, applica la chiusura, aggiorna i salvadanai', () => {
    const ott = data.periods.find((p) => p.id === '2026-10')!;
    const closing = planClosing(ott.leftovers!, 0, 'half');
    const { period, potDeltas } = buildNewPeriod({
      target: calendarPeriodById('2026-11', 27),
      today: '2026-10-26',
      salary: 150000,
      envelopes: data.envelopes,
      items: [...items, rent],
      closing,
    });
    expect(period).toMatchObject({
      id: '2026-11', name: 'Novembre', startedAt: '2026-10-26', calendarStart: '2026-10-27',
      salary: 150000, unassigned: 4800, carryIn: {}, closedAt: null,
    });
    expect(period.allocations[ENV.vita]).toBe(20000);
    expect(period.quotas).toEqual({ travel: 5000, gifts: 2500, rent: 40000 });
    // l'affitto esce: nessun salvadanaio
    expect(potDeltas).toEqual({ savings: 32500 + 4800, travel: 5000, gifts: 2500, bills: 0 });
  });
  it('opzione B: i riporti passano al periodo nuovo', () => {
    const ott = data.periods.find((p) => p.id === '2026-10')!;
    const { period } = buildNewPeriod({
      target: calendarPeriodById('2026-11', 27), today: '2026-10-27', salary: 150000,
      envelopes: data.envelopes, items,
      closing: planClosing(ott.leftovers!, 0, 'carryOver'),
    });
    expect(period.carryIn[ENV.spesa]).toBe(-1200);
  });
});
