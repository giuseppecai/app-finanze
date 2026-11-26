// Altri conti (fuori da Revolut): lo stipendio arriva lì e da lì partono alcuni pagamenti fissi.
// Le Pocket restano solo su Revolut: un altro conto riceve esattamente quello che deve pagare.
import type { ItemQuota } from './opening';
import { recurringDateInPeriod } from './recurring';
import type { AccountCard, Cents, OtherAccount, Period, Recurring, Settings } from './types';

/** Carte di un conto. */
export function accountCards(account: Pick<OtherAccount, 'cards'> | null | undefined): AccountCard[] {
  return account?.cards ?? [];
}

/** Serve scegliere la carta? Solo se il conto ne ha più di una (Revolut: Quotidiano ed Extra). */
export function needsCardChoice(account: Pick<OtherAccount, 'cards'> | null | undefined): boolean {
  return accountCards(account).length > 1;
}

type PeriodRange = Pick<Period, 'calendarStart' | 'calendarEnd'>;

export interface AccountPayment {
  id: string;
  name: string;
  amount: Cents;
}

/**
 * Pagamenti di questo periodo che escono dal conto `accountId`: abbonamenti/rate con addebito nel
 * periodo e uscite fisse (affitto) che si pagano da lì.
 */
export function accountPayments(
  accountId: string,
  recurrings: readonly Recurring[],
  items: readonly ItemQuota[],
  period: PeriodRange,
): AccountPayment[] {
  return [
    ...items
      .filter((q) => q.item.kind === 'payment' && q.item.payFrom === accountId && q.amount > 0)
      .map((q) => ({ id: q.item.id, name: q.item.name, amount: q.amount })),
    ...recurrings
      .filter((r) => r.active && r.payFrom === accountId && recurringDateInPeriod(r, period) !== null)
      .map((r) => ({ id: r.id, name: r.name, amount: r.amount })),
  ];
}

/** Abbonamenti/rate di questo periodo pagati da altri conti (non dalla Pocket Spese fisse): escono dallo stipendio. */
export function otherAccountsRecurring(recurrings: readonly Recurring[], period: PeriodRange): Cents {
  return recurrings.reduce((s, r) => (r.active && r.payFrom && recurringDateInPeriod(r, period) !== null ? s + r.amount : s), 0);
}

export interface SalaryAccountPlan {
  account: OtherAccount;
  payments: AccountPayment[];
  /** quanto lasciare sul conto dello stipendio (affitto + rata…) */
  leave: Cents;
  /** quanto spostare su Revolut */
  move: Cents;
}

/**
 * Stipendio su un altro conto: ci lasci esattamente i pagamenti che partono da lì, il resto va su Revolut.
 * Esempio: stipendio 1.500 su Isybank, affitto 582 + rata iPhone 70,24 → lascia 652,24, sposta 847,76.
 */
export function salaryAccountPlan(settings: Pick<Settings, 'accounts' | 'salaryAccountId'>, salary: Cents, payments: AccountPayment[]): SalaryAccountPlan | null {
  const account = settings.accounts?.find((a) => a.id === settings.salaryAccountId);
  if (!account) return null;
  const leave = payments.reduce((s, p) => s + p.amount, 0);
  return { account, payments, leave, move: salary - leave };
}
