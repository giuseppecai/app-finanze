import { describe, expect, it } from 'vitest';
import { routes, tabbedRoutes } from './routes';

describe('rotte', () => {
  it('sono le 9 di 04-schermate.md più l’onboarding, tutte diverse', () => {
    const paths = Object.values(routes);
    expect(paths).toEqual([
      '/', '/nuovo', '/movimenti', '/storico', '/imposta',
      '/chiudi', '/inizio', '/prestiti', '/abbonamenti', '/benvenuto',
    ]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('la tab bar compare solo su Home, Movimenti, Storico, Imposta', () => {
    expect(tabbedRoutes.map((r) => routes[r])).toEqual(['/', '/movimenti', '/storico', '/imposta']);
  });
});
