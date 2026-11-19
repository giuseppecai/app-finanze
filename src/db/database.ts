// L'istanza del database usata dall'app.
// In sviluppo, con `?demo=1` nell'indirizzo, si usa un database separato riempito con la fixture:
// i dati veri non vengono mai toccati.
import { openDatabase, type FinanzeDB } from './schema';

export const DB_NAME = 'app-finanze';
export const DEMO_DB_NAME = 'app-finanze-demo';

function searchParams(): URLSearchParams {
  return typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
}

/** Demo attiva solo in sviluppo (`npm run dev`), mai nella build pubblicata. */
export const isDemo: boolean = import.meta.env.DEV && searchParams().get('demo') === '1';

/** Solo in sviluppo: `?oggi=2026-11-24` fissa la data (per provare abbonamenti e chiusura). */
export const devToday: string | null = (() => {
  if (!import.meta.env.DEV) return null;
  const value = searchParams().get('oggi');
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
})();

export const db: FinanzeDB = openDatabase(isDemo ? DEMO_DB_NAME : DB_NAME);
