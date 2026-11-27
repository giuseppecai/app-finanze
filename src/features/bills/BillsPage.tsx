import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, useLoans, usePeople, usePeriods, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { BottomSheet } from '../../components/BottomSheet';
import { IconChevronRight, IconPlus, IconReceipt } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { SymbolIcon, Tile } from '../../components/Symbol';
import { db } from '../../db/database';
import { markFixedReviewed } from '../../db/repositories';
import { annualCost, monthlyFixedCost, reviewDue } from '../../domain/insights';
import { TopBar } from '../../components/TopBar';
import { PageHeader } from '../../components/PageHeader';
import { ScheduleRow } from '../../components/ScheduleRow';
import { billsToRegister, expectedShare, fundStatus, isPeriodic, isSaving, monthlyQuota } from '../../domain/bills';
import { today } from '../../domain/clock';
import { formatShortDate, formatShortRange, monthsBetween, parseISODate } from '../../domain/dates';
import { calendarPeriodFor, nextOpeningId } from '../../domain/periods';
import { balanceWith } from '../../domain/loans';
import { formatEuro } from '../../domain/money';
import {
  frequencyOf, mainRecurringEnvelope, nextUpcomingCharge, recurringQuota, recurringRows,
  type RecurringRow, type RecurringStatus,
} from '../../domain/recurring';
import type { Bill, MonthlyItem, Person, Recurring, Transaction } from '../../domain/types';
import { symbolFor } from '../../domain/symbols';
import { it } from '../../i18n/it';
import { RecurringSheet } from '../recurring/RecurringSheet';
import { MonthlyItemSheet } from '../settings/MonthlyItemSheet';
import { BillSheet } from './BillSheet';

/**
 * Spese fisse (R16): abbonamenti e bollette in un solo elenco, tutti pagati dalla Pocket Spese fisse
 * con un solo giroconto a inizio mese. Tag: Abbonamento (si scala da solo) o Bolletta (la registri tu).
 */
export function BillsPage() {
  const bills = useBills();
  const recurring = useRecurring();
  const envelopes = useEnvelopes();
  const people = usePeople();
  const loans = useLoans();
  const pots = usePots();
  const period = useCurrentPeriod();
  const txs = usePeriodTransactions(period?.id ?? null);
  const periods = usePeriods();
  const settings = useSettings();
  const [bill, setBill] = useState<Bill | 'new' | null>(null);
  const [sub, setSub] = useState<Recurring | 'new' | null>(null);
  const [choosing, setChoosing] = useState(false);
  /** pagamento (affitto…) da creare o modificare */
  const [pay, setPay] = useState<MonthlyItem | 'new' | null>(null);
  if (!bills || !recurring || !envelopes || !people || !loans || !pots || period === undefined || !txs || !periods || !settings) return null;

  const now = today();
  const startDay = settings.periodStartDay;
  const pot = pots.find((p) => p.id === 'bills')?.balance ?? 0;
  const opening = nextOpeningId(periods, now, startDay);
  const toRegister = billsToRegister(bills, txs).length;
  // Pagamenti come l'affitto: spese fisse anche loro, ma escono dallo stipendio (non dalla Pocket).
  const payments = settings.monthlyItems.filter((i) => i.kind === 'payment');
  // Il costo di un mese normale (come "circa € X al mese" in Imposta), non il giroconto: non dipende
  // da quello che è già nella Pocket, altrimenti a metà mese le mensili già accantonate sparirebbero.
  const cost = monthlyFixedCost(recurring, bills, settings.monthlyItems);
  const yearly = annualCost(recurring, bills, settings.monthlyItems);
  const range = period ?? calendarPeriodFor(now, startDay);
  const current = range.id;
  const rows = recurringRows(recurring, range, period ? txs : [], now);
  const next = period ? nextUpcomingCharge(rows) : null;
  const names = new Map(people.map((p) => [p.id, p]));
  const roommates = [...new Set(bills.map((b) => b.personId).filter((id): id is string => !!id))];
  const defaultEnvelope = mainRecurringEnvelope(recurring) ?? envelopes.find((e) => !e.archived)?.id ?? '';

  // Questo mese: abbonamenti con addebito nel periodo, bollette mensili e periodiche attese ora (o in ritardo).
  const billNow = (b: Bill) => !isPeriodic(b) || (!!b.nextDue && b.nextDue <= current);
  const byActive = <T extends { active: boolean }>(a: T, b: T) => (a.active ? 0 : 1) - (b.active ? 0 : 1);
  const items: Item[] = [
    ...rows.map((row): Item => ({ kind: 'sub', row })),
    ...bills.map((b): Item => ({ kind: 'bill', bill: b })),
    ...payments.map((p): Item => ({ kind: 'pay', item: p })),
  ];
  const isNow = (i: Item) => (i.kind === 'sub' ? i.row.date !== null : i.kind === 'pay' ? true : billNow(i.bill));
  const sortKey = (i: Item) =>
    i.kind === 'sub' ? i.row.shownDate : i.kind === 'pay' ? '0' : i.bill.nextDue && isPeriodic(i.bill) ? `${i.bill.nextDue}-99` : `${current}-99`;
  const sort = (a: Item, b: Item) =>
    byActive(active(a), active(b)) || sortKey(a).localeCompare(sortKey(b)) || nameOf(a).localeCompare(nameOf(b), 'it');
  const thisMonth = items.filter(isNow).sort(sort);
  const later = items.filter((i) => !isNow(i)).sort(sort);

  const ctx: RowContext = {
    names, txs, current, opening, startDay, period: !!period, now,
    accountName: (id) => settings.accounts?.find((a) => a.id === id)?.name ?? null,
  };
  const open = (i: Item) => (i.kind === 'sub' ? setSub(i.row.recurring) : i.kind === 'pay' ? setPay(i.item) : setBill(i.bill));

  return (
    <div className="flow">
      <TopBar right={<button type="button" className="pill-button" onClick={() => setChoosing(true)}><IconPlus size={20} />{it.common.add}</button>} />
      <PageHeader
        full
        title={it.casa.title}
        chip={toRegister > 0
          ? { icon: <IconReceipt />, text: it.casa.toRegisterChip(toRegister) }
          : next ? { icon: <IconReceipt />, text: it.fixed.nextCharge(next.recurring.name, statusLabel(next.status, now)) } : null}
        muted={it.casa.fromPocket}
      />

      {/* In grande quello che ti serve sapere: quanto costano al mese. Il saldo della Pocket (lo stesso di Home) è secondario. */}
      <section className="hero" aria-label={it.fixed.heroLabel}>
        <div className="hero__row">
          <div>
            <p className="hero__label">{it.fixed.heroLabel}</p>
            <p className="hero__amount hero__amount--medium">{formatEuro(cost.total)}</p>
          </div>
          <span className={pot < 0 ? 'hero__status is-over' : 'hero__status'}>{it.fixed.heroPot(formatEuro(pot))}</span>
        </div>
        <div className="hero-foot">
          <span>{cost.fromSalary > 0
            ? it.fixed.footSplitPayments(formatEuro(cost.fromPocket), formatEuro(cost.fromSalary))
            : it.fixed.footSplit(formatEuro(Math.round(yearly.subscriptions / 12)), formatEuro(Math.round(yearly.bills / 12)))}</span>
        </div>
      </section>

      {reviewDue(recurring, settings.fixedReviewedAt, now) ? (
        <div className="insight">
          <Tile symbol="lightbulb" />
          <div className="insight__body">
            <p className="insight__title">{it.insights.reviewTitle}</p>
            <p className="insight__text">{it.insights.reviewText(formatEuro(annualCost(recurring, bills).subscriptions))}</p>
            <button type="button" className="insight__action" onClick={() => void markFixedReviewed(db, now)}>{it.insights.reviewDone}</button>
          </div>
        </div>
      ) : null}

      {roommates.map((id) => {
        const name = names.get(id)?.name ?? it.movements.unknownPerson;
        const balance = balanceWith(loans, id);
        return (
          <Link key={id} to={`${routes.loans}?persona=${encodeURIComponent(id)}`} className="card link-row">
            <span className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
            <span className="link-row__text">
              <span className="link-row__title">{it.casa.withName(name)}</span>
              <span className="link-row__detail">
                {balance > 0 ? it.casa.owesYou(name, formatEuro(balance)) : balance < 0 ? it.casa.youOwe(name, formatEuro(-balance)) : it.casa.nothingPending}
              </span>
            </span>
            {balance === 0 ? <span className="chip chip--done">{it.casa.even}</span> : null}
            <IconChevronRight className="chev" />
          </Link>
        );
      })}

      {items.length === 0 ? <p className="card empty-card">{it.casa.empty}</p> : null}

      {thisMonth.length > 0 ? (
        <ItemList
          title={`${it.recurring.thisMonth} · ${formatShortRange(range.calendarStart, range.calendarEnd)}`}
          items={thisMonth} ctx={ctx} onOpen={open}
        />
      ) : null}
      {later.length > 0 ? <ItemList title={it.recurring.later} items={later} ctx={ctx} onOpen={open} /> : null}

      <YearCard recurring={recurring} bills={bills} items={settings.monthlyItems} onOpen={(r) => setSub(r)} />

      <div className="flow__spacer" />
      <InfoBox>{it.casa.note}</InfoBox>

      <BottomSheet open={choosing} onClose={() => setChoosing(false)} title={it.fixed.chooseTitle}>
        <div className="choose-kind">
          <button type="button" className="choose-kind__option" onClick={() => { setChoosing(false); setSub('new'); }}>
            <span className="choose-kind__title">{it.fixed.chooseSubscription}</span>
            <span className="choose-kind__hint">{it.fixed.chooseSubscriptionHint}</span>
          </button>
          <button type="button" className="choose-kind__option" onClick={() => { setChoosing(false); setBill('new'); }}>
            <span className="choose-kind__title">{it.fixed.chooseBill}</span>
            <span className="choose-kind__hint">{it.fixed.chooseBillHint}</span>
          </button>
          <button type="button" className="choose-kind__option" onClick={() => { setChoosing(false); setPay('new'); }}>
            <span className="choose-kind__title">{it.fixed.choosePayment}</span>
            <span className="choose-kind__hint">{it.fixed.choosePaymentHint}</span>
          </button>
        </div>
      </BottomSheet>

      <MonthlyItemSheet target={pay} kind="payment" onClose={() => setPay(null)} />
      <RecurringSheet target={sub} defaultEnvelopeId={defaultEnvelope} opening={opening} periodStartDay={startDay} onClose={() => setSub(null)} />
      <BillSheet
        target={bill}
        people={people}
        loans={loans}
        hasPeriod={!!period}
        defaultPersonId={roommates[0] ?? null}
        opening={opening}
        onClose={() => setBill(null)}
      />
    </div>
  );
}

/** R23 · Quanto costano in un anno: totale e abbonamenti dal più caro (quelli che si possono togliere). */
function YearCard({ recurring, bills, items, onOpen }: { recurring: Recurring[]; bills: Bill[]; items: MonthlyItem[]; onOpen: (r: Recurring) => void }) {
  const a = annualCost(recurring, bills, items);
  if (a.total === 0) return null;
  const max = a.list[0]?.yearly ?? 0;
  return (
    <section className="recurring-list-section" aria-labelledby="year-title">
      <h2 id="year-title" className="group-label">{it.insights.yearTitle}</h2>
      <div className="card year-card">
        <div className="year-card__head">
          <span className="year-card__total">{formatEuro(a.total)}</span>
          <span className="year-card__split">{it.insights.yearText(formatEuro(a.subscriptions), formatEuro(a.bills), a.payments > 0 ? formatEuro(a.payments) : null)}</span>
        </div>
        {a.list.length > 0 ? (
          <ul className="year-list">
            {a.list.map(({ recurring: r, yearly }) => (
              <li key={r.id}>
                <button type="button" className="year-list__row" onClick={() => onOpen(r)} aria-label={`${r.name}: ${it.insights.yearItem(formatEuro(yearly))}`}>
                  <span className="year-list__body">
                    <span className="year-list__top">
                      <span className="year-list__name">{r.name}</span>
                      <span className="year-list__amount">{formatEuro(yearly)}</span>
                    </span>
                    <span className="year-list__bar" aria-hidden="true"><i style={{ width: `${max > 0 ? (yearly / max) * 100 : 0}%` }} /></span>
                  </span>
                  <IconChevronRight className="chev" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

type Item = { kind: 'sub'; row: RecurringRow } | { kind: 'bill'; bill: Bill } | { kind: 'pay'; item: MonthlyItem };

const active = (i: Item) => (i.kind === 'sub' ? i.row.recurring : i.kind === 'pay' ? { active: !i.item.archived } : i.bill);
const nameOf = (i: Item) => (i.kind === 'sub' ? i.row.recurring.name : i.kind === 'pay' ? i.item.name : i.bill.name);

type RowContext = {
  names: Map<string, Person>;
  txs: Transaction[];
  /** periodo in corso ('YYYY-MM') */
  current: string;
  /** periodo del prossimo giroconto */
  opening: string;
  startDay: number;
  /** c'è un mese aperto (altrimenti niente stati "scalato" / "da registrare") */
  period: boolean;
  now: string;
  /** nome di un altro conto (Isybank…) */
  accountName: (id: string) => string | null;
};

function statusLabel(status: RecurringStatus, now: string): string {
  switch (status.kind) {
    case 'charged':
      return it.recurring.status.charged;
    case 'paused':
      return it.recurring.status.paused;
    case 'none':
      return it.recurring.status.none;
    case 'later':
      return it.recurring.status.later(monthsBetween(now.slice(0, 7), status.date.slice(0, 7)));
    case 'upcoming':
      return status.inDays <= 0 ? it.recurring.status.today : status.inDays === 1 ? it.recurring.status.tomorrow : it.recurring.status.inDays(status.inDays);
  }
}

/** "febbraio" (o "febbraio 2028" se non è entro un anno) */
function dueMonth(id: string, opening: string): string {
  const [y, m] = id.split('-');
  const name = it.months.long[Number(m) - 1] ?? id;
  return monthsBetween(opening, id) >= 12 ? `${name} ${y}` : name;
}

function ItemList({ title, items, ctx, onOpen }: { title: string; items: Item[]; ctx: RowContext; onOpen: (i: Item) => void }) {
  return (
    <section className="recurring-list-section">
      <h2 className="group-label">{title}</h2>
      <ul className="card movement-list">
        {items.map((i) => (
          <li key={`${i.kind}-${i.kind === 'sub' ? i.row.recurring.id : i.kind === 'pay' ? i.item.id : i.bill.id}`}>
            {i.kind === 'sub' ? <SubRow row={i.row} ctx={ctx} onOpen={() => onOpen(i)} />
              : i.kind === 'pay' ? <PaymentRow item={i.item} ctx={ctx} onOpen={() => onOpen(i)} />
              : <BillRow bill={i.bill} ctx={ctx} onOpen={() => onOpen(i)} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Seconda riga dei non mensili, corta: "ogni anno · € 3,16 al mese" (accantonato) o "ogni anno · tutto nel mese". */
function savingLine(frequency: number, saving: boolean, quota: number): string {
  return `${it.recurring.frequency[frequency] ?? ''} · ${saving ? it.fixed.perMonth(formatEuro(quota)) : it.saving.lumpRow}`;
}

function SubRow({ row, ctx, onOpen }: { row: RecurringRow; ctx: RowContext; onOpen: () => void }) {
  const { recurring: r, shownDate, status } = row;
  const { d, m } = parseISODate(shownDate);
  const freq = frequencyOf(r);
  const from = r.saveFrom && r.saveFrom > ctx.opening ? r.saveFrom : ctx.opening;
  const showChip = ctx.period || status.kind === 'paused' || status.kind === 'later';
  return (
    <ScheduleRow
      boxTop={String(d)}
      boxBottom={it.months.short[m - 1]}
      title={r.name}
      detail={r.payFrom && ctx.accountName(r.payFrom) ? `${it.fixed.tagSubscription} · ${it.opening.fromAccount(ctx.accountName(r.payFrom)!)}` : it.fixed.tagSubscription}
      detail2={freq > 1 && r.active ? savingLine(freq, r.saving === true, recurringQuota(r, from, ctx.startDay)) : null}
      amount={formatEuro(r.amount)}
      paused={!r.active}
      chip={showChip ? <span className={`chip chip--${status.kind}`}>{statusLabel(status, ctx.now)}</span> : null}
      ariaLabel={it.recurring.editLabel(r.name)}
      onClick={onOpen}
    />
  );
}

/** Pagamento come l'affitto: ogni mese, dallo stipendio (o da un altro conto). */
function PaymentRow({ item, ctx, onOpen }: { item: MonthlyItem; ctx: RowContext; onOpen: () => void }) {
  return (
    <ScheduleRow
      boxTop={<SymbolIcon id={symbolFor(item)} size={20} />}
      title={item.name}
      detail={it.fixed.paymentDetail(item.payFrom ? ctx.accountName(item.payFrom) : null)}
      amount={formatEuro(item.amount)}
      paused={item.archived}
      chip={item.archived ? <span className="chip chip--paused">{it.fixed.paused}</span> : null}
      ariaLabel={it.opening.editItem(item.name)}
      onClick={onOpen}
    />
  );
}

function BillRow({ bill: b, ctx, onOpen }: { bill: Bill; ctx: RowContext; onOpen: () => void }) {
  const name = b.personId ? ctx.names.get(b.personId)?.name ?? it.movements.unknownPerson : '';
  const periodic = isPeriodic(b);
  const split = b.split === 'half' ? (b.payer === 'me' ? it.fixed.halfYouPay : it.fixed.halfTheyPay(name)) : it.casa.splitMine;
  const paid = ctx.txs.filter((t) => t.billId === b.id && t.type === 'expense').sort((x, y) => (x.date < y.date ? 1 : -1))[0];
  const late = periodic && b.nextDue ? b.nextDue < ctx.current : false;
  const from = b.saveFrom && b.saveFrom > ctx.opening ? b.saveFrom : ctx.opening;
  // Riquadro: il mese in cui arriva (mensili: questo mese; senza data: trattino)
  const month = periodic ? b.nextDue ?? null : ctx.current;
  const [y, m] = month ? month.split('-') : [null, null];
  const chip = !b.active ? (
    <span className="chip chip--paused">{it.casa.paused}</span>
  ) : !periodic ? (
    !ctx.period ? null : paid
      ? <span className="chip chip--done">{it.casa.registeredOn(formatShortDate(paid.date))}</span>
      : <span className="chip chip--upcoming">{it.casa.toRegister}</span>
  ) : b.nextDue ? (
    late
      ? <span className="chip chip--upcoming">{it.casa.dueLateChip}</span>
      : b.nextDue === ctx.current
        ? <span className="chip chip--upcoming">{it.casa.toRegister}</span>
        : <span className="chip chip--later">{it.casa.dueChip(dueMonth(b.nextDue, ctx.opening))}</span>
  ) : null;
  const fund = fundStatus(b);
  return (
    <ScheduleRow
      boxTop={m ? it.months.short[Number(m) - 1] ?? '' : <IconReceipt size={20} aria-label={it.fixed.noDate} />}
      boxBottom={y && y !== ctx.current.slice(0, 4) ? y : null}
      title={b.name}
      detail={`${it.fixed.tagBill} · ${split}`}
      detail2={periodic ? (
        <span className={isSaving(b) && fund.missing > 0 ? 'is-over' : undefined}>
          {isSaving(b) && fund.missing > 0
            ? `${it.recurring.frequency[b.frequency] ?? ''} · ${it.casa.fundMissingShort(formatEuro(fund.missing))}`
            : savingLine(b.frequency, isSaving(b), monthlyQuota(b, from))}
        </span>
      ) : null}
      amount={formatEuro(expectedShare(b))}
      paused={!b.active}
      chip={chip}
      onClick={onOpen}
    />
  );
}
