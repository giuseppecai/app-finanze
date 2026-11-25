import { describe, expect, it } from 'vitest';
import { savingPreview, savingQuota } from '../saving';
import { monthlyQuota } from '../bills';
import { chargeToTransaction, dueCharges, recurringDuePeriod, recurringQuota, savedSubscriptions } from '../recurring';
import { calendarPeriodById } from '../periods';
import type { Recurring } from '../types';
import { ENV } from '../../db/fixtures';

// Esempio di R15: Prime Video 49,99 € l'anno, addebito il 23 marzo (startDay 27 → periodo Marzo).
const base = { envelopeId: ENV.rate, card: 'extra', active: true, createdAt: '2026-01-01T00:00:00Z' } as const;
const prime: Recurring = { ...base, id: 'prime', name: 'Prime Video', amount: 4999, dayOfMonth: 23, frequency: 12, anchorMonth: '2027-03' };
const primeSaved: Recurring = { ...prime, saving: true, saveFrom: '2026-09', fund: 0 };
const mar = { ...calendarPeriodById('2027-03', 27) };

describe('R15 · scenario 1: accantono da settembre', () => {
  it('il popup propone 7 mesi (set → mar) a € 7,15', () => {
    expect(savingPreview(4999, 0, '2026-09', '2027-03')).toEqual({ quota: 715, months: 7 });
    // con 20 € già da parte: 29,99 / 7 → 4,29
    expect(savingPreview(4999, 2000, '2026-09', '2027-03')).toEqual({ quota: 429, months: 7 });
  });

  it('la quota si ricalcola ogni mese e arriva esatta a marzo', () => {
    expect(recurringDuePeriod(prime, '2026-09', 27)).toBe('2027-03');
    let fund = 0;
    const quotas: number[] = [];
    for (const opening of ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']) {
      const q = recurringQuota({ ...primeSaved, fund }, opening, 27);
      quotas.push(q);
      fund += q;
    }
    expect(quotas).toEqual([0, 715, 714, 714, 714, 714, 714, 714]);
    expect(fund).toBe(4999);
  });

  it('il 23 marzo si paga dalla Pocket (senza busta); poi si riparte per l’anno dopo: 49,99 / 12', () => {
    const marP = { ...mar, id: '2027-03' };
    const [charge] = dueCharges([primeSaved], marP, [], '2027-03-23');
    expect(chargeToTransaction(charge!, '2027-03', 'tx', '')).toMatchObject({ envelopeId: null, amount: 4999, recurringId: 'prime' });
    // aprile: fondo 0, prossima scadenza marzo 2028 → 12 giroconti
    expect(recurringQuota({ ...primeSaved, fund: 0 }, '2027-04', 27)).toBe(417);
  });
});

describe('R15 · scenario 2: pago tutto alla scadenza', () => {
  it('nessuna quota fino a marzo; a marzo tutti i 49,99 nel giroconto → Spese fisse, e si paga dalla Pocket', () => {
    expect(recurringQuota(prime, '2026-12', 27)).toBe(0);
    expect(recurringQuota(prime, '2027-02', 27)).toBe(0);
    expect(recurringQuota(prime, '2027-03', 27)).toBe(4999);
    const [charge] = dueCharges([prime], { ...mar, id: '2027-03' }, [], '2027-03-23');
    expect(chargeToTransaction(charge!, '2027-03', 'tx', '').envelopeId).toBeNull();
  });
});

describe('R16 · Spese fisse: abbonamenti mensili', () => {
  const spotify: Recurring = { ...base, id: 'sp', name: 'Spotify', amount: 850, dayOfMonth: 5 };
  it('ogni mese nel giroconto l’importo (meno quello che è già nel fondo)', () => {
    expect(recurringQuota(spotify, '2026-12', 27)).toBe(850);
    expect(recurringQuota({ ...spotify, fund: 300 }, '2026-12', 27)).toBe(550);
    expect(recurringQuota({ ...spotify, active: false }, '2026-12', 27)).toBe(0);
  });
  it('giroconto unico: Spotify 8,50 + Prime accantonato 7,15 (e i loro fondi)', () => {
    expect(savedSubscriptions([spotify, primeSaved], '2026-09', 27)).toEqual({ quota: 850 + 715, funds: 0 });
  });
});

describe('R15 · bollette periodiche', () => {
  const acqua = { estimate: 12000, split: 'mine', frequency: 12, fund: 0, nextDue: '2027-02' } as const;
  it('accantonata (default): 120 / 3 giroconti (dic, gen, feb)', () => {
    expect(monthlyQuota(acqua, '2026-12')).toBe(4000);
  });
  it('non accantonata: 0 fino al mese della bolletta, poi tutta la tua quota (meno il fondo)', () => {
    expect(monthlyQuota({ ...acqua, saving: false }, '2026-12')).toBe(0);
    expect(monthlyQuota({ ...acqua, saving: false }, '2027-02')).toBe(12000);
    expect(monthlyQuota({ ...acqua, saving: false, fund: 3000 }, '2027-02')).toBe(9000);
    expect(monthlyQuota({ ...acqua, saving: false }, '2027-03')).toBe(12000); // in ritardo
  });
  it('accantonata da gennaio: 0 a dicembre, poi 120 / 2', () => {
    expect(monthlyQuota({ ...acqua, saveFrom: '2027-01' }, '2026-12')).toBe(0);
    expect(monthlyQuota({ ...acqua, saveFrom: '2027-01' }, '2027-01')).toBe(6000);
  });
  it('savingQuota senza scadenza: accantonata = quota fissa, non accantonata = 0', () => {
    expect(savingQuota({ target: 12000, fund: 0, due: null, saving: true, frequency: 12 }, '2026-12')).toBe(1000);
    expect(savingQuota({ target: 12000, fund: 0, due: null, saving: false, frequency: 12 }, '2026-12')).toBe(0);
  });
});

describe('R15 · prossimo addebito tra un anno (Prime il 22 novembre, prossimo novembre 2027)', () => {
  const p27: Recurring = { ...base, id: 'p27', name: 'Prime', amount: 4990, dayOfMonth: 22, frequency: 12, anchorMonth: '2027-11', saving: true, saveFrom: '2026-11', fund: 1200 };
  it('il 22 novembre 2026 è già passato: la scadenza è novembre 2027, non quella di quest’anno', () => {
    expect(recurringDuePeriod(p27, '2026-11', 27)).toBe('2027-11');
    expect(dueCharges([p27], { ...calendarPeriodById('2026-11', 27), id: '2026-11' }, [], '2026-11-26')).toEqual([]);
  });
  it('con € 12 già da parte: 37,90 / 13 giroconti (nov 2026 → nov 2027) = € 2,92, non € 37,90', () => {
    expect(recurringQuota(p27, '2026-11', 27)).toBe(292);
    expect(recurringQuota(p27, '2026-12', 27)).toBe(316); // 37,90 / 12
  });
});
