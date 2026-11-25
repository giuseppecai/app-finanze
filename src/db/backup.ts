// Backup in JSON: tutte le tabelle + versione dello schema + data. Logica pura (niente Dexie).
import type { DataSet } from './fixtures';
import { migrateEnvelopeV4, migratePeriodV3, migrateSettingsV3, migrateSettingsV5, SCHEMA_VERSION, withSymbol } from './schema';

export const BACKUP_APP = 'app-finanze';

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: DataSet;
}

export function buildBackup(data: DataSet, exportedAt: string): BackupFile {
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt, data };
}

/** "finanze-backup-2026-11-19.json" */
export function backupFileName(exportedAt: string): string {
  return `finanze-backup-${exportedAt.slice(0, 10)}.json`;
}

export class BackupError extends Error {}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown, name: string): Rec[] => {
  if (!Array.isArray(v) || !v.every(isRec)) throw new BackupError(`Nel backup manca l'elenco "${name}".`);
  return v;
};

/**
 * Legge un file di backup e lo porta allo schema attuale (un backup v1 riceve i campi della v2).
 * Lancia BackupError con un messaggio comprensibile se il file non è un backup valido.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Il file non è un backup di Finanze (JSON non valido).');
  }
  if (!isRec(raw) || raw.app !== BACKUP_APP || !isRec(raw.data)) {
    throw new BackupError('Il file non è un backup di Finanze.');
  }
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version < 1) throw new BackupError('Versione del backup sconosciuta.');
  if (version > SCHEMA_VERSION) throw new BackupError('Il backup viene da una versione più nuova dell’app: aggiorna prima l’app.');

  const d = raw.data;
  if (!isRec(d.settings) || d.settings.id !== 'settings') throw new BackupError('Nel backup mancano le impostazioni.');
  const pots = arr(d.pots, 'salvadanai');
  // v1 → v2: prestiti nei due sensi, billId, billsQuota, bollette, salvadanaio Bollette.
  // v2 → v3: voci fisse dell'inizio del mese, quote per voce nei periodi, bollette senza busta.
  const data = {
    settings: migrateSettingsV5(migrateSettingsV3(d.settings)),
    // v3 → v4: Casa & Servizi da spendere.
    envelopes: arr(d.envelopes, 'buste').map(migrateEnvelopeV4).map(withSymbol),
    periods: arr(d.periods, 'periodi').map((p) => migratePeriodV3({ billsQuota: 0, ...p })),
    transactions: arr(d.transactions, 'movimenti').map((t) => ({ billId: null, ...t })),
    recurring: arr(d.recurring, 'abbonamenti'),
    people: arr(d.people, 'persone'),
    loans: arr(d.loans, 'prestiti').map((l) => ({ direction: 'lent', offsets: null, ...l })),
    pots: (pots.some((p) => p.id === 'bills') ? pots : [...pots, { id: 'bills', name: 'Spese fisse', balance: 0 }]).map(withSymbol),
    reconciliations: arr(d.reconciliations, 'confronti'),
    bills: d.bills === undefined ? [] : arr(d.bills, 'bollette').map(({ envelopeId: _unused, ...b }) => b),
  } as unknown as DataSet;
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: String(raw.exportedAt ?? ''), data };
}
