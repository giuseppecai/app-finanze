// R7 · Inizio del mese.
import type { ClosingPlan } from './closing';
import type { CalendarPeriod } from './periods';
import type { Cents, Envelope, ISODate, MonthlyItem, Period, PotId } from './types';

/** Una voce fissa con l'importo scelto per questo mese. */
export interface ItemQuota {
  item: Pick<MonthlyItem, 'id' | 'name' | 'kind'> & Partial<Pick<MonthlyItem, 'payFrom'>>;
  amount: Cents;
}

export interface OpeningPlan {
  budget: Cents;
  /** voci fisse (salvadanai e uscite) nell'ordine di Imposta */
  items: ItemQuota[];
  /** giroconto mensile → Bollette (R13), 0 se non ci sono bollette */
  bills: Cents;
  /** abbonamenti/rate di questo mese pagati da altri conti (es. rata iPhone da Isybank) */
  other: Cents;
  /** S − budget − Σ voci − Bollette − altri conti; negativo se lo stipendio non copre */
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

/** Buste con i tetti scelti all'"Inizio del mese" (`caps` sovrascrive quelli di Imposta). */
export function withCaps(envelopes: readonly Envelope[], caps: Readonly<Record<string, Cents>> = {}): Envelope[] {
  return envelopes.map((e) => (caps[e.id] !== undefined ? { ...e, cap: caps[e.id]! } : e));
}

/**
 * Quanto resta per le buste (passo "Buste" dell'Inizio del mese): stipendio − giroconto Spese fisse
 * − uscite fisse (affitto) − quote delle Pocket. Quello che le buste non usano va a Risparmi.
 */
export function availableForEnvelopes(salary: Cents, items: readonly ItemQuota[], bills: Cents, other: Cents = 0): Cents {
  return salary - bills - other - items.reduce((s, q) => s + q.amount, 0);
}

/** Voci attive con l'importo di questo mese (`amounts` sovrascrive l'importo proposto). */
export function itemQuotas(items: readonly MonthlyItem[], amounts: Readonly<Record<string, Cents>> = {}): ItemQuota[] {
  return items.filter((i) => !i.archived).map((item) => ({ item, amount: amounts[item.id] ?? item.amount }));
}

export function planOpening(salary: Cents, envelopes: readonly Envelope[], items: readonly ItemQuota[], bills: Cents = 0, other: Cents = 0): OpeningPlan {
  const budget = capsTotal(envelopes);
  const fixed = items.reduce((s, q) => s + q.amount, 0);
  const savings = salary - budget - fixed - bills - other;
  return { budget, items: [...items], bills, other, savings, short: savings < 0 };
}

export interface NewPeriodInput {
  target: CalendarPeriod;
  today: ISODate;
  salary: Cents;
  envelopes: readonly Envelope[];
  items: readonly ItemQuota[];
  /** giroconto mensile → Bollette (R13) */
  billsQuota?: Cents;
  /** abbonamenti/rate del mese pagati da altri conti (escono dallo stipendio, non vanno su Revolut) */
  otherAccounts?: Cents;
  /** tetti scelti all'"Inizio del mese" (id busta → tetto); assenti = quelli di Imposta */
  caps?: Readonly<Record<string, Cents>>;
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
  const envelopes = withCaps(input.envelopes, input.caps);
  const plan = planOpening(input.salary, envelopes, input.items, billsQuota, input.otherAccounts ?? 0);
  const allocations: Record<string, Cents> = Object.fromEntries(activeEnvelopes(envelopes).map((e) => [e.id, e.cap]));
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
