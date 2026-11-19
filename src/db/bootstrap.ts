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

export async function initDatabase(): Promise<void> {
  if (import.meta.env.DEV && isDemo) {
    // La demo riparte sempre dalla fixture, con "oggi" = 19 novembre 2026 (o ?oggi=...).
    // Import dinamico: nella build di produzione questo ramo sparisce insieme alla fixture.
    const { buildDemoData, DEMO_TODAY } = await import('./fixtures');
    setToday(devToday ?? DEMO_TODAY);
    await replaceAll(db, buildDemoData());
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
