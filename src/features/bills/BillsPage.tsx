import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBills, useCurrentPeriod, useLoans, usePeople, usePeriods, usePeriodTransactions, usePots, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { IconChevronRight, IconPlus, IconReceipt } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { TopBar } from '../../components/TopBar';
import { PageHeader } from '../../components/PageHeader';
import { billsQuotaTotal, billsToRegister, fundStatus, isPeriodic, monthlyQuota } from '../../domain/bills';
import { today } from '../../domain/clock';
import { formatShortDate, formatShortRange, monthsBetween } from '../../domain/dates';
import { nextOpeningId } from '../../domain/periods';
import { balanceWith } from '../../domain/loans';
import { formatEuro } from '../../domain/money';
import type { Bill, Person, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';
import { ScheduleRow } from '../../components/ScheduleRow';
import { BillSheet } from './BillSheet';

/**
 * Bollette (R13): tutte, mensili comprese, si accantonano nella Pocket Bollette con un giroconto
 * a inizio mese e si pagano da lì. Si apre da "Messi da parte" in Home e da Imposta.
 */
export function BillsPage() {
  const bills = useBills();
  const people = usePeople();
  const loans = useLoans();
  const pots = usePots();
  const period = useCurrentPeriod();
  const txs = usePeriodTransactions(period?.id ?? null);
  const periods = usePeriods();
  const settings = useSettings();
  const [target, setTarget] = useState<Bill | 'new' | null>(null);
  if (!bills || !people || !loans || !pots || period === undefined || !txs || !periods || !settings) return null;

  const billsPot = pots.find((p) => p.id === 'bills')?.balance ?? 0;
  const opening = nextOpeningId(periods, today(), settings.periodStartDay);
  const quota = billsQuotaTotal(bills, opening);
  const toRegister = billsToRegister(bills, txs).length;
  // Stessa divisione di Abbonamenti: quelle di questo mese (mensili + periodiche in arrivo o in ritardo) e quelle più avanti.
  const current = period?.id ?? opening;
  const dueNow = (b: Bill) => !isPeriodic(b) || (!!b.nextDue && b.nextDue <= current);
  const byDue = (a: Bill, b: Bill) =>
    (a.active ? 0 : 1) - (b.active ? 0 : 1) || (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999') || a.order - b.order;
  const thisMonth = bills.filter(dueNow).sort((a, b) => (a.active ? 0 : 1) - (b.active ? 0 : 1) || a.order - b.order);
  const later = bills.filter((b) => !dueNow(b)).sort(byDue);
  const active = bills.filter((b) => b.active);
  const fundTotal = active.reduce((s, b) => s + fundStatus(b).fund, 0);
  const targetTotal = active.reduce((s, b) => s + fundStatus(b).target, 0);
  const missingTotal = active.reduce((s, b) => s + fundStatus(b).missing, 0);
  const barPct = targetTotal > 0 ? Math.max(0, Math.min(100, (fundTotal / targetTotal) * 100)) : 0;
  const names = new Map(people.map((p) => [p.id, p]));
  const roommates = [...new Set(bills.map((b) => b.personId).filter((id): id is string => !!id))];

  return (
    <div className="flow">
      <TopBar right={<button type="button" className="pill-button" onClick={() => setTarget('new')}><IconPlus size={20} />{it.common.add}</button>} />
      <PageHeader
        full
        title={it.casa.title}
        chip={toRegister > 0 ? { icon: <IconReceipt />, text: it.casa.toRegisterChip(toRegister) } : null}
        muted={it.casa.fromPocket}
      />

      <section className="hero" aria-label={it.casa.potLabel}>
        <div className="hero__row">
          <div>
            <p className="hero__label">{it.casa.potLabel}</p>
            <p className={billsPot < 0 ? 'hero__amount hero__amount--medium is-over' : 'hero__amount hero__amount--medium'}>{formatEuro(billsPot)}</p>
          </div>
          <span className="hero__status">{quota > 0 ? it.casa.perMonthAside(formatEuro(quota)) : it.casa.noQuotaShort}</span>
        </div>
        {targetTotal > 0 ? (
          <>
            <span className="hero__bar" aria-hidden="true">
              <span className={missingTotal > 0 ? 'hero__bar-fill is-over' : 'hero__bar-fill'} style={{ width: `${missingTotal > 0 ? 100 : barPct}%` }} />
            </span>
            <div className="hero-foot">
              <span>{missingTotal > 0 ? it.casa.fundMissing(formatEuro(missingTotal)) : it.casa.fundOf(formatEuro(fundTotal), formatEuro(targetTotal))}</span>
            </div>
          </>
        ) : null}
      </section>

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

      {bills.length === 0 ? <p className="card empty-card">{it.casa.empty}</p> : null}

      {thisMonth.length > 0 ? (
        <BillList
          title={period ? `${it.recurring.thisMonth} · ${formatShortRange(period.calendarStart, period.calendarEnd)}` : it.recurring.thisMonth}
          bills={thisMonth} names={names} txs={txs} current={current} opening={opening} onOpen={setTarget}
        />
      ) : null}
      {later.length > 0 ? (
        <BillList title={it.recurring.later} bills={later} names={names} txs={txs} current={current} opening={opening} onOpen={setTarget} />
      ) : null}

      <div className="flow__spacer" />
      <InfoBox>{it.casa.note}</InfoBox>

      <BillSheet
        target={target}
        people={people}
        loans={loans}
        hasPeriod={!!period}
        defaultPersonId={roommates[0] ?? null}
        opening={opening}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

type ListProps = {
  title: string;
  bills: Bill[];
  names: Map<string, Person>;
  txs: Transaction[];
  /** periodo in corso ('YYYY-MM') */
  current: string;
  /** periodo del prossimo giroconto */
  opening: string;
  onOpen: (bill: Bill) => void;
};

/** "febbraio" (o "febbraio 2028" se non è entro un anno) */
function dueMonth(id: string, opening: string): string {
  const [y, m] = id.split('-');
  const name = it.months.long[Number(m) - 1] ?? id;
  return monthsBetween(opening, id) >= 12 ? `${name} ${y}` : name;
}

function BillList({ title, bills, names, txs, current, opening, onOpen }: ListProps) {
  const currentYear = current.slice(0, 4);
  return (
    <section className="recurring-list-section">
      <h2 className="group-label">{title}</h2>
      <ul className="card movement-list">
        {bills.map((b) => {
          const name = b.personId ? names.get(b.personId)?.name ?? it.movements.unknownPerson : '';
          const periodic = isPeriodic(b);
          const detail = b.split === 'half'
            ? [it.casa.splitHalfShort.toLowerCase(), b.payer === 'me' ? it.casa.payerMe : it.casa.payerRoommate(name)].join(' · ')
            : it.casa.splitMine;
          const paid = txs.filter((t) => t.billId === b.id && t.type === 'expense').sort((x, y) => (x.date < y.date ? 1 : -1))[0];
          const late = periodic && b.nextDue ? b.nextDue < current : false;
          const quota = monthlyQuota(b, opening);
          const fund = fundStatus(b);
          // Riquadro: il mese in cui arriva (mensili: questo mese; senza data: trattino)
          const month = periodic ? b.nextDue ?? null : current;
          const [y, m] = month ? month.split('-') : [null, null];
          const chip = !b.active ? (
            <span className="chip chip--paused">{it.casa.paused}</span>
          ) : !periodic ? (
            paid
              ? <span className="chip chip--done">{it.casa.registeredOn(formatShortDate(paid.date))}</span>
              : <span className="chip chip--upcoming">{it.casa.toRegister}</span>
          ) : b.nextDue ? (
            late
              ? <span className="chip chip--upcoming">{it.casa.dueLateChip}</span>
              : b.nextDue === current
                ? <span className="chip chip--upcoming">{it.casa.toRegister}</span>
                : <span className="chip chip--later">{it.casa.dueChip(dueMonth(b.nextDue, opening))}</span>
          ) : null;
          return (
            <li key={b.id}>
              <ScheduleRow
                boxTop={m ? it.months.short[Number(m) - 1] ?? '—' : '—'}
                boxBottom={y && y !== currentYear ? y : null}
                title={b.name}
                detail={detail}
                detail2={periodic ? (
                  <>
                    {it.recurring.frequency[b.frequency]} ·{' '}
                    <span className={fund.missing > 0 ? 'is-over' : undefined}>
                      {fund.missing > 0 ? it.casa.fundMissingShort(formatEuro(fund.missing)) : it.casa.fundOfShort(formatEuro(fund.fund), formatEuro(fund.target))}
                    </span>
                  </>
                ) : null}
                amount={<>{formatEuro(quota)}<small>{it.casa.perMonthShort}</small></>}
                paused={!b.active}
                chip={chip}
                onClick={() => onOpen(b)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
