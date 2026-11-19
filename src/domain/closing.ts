// R6 · Chiusura del mese.
import type { EnvelopeBalance } from './envelopes';
import type { Cents, LeftoverChoice } from './types';

export type ClosingOption = Exclude<LeftoverChoice, 'deficit'>;

export interface Transfer {
  from: 'budget' | 'savings';
  to: 'budget' | 'savings';
  amount: Cents;
}

export interface ClosingPlan {
  choice: LeftoverChoice;
  /** avanzo per busta (snapshot per lo Storico) */
  leftovers: Record<string, Cents>;
  /** Σ avanzi + da assegnare */
  net: Cents;
  /** variazione del salvadanaio Risparmi */
  savingsDelta: Cents;
  /** giroconto da fare su Revolut, se serve */
  transfer: Transfer | null;
  /** riporti per busta del periodo nuovo (solo "Lascia nel Budget del mese") */
  nextCarryIn: Record<string, Cents>;
  /** "da assegnare" iniziale del periodo nuovo */
  nextUnassigned: Cents;
}

export function leftoversOf(balances: readonly EnvelopeBalance[]): Record<string, Cents> {
  return Object.fromEntries(balances.map((b) => [b.envelope.id, b.remaining]));
}

export function closingNet(leftovers: Record<string, Cents>, unassigned: Cents): Cents {
  return Object.values(leftovers).reduce((s, v) => s + v, unassigned);
}

/**
 * Piano di chiusura. Con netto ≤ 0 non c'è scelta: si copre lo sforamento da Risparmi.
 * - toSavings (A): tutto in Risparmi.
 * - carryOver (B): ogni busta riparte da tetto + proprio avanzo; il "da assegnare" resta tale.
 * - half (C): metà (arrotondata per difetto al centesimo) in Risparmi, il resto da assegnare.
 */
export function planClosing(
  leftovers: Record<string, Cents>,
  unassigned: Cents,
  option: ClosingOption,
): ClosingPlan {
  const net = closingNet(leftovers, unassigned);
  const base = { leftovers, net };

  if (net <= 0) {
    const cover = -net;
    return {
      ...base,
      choice: 'deficit',
      savingsDelta: -cover,
      transfer: cover > 0 ? { from: 'savings', to: 'budget', amount: cover } : null,
      nextCarryIn: {},
      nextUnassigned: 0,
    };
  }

  switch (option) {
    case 'toSavings':
      return {
        ...base,
        choice: 'toSavings',
        savingsDelta: net,
        transfer: { from: 'budget', to: 'savings', amount: net },
        nextCarryIn: {},
        nextUnassigned: 0,
      };
    case 'carryOver':
      return {
        ...base,
        choice: 'carryOver',
        savingsDelta: 0,
        transfer: null,
        nextCarryIn: { ...leftovers },
        nextUnassigned: unassigned,
      };
    case 'half': {
      const toSavings = Math.floor(net / 2);
      return {
        ...base,
        choice: 'half',
        savingsDelta: toSavings,
        transfer: { from: 'budget', to: 'savings', amount: toSavings },
        nextCarryIn: {},
        nextUnassigned: net - toSavings,
      };
    }
  }
}
