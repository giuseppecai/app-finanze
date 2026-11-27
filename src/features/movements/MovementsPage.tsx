import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAllTransactions, useBills, useEnvelopes, usePeople, usePeriods, usePeriodTransactions, usePots, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { FilterChips } from '../../components/FilterChips';
import { IconArrowDownLeft, IconArrowUpRight, IconChevronDown, IconClose, IconReceipt } from '../../components/icons';
import { searchMovements, searchSummary, searchTerms } from '../../domain/insights';
import { PageHeader } from '../../components/PageHeader';
import { SymbolIcon } from '../../components/Symbol';
import { symbolFor } from '../../domain/symbols';
import { today } from '../../domain/clock';
import { addDays, formatDayHeading, formatShortRange } from '../../domain/dates';
import { summarizePeriod } from '../../domain/envelopes';
import { formatEuro } from '../../domain/money';
import { dayTotalKind, expensesSummary, groupByDay, signedAmount } from '../../domain/movements';
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
  const bills = useBills();
  // R19 · Cerca: la ricerca sta nell'indirizzo, così tornando da un movimento resta.
  const query = params.get('cerca') ?? '';
  const searching = searchTerms(query) !== null;
  const all = useAllTransactions(searching);

  if (!periods || !envelopes || !people || !txs || !bills || !all) return null;

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
        <PageHeader title={it.movements.title} />
        <p className="placeholder">{it.movements.empty}</p>
      </>
    );
  }

  const summary = expensesSummary(txs);
  const visibleEnvelopes = envelopes.filter((e) => !e.archived || e.id in period.allocations);
  const selected = filter === ALL ? null : envelopes.find((e) => e.id === filter) ?? null;
  const found = searching ? searchMovements(all, query, { envelopes, people, bills }) ?? [] : null;
  const source = found ?? txs;
  const visible = selected ? source.filter((t) => t.envelopeId === selected.id) : source;
  const foundSummary = found ? searchSummary(visible) : null;
  const balance = selected
    ? summarizePeriod(envelopes, period, txs).balances.find((b) => b.envelope.id === selected.id) ?? null
    : null;

  return (
    <>
      <PageHeader
        title={it.movements.title}
        chip={foundSummary
          ? { icon: <IconReceipt />, text: it.insights.searchSummary(foundSummary.count, formatEuro(foundSummary.total, { decimals: 'always' }), foundSummary.months) }
          : { icon: <IconReceipt />, text: it.movements.spent(formatEuro(summary.total, { decimals: 'always' })) }}
        extra={foundSummary ? null : <PeriodSelect periods={sorted} value={period} onChange={(id) => setParam('periodo', id)} />}
      />

      <SearchField value={query} onChange={(v) => setParam('cerca', v === '' ? null : v)} />

      <FilterChips
        label={it.movements.filterLabel}
        chips={[{ value: ALL, label: it.movements.all }, ...visibleEnvelopes.map((e) => ({ value: e.id, label: e.shortName }))]}
        value={selected ? selected.id : ALL}
        onChange={(v) => setParam('busta', v === ALL ? null : v)}
      />

      {balance && !found ? (
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
        emptyText={found ? it.insights.searchEmpty(query.trim()) : selected ? it.movements.emptyFiltered(selected.name) : it.movements.empty}
        showYear={!!found}
      />
    </>
  );
}

/** R19 · Cerca in tutti i mesi. */
function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const short = value.trim() !== '' && searchTerms(value) === null;
  return (
    <div className="search-field">
      <label htmlFor="movements-search" className="visually-hidden">{it.insights.search}</label>
      <input
        id="movements-search"
        className="text-input"
        type="text"
        value={value}
        placeholder={it.insights.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      {value !== '' ? (
        <button type="button" className="search-field__clear" aria-label={it.insights.searchClear} onClick={() => onChange('')}><IconClose size={18} /></button>
      ) : null}
      {short ? <p className="search-field__hint">{it.insights.searchShort}</p> : null}
    </div>
  );
}

function PeriodSelect({ periods, value, onChange }: { periods: Period[]; value: Period; onChange: (id: string) => void }) {
  return (
    <label className="period-chip">
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

type ListProps = { txs: Transaction[]; envelopes: Envelope[]; people: Person[]; emptyText: string; showYear?: boolean };

function MovementList({ txs, envelopes, people, emptyText, showYear = false }: ListProps) {
  if (txs.length === 0) return <p className="placeholder">{emptyText}</p>;
  const envById = new Map(envelopes.map((e) => [e.id, e]));
  const personById = new Map(people.map((p) => [p.id, p]));
  return (
    <div className="day-groups">
      {groupByDay(txs).map((group) => {
        const kind = dayTotalKind(group);
        return (
          <section key={group.date} className="day-group">
            {/* Intestazione fissa in alto mentre si scorre: giorno e cosa conta nel totale */}
            <div className="day-group__head">
              <h2>{dayLabel(group.date)}{showYear && group.date.slice(0, 4) !== today().slice(0, 4) ? ` ${group.date.slice(0, 4)}` : ''}</h2>
              <span>
                {kind === 'none' ? it.movements.dayNone : kind === 'spent' ? it.movements.daySpent(signed(group.total)) : it.movements.dayIn(signed(group.total))}
              </span>
            </div>
            <ul className="card movement-list">
              {group.transactions.map((tx) => (
                <MovementRow key={tx.id} tx={tx} envelope={tx.envelopeId ? envById.get(tx.envelopeId) : undefined} person={tx.personId ? personById.get(tx.personId) : undefined} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MovementRow({ tx, envelope, person }: { tx: Transaction; envelope?: Envelope; person?: Person }) {
  const accounts = useSettings()?.accounts ?? [];
  const pots = usePots();
  const isLoan = tx.type === 'loan' || tx.type === 'loanRepayment' || tx.type === 'debt' || tx.type === 'debtRepayment';
  const personName = person?.name ?? it.movements.unknownPerson;
  const cardName = tx.card ? it.cards[tx.card] : it.budgetPocket;
  // Prestiti e debiti non sono spese: avatar tondo con l'iniziale, importo grigio senza segno, freccia.
  const outgoing = tx.type === 'loan' || tx.type === 'debtRepayment';

  let icon: ReactNode;
  let iconClass = 'movement__icon';
  let title: string;
  let detail: string;
  if (tx.type === 'income') {
    icon = <IconArrowDownLeft />;
    iconClass += ' movement__icon--in';
    title = tx.note || it.movements.income;
    detail = `${it.movements.income} · ${cardName}`;
  } else if (isLoan) {
    icon = personName.charAt(0).toUpperCase();
    iconClass += ' movement__icon--person';
    const label = {
      loan: it.movements.loan(personName),
      loanRepayment: it.movements.repayment(personName),
      debt: it.movements.debt(personName),
      debtRepayment: it.movements.debtRepayment(personName),
    }[tx.type as 'loan' | 'loanRepayment' | 'debt' | 'debtRepayment'];
    title = tx.note || label;
    detail = label;
  } else if (tx.type === 'refund' && tx.potId) {
    // Rimborso messo in una Pocket (R4): un regalo, soldi da mettere da parte.
    const pot = pots?.find((p) => p.id === tx.potId);
    const potName = pot?.name ?? it.entry.potLabel;
    icon = <SymbolIcon id={symbolFor({ name: potName, icon: pot?.icon })} size={20} />;
    iconClass += ' movement__icon--in';
    title = tx.note || potName;
    detail = `${potName} · ${it.movements.potRefund}`;
  } else if (tx.type === 'expense' && !tx.envelopeId && tx.billId) {
    icon = <IconReceipt />;
    title = tx.note || it.casa.title;
    detail = it.movements.fromBillsPot;
  } else {
    icon = <SymbolIcon id={envelope ? symbolFor(envelope) : 'tag'} size={20} />;
    title = tx.note || envelope?.name || '';
    // Pagato da un altro conto (rata da Isybank): il conto, e la carta se ne ha più di una.
    const account = tx.accountId ? accounts.find((a) => a.id === tx.accountId) : undefined;
    const accountLabel = account ? [account.name, account.cards?.find((c) => c.id === tx.accountCardId)?.name].filter(Boolean).join(' · ') : null;
    const parts = accountLabel ? [accountLabel] : [envelope?.shortName ?? '', cardName];
    if (tx.type === 'refund') parts.push(it.movements.refund);
    if (tx.source === 'recurring') parts.push(it.movements.auto);
    detail = parts.join(' · ');
  }

  const positive = signedAmount(tx) > 0;
  const content = (
    <>
      <span className={iconClass} aria-hidden="true">{icon}</span>
      <span className="movement__text">
        <span className="movement__title">{title}</span>
        <span className="movement__detail">{detail}</span>
      </span>
      {isLoan ? (
        <span className="movement__amount movement__amount--loan">
          {outgoing ? <IconArrowUpRight /> : <IconArrowDownLeft size={16} />}
          {formatEuro(tx.amount, { decimals: 'always' })}
        </span>
      ) : (
        <span className={positive ? 'movement__amount is-positive' : 'movement__amount'}>{signed(signedAmount(tx))}</span>
      )}
    </>
  );

  // Le restituzioni si gestiscono (e si annullano) dalla schermata Prestiti.
  const isRepayment = tx.type === 'loanRepayment' || tx.type === 'debtRepayment';
  const to = isRepayment ? `${routes.loans}?persona=${encodeURIComponent(tx.personId ?? '')}` : `${routes.entry}?id=${encodeURIComponent(tx.id)}`;
  return (
    <li>
      <Link to={to} className="movement">
        {content}
      </Link>
    </li>
  );
}
