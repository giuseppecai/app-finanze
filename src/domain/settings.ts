// Imposta · cambiare i tetti a metà mese (decisione 6 di M0): i soldi vanno spostati davvero.
import { netSpent } from './envelopes';
import type { Cents, Envelope, MonthlyItem, Period, Pot, Recurring, Transaction } from './types';

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
  /** residui delle buste tolte mandati altrove (un salvadanaio diverso da Risparmi o "da assegnare") */
  moves: FundsMove[];
}

/** Dove vanno i soldi di qualcosa che si toglie: l'id di un salvadanaio, o "da assegnare" nel mese aperto. */
export type FundsDestination = string;
export const UNASSIGNED: FundsDestination = '__unassigned';
export const DEFAULT_DESTINATION: FundsDestination = 'savings';

export interface FundsMove {
  to: FundsDestination;
  amount: Cents;
}

/**
 * Nuovi tetti (`caps`: id → tetto, comprese le buste nuove). Valgono da subito: il mese aperto
 * aggiorna le allocazioni e l'app dice quale giroconto fare tra Risparmi e Budget del mese.
 */
export function planCapsChange(
  envelopes: readonly Envelope[],
  caps: Record<string, Cents>,
  current: Pick<Period, 'allocations'> | null,
  /** buste tolte: id → allocazione che resta nel mese aperto (`null` = sparisce dal mese), vedi `allocationAfterRemoval` */
  removed: Readonly<Record<string, Cents | null>> = {},
  /** dove va il residuo di ogni busta tolta (default Risparmi) */
  destinations: Readonly<Record<string, FundsDestination>> = {},
): CapsChange {
  const isRemoved = (id: string) => id in removed;
  const active = (id: string) => envelopes.find((e) => e.id === id)?.archived !== true && !isRemoved(id);
  const after = Object.entries(caps).reduce((s, [id, c]) => (active(id) ? s + c : s), 0)
    + envelopes.filter((e) => !e.archived && !isRemoved(e.id) && !(e.id in caps)).reduce((s, e) => s + e.cap, 0);
  if (!current) {
    const before = envelopes.filter((e) => !e.archived).reduce((s, e) => s + e.cap, 0);
    return { before, after, diff: after - before, transfer: null, savingsDelta: 0, allocations: null, moves: [] };
  }
  const allocations = { ...current.allocations };
  for (const [id, cap] of Object.entries(caps)) {
    if (active(id)) allocations[id] = cap;
  }
  for (const [id, left] of Object.entries(removed)) {
    if (left === null) delete allocations[id];
    else allocations[id] = left;
  }
  const before = Object.values(current.allocations).reduce((s, v) => s + v, 0);
  const total = Object.values(allocations).reduce((s, v) => s + v, 0);
  const diff = total - before;
  // Il residuo liberato da ogni busta tolta va dove ha scelto l'utente; il resto passa da Risparmi.
  const byDest = new Map<FundsDestination, Cents>();
  for (const [id, left] of Object.entries(removed)) {
    const dest = destinations[id] ?? DEFAULT_DESTINATION;
    const freed = (current.allocations[id] ?? 0) - (left ?? 0);
    if (dest === DEFAULT_DESTINATION || freed === 0) continue;
    byDest.set(dest, (byDest.get(dest) ?? 0) + freed);
  }
  const moves = [...byDest].map(([to, amount]) => ({ to, amount }));
  const savingsDelta = -diff - moves.reduce((s, m) => s + m.amount, 0);
  const transfer = savingsDelta < 0
    ? { from: 'savings' as const, to: 'budget' as const, amount: -savingsDelta }
    : savingsDelta > 0
      ? { from: 'budget' as const, to: 'savings' as const, amount: savingsDelta }
      : null;
  return { before, after: total, diff, transfer, savingsDelta, allocations, moves };
}

/** Nome breve di default per una busta nuova: la prima parola. */
export function defaultShortName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

// ── Togliere buste, voci fisse e salvadanai ───────────────────────────────────

/**
 * Busta tolta a mese aperto: il residuo torna in Risparmi, resta assegnato solo quanto già speso
 * (così il residuo va a zero e i movimenti del mese restano coerenti). Se la busta non ha movimenti
 * né riporti nel mese, sparisce dal mese (`null`). Una busta già sforata non cambia.
 */
export function allocationAfterRemoval(
  id: string,
  period: Pick<Period, 'allocations' | 'carryIn'>,
  txs: readonly Transaction[],
): Cents | null {
  const carry = period.carryIn[id] ?? 0;
  const allocated = period.allocations[id] ?? 0;
  if (carry === 0 && !txs.some((t) => t.envelopeId === id)) return null;
  return Math.min(allocated, Math.max(0, netSpent(id, txs) - carry));
}

/** Una busta usata (movimenti, mesi passati) si archivia; una mai usata si cancella. */
export function envelopeInUse(
  id: string,
  periods: readonly Pick<Period, 'allocations' | 'carryIn' | 'leftovers'>[],
  txs: readonly Pick<Transaction, 'envelopeId'>[],
  recurring: readonly Pick<Recurring, 'envelopeId'>[],
): boolean {
  void recurring; // R16: gli abbonamenti si pagano dalla Pocket Spese fisse, non tengono legata una busta
  return txs.some((t) => t.envelopeId === id)
    || periods.some((p) => id in p.allocations || id in p.carryIn || (p.leftovers !== null && id in p.leftovers));
}

/** Abbonamenti che pagano da questa busta: nessuno da R16 (si pagano dalla Pocket Spese fisse). */
export function recurringOnEnvelope(id: string, recurring: readonly Recurring[]): Recurring[] {
  void id;
  void recurring;
  return [];
}

/** Salvadanai che non si possono togliere: Risparmi riceve il resto dello stipendio, Bollette le quote. */
export const FIXED_POTS: readonly string[] = ['savings', 'bills'];

export interface PotRemoval {
  /** saldo da spostare (anche negativo) */
  amount: Cents;
  /** dove va il saldo */
  to: FundsDestination;
  /** la voce fissa collegata, che sparisce dall'inizio del mese */
  item: MonthlyItem | null;
}

/** Togliere un salvadanaio (o la voce-salvadanaio dell'inizio del mese): il saldo va dove sceglie l'utente (default Risparmi). */
export function planPotRemoval(
  id: string,
  pots: readonly Pot[],
  items: readonly MonthlyItem[],
  to: FundsDestination = DEFAULT_DESTINATION,
): PotRemoval {
  if (FIXED_POTS.includes(id)) throw new Error('Questo salvadanaio non si può togliere');
  if (to === id) throw new Error('Destinazione non valida');
  if (to !== UNASSIGNED && !pots.some((p) => p.id === to)) throw new Error('Salvadanaio di destinazione mancante');
  return {
    amount: pots.find((p) => p.id === id)?.balance ?? 0,
    to,
    item: items.find((i) => i.id === id) ?? null,
  };
}

export interface DestinationOption {
  value: FundsDestination;
  name: string;
}

/**
 * Dove si possono spostare i soldi: Risparmi per primo (scelta proposta), poi gli altri salvadanai
 * nell'ordine di "Messi da parte", poi "da assegnare" nel Budget del mese se c'è un mese aperto.
 */
export function fundsDestinations(
  lines: readonly { id: string; name: string }[],
  excludeId: string | null,
  hasPeriod: boolean,
  unassignedName: string,
): DestinationOption[] {
  const pots = lines.filter((l) => l.id !== excludeId);
  const savings = pots.filter((l) => l.id === DEFAULT_DESTINATION);
  const others = pots.filter((l) => l.id !== DEFAULT_DESTINATION);
  return [
    ...[...savings, ...others].map((l) => ({ value: l.id, name: l.name })),
    ...(hasPeriod ? [{ value: UNASSIGNED, name: unassignedName }] : []),
  ];
}
