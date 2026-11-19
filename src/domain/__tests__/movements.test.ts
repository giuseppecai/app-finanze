import { describe, expect, it } from 'vitest';
import { daysAgo, entryFeedback, expensesSummary, groupByDay, signedAmount } from '../movements';
import { buildDemoData, DEMO_TODAY } from '../../db/fixtures';

const data = buildDemoData();
const nov = data.transactions.filter((t) => t.periodId === '2026-11');

describe('Movimenti', () => {
  it('riepilogo: Speso € 448,50 · 16 spese', () => {
    expect(expensesSummary(nov)).toEqual({ total: 44850, count: 16 });
  });

  it('gruppi per giorno dal più recente, nel giorno l\'ultimo inserito per primo', () => {
    const groups = groupByDay(nov);
    expect(groups.map((g) => g.date).slice(0, 4)).toEqual(['2026-11-19', '2026-11-18', '2026-11-17', '2026-11-16']);
    expect(groups[0]!.transactions.map((t) => t.note)).toEqual(['Pranzo con colleghi', 'Conad']);
    expect(groups[0]!.total).toBe(-4600);
  });

  it('il totale del giorno somma entrate e spese, non i prestiti', () => {
    const groups = groupByDay(nov);
    expect(groups.find((g) => g.date === '2026-11-17')!.total).toBe(112);
    expect(groups.find((g) => g.date === '2026-11-12')!.total).toBe(-4800); // Cena 42 + Disney+ 6, non il prestito a Marco
  });

  it('segno: spese e prestiti escono, rimborsi ed entrate entrano', () => {
    expect(signedAmount({ type: 'expense', amount: 100 })).toBe(-100);
    expect(signedAmount({ type: 'loan', amount: 100 })).toBe(-100);
    expect(signedAmount({ type: 'refund', amount: 100 })).toBe(100);
    expect(signedAmount({ type: 'income', amount: 100 })).toBe(100);
  });
});

describe('Inserimento · riga di feedback', () => {
  it('Vita (69): spesa da 4,80 → restano € 64,20', () => {
    expect(entryFeedback('expense', 6900, 480)).toEqual({ kind: 'left', amount: 6420 });
  });
  it('Spesa alimentare (−8): spesa da 4,80 → sfori di € 12,80', () => {
    expect(entryFeedback('expense', -800, 480)).toEqual({ kind: 'over', amount: 1280 });
  });
  it('spesa che porta esattamente a zero → restano € 0', () => {
    expect(entryFeedback('expense', 480, 480)).toEqual({ kind: 'left', amount: 0 });
  });
  it('rimborso da 4,80 in Vita → torna a € 73,80', () => {
    expect(entryFeedback('refund', 6900, 480)).toEqual({ kind: 'back', amount: 7380 });
  });
});

describe('Ultimo confronto', () => {
  it('16 novembre visto dal 19 → 3 giorni fa', () => {
    expect(daysAgo('2026-11-16', DEMO_TODAY)).toBe(3);
  });
});
