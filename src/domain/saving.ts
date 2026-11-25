// R15 · Accantonare o pagare tutto nel mese: bollette periodiche e abbonamenti non mensili.
import { monthsBetween } from './dates';
import type { Cents, PeriodId } from './types';

export interface SavingInput {
  /** quanto serve per la prossima scadenza (tua quota / importo dell'abbonamento) */
  target: Cents;
  /** già accantonato */
  fund: Cents;
  /** periodo della prossima scadenza; null = non si sa */
  due: PeriodId | null;
  /** true = si accantona ogni mese; false = tutto nel mese della scadenza */
  saving: boolean;
  /** primo periodo in cui si accantona (null = da subito) */
  saveFrom?: PeriodId | null;
  /** ogni quanti mesi (per la quota fissa quando la scadenza non si sa) */
  frequency: number;
}

/**
 * Giroconti che restano prima della scadenza, contando quello di `opening` (il prossimo "Inizio del
 * mese"). Minimo 1: se la scadenza è già passata, tutto al prossimo.
 */
export function depositsLeft(due: PeriodId, opening: PeriodId): number {
  return Math.max(1, monthsBetween(opening, due) + 1);
}

/**
 * Quanto mettere da parte all'"Inizio del mese" del periodo `opening`:
 * - si accantona, scadenza nota: (quanto manca) ÷ (giroconti che restano), per eccesso al centesimo;
 *   0 prima di `saveFrom`;
 * - si accantona, scadenza non nota: quota fissa target ÷ frequenza;
 * - non si accantona: tutto quello che manca nel mese della scadenza (o dopo, se è in ritardo), 0 negli altri.
 */
export function savingQuota(input: SavingInput, opening: PeriodId): Cents {
  const missing = Math.max(0, input.target - input.fund);
  if (!input.saving) {
    if (!input.due) return 0;
    return monthsBetween(opening, input.due) <= 0 ? missing : 0;
  }
  if (input.saveFrom && opening < input.saveFrom) return 0;
  if (!input.due) return Math.ceil(input.target / input.frequency);
  return Math.ceil(missing / depositsLeft(input.due, opening));
}

export interface SavingPreview {
  /** quota al mese */
  quota: Cents;
  /** quanti giroconti prima della scadenza */
  months: number;
}

/**
 * Anteprima del popup "Iniziamo ad accantonare?": partendo da `from` con `fund` già da parte,
 * quanto al mese e per quanti mesi fino alla scadenza `due`.
 * Esempio: Prime 49,99 il 23 marzo, da settembre → 7 mesi, € 7,15 al mese.
 */
export function savingPreview(target: Cents, fund: Cents, from: PeriodId, due: PeriodId): SavingPreview {
  const months = depositsLeft(due, from);
  return { quota: Math.ceil(Math.max(0, target - fund) / months), months };
}
