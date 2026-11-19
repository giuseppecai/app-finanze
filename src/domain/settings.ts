// Imposta · cambiare i tetti a metà mese (decisione 6 di M0): i soldi vanno spostati davvero.
import type { Cents, Envelope, Period } from './types';

export interface CapsChange {
  /** totale buste prima (allocazioni del mese in corso, o tetti se non c'è un mese aperto) */
  before: Cents;
  /** totale buste dopo */
  after: Cents;
  diff: Cents;
  /** giroconto da fare se il mese è aperto: alzando i tetti servono soldi da Risparmi, abbassandoli tornano lì */
  transfer: { from: 'savings' | 'budget'; to: 'savings' | 'budget'; amount: Cents } | null;
  /** variazione del salvadanaio Risparmi */
  savingsDelta: Cents;
  /** allocazioni aggiornate del mese aperto (null se non c'è) */
  allocations: Record<string, Cents> | null;
}

/**
 * Nuovi tetti (`caps`: id → tetto, comprese le buste nuove). Valgono da subito: il mese aperto
 * aggiorna le allocazioni e l'app dice quale giroconto fare tra Risparmi e Budget del mese.
 */
export function planCapsChange(
  envelopes: readonly Envelope[],
  caps: Record<string, Cents>,
  current: Pick<Period, 'allocations'> | null,
): CapsChange {
  const active = (id: string) => envelopes.find((e) => e.id === id)?.archived !== true;
  const after = Object.entries(caps).reduce((s, [id, c]) => (active(id) ? s + c : s), 0);
  if (!current) {
    const before = envelopes.filter((e) => !e.archived).reduce((s, e) => s + e.cap, 0);
    return { before, after, diff: after - before, transfer: null, savingsDelta: 0, allocations: null };
  }
  const allocations = { ...current.allocations };
  for (const [id, cap] of Object.entries(caps)) {
    if (active(id)) allocations[id] = cap;
  }
  const before = Object.values(current.allocations).reduce((s, v) => s + v, 0);
  const total = Object.values(allocations).reduce((s, v) => s + v, 0);
  const diff = total - before;
  const transfer = diff > 0
    ? { from: 'savings' as const, to: 'budget' as const, amount: diff }
    : diff < 0
      ? { from: 'budget' as const, to: 'savings' as const, amount: -diff }
      : null;
  return { before, after: total, diff, transfer, savingsDelta: -diff, allocations };
}

/** Nome breve di default per una busta nuova: la prima parola. */
export function defaultShortName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
