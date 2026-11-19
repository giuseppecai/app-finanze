import { Link, useSearchParams } from 'react-router-dom';
import { useEnvelopes, usePeople, usePeriods, usePeriodTransactions } from '../../app/data';
import { routes } from '../../app/routes';
import { FilterChips } from '../../components/FilterChips';
import { IconChevronDown } from '../../components/icons';
import { today } from '../../domain/clock';
import { addDays, formatDayHeading, formatShortRange } from '../../domain/dates';
import { summarizePeriod } from '../../domain/envelopes';
import { formatEuro } from '../../domain/money';
import { expensesSummary, groupByDay, signedAmount } from '../../domain/movements';
import { currentPeriod } from '../../domain/periods';
import type { Envelope, Period, Person, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';

const ALL = 'tutte';

export function MovementsPage() {
  const [params, setParams] = useSearchParams();
  const periods = usePeriods();
  const envelopes = useEnvelopes();
  const people = usePeople();

  const sorted = periods ? periods.slice().sort((a, b) => (a.id < b.id ? 1 : -1)) : [];
  const fallback = periods ? currentPeriod(periods) ?? sorted[0] ?? null : null;
  const period = sorted.find((p) => p.id === params.get('periodo')) ?? fallback;
  const txs = usePeriodTransactions(period?.id ?? null);

  if (!periods || !envelopes || !people || !txs) return null;

  const filter = params.get('busta') ?? ALL;
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (!period) {
    return (
      <>
        <header className="screen-header"><h1 className="screen-title">{it.movements.title}</h1></header>
        <p className="placeholder">{it.movements.empty}</p>
      </>
    );
  }

  const summary = expensesSummary(txs);
  const visibleEnvelopes = envelopes.filter((e) => !e.archived || e.id in period.allocations);
  const selected = filter === ALL ? null : envelopes.find((e) => e.id === filter) ?? null;
  const visible = selected ? txs.filter((t) => t.envelopeId === selected.id) : txs;
  const balance = selected
    ? summarizePeriod(envelopes, period, txs).balances.find((b) => b.envelope.id === selected.id) ?? null
    : null;

  return (
    <>
      <header className="movements-header">
        <div className="screen-header">
          <h1 className="screen-title">{it.movements.title}</h1>
          <p className="screen-subtitle">{it.movements.summary(formatEuro(summary.total, { decimals: 'always' }), summary.count)}</p>
        </div>
        <PeriodSelect periods={sorted} value={period} onChange={(id) => setParam('periodo', id)} />
      </header>

      <FilterChips
        label={it.movements.filterLabel}
        chips={[{ value: ALL, label: it.movements.all }, ...visibleEnvelopes.map((e) => ({ value: e.id, label: e.shortName }))]}
        value={selected ? selected.id : ALL}
        onChange={(v) => setParam('busta', v === ALL ? null : v)}
      />

      {balance ? (
        <p className="filter-line">
          <span>{it.movements.envelopeLine(balance.envelope.name, formatEuro(balance.spent), formatEuro(balance.put))}</span>
          <span className={balance.remaining < 0 ? 'filter-line__left is-over' : 'filter-line__left'}>
            {it.movements.left(formatEuro(balance.remaining))}
          </span>
        </p>
      ) : null}

      <MovementList
        txs={visible}
        envelopes={envelopes}
        people={people}
        emptyText={selected ? it.movements.emptyFiltered(selected.name) : it.movements.empty}
      />
    </>
  );
}

function PeriodSelect({ periods, value, onChange }: { periods: Period[]; value: Period; onChange: (id: string) => void }) {
  return (
    <label className="pill-select">
      <span className="visually-hidden">{it.movements.periodLabel}</span>
      <span aria-hidden="true">{formatShortRange(value.calendarStart, value.calendarEnd)}</span>
      <IconChevronDown />
      <select value={value.id} onChange={(e) => onChange(e.target.value)}>
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.id.slice(0, 4)} · {formatShortRange(p.calendarStart, p.calendarEnd)}
          </option>
        ))}
      </select>
    </label>
  );
}

function dayLabel(date: string): string {
  const now = today();
  if (date === now) return it.movements.today;
  if (date === addDays(now, -1)) return it.movements.yesterday;
  return formatDayHeading(date);
}

function signed(cents: number): string {
  return formatEuro(cents, { decimals: 'always', sign: 'always' });
}

type ListProps = { txs: Transaction[]; envelopes: Envelope[]; people: Person[]; emptyText: string };

function MovementList({ txs, envelopes, people, emptyText }: ListProps) {
  if (txs.length === 0) return <p className="placeholder">{emptyText}</p>;
  const envById = new Map(envelopes.map((e) => [e.id, e]));
  const personById = new Map(people.map((p) => [p.id, p]));
  return (
    <div className="day-groups">
      {groupByDay(txs).map((group) => (
        <section key={group.date} className="day-group">
          <div className="day-group__head">
            <h2>{dayLabel(group.date)}</h2>
            <span>{signed(group.total)}</span>
          </div>
          <ul className="card movement-list">
            {group.transactions.map((tx) => (
              <MovementRow key={tx.id} tx={tx} envelope={tx.envelopeId ? envById.get(tx.envelopeId) : undefined} person={tx.personId ? personById.get(tx.personId) : undefined} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MovementRow({ tx, envelope, person }: { tx: Transaction; envelope?: Envelope; person?: Person }) {
  const isLoan = tx.type === 'loan' || tx.type === 'loanRepayment';
  const personName = person?.name ?? it.movements.unknownPerson;
  const cardName = tx.card ? it.cards[tx.card] : it.budgetPocket;

  let initial: string;
  let title: string;
  let detail: string;
  if (tx.type === 'income') {
    initial = '+';
    title = tx.note || it.movements.income;
    detail = `${it.movements.income} · ${cardName}`;
  } else if (isLoan) {
    initial = personName.charAt(0).toUpperCase();
    title = tx.note || (tx.type === 'loan' ? it.movements.loan(personName) : it.movements.repayment(personName));
    detail = tx.type === 'loan' ? it.movements.loan(personName) : it.movements.repayment(personName);
  } else {
    initial = (envelope?.shortName ?? '?').charAt(0).toUpperCase();
    title = tx.note || envelope?.name || '';
    const parts = [envelope?.name ?? '', cardName];
    if (tx.type === 'refund') parts.push(it.movements.refund);
    if (tx.source === 'recurring') parts.push(it.movements.auto);
    detail = parts.join(' · ');
  }

  const positive = signedAmount(tx) > 0;
  const content = (
    <>
      <span className={tx.type === 'income' ? 'movement__icon movement__icon--income' : 'movement__icon'} aria-hidden="true">{initial}</span>
      <span className="movement__text">
        <span className="movement__title">{title}</span>
        <span className="movement__detail">{detail}</span>
      </span>
      <span className={positive ? 'movement__amount is-positive' : 'movement__amount'}>{signed(signedAmount(tx))}</span>
    </>
  );

  // Prestiti e restituzioni si gestiscono dalla schermata Prestiti.
  const to = isLoan ? routes.loans : `${routes.entry}?id=${encodeURIComponent(tx.id)}`;
  return (
    <li>
      <Link to={to} className="movement">
        {content}
      </Link>
    </li>
  );
}
