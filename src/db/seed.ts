// Dati iniziali al primo avvio (docs/03-modello-dati.md § Dati iniziali). Solo dati.
import { DEFAULT_MONTHLY_ITEMS } from '../domain/pots';
import type { DataSet } from './fixtures';

/**
 * `newId` genera gli id (crypto.randomUUID nell'app), `now` è il timestamp ISO del primo avvio.
 * I giorni degli abbonamenti sono di esempio: l'onboarding chiede di controllarli.
 */
export function buildSeed(newId: () => string, now: string): DataSet {
  const envelopes = [
    { name: 'Trasporti', shortName: 'Trasporti', kind: 'spendable', cap: 10000 },
    { name: 'Vita', shortName: 'Vita', kind: 'spendable', cap: 20000 },
    { name: 'Spesa alimentare', shortName: 'Spesa', kind: 'spendable', cap: 5000 },
    { name: 'Shopping', shortName: 'Shopping', kind: 'spendable', cap: 12000 },
    { name: 'Casa & Servizi', shortName: 'Casa', kind: 'spendable', cap: 12000 },
    { name: 'Rate & Abbonamenti', shortName: 'Rate', kind: 'committed', cap: 11000 },
  ].map((e, i) => ({ ...e, kind: e.kind as 'spendable' | 'committed', id: newId(), order: i + 1, archived: false }));

  const rateId = envelopes[5]!.id;
  const recurring = [
    { name: 'Rata iPhone', amount: 7000, dayOfMonth: 1 },
    { name: 'Spotify', amount: 850, dayOfMonth: 5 },
    { name: 'Disney+', amount: 600, dayOfMonth: 12 },
    { name: 'Prime', amount: 500, dayOfMonth: 15 },
    { name: 'iCloud', amount: 100, dayOfMonth: 24 },
  ].map((r) => ({ ...r, id: newId(), envelopeId: rateId, card: 'extra' as const, active: true, createdAt: now }));

  return {
    settings: {
      id: 'settings',
      periodStartDay: 27,
      cardReserve: null,
      monthlyItems: DEFAULT_MONTHLY_ITEMS.map((i) => ({ ...i })),
      lastEnvelopeId: null,
      onboardingDone: false,
    },
    envelopes,
    periods: [],
    transactions: [],
    recurring,
    people: [],
    loans: [],
    pots: [
      { id: 'savings', name: 'Risparmi', balance: 0 },
      { id: 'travel', name: 'Viaggi', balance: 0 },
      { id: 'gifts', name: 'Regali & Imprevisti', balance: 0 },
      { id: 'bills', name: 'Bollette', balance: 0 },
    ],
    reconciliations: [],
    bills: [],
  };
}
