// Rotte dell'app (HashRouter), da docs/04-schermate.md.
export const routes = {
  home: '/',
  entry: '/nuovo',
  movements: '/movimenti',
  history: '/storico',
  settings: '/imposta',
  closing: '/chiudi',
  opening: '/inizio',
  loans: '/prestiti',
  recurring: '/abbonamenti',
  onboarding: '/benvenuto',
  bills: '/bollette',
  backup: '/backup',
  /** vecchio indirizzo di Bollette (prima stava dentro Casa & Servizi) */
  casa: '/casa',
} as const;

export type RouteName = keyof typeof routes;

/** Schermate con la tab bar in basso. Le altre si aprono a tutto schermo. */
export const tabbedRoutes: readonly RouteName[] = ['home', 'movements', 'history', 'settings'];
