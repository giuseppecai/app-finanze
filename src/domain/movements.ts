// Calcoli di supporto per Movimenti, Home e Inserimento rapido (logica pura).
import { diffDays } from './dates';
import type { Cents, ISODate, Transaction, TxType } from './types';

/** Effetto sui tuoi soldi: spese, prestiti dati e debiti pagati escono; il resto entra. */
export function signedAmount(tx: Pick<Transaction, 'type' | 'amount'>): Cents {
  return tx.type === 'expense' || tx.type === 'loan' || tx.type === 'debtRepayment' ? -tx.amount : tx.amount;
}

/** I prestiti non sono spese: restano fuori dai totali di giorno e di periodo. */
export function countsInTotals(type: TxType): boolean {
  return type === 'expense' || type === 'refund' || type === 'income';
}

export interface DayGroup {
  date: ISODate;
  transactions: Transaction[];
  /** somma con segno di spese, rimborsi ed entrate del giorno */
  total: Cents;
}

/** Movimenti raggruppati per giorno, dal più recente; nel giorno, l'ultimo inserito per primo. */
export function groupByDay(txs: readonly Transaction[]): DayGroup[] {
  const sorted = txs.slice().sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
  const groups: DayGroup[] = [];
  for (const tx of sorted) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, transactions: [], total: 0 };
      groups.push(group);
    }
    group.transactions.push(tx);
    if (countsInTotals(tx.type)) group.total += signedAmount(tx);
  }
  return groups;
}

/** "Speso € 448,50 · 16 spese": totale e numero delle spese (i rimborsi non le riducono qui). */
export function expensesSummary(txs: readonly Transaction[]): { total: Cents; count: number } {
  const expenses = txs.filter((t) => t.type === 'expense');
  return { total: expenses.reduce((s, t) => s + t.amount, 0), count: expenses.length };
}

export type EntryFeedback =
  | { kind: 'left'; amount: Cents } // restano € X dopo questa spesa
  | { kind: 'over'; amount: Cents } // sfori di € X
  | { kind: 'back'; amount: Cents }; // torna a € X

/**
 * Riga di feedback dell'inserimento. `remaining` è il residuo della busta senza questo movimento
 * (in modifica, il movimento originale va escluso prima di calcolarlo).
 */
export function entryFeedback(type: 'expense' | 'refund', remaining: Cents, amount: Cents): EntryFeedback {
  if (type === 'refund') return { kind: 'back', amount: remaining + amount };
  const after = remaining - amount;
  return after < 0 ? { kind: 'over', amount: -after } : { kind: 'left', amount: after };
}

/** Giorni passati da una data (0 = oggi). */
export function daysAgo(date: ISODate, today: ISODate): number {
  return diffDays(date, today);
}
