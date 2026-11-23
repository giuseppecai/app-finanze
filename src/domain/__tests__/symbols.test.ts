import { describe, expect, it } from 'vitest';
import { FALLBACK_SYMBOL, SYMBOL_GROUPS, suggestSymbol, symbolFor, symbolLabel } from '../symbols';

describe('Simboli', () => {
  it('57 simboli in 6 gruppi, nessun doppione', () => {
    const ids = SYMBOL_GROUPS.flatMap((g) => g.symbols.map((s) => s.id));
    expect(SYMBOL_GROUPS).toHaveLength(6);
    expect(ids).toHaveLength(57);
    expect(new Set(ids).size).toBe(57);
  });

  it('suggerimento dal nome: inizio di parola, senza accenti, il primo del catalogo vince', () => {
    expect(suggestSymbol('Palestra')).toBe('dumbbell');
    expect(suggestSymbol('Caffè e colazioni')).toBe('coffee');
    expect(suggestSymbol('Regali di Natale')).toBe('gift');
    expect(suggestSymbol('Benzina scooter')).toBe('fuel');
    expect(suggestSymbol('Xyz')).toBe(FALLBACK_SYMBOL);
    expect(suggestSymbol('')).toBe(FALLBACK_SYMBOL);
  });

  it('simbolo da mostrare: quello salvato, poi il predefinito per nome, poi "tag"', () => {
    expect(symbolFor({ name: 'Vita', icon: 'party-popper' })).toBe('party-popper');
    expect(symbolFor({ name: 'Vita' })).toBe('coffee');
    expect(symbolFor({ name: 'Vita', icon: 'non-esiste' })).toBe('coffee');
    expect(symbolFor({ name: 'Busta strana' })).toBe('tag');
    expect(symbolLabel('coffee')).toBe('Caffè');
  });
});
