import { describe, expect, it } from 'vitest';
import { amountText, formatEuro, keypadBackspace, keypadPress, parseEuro, stepCents, type KeypadKey } from '../money';

const M = '−';
/** gli spazi negli importi sono non separabili (U+00A0): niente a capo tra € e cifra */
const nb = (s: string) => s.replace(/ /g, ' ');

describe('R1 · formatEuro', () => {
  it('simbolo davanti con spazio, virgola decimale', () => {
    expect(formatEuro(1240)).toBe(nb('€ 12,40'));
  });
  it('punto delle migliaia anche a 4 cifre', () => {
    expect(formatEuro(124000)).toBe(nb('€ 1.240'));
    expect(formatEuro(149500)).toBe(nb('€ 1.495'));
    expect(formatEuro(123456789)).toBe(nb('€ 1.234.567,89'));
  });
  it('niente decimali se i centesimi sono zero, decimali se presenti', () => {
    expect(formatEuro(5700)).toBe(nb('€ 57'));
    expect(formatEuro(2050)).toBe(nb('€ 20,50'));
    expect(formatEuro(0)).toBe(nb('€ 0'));
  });
  it("opzione decimals 'always' per tastierino e confronto", () => {
    expect(formatEuro(480, { decimals: 'always' })).toBe(nb('€ 4,80'));
    expect(formatEuro(1200, { decimals: 'always' })).toBe(nb('€ 12,00'));
    expect(formatEuro(0, { decimals: 'always' })).toBe(nb('€ 0,00'));
  });
  it('negativi con il meno tipografico U+2212 e spazio', () => {
    expect(formatEuro(-800)).toBe(nb(`${M} € 8`));
    expect(formatEuro(-1240, { decimals: 'always' })).toBe(nb(`${M} € 12,40`));
  });
  it("segno + per le entrate con sign 'always'", () => {
    expect(formatEuro(112, { sign: 'always' })).toBe(nb('+ € 1,12'));
    expect(formatEuro(0, { sign: 'always' })).toBe(nb('€ 0'));
  });
  it('rifiuta importi non interi', () => {
    expect(() => formatEuro(12.4)).toThrow();
  });
  it('testo per i campi modificabili: senza simbolo, 2 decimali, migliaia col punto', () => {
    expect(amountText(1240)).toBe('12,40');
    expect(amountText(124000)).toBe('1.240,00');
    expect(amountText(-800)).toBe('-8,00');
    expect(parseEuro(amountText(124050))).toBe(124050);
  });
});

describe('R1 · parseEuro', () => {
  it.each([
    ['12,40', 1240],
    ['339,10', 33910],
    ['1.240', 124000],
    ['1.240,50', 124050],
    ['12.4', 1240],
    ['12.40', 1240],
    ['€ 8', 800],
    ['0', 0],
    [' 62 ', 6200],
  ])('%s → %i', (input, cents) => {
    expect(parseEuro(input)).toBe(cents);
  });
  it.each(['', 'abc', '12,345', '-5', '1,2,3'])('%s non è valido', (input) => {
    expect(parseEuro(input)).toBeNull();
  });
});

describe('R1 · tastierino', () => {
  const type = (keys: KeypadKey[]) => keys.reduce(keypadPress, 0);
  it('digitare 4, 8, 0 → 480 (€ 4,80)', () => {
    expect(type(['4', '8', '0'])).toBe(480);
    expect(formatEuro(type(['4', '8', '0']), { decimals: 'always' })).toBe(nb('€ 4,80'));
  });
  it('tasto 00', () => {
    expect(type(['1', '2', '00'])).toBe(1200);
    expect(type(['00'])).toBe(0);
  });
  it('tasto cancella', () => {
    expect(keypadBackspace(480)).toBe(48);
    expect(keypadBackspace(4)).toBe(0);
    expect(keypadBackspace(0)).toBe(0);
  });
  it('massimo 7 cifre', () => {
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8'])).toBe(1234567);
    expect(type(['1', '2', '3', '4', '5', '6', '00'])).toBe(1234560);
  });
});

describe('stepCents', () => {
  it('passo di 5 € agganciato ai multipli', () => {
    expect(stepCents(14049, 500, 1)).toBe(14500);
    expect(stepCents(14049, 500, -1)).toBe(14000);
    expect(stepCents(14000, 500, 1)).toBe(14500);
    expect(stepCents(14000, 500, -1)).toBe(13500);
  });
});
