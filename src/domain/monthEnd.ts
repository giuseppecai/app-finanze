// Chiusura e inizio del mese: anteprima della chiusura, checklist dei giroconti, suggerimenti di tetto.
import { leftoversOf, type ClosingPlan } from './closing';
import { summarizePeriod, type PeriodSummary } from './envelopes';
import type { SalaryAccountPlan } from './accounts';
import type { ItemQuota, OpeningPlan } from './opening';
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

/** Conti dei giroconti: quelli fissi più gli id delle voci (salvadanai o uscite). */
export type ChecklistAccount = 'salary' | 'budget' | 'savings' | 'bills' | (string & {});

export interface ChecklistItem {
  /** chiave stabile della riga: 'closing' | 'budget' | 'bills' | 'savings' | 'item:<id>' */
  key: string;
  kind: 'leave' | 'move' | 'closing' | 'budget' | 'item' | 'bills' | 'savings';
  from: ChecklistAccount;
  to: ChecklistAccount;
  /** importo da spostare; per "savings" può essere negativo (lo stipendio non copre le buste) */
  amount: Cents;
  warn: boolean;
  /** solo per le voci fisse */
  item?: ItemQuota['item'];
}

/**
 * Giroconti da fare su Revolut, in ordine: prima quello della chiusura (se c'è), poi Budget del mese,
 * le voci fisse (salvadanai e uscite come l'affitto), Bollette (se ci sono bollette) e Risparmi (R7).
 * L'app non li esegue: sono una lista da spuntare.
 */
export function transferChecklist(
  opening: OpeningPlan,
  closing: Pick<ClosingPlan, 'transfer'> | null,
  /** stipendio su un altro conto: prima "Lascia su Isybank", poi "Isybank → Revolut" */
  salaryAccount: Pick<SalaryAccountPlan, 'account' | 'leave' | 'move'> | null = null,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (salaryAccount) {
    if (salaryAccount.leave > 0) {
      items.push({ key: 'leave', kind: 'leave', from: 'salary', to: salaryAccount.account.id, amount: salaryAccount.leave, warn: false });
    }
    items.push({ key: 'move', kind: 'move', from: salaryAccount.account.id, to: 'revolut', amount: salaryAccount.move, warn: salaryAccount.move < 0 });
  }
  if (closing?.transfer) {
    items.push({ key: 'closing', kind: 'closing', from: closing.transfer.from, to: closing.transfer.to, amount: closing.transfer.amount, warn: false });
  }
  items.push({ key: 'budget', kind: 'budget', from: 'salary', to: 'budget', amount: opening.budget, warn: false });
  for (const q of opening.items) {
    // Le uscite pagate da un altro conto (affitto da Isybank) sono già in "Lascia su …".
    if (q.item.payFrom) continue;
    items.push({ key: `item:${q.item.id}`, kind: 'item', from: 'salary', to: q.item.id, amount: q.amount, warn: false, item: q.item });
  }
  if (opening.bills > 0) items.push({ key: 'bills', kind: 'bills', from: 'salary', to: 'bills', amount: opening.bills, warn: false });
  items.push({ key: 'savings', kind: 'savings', from: 'salary', to: 'savings', amount: opening.savings, warn: opening.short });
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
