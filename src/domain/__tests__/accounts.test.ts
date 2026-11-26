import { describe, expect, it } from 'vitest';
import { accountPayments, needsCardChoice, otherAccountsRecurring, salaryAccountPlan } from '../accounts';
import { transferChecklist } from '../monthEnd';
import { availableForEnvelopes, buildNewPeriod, planOpening } from '../opening';
import { calendarPeriodById } from '../periods';
import { chargeToTransaction, recurringQuota } from '../recurring';
import type { Envelope, Recurring } from '../types';

// Stipendio su Isybank; da lì partono l'affitto (a mano) e la rata iPhone (addebito il 5).
const settings = { accounts: [{ id: 'isy', name: 'Isybank' }], salaryAccountId: 'isy' };
const rent = { item: { id: 'rent', name: 'Affitto', kind: 'payment' as const, payFrom: 'isy' }, amount: 58200 };
const travel = { item: { id: 'travel', name: 'Viaggi', kind: 'pot' as const }, amount: 5000 };
const rata: Recurring = {
  id: 'rata', name: 'Rata iPhone', amount: 7024, dayOfMonth: 5, envelopeId: 'x', card: 'extra', active: true, createdAt: '', payFrom: 'isy',
};
const spotify: Recurring = { id: 'sp', name: 'Spotify', amount: 850, dayOfMonth: 7, envelopeId: 'x', card: 'extra', active: true, createdAt: '' };
const dic = calendarPeriodById('2026-12', 27);
const envelopes: Envelope[] = [{ id: 'vita', name: 'Vita', shortName: 'Vita', kind: 'spendable', cap: 20000, order: 0, archived: false }];

describe('Altri conti · stipendio su Isybank', () => {
  it('su Isybank restano affitto 582 + rata 70,24 = 652,24; su Revolut vanno 847,76', () => {
    const payments = accountPayments('isy', [rata, spotify], [rent, travel], dic);
    expect(payments.map((p) => p.name)).toEqual(['Affitto', 'Rata iPhone']);
    expect(salaryAccountPlan(settings, 150000, payments)).toMatchObject({ leave: 65224, move: 84776 });
  });

  it('la rata da Isybank non passa dalla Pocket Spese fisse (quota 0), Spotify sì', () => {
    expect(recurringQuota(rata, '2026-12', 27)).toBe(0);
    expect(recurringQuota(spotify, '2026-12', 27)).toBe(850);
    expect(otherAccountsRecurring([rata, spotify], dic)).toBe(7024);
  });

  it('ma esce dallo stipendio: meno soldi per le buste e per Risparmi', () => {
    // 1.500 − Spese fisse 8,50 − affitto 582 − Viaggi 50 − rata 70,24 = 789,26
    expect(availableForEnvelopes(150000, [rent, travel], 850, 7024)).toBe(78926);
    const plan = planOpening(150000, envelopes, [rent, travel], 850, 7024);
    expect(plan.savings).toBe(78926 - 20000);
    const { potDeltas } = buildNewPeriod({ target: dic, today: '2026-11-27', salary: 150000, envelopes, items: [rent, travel], billsQuota: 850, otherAccounts: 7024, closing: null });
    expect(potDeltas.savings).toBe(58926);
  });

  it('giroconti: prima "Lascia su Isybank" e "Isybank → Revolut", l’affitto non ha una riga sua', () => {
    const plan = planOpening(150000, envelopes, [rent, travel], 850, 7024);
    const account = salaryAccountPlan(settings, 150000, accountPayments('isy', [rata], [rent, travel], dic))!;
    const rows = transferChecklist(plan, null, account);
    expect(rows.map((r) => [r.key, r.amount])).toEqual([
      ['leave', 65224], ['move', 84776], ['budget', 20000], ['item:travel', 5000], ['bills', 850], ['savings', 58926],
    ]);
    // quello che arriva su Revolut copre esattamente i giroconti su Revolut
    expect(84776).toBe(20000 + 5000 + 850 + 58926);
  });

  it('stipendio su Revolut (nessun conto dello stipendio): niente righe in più', () => {
    expect(salaryAccountPlan({ accounts: settings.accounts, salaryAccountId: null }, 150000, [])).toBeNull();
  });
});

describe('Altri conti · carte', () => {
  it('Isybank con una carta (o nessuna): niente da scegliere; con due sì', () => {
    expect(needsCardChoice({ cards: [{ id: 'c1', name: 'Carta Isybank' }] })).toBe(false);
    expect(needsCardChoice({})).toBe(false);
    expect(needsCardChoice({ cards: [{ id: 'a', name: 'Debito' }, { id: 'b', name: 'Credito' }] })).toBe(true);
  });
  it('l’addebito della rata da Isybank non ha carta Revolut: segna il conto', () => {
    const tx = chargeToTransaction({ recurring: rata, date: '2026-12-05' }, '2026-12', 'tx', '');
    expect(tx).toMatchObject({ card: null, accountId: 'isy', accountCardId: null, envelopeId: null });
    expect(chargeToTransaction({ recurring: spotify, date: '2026-12-07' }, '2026-12', 'tx2', '').card).toBe('extra');
  });
});
