// Avvio del database: seed al primo avvio (o fixture in modalità demo) e addebiti automatici.
import { setToday, today } from '../domain/clock';
import { db, devToday, isDemo } from './database';
import { replaceAll } from './dataset';
import { newId, runRecurringCharges } from './repositories';
import { buildSeed } from './seed';
import type { FinanzeDB } from './schema';

/** Al primo avvio scrive i dati iniziali. Non tocca un database già inizializzato. */
export async function seedIfEmpty(target: FinanzeDB): Promise<boolean> {
  const existing = await target.settings.get('settings');
  if (existing) return false;
  await replaceAll(target, buildSeed(newId, new Date().toISOString()));
  return true;
}

/** Chiede al browser di non sfrattare i dati quando manca spazio (best effort, nessun errore se rifiuta). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function initDatabase(): Promise<void> {
  if (isDemo) {
    // Demo: "oggi" = 19 novembre 2026 (o ?oggi=...). La fixture si carica la prima volta
    // (o con &reset=1); poi i dati di prova restano, così si prova anche che sopravvivono al riavvio.
    // Import dinamico: la fixture si scarica solo quando serve.
    const { buildDemoData, DEMO_TODAY } = await import('./fixtures');
    setToday(devToday ?? DEMO_TODAY);
    const reset = new URLSearchParams(location.search).get('reset') === '1';
    if (reset || !(await db.settings.get('settings'))) await replaceAll(db, buildDemoData());
  } else {
    if (devToday) setToday(devToday);
    await seedIfEmpty(db);
  }
  await runRecurringCharges(db, today());
}

/** Al ritorno in primo piano (e al cambio di data) controlla gli addebiti automatici. */
export function watchRecurringCharges(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void runRecurringCharges(db, today());
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
