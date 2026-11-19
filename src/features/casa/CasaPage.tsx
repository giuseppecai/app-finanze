import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, useLoans, usePeople, usePeriodTransactions, usePots, useRecurring } from '../../app/data';
import { routes } from '../../app/routes';
import { IconChevronRight } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { TopBar } from '../../components/TopBar';
import { expectedShare, fundStatus, isPeriodic, monthlyBillsShare, monthlyQuota, billsQuotaTotal } from '../../domain/bills';
import { formatShortDate } from '../../domain/dates';
import { balanceWith } from '../../domain/loans';
import { formatEuro } from '../../domain/money';
import { mainRecurringEnvelope } from '../../domain/recurring';
import type { Bill, Envelope, Person, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';
import { BillSheet } from './BillSheet';

/** La busta della casa: quella delle bollette, oppure l'impegnata che non è degli abbonamenti. */
export function casaEnvelope(envelopes: readonly Envelope[], bills: readonly Bill[], recurringEnvelopeId: string | null): Envelope | undefined {
  const fromBills = bills[0]?.envelopeId;
  return envelopes.find((e) => e.id === fromBills)
    ?? envelopes.find((e) => e.kind === 'committed' && !e.archived && e.id !== recurringEnvelopeId);
}

export function CasaPage() {
  const bills = useBills();
  const envelopes = useEnvelopes();
  const people = usePeople();
  const loans = useLoans();
  const pots = usePots();
  const recurring = useRecurring();
  const period = useCurrentPeriod();
  const txs = usePeriodTransactions(period?.id ?? null);
  const [target, setTarget] = useState<Bill | 'new' | null>(null);
  if (!bills || !envelopes || !people || !loans || !pots || !recurring || period === undefined || !txs) return null;

  const envelope = casaEnvelope(envelopes, bills, mainRecurringEnvelope(recurring));
  const cap = envelope ? (period?.allocations[envelope.id] ?? envelope.cap) : 0;
  const monthlyShare = monthlyBillsShare(bills, envelope?.id);
  const billsPot = pots.find((p) => p.id === 'bills')?.balance ?? 0;
  const quota = billsQuotaTotal(bills);
  const monthly = bills.filter((b) => !isPeriodic(b));
  const periodic = bills.filter(isPeriodic);
  const names = new Map(people.map((p) => [p.id, p]));
  const roommates = [...new Set(bills.map((b) => b.personId).filter((id): id is string => !!id))];

  return (
    <div className="flow">
      <TopBar right={<button type="button" className="pill-button" onClick={() => setTarget('new')}>{it.casa.add}</button>} />
      <header className="screen-header">
        <h1 className="screen-title">{envelope?.name ?? it.casa.title}</h1>
        <p className="screen-subtitle">{it.casa.subtitle}</p>
      </header>

      <section className="hero">
        <div className="hero__row">
          <div>
            <p className="hero__label">{it.casa.monthlyBills}</p>
            <p className="hero__amount hero__amount--medium">{formatEuro(monthlyShare)}</p>
          </div>
          {envelope ? <span className="hero__status">{it.casa.envelopeCap(formatEuro(cap))}</span> : null}
        </div>
        {envelope ? (
          <span className="hero__bar" aria-hidden="true">
            <span className={monthlyShare > cap ? 'hero__bar-fill is-over' : 'hero__bar-fill'} style={{ width: `${cap > 0 ? Math.min(100, (monthlyShare / cap) * 100) : 100}%` }} />
          </span>
        ) : null}
        <p className="hero__status">
          {it.casa.setAside(formatEuro(billsPot))}{quota > 0 ? ` · ${it.casa.perMonth(formatEuro(quota))}` : ''}
        </p>
      </section>

      {roommates.map((id) => {
        const name = names.get(id)?.name ?? it.movements.unknownPerson;
        const balance = balanceWith(loans, id);
        const text = balance > 0 ? it.casa.owesYou(name, formatEuro(balance)) : balance < 0 ? it.casa.youOwe(name, formatEuro(-balance)) : `${name}: ${it.casa.even}`;
        return (
          <Link key={id} to={`${routes.loans}?persona=${encodeURIComponent(id)}`} className="card link-row">
            <span>{text}</span>
            <IconChevronRight />
          </Link>
        );
      })}

      {bills.length === 0 ? <p className="card empty-card">{it.casa.empty}</p> : null}

      {monthly.length > 0 ? (
        <BillList title={it.casa.monthlyTitle} bills={monthly} names={names} txs={txs} onOpen={setTarget} />
      ) : null}
      {periodic.length > 0 ? (
        <BillList title={it.casa.periodicTitle} bills={periodic} names={names} txs={txs} onOpen={setTarget} />
      ) : null}

      {envelope ? (
        <Link to={`${routes.movements}?busta=${encodeURIComponent(envelope.id)}`} className="text-link">{it.casa.movementsLink}</Link>
      ) : null}
      <div className="flow__spacer" />
      <InfoBox>{it.casa.note}</InfoBox>

      <BillSheet
        target={target}
        people={people}
        loans={loans}
        hasPeriod={!!period}
        defaultEnvelopeId={envelope?.id ?? envelopes[0]?.id ?? ''}
        defaultPersonId={roommates[0] ?? null}
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
  onOpen: (bill: Bill) => void;
};

function BillList({ title, bills, names, txs, onOpen }: ListProps) {
  return (
    <section className="recurring-list-section">
      <h2 className="section-head--muted">{title}</h2>
      <ul className="card movement-list">
        {bills.map((b) => {
          const name = b.personId ? names.get(b.personId)?.name ?? it.movements.unknownPerson : '';
          const detail = [
            isPeriodic(b) ? it.casa.frequency[b.frequency] : null,
            b.split === 'half' ? it.casa.splitHalf(name) : it.casa.splitMine,
            b.payer === 'me' ? it.casa.payerMe : it.casa.payerRoommate(name),
          ].filter(Boolean).join(' · ');
          const paid = txs.filter((t) => t.billId === b.id && t.type === 'expense').sort((x, y) => (x.date < y.date ? 1 : -1))[0];
          return (
            <li key={b.id}>
              <button type="button" className="bill-row" onClick={() => onOpen(b)}>
                <span className="movement__text">
                  <span className={b.active ? 'movement__title' : 'movement__title is-muted'}>{b.name}</span>
                  <span className="movement__detail">{detail}</span>
                  {isPeriodic(b) ? <FundBar bill={b} /> : null}
                </span>
                <span className="recurring-row__right">
                  <span className={b.active ? 'movement__amount' : 'movement__amount is-paused'}>
                    {isPeriodic(b) ? it.casa.quotaPerMonth(formatEuro(monthlyQuota(b))) : formatEuro(expectedShare(b))}
                  </span>
                  {!b.active ? (
                    <span className="chip chip--paused">{it.casa.paused}</span>
                  ) : !isPeriodic(b) ? (
                    paid ? (
                      <span className="chip chip--charged">{it.casa.registeredOn(formatShortDate(paid.date))}</span>
                    ) : (
                      <span className="chip chip--upcoming">{it.casa.toRegister}</span>
                    )
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FundBar({ bill }: { bill: Bill }) {
  const s = fundStatus(bill);
  const pct = s.target > 0 ? Math.max(0, Math.min(100, (s.fund / s.target) * 100)) : 0;
  return (
    <span className="fund">
      <span className="bar" aria-hidden="true">
        <span className={s.missing > 0 ? 'bar__fill bar__fill--over' : 'bar__fill bar__fill--ok'} style={{ width: `${pct}%` }} />
      </span>
      <span className={s.missing > 0 ? 'movement__detail is-over' : 'movement__detail'}>
        {s.missing > 0 ? it.casa.fundMissing(formatEuro(s.missing)) : it.casa.fundOf(formatEuro(s.fund), formatEuro(s.target))}
      </span>
    </span>
  );
}
