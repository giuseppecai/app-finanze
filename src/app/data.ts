// Hook di lettura: la fonte di verità è Dexie, i componenti si aggiornano da soli (useLiveQuery).
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { currentPeriod } from '../domain/periods';
import type { Envelope, Loan, Period, Person, Pot, Reconciliation, Recurring, Settings, Transaction } from '../domain/types';

/** `undefined` finché i dati non sono caricati. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('settings'));
}

export function useEnvelopes(): Envelope[] | undefined {
  return useLiveQuery(() => db.envelopes.orderBy('order').toArray());
}

export function usePeriods(): Period[] | undefined {
  return useLiveQuery(() => db.periods.toArray());
}

/** Periodo corrente: `null` se non ce n'è uno aperto, `undefined` durante il caricamento. */
export function useCurrentPeriod(): Period | null | undefined {
  return useLiveQuery(async () => currentPeriod(await db.periods.toArray()));
}

export function usePeriodTransactions(periodId: string | null | undefined): Transaction[] | undefined {
  return useLiveQuery(
    async (): Promise<Transaction[]> => (periodId ? db.transactions.where('periodId').equals(periodId).toArray() : []),
    [periodId],
  );
}

/** Movimenti degli ultimi giorni (ordine delle buste per uso, R12). */
export function useTransactionsSince(date: string): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.where('date').aboveOrEqual(date).toArray(), [date]);
}

export function useTransaction(id: string | null): Transaction | null | undefined {
  return useLiveQuery(async () => (id ? (await db.transactions.get(id)) ?? null : null), [id]);
}

export function useRecurring(): Recurring[] | undefined {
  return useLiveQuery(() => db.recurring.toArray());
}

export function usePots(): Pot[] | undefined {
  return useLiveQuery(() => db.pots.toArray());
}

export function useLoans(): Loan[] | undefined {
  return useLiveQuery(() => db.loans.toArray());
}

export function usePeople(): Person[] | undefined {
  return useLiveQuery(() => db.people.toArray());
}

export function useLastReconciliation(): Reconciliation | null | undefined {
  return useLiveQuery(async () => (await db.reconciliations.orderBy('date').last()) ?? null);
}
