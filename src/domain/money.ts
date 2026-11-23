// R1 · Soldi e formattazione. Tutto in centesimi interi, niente float.
import type { Cents } from './types';

const MINUS = '−'; // segno meno tipografico
/** spazio non separabile: "€ 8" e "− € 8" non vanno mai a capo */
const NBSP = ' ';

export interface FormatEuroOptions {
  /** 'auto': niente decimali se i centesimi sono zero (liste). 'always': sempre 2 decimali (tastierino, confronto). */
  decimals?: 'auto' | 'always';
  /** 'always': anche i positivi hanno il segno ("+ € 1,12"). */
  sign?: 'auto' | 'always';
}

function groupThousands(n: number): string {
  // Raggruppamento manuale: Intl in it-IT non raggruppa i numeri a 4 cifre ("1240").
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `€ 12,40`, `€ 1.240`, `− € 8`, `+ € 1,12` (con spazi non separabili) */
export function formatEuro(cents: Cents, options: FormatEuroOptions = {}): string {
  if (!Number.isInteger(cents)) throw new Error(`Importo non intero in centesimi: ${cents}`);
  const { decimals = 'auto', sign = 'auto' } = options;
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  let body = `€${NBSP}${groupThousands(euros)}`;
  if (decimals === 'always' || rest !== 0) body += `,${String(rest).padStart(2, '0')}`;
  if (cents < 0) return `${MINUS}${NBSP}${body}`;
  if (sign === 'always' && cents > 0) return `+${NBSP}${body}`;
  return body;
}

/** Importo da mettere in un campo di testo modificabile: "12,40", "-8,00" (niente simbolo, sempre 2 decimali). */
export function amountText(cents: Cents): string {
  const abs = Math.abs(cents);
  const body = `${groupThousands(Math.floor(abs / 100))},${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${body}` : body;
}

/**
 * Legge un importo scritto a mano ("12,40", "1.240,50", "12.4", "€ 8") → centesimi.
 * Restituisce null se non è un importo valido. Accetta solo valori ≥ 0.
 */
export function parseEuro(input: string): Cents | null {
  let s = input.replace(/€/g, '').replace(/\s/g, '');
  if (s === '') return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Solo punti: "12.40" o "12.4" è un decimale, "1.240" sono migliaia.
    const parts = s.split('.');
    const last = parts[parts.length - 1] ?? '';
    if (parts.length === 2 && last.length >= 1 && last.length <= 2) {
      // decimale: lascia così
    } else {
      s = s.replace(/\./g, '');
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [intPart = '0', decPart = ''] = s.split('.');
  return Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
}

/** Il tastierino lavora in centesimi e accetta al massimo 7 cifre. */
export const KEYPAD_MAX_DIGITS = 7;

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00';

/** Digitare 4, 8, 0 → 480 (€ 4,80). Le cifre oltre il massimo vengono ignorate. */
export function keypadPress(cents: Cents, key: KeypadKey): Cents {
  const digits = cents === 0 ? '' : String(cents);
  let next = digits;
  for (const ch of key) {
    if (next.length >= KEYPAD_MAX_DIGITS) break;
    next += ch;
  }
  const value = Number(next.replace(/^0+/, '') || '0');
  return value;
}

/** Tasto cancella: toglie l'ultima cifra. */
export function keypadBackspace(cents: Cents): Cents {
  return Math.floor(cents / 10);
}

/** Stepper "agganciato" al passo: da € 140,49 il + porta a € 145 e il − a € 140; da € 140 a 145 / 135. */
export function stepCents(value: Cents, step: Cents, direction: 1 | -1): Cents {
  const rest = ((value % step) + step) % step;
  if (rest === 0) return value + direction * step;
  return direction === 1 ? value + (step - rest) : value - rest;
}
