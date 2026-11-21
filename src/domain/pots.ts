// Salvadanai (specchio delle Pocket Revolut) e voci fisse dell'inizio del mese (R7).
import type { Cents, MonthlyItem, Pot } from './types';

/** Voci fisse iniziali: Viaggi e Regali & Imprevisti (salvadanai). L'affitto lo aggiunge l'utente. */
export const DEFAULT_MONTHLY_ITEMS: readonly MonthlyItem[] = [
  { id: 'travel', name: 'Viaggi', kind: 'pot', amount: 5000, archived: false },
  { id: 'gifts', name: 'Regali & Imprevisti', kind: 'pot', amount: 2500, archived: false },
];

export interface PotLine {
  id: string;
  name: string;
  balance: Cents;
}

/**
 * "Messi da parte": Risparmi, poi i salvadanai delle voci fisse (nell'ordine di Imposta), poi Bollette.
 * Bollette compare sempre; il salvadanaio di una voce archiviata resta finché non è vuoto.
 */
export function potLines(pots: readonly Pot[], items: readonly MonthlyItem[]): PotLine[] {
  const byId = new Map(pots.map((p) => [p.id, p]));
  const line = (id: string, fallback: string): PotLine => ({ id, name: byId.get(id)?.name ?? fallback, balance: byId.get(id)?.balance ?? 0 });
  const fromItems = items
    .filter((i) => i.kind === 'pot' && (!i.archived || (byId.get(i.id)?.balance ?? 0) !== 0))
    .map((i) => ({ ...line(i.id, i.name), name: i.name }));
  const known = new Set(['savings', 'bills', ...fromItems.map((l) => l.id)]);
  const others = pots.filter((p) => !known.has(p.id) && p.balance !== 0).map((p) => line(p.id, p.name));
  return [line('savings', 'Risparmi'), ...fromItems, ...others, line('bills', 'Bollette')];
}

export function potsTotal(lines: readonly PotLine[]): Cents {
  return lines.reduce((s, l) => s + l.balance, 0);
}
