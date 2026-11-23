import { describe, expect, it } from 'vitest';
import { applyRepayment, debtors, openLoansOf, owedBy, totalOwed, undoRepayment } from '../loans';
import { averageSpending, capSuggestion, historyForClosed, historyForCurrent } from '../stats';
import { summarizePeriod } from '../envelopes';
import { pickerGrid, preselectedEnvelope, sortEnvelopesForPicker, validateEntry } from '../entry';
import type { Loan } from '../types';
import { buildDemoData, DEMO_TODAY, ENV } from '../../db/fixtures';

const data = buildDemoData();
const MAMMA = 'person-mamma';
const MARCO = 'person-marco';

function replace(loans: Loan[], updated: Loan[]): Loan[] {
  const byId = new Map(updated.map((l) => [l.id, l]));
  return loans.map((l) => byId.get(l.id) ?? l);
}

describe('R9 · Prestiti FIFO', () => {
  it('Mamma: 10 + 10 + 20 → deve € 40; totale generale con Marco € 55', () => {
    expect(owedBy(data.loans, MAMMA)).toBe(4000);
    expect(owedBy(data.loans, MARCO)).toBe(1500);
    expect(totalOwed(data.loans)).toBe(5500);
  });

  it('restituisce 25 → chiusi i primi due, il terzo resta € 15; totale 30', () => {
    const r = applyRepayment(data.loans, MAMMA, 2500, '2026-11-19T10:00:00.000Z');
    expect(r.allocations).toEqual([
      { loanId: 'loan-1', amount: 1000 },
      { loanId: 'loan-2', amount: 1000 },
      { loanId: 'loan-3', amount: 500 },
    ]);
    expect(r.closedCount).toBe(2);
    const after = replace(data.loans, r.updated);
    expect(openLoansOf(after, MAMMA).map((l) => [l.id, l.remaining])).toEqual([['loan-3', 1500]]);
    expect(after.find((l) => l.id === 'loan-1')?.closedAt).toBe('2026-11-19T10:00:00.000Z');
    expect(owedBy(after, MAMMA)).toBe(1500);
    expect(totalOwed(after)).toBe(3000);

    // Annulla → torna a 40
    const undone = replace(after, undoRepayment(after, r.allocations));
    expect(owedBy(undone, MAMMA)).toBe(4000);
    expect(undone.every((l) => l.closedAt === null)).toBe(true);
  });

  it('"Tutto" chiude tutti i prestiti e la persona sparisce da "Chi ti deve"', () => {
    const r = applyRepayment(data.loans, MAMMA, 4000, 'x');
    const after = replace(data.loans, r.updated);
    expect(debtors(after).map((d) => d.personId)).toEqual([MARCO]);
  });

  it('ordine: data, poi createdAt', () => {
    const tie: Loan[] = [
      { ...data.loans[0]!, id: 'b', date: '2026-11-01', createdAt: '2026-11-01T12:00:00Z' },
      { ...data.loans[0]!, id: 'a', date: '2026-11-01', createdAt: '2026-11-01T09:00:00Z' },
    ];
    expect(openLoansOf(tie, MAMMA).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('non si può restituire più di quanto dovuto, né zero', () => {
    expect(() => applyRepayment(data.loans, MAMMA, 4001, 'x')).toThrow();
    expect(() => applyRepayment(data.loans, MAMMA, 0, 'x')).toThrow();
  });

  it('Chi ti deve: chi deve di più per primo', () => {
    expect(debtors(data.loans).map((d) => [d.personId, d.owed])).toEqual([[MAMMA, 4000], [MARCO, 1500]]);
  });
});

describe('R10 · Spesa media', () => {
  const spesa = data.envelopes.find((e) => e.id === ENV.spesa)!;

  it('Spesa alimentare 56, 58, 54, 59, 62 → € 58, più del tetto 50', () => {
    expect(averageSpending(spesa, data.periods)).toEqual({ average: 5800, periods: 5, aboveCap: true });
  });
  it('con il tetto a 60 la riga torna grigia', () => {
    expect(averageSpending({ ...spesa, cap: 6000 }, data.periods)?.aboveCap).toBe(false);
  });
  it('senza periodi chiusi la riga non compare', () => {
    expect(averageSpending(spesa, data.periods.filter((p) => p.closedAt === null))).toBeNull();
  });
  it('considera al massimo gli ultimi 6 periodi chiusi', () => {
    expect(averageSpending(spesa, data.periods, 2)).toMatchObject({ average: 6100, periods: 2 }); // Ott 62, Set 59 → 60,50 → 61
  });
});

describe('R6 · Suggerimento tetto', () => {
  const byId = (id: string) => data.envelopes.find((e) => e.id === id)!;

  it('Spesa alimentare: sforato in 5 mesi su 5, in media di € 7,80 (≈ € 8) → suggerito € 60', () => {
    expect(capSuggestion(byId(ENV.spesa), data.periods)).toEqual({
      envelopeId: ENV.spesa, overMonths: 5, months: 5, averageOver: 780, averageSpent: 5780, suggestedCap: 6000,
    });
  });
  it('Trasporti ha sforato solo 2 volte su 5 → nessun suggerimento', () => {
    expect(capSuggestion(byId(ENV.trasporti), data.periods)).toBeNull();
  });
  it('le buste impegnate non generano suggerimenti', () => {
    expect(capSuggestion(byId(ENV.casa), data.periods)).toBeNull();
  });
});

describe('R11 · Storico', () => {
  const order = data.envelopes.map((e) => e.id);
  const closed = (id: string) => historyForClosed(data.periods.find((p) => p.id === id)!, order);

  it.each([
    ['2026-06', 65200, false],
    ['2026-07', 73100, true],
    ['2026-08', 68800, false],
    ['2026-09', 64000, false],
    ['2026-10', 60400, false],
  ])('%s: speso %i (sopra il budget: %s)', (id, spent, over) => {
    const h = closed(id);
    expect(h.spent).toBe(spent);
    expect(h.capsTotal).toBe(70000);
    expect(h.overBudget).toBe(over);
    expect(h.final).toBe(70000 - spent);
  });

  it('riga busta: messo, speso, avanzo', () => {
    expect(closed('2026-10').rows.find((r) => r.envelopeId === ENV.spesa)).toEqual({ envelopeId: ENV.spesa, put: 5000, spent: 6200, final: -1200 });
  });

  it('Novembre in corso: speso € 448,50, colonna Resta', () => {
    const nov = data.periods.find((p) => p.id === '2026-11')!;
    const s = summarizePeriod(data.envelopes, nov, data.transactions.filter((t) => t.periodId === nov.id));
    const h = historyForCurrent(nov, s.balances);
    expect(h).toMatchObject({ inProgress: true, spent: 44850, final: 25150, overBudget: false });
  });
});

describe('R12 · Inserimento rapido', () => {
  const novTxs = data.transactions.filter((t) => t.periodId === '2026-11');

  it('buste ordinate per uso negli ultimi 60 giorni, le impegnate in fondo', () => {
    const sorted = sortEnvelopesForPicker(data.envelopes, novTxs, DEMO_TODAY).map((e) => e.shortName);
    // Vita 5 · Trasporti 2 · Spesa 2 · Casa 2 · Shopping 1 | Rate 4 (Casa & Servizi ora è da spendere)
    expect(sorted).toEqual(['Vita', 'Trasporti', 'Spesa', 'Casa', 'Shopping', 'Rate']);
  });
  it('a parità di uso vale l\'ordine di Imposta', () => {
    expect(sortEnvelopesForPicker(data.envelopes, [], DEMO_TODAY).map((e) => e.shortName))
      .toEqual(['Trasporti', 'Vita', 'Spesa', 'Shopping', 'Casa', 'Rate']);
  });
  it('busta preselezionata = ultima usata', () => {
    const sorted = sortEnvelopesForPicker(data.envelopes, novTxs, DEMO_TODAY);
    expect(preselectedEnvelope(sorted, ENV.shopping)?.id).toBe(ENV.shopping);
    expect(preselectedEnvelope(sorted, null)?.id).toBe(ENV.vita);
  });
  it('validazione: importo > 0, busta per spese, persona per prestiti', () => {
    expect(validateEntry({ type: 'expense', amount: 480, envelopeId: ENV.vita, personId: null })).toEqual([]);
    expect(validateEntry({ type: 'expense', amount: 0, envelopeId: ENV.vita, personId: null })).toEqual(['amountRequired']);
    expect(validateEntry({ type: 'loan', amount: 480, envelopeId: null, personId: null })).toEqual(['personRequired']);
    expect(validateEntry({ type: 'refund', amount: 480, envelopeId: null, personId: null })).toEqual(['envelopeRequired']);
  });
});

describe('R11 · ultimi 6 mesi', () => {
  it('Giugno–Ottobre chiusi e Novembre in corso, Luglio sopra il budget', async () => {
    const { recentHistory } = await import('../stats');
    const nov = data.periods.find((p) => p.id === '2026-11')!;
    const s = summarizePeriod(data.envelopes, nov, data.transactions.filter((t) => t.periodId === nov.id));
    const h = recentHistory(data.periods, data.envelopes.map((e) => e.id), { period: nov, balances: s.balances });
    expect(h.map((p) => [p.periodId, p.spent, p.overBudget, p.inProgress])).toEqual([
      ['2026-06', 65200, false, false],
      ['2026-07', 73100, true, false],
      ['2026-08', 68800, false, false],
      ['2026-09', 64000, false, false],
      ['2026-10', 60400, false, false],
      ['2026-11', 44850, false, true],
    ]);
  });

  it('senza periodo in corso mostra fino a 6 chiusi', async () => {
    const { recentHistory } = await import('../stats');
    expect(recentHistory(data.periods, data.envelopes.map((e) => e.id), null).map((p) => p.periodId)).toEqual([
      '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]);
  });
});

describe('Inserimento · griglia a 6 caselle', () => {
  const env = (id: string, order: number) => ({ id, name: id, shortName: id, kind: 'spendable' as const, cap: 100, order, archived: false });
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(env);
  it('con 5 buste o meno si vedono tutte, senza "Altre"', () => {
    expect(pickerGrid(seven.slice(0, 5), 'a')).toEqual({ visible: seven.slice(0, 5), hidden: [] });
  });
  it('demo (6 buste): le 5 da spendere + "Altre" con Rate', () => {
    const sorted = sortEnvelopesForPicker(data.envelopes, data.transactions.filter((t) => t.periodId === '2026-11'), DEMO_TODAY);
    expect(pickerGrid(sorted, ENV.vita).hidden.map((e) => e.shortName)).toEqual(['Rate']);
  });
  it('con più di 5: le prime 5 + "Altre" con le restanti', () => {
    const g = pickerGrid(seven, 'b');
    expect(g.visible.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(g.hidden.map((e) => e.id)).toEqual(['f', 'g']);
  });
  it('la busta scelta fuori dalle prime 5 prende il posto della quinta', () => {
    const g = pickerGrid(seven, 'g');
    expect(g.visible.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd', 'g']);
    expect(g.hidden.map((e) => e.id)).toEqual(['e', 'f']);
  });
});
