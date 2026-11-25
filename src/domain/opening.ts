// R7 · Inizio del mese.
import type { ClosingPlan } from './closing';
import type { CalendarPeriod } from './periods';
import type { Cents, Envelope, ISODate, MonthlyItem, Period, PotId } from './types';

/** Una voce fissa con l'importo scelto per questo mese. */
export interface ItemQuota {
  item: Pick<MonthlyItem, 'id' | 'name' | 'kind'>;
  amount: Cents;
}

export interface OpeningPlan {
  /** Σ tetti + abbonamenti non mensili pagati tutti questo mese (R15) */
  budget: Cents;
  /** parte del budget dovuta agli abbonamenti non mensili di questo mese */
  extra: Cents;
  /** voci fisse (salvadanai e uscite) nell'ordine di Imposta */
  items: ItemQuota[];
  /** giroconto mensile → Bollette (R13), 0 se non ci sono bollette */
  bills: Cents;
  /** S − budget − Σ voci − Bollette; negativo se lo stipendio non copre */
  savings: Cents;
  short: boolean;
}

/** Buste attive (non archiviate) che ricevono un tetto nel periodo nuovo. */
export function activeEnvelopes(envelopes: readonly Envelope[]): Envelope[] {
  return envelopes.filter((e) => !e.archived);
}

export function capsTotal(envelopes: readonly Envelope[]): Cents {
  return activeEnvelopes(envelopes).reduce((s, e) => s + e.cap, 0);
}

/** Voci attive con l'importo di questo mese (`amounts` sovrascrive l'importo proposto). */
export function itemQuotas(items: readonly MonthlyItem[], amounts: Readonly<Record<string, Cents>> = {}): ItemQuota[] {
  return items.filter((i) => !i.archived).map((item) => ({ item, amount: amounts[item.id] ?? item.amount }));
}

export function planOpening(salary: Cents, envelopes: readonly Envelope[], items: readonly ItemQuota[], bills: Cents = 0, extra: Cents = 0): OpeningPlan {
  const budget = capsTotal(envelopes) + extra;
  const fixed = items.reduce((s, q) => s + q.amount, 0);
  const savings = salary - budget - fixed - bills;
  return { budget, extra, items: [...items], bills, savings, short: savings < 0 };
}

/** Abbonamenti pagati tutti nel mese: id → { busta, importo } (vedi `lumpExtras`). */
export type PeriodExtras = Readonly<Record<string, { envelopeId: string; amount: Cents }>>;

export function extrasTotal(extras: PeriodExtras = {}): Cents {
  return Object.values(extras).reduce((s, e) => s + e.amount, 0);
}

export interface NewPeriodInput {
  target: CalendarPeriod;
  today: ISODate;
  salary: Cents;
  envelopes: readonly Envelope[];
  items: readonly ItemQuota[];
  /** giroconto mensile → Bollette (R13) */
  billsQuota?: Cents;
  /** abbonamenti non mensili pagati tutti questo mese: la loro busta sale dell'importo (R15) */
  extras?: PeriodExtras;
  /** piano di chiusura del periodo precedente (null per il primo periodo) */
  closing: Pick<ClosingPlan, 'nextCarryIn' | 'nextUnassigned' | 'savingsDelta'> | null;
}

export interface NewPeriodResult {
  period: Period;
  /** variazioni dei salvadanai: ogni voce-salvadanaio + la sua quota, Bollette, Risparmi + resto (+ chiusura) */
  potDeltas: Record<PotId, Cents>;
}

/** Crea il periodo: fotografa i tetti, applica riporti / da assegnare della chiusura. */
export function buildNewPeriod(input: NewPeriodInput): NewPeriodResult {
  const billsQuota = input.billsQuota ?? 0;
  const extras = input.extras ?? {};
  const plan = planOpening(input.salary, input.envelopes, input.items, billsQuota, extrasTotal(extras));
  const allocations: Record<string, Cents> = Object.fromEntries(activeEnvelopes(input.envelopes).map((e) => [e.id, e.cap]));
  for (const e of Object.values(extras)) allocations[e.envelopeId] = (allocations[e.envelopeId] ?? 0) + e.amount;
  const period: Period = {
    ...input.target,
    startedAt: input.today,
    salary: input.salary,
    allocations,
    carryIn: { ...(input.closing?.nextCarryIn ?? {}) },
    unassigned: input.closing?.nextUnassigned ?? 0,
    quotas: Object.fromEntries(input.items.map((q) => [q.item.id, q.amount])),
    closedAt: null,
    leftoverChoice: null,
    leftovers: null,
    billsQuota,
    ...(Object.keys(extras).length > 0 ? { extras: Object.fromEntries(Object.entries(extras).map(([id, e]) => [id, e.amount])) } : {}),
  };
  const potDeltas: Record<PotId, Cents> = {
    savings: plan.savings + (input.closing?.savingsDelta ?? 0),
    bills: billsQuota,
  };
  for (const q of input.items) {
    if (q.item.kind === 'pot') potDeltas[q.item.id] = (potDeltas[q.item.id] ?? 0) + q.amount;
  }
  return { period, potDeltas };
}
