import { describe, expect, it } from 'vitest';
import { planClosing } from '../closing';
import { closingPreview, suggestionsAtClosing, transferChecklist } from '../monthEnd';
import { planOpening, type ItemQuota } from '../opening';
import { DEFAULT_MONTHLY_ITEMS } from '../pots';
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
  const items: ItemQuota[] = DEFAULT_MONTHLY_ITEMS.map((item) => ({ item, amount: item.amount }));
  const opening = planOpening(150000, data.envelopes, items);

  it('primo mese: i 4 giroconti di R7', () => {
    expect(transferChecklist(opening, null).map((i) => [i.key, i.to, i.amount])).toEqual([
      ['budget', 'budget', 70000],
      ['item:travel', 'travel', 5000],
      ['item:gifts', 'gifts', 2500],
      ['savings', 'savings', 72500],
    ]);
  });

  it('con l’affitto (uscita) e le bollette: Budget, voci, Bollette, Risparmi', () => {
    const rent = { item: { id: 'rent', name: 'Affitto', kind: 'payment' as const }, amount: 40000 };
    const list = transferChecklist(planOpening(150000, data.envelopes, [...items, rent], 7900), null);
    expect(list.map((i) => [i.key, i.amount])).toEqual([
      ['budget', 70000], ['item:travel', 5000], ['item:gifts', 2500], ['item:rent', 40000], ['bills', 7900], ['savings', 24600],
    ]);
    expect(list[3]?.item?.kind).toBe('payment');
  });

  it('dopo una chiusura con avanzo: prima il giroconto Budget → Risparmi', () => {
    const closing = planClosing(data.periods.find((p) => p.id === '2026-10')!.leftovers!, 0, 'toSavings');
    const list = transferChecklist(opening, closing);
    expect(list[0]).toEqual({ key: 'closing', kind: 'closing', from: 'budget', to: 'savings', amount: 9600, warn: false });
    expect(list).toHaveLength(5);
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
    const short = transferChecklist(planOpening(70000, data.envelopes, items), null);
    expect(short[3]).toMatchObject({ key: 'savings', amount: -7500, warn: true });
  });
});
