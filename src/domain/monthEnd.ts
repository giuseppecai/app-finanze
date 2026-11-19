// Chiusura e inizio del mese: anteprima della chiusura, checklist dei giroconti, suggerimenti di tetto.
import { leftoversOf, type ClosingPlan } from './closing';
import { summarizePeriod, type PeriodSummary } from './envelopes';
import type { OpeningPlan } from './opening';
import { chargeToTransaction, dueCharges, type DueCharge } from './recurring';
import { capSuggestion, type CapSuggestion } from './stats';
import type { Cents, Envelope, Period, Recurring, Transaction } from './types';

export interface ClosingPreview {
  /** addebiti automatici non ancora scalati fino alla fine del periodo (si generano alla chiusura) */
  pending: DueCharge[];
  /** movimenti del periodo + addebiti in sospeso */
  txs: Transaction[];
  summary: PeriodSummary;
  leftovers: Record<string, Cents>;
  unassigned: Cents;
}

/**
 * Come si chiude il periodo: residui a fine periodo, contando anche gli abbonamenti che si addebitano
 * entro la fine di calendario (chi chiude il 25 non perde l'iCloud del 26).
 */
export function closingPreview(
  envelopes: readonly Envelope[],
  period: Period,
  periodTxs: readonly Transaction[],
  recurrings: readonly Recurring[],
  createdAt = '',
): ClosingPreview {
  const pending = dueCharges(recurrings, period, periodTxs, period.calendarEnd);
  const pendingTxs = pending.map((c) => chargeToTransaction(c, period.id, `pending-${c.recurring.id}`, createdAt));
  const txs = [...periodTxs, ...pendingTxs];
  const summary = summarizePeriod(envelopes, period, txs);
  return { pending, txs, summary, leftovers: leftoversOf(summary.balances), unassigned: summary.unassigned };
}

export type ChecklistAccount = 'salary' | 'budget' | 'savings' | 'travel' | 'gifts';

export interface ChecklistItem {
  id: 'closing' | 'budget' | 'travel' | 'gifts' | 'savings';
  from: ChecklistAccount;
  to: ChecklistAccount;
  /** importo da spostare; per "savings" può essere negativo (lo stipendio non copre le buste) */
  amount: Cents;
  warn: boolean;
}

/**
 * Giroconti da fare su Revolut, in ordine: prima quello della chiusura (se c'è), poi i 4 dell'inizio
 * del mese (R7). L'app non li esegue: sono una lista da spuntare.
 */
export function transferChecklist(opening: OpeningPlan, closing: Pick<ClosingPlan, 'transfer'> | null): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (closing?.transfer) {
    items.push({ id: 'closing', from: closing.transfer.from, to: closing.transfer.to, amount: closing.transfer.amount, warn: false });
  }
  items.push(
    { id: 'budget', from: 'salary', to: 'budget', amount: opening.budget, warn: false },
    { id: 'travel', from: 'salary', to: 'travel', amount: opening.travel, warn: false },
    { id: 'gifts', from: 'salary', to: 'gifts', amount: opening.gifts, warn: false },
    { id: 'savings', from: 'salary', to: 'savings', amount: opening.savings, warn: opening.short },
  );
  return items;
}

/** Suggerimenti di tetto alla chiusura: contano i periodi chiusi più quello che si sta chiudendo. */
export function suggestionsAtClosing(
  envelopes: readonly Envelope[],
  periods: readonly Period[],
  closing: Period,
  leftovers: Record<string, Cents>,
): CapSuggestion[] {
  const withClosing = [
    ...periods.filter((p) => p.id !== closing.id),
    { ...closing, closedAt: 'closing', leftovers },
  ];
  return envelopes
    .filter((e) => !e.archived)
    .map((e) => capSuggestion(e, withClosing))
    .filter((s): s is CapSuggestion => s !== null);
}
