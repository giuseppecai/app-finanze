import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useBills, useCurrentPeriod, useLoans, usePeople, usePeriods, usePeriodTransactions, usePots, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { IconChevronRight, IconPlus, IconReceipt } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { TopBar } from '../../components/TopBar';
import { PageHeader } from '../../components/PageHeader';
import { billsQuotaTotal, billsToRegister, fundStatus, isPeriodic, monthlyQuota } from '../../domain/bills';
import { today } from '../../domain/clock';
import { formatShortDate, monthsBetween } from '../../domain/dates';
import { nextOpeningId } from '../../domain/periods';
import { balanceWith } from '../../domain/loans';
import { formatEuro } from '../../domain/money';
import type { Bill, Person, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';
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
  const monthly = bills.filter((b) => !isPeriodic(b));
  const periodic = bills.filter(isPeriodic);
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

      <section className="hero hero--light" aria-label={it.casa.potLabel}>
        <p className="hero__label">{it.casa.potLabel}</p>
        <p className={billsPot < 0 ? 'hero__amount hero__amount--medium is-over' : 'hero__amount hero__amount--medium'}>{formatEuro(billsPot)}</p>
        <p className="hero__status">{quota > 0 ? it.casa.perMonth(formatEuro(quota)) : it.casa.noQuota}</p>
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

      {monthly.length > 0 ? (
        <BillList title={it.casa.monthlyTitle} bills={monthly} names={names} txs={txs} opening={opening} onOpen={setTarget} />
      ) : null}
      {periodic.length > 0 ? (
        <BillList title={it.casa.periodicTitle} bills={periodic} names={names} txs={txs} opening={opening} onOpen={setTarget} />
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

function BillList({ title, bills, names, txs, opening, onOpen }: ListProps) {
  return (
    <section className="recurring-list-section">
      <h2 className="group-label">{title}</h2>
      <ul className="card movement-list">
        {bills.map((b) => {
          const name = b.personId ? names.get(b.personId)?.name ?? it.movements.unknownPerson : '';
          const periodic = isPeriodic(b);
          const detail = [
            periodic ? it.casa.frequency[b.frequency] : null,
            b.split === 'half' ? (periodic ? it.casa.splitHalfShort.toLowerCase() : it.casa.splitHalf(name)) : it.casa.splitMine,
            b.split === 'half' ? (b.payer === 'me' ? it.casa.payerMe : it.casa.payerRoommate(name)) : null,
          ].filter(Boolean).join(' · ');
          const paid = txs.filter((t) => t.billId === b.id && t.type === 'expense').sort((x, y) => (x.date < y.date ? 1 : -1))[0];
          const late = periodic && b.nextDue ? monthsBetween(opening, b.nextDue) < 0 : false;
          const quota = monthlyQuota(b, opening);
          const chip = !b.active ? (
            <span className="chip chip--paused">{it.casa.paused}</span>
          ) : !periodic ? (
            paid
              ? <span className="chip chip--done">{it.casa.registeredOn(formatShortDate(paid.date))}</span>
              : <span className="chip chip--upcoming">{it.casa.toRegister}</span>
          ) : b.nextDue ? (
            late
              ? <span className="chip chip--upcoming">{it.casa.dueLateChip}</span>
              : <span className="chip chip--later">{it.casa.dueChip(dueMonth(b.nextDue, opening))}</span>
          ) : null;
          return (
            <li key={b.id}>
              <button type="button" className="bill-row" onClick={() => onOpen(b)}>
                <span className="bill-row__top">
                  <span className={b.active ? 'bill-row__name' : 'bill-row__name is-muted'}>{b.name}</span>
                  <span className={b.active ? 'bill-row__quota' : 'bill-row__quota is-paused'}>
                    {formatEuro(quota)}<small>{it.casa.perMonthShort}</small>
                  </span>
                </span>
                <span className="bill-row__detail">{detail}</span>
                <FundBar bill={b} chip={chip} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FundBar({ bill, chip }: { bill: Bill; chip: ReactNode }) {
  const s = fundStatus(bill);
  const pct = s.target > 0 ? Math.max(0, Math.min(100, (s.fund / s.target) * 100)) : 0;
  return (
    <span className="fund">
      <span className="bar" aria-hidden="true">
        <span className={s.missing > 0 ? 'bar__fill bar__fill--over' : 'bar__fill bar__fill--ok'} style={{ width: `${pct}%` }} />
      </span>
      <span className="fund__foot">
        <span className={s.missing > 0 ? 'bill-row__detail is-over' : 'bill-row__detail'}>
          {s.missing > 0 ? it.casa.fundMissing(formatEuro(s.missing)) : it.casa.fundOf(formatEuro(s.fund), formatEuro(s.target))}
        </span>
        {chip}
      </span>
    </span>
  );
}
