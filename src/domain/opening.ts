// R7 · Inizio del mese.
import type { ClosingPlan } from './closing';
import type { CalendarPeriod } from './periods';
import type { Cents, Envelope, ISODate, Period, PotId } from './types';

export type OpeningTransferId = 'budget' | 'travel' | 'gifts' | 'savings';

export interface OpeningTransfer {
  id: OpeningTransferId;
  amount: Cents;
}

export interface OpeningPlan {
  budget: Cents;
  travel: Cents;
  gifts: Cents;
  /** S − budget − Viaggi − Regali; negativo se lo stipendio non copre le buste */
  savings: Cents;
  short: boolean;
  /** Checklist dei 4 giroconti su Revolut, in ordine */
  transfers: OpeningTransfer[];
}

/** Buste attive (non archiviate) che ricevono un tetto nel periodo nuovo. */
export function activeEnvelopes(envelopes: readonly Envelope[]): Envelope[] {
  return envelopes.filter((e) => !e.archived);
}

export function capsTotal(envelopes: readonly Envelope[]): Cents {
  return activeEnvelopes(envelopes).reduce((s, e) => s + e.cap, 0);
}

export function planOpening(salary: Cents, envelopes: readonly Envelope[], travel: Cents, gifts: Cents): OpeningPlan {
  const budget = capsTotal(envelopes);
  const savings = salary - budget - travel - gifts;
  return {
    budget,
    travel,
    gifts,
    savings,
    short: savings < 0,
    transfers: [
      { id: 'budget', amount: budget },
      { id: 'travel', amount: travel },
      { id: 'gifts', amount: gifts },
      { id: 'savings', amount: savings },
    ],
  };
}

export interface NewPeriodInput {
  target: CalendarPeriod;
  today: ISODate;
  salary: Cents;
  envelopes: readonly Envelope[];
  travel: Cents;
  gifts: Cents;
  /** piano di chiusura del periodo precedente (null per il primo periodo) */
  closing: Pick<ClosingPlan, 'nextCarryIn' | 'nextUnassigned' | 'savingsDelta'> | null;
}

export interface NewPeriodResult {
  period: Period;
  /** variazioni dei salvadanai: Viaggi + V, Regali + R, Risparmi + resto (+ effetto della chiusura) */
  potDeltas: Record<PotId, Cents>;
}

/** Crea il periodo: fotografa i tetti, applica riporti / da assegnare della chiusura. */
export function buildNewPeriod(input: NewPeriodInput): NewPeriodResult {
  const plan = planOpening(input.salary, input.envelopes, input.travel, input.gifts);
  const allocations = Object.fromEntries(activeEnvelopes(input.envelopes).map((e) => [e.id, e.cap]));
  const period: Period = {
    ...input.target,
    startedAt: input.today,
    salary: input.salary,
    allocations,
    carryIn: { ...(input.closing?.nextCarryIn ?? {}) },
    unassigned: input.closing?.nextUnassigned ?? 0,
    travelQuota: input.travel,
    giftsQuota: input.gifts,
    closedAt: null,
    leftoverChoice: null,
    leftovers: null,
  };
  return {
    period,
    potDeltas: {
      savings: plan.savings + (input.closing?.savingsDelta ?? 0),
      travel: input.travel,
      gifts: input.gifts,
    },
  };
}
