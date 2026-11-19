import { describe, expect, it } from 'vitest';
import { planClosing } from '../closing';
import { closingPreview, suggestionsAtClosing, transferChecklist } from '../monthEnd';
import { planOpening } from '../opening';
import { buildDemoData, ENV } from '../../db/fixtures';

const data = buildDemoData();
const nov = data.periods.find((p) => p.id === '2026-11')!;
const novTxs = data.transactions.filter((t) => t.periodId === nov.id);

describe('Chiusura di Novembre (fixture)', () => {
  const preview = closingPreview(data.envelopes, nov, novTxs, data.recurring);

  it('conta anche iCloud del 24, non ancora scalato', () => {
    expect(preview.pending.map((p) => [p.recurring.name, p.date])).toEqual([['iCloud', '2026-11-24']]);
    expect(preview.leftovers[ENV.rate]).toBe(1950);
  });

  it('avanzi per busta e da assegnare', () => {
    expect(preview.leftovers).toEqual({
      [ENV.trasporti]: 3800, [ENV.vita]: 6900, [ENV.spesa]: -800, [ENV.shopping]: 7500, [ENV.casa]: 5700, [ENV.rate]: 1950,
    });
    expect(preview.unassigned).toBe(112);
    expect(planClosing(preview.leftovers, preview.unassigned, 'toSavings').net).toBe(25162);
  });

  it('senza abbonamenti in sospeso non aggiunge nulla', () => {
    const paused = data.recurring.map((r) => ({ ...r, active: false }));
    expect(closingPreview(data.envelopes, nov, novTxs, paused).pending).toEqual([]);
  });

  it('suggerimento: Spesa alimentare ha sforato 5 mesi su 5 (Novembre compreso) → € 60', () => {
    const s = suggestionsAtClosing(data.envelopes, data.periods, nov, preview.leftovers);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ envelopeId: ENV.spesa, overMonths: 5, months: 5, averageOver: 820, suggestedCap: 6000 });
  });
});

describe('Checklist dei giroconti', () => {
  const opening = planOpening(150000, data.envelopes, 5000, 2500);

  it('primo mese: i 4 giroconti di R7', () => {
    expect(transferChecklist(opening, null).map((i) => [i.id, i.to, i.amount])).toEqual([
      ['budget', 'budget', 70000],
      ['travel', 'travel', 5000],
      ['gifts', 'gifts', 2500],
      ['savings', 'savings', 72500],
    ]);
  });

  it('dopo una chiusura con avanzo: prima il giroconto Budget → Risparmi', () => {
    const closing = planClosing(data.periods.find((p) => p.id === '2026-10')!.leftovers!, 0, 'toSavings');
    const items = transferChecklist(opening, closing);
    expect(items[0]).toEqual({ id: 'closing', from: 'budget', to: 'savings', amount: 9600, warn: false });
    expect(items).toHaveLength(5);
  });

  it('opzione B: nessun giroconto di chiusura', () => {
    const closing = planClosing({ a: 9600 }, 0, 'carryOver');
    expect(transferChecklist(opening, closing)).toHaveLength(4);
  });

  it('deficit: Risparmi → Budget del mese', () => {
    const closing = planClosing({ a: -1500 }, 0, 'toSavings');
    expect(transferChecklist(opening, closing)[0]).toMatchObject({ from: 'savings', to: 'budget', amount: 1500 });
  });

  it('stipendio che non copre le buste: riga Risparmi in avviso', () => {
    const short = transferChecklist(planOpening(70000, data.envelopes, 5000, 2500), null);
    expect(short[3]).toMatchObject({ id: 'savings', amount: -7500, warn: true });
  });
});
