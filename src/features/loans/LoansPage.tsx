import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoans, usePeople } from '../../app/data';
import { IconChevronDown, IconPiggyBank } from '../../components/icons';
import { Toast } from '../../components/Toast';
import { TopBar } from '../../components/TopBar';
import { PageHeader } from '../../components/PageHeader';
import { InfoBox } from '../../components/InfoBox';
import { db } from '../../db/database';
import { registerRepayment, undoRepaymentTransaction } from '../../db/repositories';
import { today } from '../../domain/clock';
import { formatShortDate } from '../../domain/dates';
import { applyRepayment, personBalances, totalDebt, totalOwed, type PersonBalance } from '../../domain/loans';
import { formatEuro, parseEuro, amountText } from '../../domain/money';
import type { Loan, Person } from '../../domain/types';
import { it } from '../../i18n/it';

type ToastState = { txId: string; text: string } | null;

export function LoansPage() {
  const loans = useLoans();
  const people = usePeople();
  const [params] = useSearchParams();
  const [open, setOpen] = useState<string | null>(() => params.get('persona'));
  const [toast, setToast] = useState<ToastState>(null);
  const [history, setHistory] = useState(false);
  const dismiss = useCallback(() => setToast(null), []);
  if (!loans || !people) return null;

  const names = new Map(people.map((p) => [p.id, p]));
  const balances = personBalances(loans);
  const toGet = totalOwed(loans);
  const toGive = totalDebt(loans);
  const creditors = balances.filter((b) => b.balance > 0).length;
  const hasDebts = balances.some((b) => b.balance < 0);

  async function undo() {
    if (!toast) return;
    const id = toast.txId;
    setToast(null);
    await undoRepaymentTransaction(db, id);
  }

  return (
    <div className="flow">
      {/* Un solo modo per creare un prestito: ＋ → Prestito (nota in fondo) */}
      <TopBar />
      <PageHeader full title={it.loans.title} chip={{ icon: <IconPiggyBank />, text: it.loans.backToSavings }} />

      <section className="hero hero--light">
        <div className="hero__row">
          <div>
            <p className="hero__label">{it.loans.toGet}</p>
            <p className="hero__amount hero__amount--medium">{formatEuro(toGet)}</p>
          </div>
          <span className="hero__status hero__status--right">
            {creditors > 0 ? it.loans.fromPeople(creditors) : null}
            {toGive > 0 ? <><br />{it.loans.youOweTotal(formatEuro(toGive))}</> : null}
          </span>
        </div>
      </section>

      <section className="loans-section">
        <h2 className="section-head--muted">{hasDebts ? it.loans.balances : it.loans.whoOwes}</h2>
        {balances.length === 0 ? (
          <p className="card empty-card">{it.loans.empty}</p>
        ) : (
          balances.map((b) => (
            <PersonCard
              key={b.personId}
              balance={b}
              person={names.get(b.personId)}
              loans={loans}
              open={open === b.personId}
              onToggle={() => {
                setToast(null);
                setOpen(open === b.personId ? null : b.personId);
              }}
              onRegistered={(txId, text) => setToast({ txId, text })}
            />
          ))
        )}
      </section>

      <div className="flow__spacer" />
      <button type="button" className="card history-toggle" aria-expanded={history} onClick={() => setHistory((h) => !h)}>
        <span>{history ? it.loans.hideHistory : it.loans.closedHistory}</span>
        <IconChevronDown className={history ? 'chevron is-open' : 'chevron'} />
      </button>
      {history ? <ClosedHistory loans={loans} names={names} /> : null}
      <InfoBox>{it.loans.howToLend}</InfoBox>

      {toast ? <Toast text={toast.text} onUndo={() => void undo()} onDismiss={dismiss} /> : null}
    </div>
  );
}

type CardProps = {
  balance: PersonBalance;
  person: Person | undefined;
  loans: Loan[];
  open: boolean;
  onToggle: () => void;
  onRegistered: (txId: string, text: string) => void;
};

function PersonCard({ balance, person, loans, open, onToggle, onRegistered }: CardProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = person?.name ?? it.movements.unknownPerson;
  const lent = balance.balance > 0;
  const total = Math.abs(balance.balance);
  const oldest = balance.openLoans[0];

  const parsed = text.trim() === '' ? 0 : parseEuro(text);
  const amount = parsed ?? 0;
  const tooMuch = amount > total;
  const preview = amount > 0 && !tooMuch ? applyRepayment(loans, balance.personId, amount, 'preview') : null;
  const covered = new Map((preview?.allocations ?? []).map((a) => [a.loanId, a.amount]));

  let previewText: string = it.loans.previewIdle;
  if (parsed === null) previewText = it.reconcile.invalid;
  else if (tooMuch) previewText = it.loans.tooMuch(formatEuro(total, { decimals: 'always' }));
  else if (amount > 0) {
    const money = formatEuro(amount, { decimals: 'always' });
    const left = formatEuro(total - amount, { decimals: 'always' });
    previewText = lent
      ? amount === total ? it.loans.previewAll(money) : it.loans.previewPart(left, money)
      : amount === total ? it.loans.previewDebtAll(money) : it.loans.previewDebtPart(left, money);
  }

  async function register() {
    if (!preview || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await registerRepayment(db, { personId: balance.personId, amount, date: today() });
      const money = formatEuro(amount);
      onRegistered(r.transaction.id, lent ? it.loans.toastLent(money, name, r.closedCount) : it.loans.toastBorrowed(money, name, r.closedCount));
      setText('');
    } catch (e) {
      console.error(e);
      setError(it.loans.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={open ? 'card person-card is-open' : 'card person-card'}>
      <button type="button" className="person-card__head" aria-expanded={open} onClick={onToggle}>
        <span className="person-card__avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span className="movement__text">
          <span className="person-card__name">{name}</span>
          <span className="movement__detail">
            {it.loans.sub(balance.openLoans.length, lent, oldest ? formatShortDate(oldest.date) : '')}
          </span>
        </span>
        <span className="person-card__total">{lent ? formatEuro(total) : it.loans.youOwe(formatEuro(total))}</span>
        <IconChevronDown className={open ? 'chevron is-open' : 'chevron'} />
      </button>
      {open ? (
        <div className="person-card__body">
          <ul className="person-card__loans">
            {balance.openLoans.map((l) => {
              const c = covered.get(l.id) ?? 0;
              const closes = c >= l.remaining && c > 0;
              const partial = c > 0 && !closes;
              return (
                <li key={l.id}>
                  <span className="movement__text">
                    <span className={closes ? 'person-card__reason is-closing' : 'person-card__reason'}>{l.reason || (lent ? it.entry.types.loan : it.entry.debt)}</span>
                    <span className="movement__detail">{formatShortDate(l.date)}{l.remaining < l.amount ? ` · ${it.loans.remains(formatEuro(l.remaining))}` : ''}</span>
                  </span>
                  <span className="person-card__right">
                    <span className={closes ? 'person-card__amount is-closing' : 'person-card__amount'}>{formatEuro(l.remaining)}</span>
                    {closes ? <span className="person-card__state is-closes">{it.loans.closes}</span> : null}
                    {partial ? <span className="person-card__state is-partial">{it.loans.remains(formatEuro(l.remaining - c))}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <label htmlFor={`repay-${balance.personId}`} className="person-card__label">{lent ? it.loans.gaveBack : it.loans.youGave}</label>
          <div className="person-card__repay">
            <div className={parsed === null || tooMuch ? 'amount-field__box is-invalid' : 'amount-field__box'}>
              <span className="amount-field__currency" aria-hidden="true">€</span>
              <input
                id={`repay-${balance.personId}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <button type="button" className="outcome__button outcome__button--secondary" onClick={() => setText(amountText(total))}>
              {it.loans.all}
            </button>
            <button type="button" className="outcome__button outcome__button--accent" disabled={!preview || busy} onClick={() => void register()}>
              {it.loans.register}
            </button>
          </div>
          <p className="muted-note" aria-live="polite">{previewText}</p>
          {error ? <p className="muted-note" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ClosedHistory({ loans, names }: { loans: Loan[]; names: Map<string, Person> }) {
  const closed = loans.filter((l) => l.closedAt !== null || l.remaining === 0);
  if (closed.length === 0) return <p className="card empty-card">{it.loans.noClosed}</p>;
  const byPerson = new Map<string, Loan[]>();
  for (const l of closed.sort((a, b) => (a.date < b.date ? 1 : -1))) {
    byPerson.set(l.personId, [...(byPerson.get(l.personId) ?? []), l]);
  }
  return (
    <div className="day-groups">
      {[...byPerson.entries()].map(([personId, list]) => (
        <section key={personId} className="day-group">
          <div className="day-group__head"><h2>{names.get(personId)?.name ?? it.movements.unknownPerson}</h2></div>
          <ul className="card movement-list">
            {list.map((l) => (
              <li key={l.id} className="closed-loan">
                <span className="movement__text">
                  <span className="movement__title">{l.reason || it.entry.types.loan}</span>
                  <span className="movement__detail">
                    {formatShortDate(l.date)}
                    {l.direction === 'borrowed' ? ` · ${it.loans.debtTag}` : ''}
                    {l.offsets ? ` · ${it.loans.offsetNote}` : ''}
                  </span>
                </span>
                <span className="movement__amount">{formatEuro(l.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
