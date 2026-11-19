// L'istanza del database usata dall'app.
// Con `?demo=1` nell'indirizzo si usa un database separato riempito con la fixture dei documenti:
// i dati veri non vengono mai toccati. Funziona anche nella versione pubblicata, così la demo
// si può provare dall'iPhone in Safari (l'app installata nella Home apre sempre i dati veri).
import { openDatabase, type FinanzeDB } from './schema';

export const DB_NAME = 'app-finanze';
export const DEMO_DB_NAME = 'app-finanze-demo';

function searchParams(): URLSearchParams {
  return typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
}

export const isDemo: boolean = searchParams().get('demo') === '1';

/** In sviluppo o in demo: `?oggi=2026-11-24` fissa la data (per provare abbonamenti e chiusura). */
export const devToday: string | null = (() => {
  if (!import.meta.env.DEV && !isDemo) return null;
  const value = searchParams().get('oggi');
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
})();

export const db: FinanzeDB = openDatabase(isDemo ? DEMO_DB_NAME : DB_NAME);
