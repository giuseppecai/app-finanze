import { describe, expect, it } from 'vitest';
import { backupFileName, BackupError, buildBackup, parseBackup } from '../../db/backup';
import { buildDemoData, ENV } from '../../db/fixtures';
import { defaultShortName, planCapsChange } from '../settings';

const data = buildDemoData();
const nov = data.periods.find((p) => p.id === '2026-11')!;

describe('Imposta · tetti a metà mese', () => {
  it('Spesa alimentare 50 → 60 a mese aperto: +10, giroconto Risparmi → Budget del mese', () => {
    const caps = Object.fromEntries(data.envelopes.map((e) => [e.id, e.id === ENV.spesa ? 6000 : e.cap]));
    const c = planCapsChange(data.envelopes, caps, nov);
    expect(c).toMatchObject({ before: 70000, after: 71000, diff: 1000, savingsDelta: -1000, transfer: { from: 'savings', to: 'budget', amount: 1000 } });
    expect(c.allocations?.[ENV.spesa]).toBe(6000);
  });

  it('abbassando: i soldi tornano in Risparmi', () => {
    const caps = { [ENV.shopping]: 10000 };
    const c = planCapsChange(data.envelopes, caps, nov);
    expect(c).toMatchObject({ diff: -2000, savingsDelta: 2000, transfer: { from: 'budget', to: 'savings', amount: 2000 } });
  });

  it('busta nuova a mese aperto: entra nelle allocazioni', () => {
    const c = planCapsChange(data.envelopes, { 'env-nuova': 3000 }, nov);
    expect(c.allocations?.['env-nuova']).toBe(3000);
    expect(c.diff).toBe(3000);
  });

  it('senza mese aperto: nessun giroconto, valgono dal prossimo inizio', () => {
    const c = planCapsChange(data.envelopes, { [ENV.spesa]: 6000 }, null);
    expect(c).toMatchObject({ before: 70000, transfer: null, savingsDelta: 0, allocations: null });
  });

  it('nessun cambio → nessun giroconto', () => {
    expect(planCapsChange(data.envelopes, {}, nov).transfer).toBeNull();
  });

  it('nome breve di default', () => {
    expect(defaultShortName('  Regali di Natale ')).toBe('Regali');
  });
});

describe('Backup', () => {
  it('esporta e reimporta gli stessi dati', () => {
    const file = buildBackup(data, '2026-11-19T10:00:00.000Z');
    expect(file.schemaVersion).toBe(5);
    expect(backupFileName(file.exportedAt)).toBe('finanze-backup-2026-11-19.json');
    const back = parseBackup(JSON.stringify(file));
    expect(back.data).toEqual(data);
  });

  it('un backup v1 riceve i campi della v2', () => {
    const v1 = JSON.parse(JSON.stringify(buildBackup(data, 'x'))) as { schemaVersion: number; data: Record<string, unknown[]> };
    v1.schemaVersion = 1;
    v1.data.loans = (v1.data.loans as Record<string, unknown>[]).map(({ direction: _d, offsets: _o, ...l }) => l);
    v1.data.transactions = (v1.data.transactions as Record<string, unknown>[]).map(({ billId: _b, ...t }) => t);
    v1.data.pots = (v1.data.pots as Record<string, unknown>[]).filter((p) => p.id !== 'bills');
    delete (v1.data as Record<string, unknown>).bills;
    const back = parseBackup(JSON.stringify(v1));
    expect(back.data.loans.every((l) => l.direction === 'lent' && l.offsets === null)).toBe(true);
    expect(back.data.transactions.every((t) => t.billId === null)).toBe(true);
    expect(back.data.pots.map((p) => p.id)).toContain('bills');
    expect(back.data.bills).toEqual([]);
  });

  it('un backup v2 riceve le voci fisse e le quote per voce della v3', () => {
    const v2 = JSON.parse(JSON.stringify(buildBackup(data, 'x'))) as { schemaVersion: number; data: Record<string, unknown> };
    v2.schemaVersion = 2;
    const { monthlyItems: _m, ...settings } = v2.data.settings as Record<string, unknown>;
    v2.data.settings = { ...settings, giftsQuota: 2500, lastTravelQuota: 7000 };
    v2.data.periods = (v2.data.periods as Record<string, unknown>[]).map(({ quotas: _q, ...p }) => ({ ...p, travelQuota: 5000, giftsQuota: 2500 }));
    v2.data.bills = (v2.data.bills as Record<string, unknown>[]).map((b) => ({ ...b, envelopeId: 'env-casa' }));
    const back = parseBackup(JSON.stringify(v2));
    expect(back.data.settings.monthlyItems.map((i) => [i.id, i.kind, i.amount])).toEqual([['travel', 'pot', 7000], ['gifts', 'pot', 2500]]);
    expect('giftsQuota' in back.data.settings).toBe(false);
    expect(back.data.periods.every((p) => p.quotas.travel === 5000 && p.quotas.gifts === 2500 && !('travelQuota' in p))).toBe(true);
    expect(back.data.bills.every((b) => !('envelopeId' in b))).toBe(true);
  });

  it.each([
    ['non JSON', 'ciao'],
    ['altro file', JSON.stringify({ hello: 1 })],
    ['versione futura', JSON.stringify({ ...buildBackup(data, 'x'), schemaVersion: 99 })],
    ['senza impostazioni', JSON.stringify({ ...buildBackup(data, 'x'), data: { ...data, settings: null } })],
    ['senza movimenti', JSON.stringify({ ...buildBackup(data, 'x'), data: { ...data, transactions: 'no' } })],
  ])('rifiuta: %s', (_name, text) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
  });
});
