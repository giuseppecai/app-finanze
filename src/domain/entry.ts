// R12 · Ordine e default nell'inserimento rapido, validazione.
import { addDays } from './dates';
import type { Cents, Envelope, ISODate, Transaction, TxType } from './types';

/**
 * Buste per la griglia "In quale busta?": prima le da spendere, ordinate per numero di movimenti
 * negli ultimi 60 giorni (a parità: ordine di Imposta); le impegnate in fondo, con lo stesso criterio.
 */
export function sortEnvelopesForPicker(
  envelopes: readonly Envelope[],
  txs: readonly Transaction[],
  today: ISODate,
  days = 60,
): Envelope[] {
  const since = addDays(today, -days);
  const counts = new Map<string, number>();
  for (const tx of txs) {
    if (tx.envelopeId === null || tx.date < since || tx.date > today) continue;
    if (tx.type !== 'expense' && tx.type !== 'refund') continue;
    counts.set(tx.envelopeId, (counts.get(tx.envelopeId) ?? 0) + 1);
  }
  const kindRank = (e: Envelope) => (e.kind === 'spendable' ? 0 : 1);
  return envelopes
    .filter((e) => !e.archived)
    .slice()
    .sort((a, b) =>
      kindRank(a) - kindRank(b) ||
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
      a.order - b.order,
    );
}

/** Busta preselezionata: l'ultima usata, se esiste ancora; altrimenti la prima della griglia. */
export function preselectedEnvelope(sorted: readonly Envelope[], lastEnvelopeId: string | null): Envelope | null {
  return sorted.find((e) => e.id === lastEnvelopeId) ?? sorted[0] ?? null;
}

export type EntryError = 'amountRequired' | 'envelopeRequired' | 'personRequired';

export interface EntryDraft {
  type: TxType;
  amount: Cents;
  envelopeId: string | null;
  personId: string | null;
}

/** Validazione: importo > 0; spesa/rimborso servono una busta; il prestito serve una persona. */
export function validateEntry(draft: EntryDraft): EntryError[] {
  const errors: EntryError[] = [];
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) errors.push('amountRequired');
  if ((draft.type === 'expense' || draft.type === 'refund') && !draft.envelopeId) errors.push('envelopeRequired');
  if ((draft.type === 'loan' || draft.type === 'loanRepayment') && !draft.personId) errors.push('personRequired');
  return errors;
}
