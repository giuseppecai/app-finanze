// M10 · Capire dove vanno i soldi: gli esempi di R18–R25 (docs/02-regole-e-calcoli.md).
import { describe, expect, it } from 'vitest';
import { buildDemoData, DEMO_TODAY, ENV } from '../../db/fixtures';
import { summarizePeriod } from '../envelopes';
import {
  annualCost, biggestExpenses, capKeptHides, cleanIntention, closingSavingsOf, impulseSummary, mondayOf, monthSavings,
  normalizeText, periodSplit, recentClosedIds, reviewDue, searchMovements, searchSummary, searchTerms, spentBetween,
  todayAllowance, weekdaySpending, weekSpending,
} from '../insights';
import { availableForEnvelopes, buildNewPeriod, planOpening, savingsGoalCheck, splitOf, type ItemQuota } from '../opening';
import { calendarPeriodById } from '../periods';
import { historyForCurrent } from '../stats';
import type { Bill, Envelope, MonthlyItem, Period, Recurring, Transaction } from '../types';

const eur = (v: number) => Math.round(v * 100);

const items: MonthlyItem[] = [
  { id: 'travel', name: 'Viaggi', kind: 'pot', amount: eur(50), archived: false },
  { id: 'gifts', name: 'Regali & Imprevisti', kind: 'pot', amount: eur(25), archived: false },
  { id: 'rent', name: 'Affitto', kind: 'payment', amount: eur(582), archived: false },
];
const q = (id: string, amount: number): ItemQuota => ({ item: items.find((i) => i.id === id)!, amount: eur(amount) });
const env = (id: string, cap: number): Envelope => ({ id, name: id, shortName: id, kind: 'spendable', cap: eur(cap), order: 1, archived: false });

const basePeriod = (over: Partial<Period> = {}): Period => ({
  ...calendarPeriodById('2026-12', 27),
  startedAt: '2026-11-27',
  salary: eur(1500),
  allocations: { a: eur(700) },
  carryIn: {},
  unassigned: 0,
  quotas: { travel: eur(50), gifts: eur(25) },
  closedAt: null,
  leftoverChoice: null,
  leftovers: null,
  billsQuota: eur(79),
  ...over,
});

describe('R18 · il mese intero', () => {
  it('buste 700, Viaggi 50, Regali 25, Spese fisse 79 → Risparmi 646, 43%', () => {
    const plan = planOpening(eur(1500), [env('a', 700)], [q('travel', 50), q('gifts', 25)], eur(79));
    expect(splitOf(plan)).toEqual({ fixed: eur(79), payments: 0, pots: eur(75), envelopes: eur(700), savings: eur(646) });
    const m = monthSavings(basePeriod({ split: splitOf(plan) }), items);
    expect(m.saved).toBe(eur(646));
    expect(m.rate).toBe(43);
  });

  it('chiuso con l\'opzione A e avanzo 96 → risparmiato 742, 49%', () => {
    const p = basePeriod({ closedAt: 'x', leftoverChoice: 'toSavings', leftovers: { a: eur(96) }, closingSavings: eur(96) });
    expect(monthSavings(p, items)).toMatchObject({ saved: eur(742), rate: 49 });
  });

  it('affitto 582 e spese fisse 334,71: le buste si prendono tutto → Risparmi 0, 0%', () => {
    const plan = planOpening(eur(1500), [env('a', 508.29)], [q('rent', 582), q('travel', 50), q('gifts', 25)], eur(334.71));
    const split = splitOf(plan);
    expect(split).toEqual({ fixed: eur(334.71), payments: eur(582), pots: eur(75), envelopes: eur(508.29), savings: 0 });
    expect(monthSavings(basePeriod({ split }), items)).toMatchObject({ saved: 0, rate: 0 });
  });

  it('lo stesso mese chiuso con 30 € di sforo coperti da Risparmi → − 30, − 2%', () => {
    const plan = planOpening(eur(1500), [env('a', 508.29)], [q('rent', 582), q('travel', 50), q('gifts', 25)], eur(334.71));
    const p = basePeriod({ split: splitOf(plan), closedAt: 'x', leftoverChoice: 'deficit', leftovers: { a: eur(-30) } });
    expect(monthSavings(p, items)).toMatchObject({ saved: eur(-30), rate: -2 });
  });

  it('periodo creato prima di M10: la divisione si ricostruisce, una voce sparita conta come pagamento', () => {
    const p = basePeriod({ quotas: { travel: eur(50), gifts: eur(25), old: eur(100) } });
    expect(periodSplit(p, items)).toEqual({ fixed: eur(79), payments: eur(100), pots: eur(75), envelopes: eur(700), savings: eur(546) });
  });

  it('chiusura senza closingSavings: si ricostruisce dalla scelta e dagli avanzi', () => {
    const closed = { closedAt: 'x', leftovers: { a: eur(90), b: eur(6) }, unassigned: 0 };
    expect(closingSavingsOf({ ...closed, leftoverChoice: 'toSavings' })).toBe(eur(96));
    expect(closingSavingsOf({ ...closed, leftoverChoice: 'half', unassigned: 1 })).toBe(4800);
    expect(closingSavingsOf({ ...closed, leftoverChoice: 'carryOver' })).toBe(0);
    expect(closingSavingsOf({ closedAt: 'x', leftovers: { a: eur(-30) }, unassigned: 0, leftoverChoice: 'deficit' })).toBe(eur(-30));
    expect(closingSavingsOf({ closedAt: null, leftovers: null, unassigned: 0, leftoverChoice: null })).toBeNull();
  });

  it('demo: Ottobre chiuso con l\'opzione A → Risparmi 646 + avanzo 96', () => {
    const data = buildDemoData();
    const oct = data.periods.find((p) => p.id === '2026-10')!;
    const m = monthSavings(oct, data.settings.monthlyItems);
    expect(m.split.savings).toBe(eur(1500 - 700 - 75));
    expect(m.saved).toBe(eur(1500 - 700 - 75 + 96));
  });

  it('buildNewPeriod salva divisione, altri conti, obiettivo e proposito', () => {
    const { period } = buildNewPeriod({
      target: calendarPeriodById('2026-12', 27),
      today: '2026-11-27',
      salary: eur(1500),
      envelopes: [env('a', 700)],
      items: [q('travel', 50), q('gifts', 25)],
      billsQuota: eur(79),
      otherAccounts: eur(10),
      savingsGoal: eur(300),
      intention: 'Massimo 2 aperitivi a settimana',
      closing: null,
    });
    expect(period.split).toEqual({ fixed: eur(89), payments: 0, pots: eur(75), envelopes: eur(700), savings: eur(636) });
    expect(period.otherAccounts).toBe(eur(10));
    expect(period.savingsGoal).toBe(eur(300));
    expect(period.intention).toBe('Massimo 2 aperitivi a settimana');
  });
});

describe('R19 · cerca nei movimenti', () => {
  const tx = (id: string, periodId: string, note: string, amount: number, type: Transaction['type'] = 'expense', envelopeId: string | null = 'vita') =>
    ({ id, periodId, note, amount: eur(amount), type, envelopeId, personId: null, billId: null });
  const txs = [
    tx('1', '2026-08', 'Glovo', 18),
    tx('2', '2026-09', 'Glovo', 22),
    tx('3', '2026-09', 'glovo sushi', 31),
    tx('4', '2026-10', 'GLOVO', 25),
    tx('5', '2026-10', 'Glovo', 4, 'refund'),
    tx('6', '2026-11', 'Glovo', 50),
    tx('7', '2026-11', 'Caffe della settimana', 25),
    tx('8', '2026-11', 'Conad', 24, 'expense', 'spesa'),
  ];
  const lookups = {
    envelopes: [{ id: 'vita', name: 'Vita', shortName: 'Vita' }, { id: 'spesa', name: 'Spesa alimentare', shortName: 'Spesa' }],
    people: [],
    bills: [],
  };

  it('"glovo" → 6 movimenti · € 142 · in 4 mesi', () => {
    const found = searchMovements(txs, 'glovo', lookups)!;
    expect(found.map((t) => t.id)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(searchSummary(found)).toEqual({ count: 6, total: eur(142), months: 4 });
  });

  it('"glovo sushi" → 1 movimento, € 31; ogni parola deve esserci, in qualsiasi ordine', () => {
    const found = searchMovements(txs, '  Sushi   GLOVO ', lookups)!;
    expect(found.map((t) => t.id)).toEqual(['3']);
    expect(searchSummary(found).total).toBe(eur(31));
  });

  it('"caffè" trova "Caffe della settimana" (senza accenti)', () => {
    expect(normalizeText('Caffè  DELLA')).toBe('caffe della');
    expect(searchMovements(txs, 'caffè', lookups)!.map((t) => t.id)).toEqual(['7']);
  });

  it('cerca anche nel nome della busta; sotto i 2 caratteri non cerca', () => {
    expect(searchMovements(txs, 'alimentare', lookups)!.map((t) => t.id)).toEqual(['8']);
    expect(searchTerms('g')).toBeNull();
    expect(searchMovements(txs, ' g ', lookups)).toBeNull();
  });

  it('prestiti ed entrate si vedono ma non contano nel totale', () => {
    const s = searchSummary([
      { type: 'expense', amount: 1000, periodId: '2026-11' },
      { type: 'loan', amount: 5000, periodId: '2026-10' },
      { type: 'income', amount: 112, periodId: '2026-09' },
    ]);
    expect(s).toEqual({ count: 3, total: 1000, months: 1 });
  });
});

describe('R20 · il ritmo', () => {
  it('19 nov, fine 26 nov: 8 giorni, puoi ancora spendere 231 → oggi € 28,87', () => {
    expect(todayAllowance({ spendable: eur(231), spentToday: 0, today: '2026-11-19', calendarEnd: '2026-11-26' }))
      .toEqual({ daysLeft: 8, quota: 2887, spentToday: 0, left: 2887, nothing: false });
  });

  it('spendi 20 oggi: la quota resta € 28,87, restano € 8,87', () => {
    const a = todayAllowance({ spendable: eur(211), spentToday: eur(20), today: '2026-11-19', calendarEnd: '2026-11-26' });
    expect(a.quota).toBe(2887);
    expect(a.left).toBe(887);
  });

  it('oltre la quota: resta negativo; "Puoi ancora spendere" ≤ 0 → niente; dopo la fine 1 giorno', () => {
    expect(todayAllowance({ spendable: eur(100), spentToday: eur(40), today: '2026-11-26', calendarEnd: '2026-11-26' })).toMatchObject({ quota: eur(140), left: eur(100) });
    expect(todayAllowance({ spendable: eur(10), spentToday: eur(40), today: '2026-11-25', calendarEnd: '2026-11-26' }).left).toBe(eur(-15));
    expect(todayAllowance({ spendable: eur(-8), spentToday: 0, today: '2026-11-19', calendarEnd: '2026-11-26' })).toMatchObject({ quota: 0, nothing: true });
    expect(todayAllowance({ spendable: eur(30), spentToday: 0, today: '2026-11-28', calendarEnd: '2026-11-26' })).toMatchObject({ daysLeft: 1, quota: eur(30) });
  });

  const novTxs = buildDemoData().transactions.filter((t) => t.periodId === '2026-11');

  it('settimana: mercoledì 18 nov → € 42; la scorsa (lun 9 – mer 11) € 38', () => {
    expect(mondayOf('2026-11-18')).toBe('2026-11-16');
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
    expect(weekSpending(novTxs, '2026-11-18')).toEqual({ thisWeek: eur(42), lastWeek: eur(38) });
  });

  it('speso oggi conta solo le buste scelte (le da spendere)', () => {
    expect(spentBetween(novTxs, '2026-11-15', '2026-11-15')).toBe(eur(51));
    expect(spentBetween(novTxs, '2026-11-15', '2026-11-15', new Set([ENV.trasporti]))).toBe(eur(46));
  });

  it('quando spendi: per giorno della settimana, lunedì → domenica', () => {
    const w = weekdaySpending(novTxs);
    expect(w.total).toBe(eur(448.5));
    expect(w.days.reduce((s, v) => s + v, 0)).toBe(w.total);
    // giovedì 5, 12, 19: Caffè 25, Spotify 8,50, Cena 42, Disney+ 6, Pranzo 22, Conad 24
    expect(w.days[3]).toBe(eur(127.5));
    // domenica 1, 8, 15: Rata iPhone 70, Carrefour 34, Prime 5, Treno 46 → il giorno più caro
    expect(w.days[6]).toBe(eur(155));
    expect(w.top).toBe(6);
    expect(w.activeDays).toBe(12); // il 17 c'è solo l'entrata
  });
});

describe('R21 · prima i risparmi', () => {
  const available = availableForEnvelopes(eur(1500), [q('travel', 50), q('gifts', 25)], eur(79));

  it('obiettivo 300 → restano per le buste € 1.046; buste 700 → Risparmi 646, nessun avviso', () => {
    expect(available).toBe(eur(1346));
    expect(savingsGoalCheck(available, eur(300), eur(700))).toEqual({ forEnvelopes: eur(1046), savings: eur(646), eroded: 0 });
  });

  it('buste 1.100 → Risparmi 246, le buste si mangiano € 54', () => {
    expect(savingsGoalCheck(available, eur(300), eur(1100))).toEqual({ forEnvelopes: eur(1046), savings: eur(246), eroded: eur(54) });
  });

  it('senza obiettivo tutto come prima; Risparmi negativo → niente "eroso" (vale l\'avviso arancione)', () => {
    expect(savingsGoalCheck(available, 0, eur(700))).toEqual({ forEnvelopes: available, savings: eur(646), eroded: 0 });
    expect(savingsGoalCheck(available, eur(300), eur(1400)).eroded).toBe(0);
  });

  it('obiettivo raggiunto se la parte di inizio mese lo copre', () => {
    const split = { fixed: eur(79), payments: 0, pots: eur(75), envelopes: eur(700), savings: eur(646) };
    expect(monthSavings(basePeriod({ split, savingsGoal: eur(300) }), items).goalReached).toBe(true);
    expect(monthSavings(basePeriod({ split: { ...split, savings: eur(246) }, savingsGoal: eur(300) }), items).goalReached).toBe(false);
    expect(monthSavings(basePeriod({ split }), items)).toMatchObject({ goal: 0, goalReached: false });
  });
});

describe('R22 · spese d\'impulso', () => {
  it('Novembre: Zalando 45, Aperitivo 24, Cena fuori 42 → € 111, 25%, soprattutto Vita € 66', () => {
    const data = buildDemoData();
    const nov = data.periods.find((p) => p.id === '2026-11')!;
    const txs = data.transactions.filter((t) => t.periodId === '2026-11');
    const spent = historyForCurrent(nov, summarizePeriod(data.envelopes, nov, txs).balances).spent;
    expect(spent).toBe(eur(448.5));
    const marked = txs.map((t) => (['Zalando', 'Aperitivo', 'Cena fuori'].includes(t.note) ? { ...t, impulse: true } : { ...t, impulse: false }));
    expect(impulseSummary(marked, spent)).toEqual({ total: eur(111), share: 25, top: { envelopeId: ENV.vita, amount: eur(66) } });
  });

  it('nessuna spesa segnata → niente riga; rimborsi e spese senza busta non contano', () => {
    expect(impulseSummary([{ type: 'expense', amount: 100, envelopeId: 'a' }], 100)).toBeNull();
    expect(impulseSummary([
      { type: 'refund', amount: 100, envelopeId: 'a', impulse: true },
      { type: 'expense', amount: 100, envelopeId: null, impulse: true },
    ], 100)).toBeNull();
  });
});

describe('R23 · spese fisse in un anno', () => {
  const rec = (id: string, name: string, amount: number, frequency: Recurring['frequency'] = 1, active = true): Recurring => ({
    id, name, amount: eur(amount), dayOfMonth: 1, frequency, envelopeId: 'rate', card: 'extra', active, createdAt: '2026-01-01T00:00:00.000Z',
    ...(frequency !== 1 ? { anchorMonth: '2027-03' } : {}),
  });
  const bill = (id: string, frequency: Bill['frequency'], estimate: number, split: Bill['split']): Bill => ({
    id, name: id, frequency, estimate: eur(estimate), split, payer: 'me', personId: null, fund: 0, active: true, order: 1, createdAt: '',
  });
  const subs = [
    rec('iphone', 'Rata iPhone', 70), rec('spotify', 'Spotify', 8.5), rec('disney', 'Disney+', 6), rec('prime', 'Prime', 5), rec('icloud', 'iCloud', 1),
    rec('dominio', 'Dominio', 12, 12), rec('palestra', 'Palestra', 30, 2), rec('pausa', 'In pausa', 99, 1, false),
  ];
  const bills = [bill('luce', 1, 80, 'half'), bill('internet', 1, 28, 'half'), bill('gas', 2, 60, 'half'), bill('acqua', 12, 120, 'mine')];

  it('abbonamenti € 1.278, bollette € 948, totale € 2.226; dal più caro all\'anno', () => {
    const a = annualCost(subs, bills);
    expect(a).toMatchObject({ subscriptions: eur(1278), bills: eur(948), total: eur(2226) });
    expect(a.list.map((x) => [x.recurring.name, x.yearly])).toEqual([
      ['Rata iPhone', eur(840)], ['Palestra', eur(180)], ['Spotify', eur(102)], ['Disney+', eur(72)], ['Prime', eur(60)],
      ['Dominio', eur(12)], ['iCloud', eur(12)],
    ]);
  });

  it('controllo ogni 6 mesi: 20 mag → sì (183 giorni), 21 mag → no; mai fatto → sì; senza abbonamenti attivi → no', () => {
    expect(reviewDue(subs, '2026-05-20', DEMO_TODAY)).toBe(true);
    expect(reviewDue(subs, '2026-05-21', DEMO_TODAY)).toBe(false);
    expect(reviewDue(subs, null, DEMO_TODAY)).toBe(true);
    expect(reviewDue([{ active: false }], null, DEMO_TODAY)).toBe(false);
  });
});

describe('R24 · un proposito al mese', () => {
  it('senza spazi ai lati, massimo 140 caratteri, vuoto = niente', () => {
    expect(cleanIntention('  Massimo 2 aperitivi a settimana  ')).toBe('Massimo 2 aperitivi a settimana');
    expect(cleanIntention('   ')).toBeNull();
    expect(cleanIntention(undefined)).toBeNull();
    expect(cleanIntention('x'.repeat(200))).toHaveLength(140);
  });
});

describe('R25 · tetto: alzare o tenere', () => {
  const t = (id: string, periodId: string, date: string, amount: number, envelopeId = 'spesa', type: Transaction['type'] = 'expense') =>
    ({ id, periodId, date, amount: eur(amount), envelopeId, type, createdAt: `${date}T10:00:00.000Z` });

  it('le 3 spese più grandi negli ultimi 3 periodi: 40, 34, 31', () => {
    const txs = [
      t('a', '2026-09', '2026-09-01', 24), t('b', '2026-10', '2026-10-02', 34), t('c', '2026-10', '2026-10-05', 31),
      t('d', '2026-11', '2026-11-01', 12), t('e', '2026-11', '2026-11-03', 40), t('f', '2026-11', '2026-11-04', 9),
      t('old', '2026-08', '2026-08-01', 99), t('vita', '2026-11', '2026-11-01', 80, 'vita'), t('rimb', '2026-11', '2026-11-01', 70, 'spesa', 'refund'),
    ];
    expect(biggestExpenses(txs, 'spesa', ['2026-11', '2026-10', '2026-09']).map((x) => x.id)).toEqual(['e', 'b', 'c']);
  });

  it('a parità di importo, la più recente', () => {
    const txs = [t('vecchia', '2026-11', '2026-11-01', 30), t('nuova', '2026-11', '2026-11-09', 30)];
    expect(biggestExpenses(txs, 'spesa', ['2026-11'], 1).map((x) => x.id)).toEqual(['nuova']);
  });

  it('ultimi periodi chiusi; dopo "Tieni" il suggerimento torna solo con una chiusura nuova', () => {
    const periods = [{ id: '2026-09', closedAt: 'x' }, { id: '2026-11', closedAt: null }, { id: '2026-10', closedAt: 'x' }, { id: '2026-08', closedAt: 'x' }];
    expect(recentClosedIds(periods, 3)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(capKeptHides({ spesa: '2026-10' }, 'spesa', '2026-10')).toBe(true);
    expect(capKeptHides({ spesa: '2026-10' }, 'spesa', '2026-11')).toBe(false);
    expect(capKeptHides({ spesa: '2026-10' }, 'vita', '2026-10')).toBe(false);
    expect(capKeptHides(undefined, 'spesa', '2026-10')).toBe(false);
  });
});
