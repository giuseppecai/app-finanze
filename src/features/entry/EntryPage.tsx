import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useBills, useCurrentPeriod, useEnvelopes, useLoans, usePeople, usePeriods, usePeriodTransactions, useSettings, useTransaction,
  useTransactionsSince,
} from '../../app/data';
import { routes } from '../../app/routes';
import { EnvelopePicker } from '../../components/EnvelopePicker';
import { IconCalendar } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { Keypad } from '../../components/Keypad';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TopBar, useCloseScreen } from '../../components/TopBar';
import { db } from '../../db/database';
import {
  addLoanEntry, addTransaction, deleteTransaction, updateTransaction,
} from '../../db/repositories';
import { today } from '../../domain/clock';
import { addDays, formatDayHeading, formatShortDate } from '../../domain/dates';
import { preselectedEnvelope, sortEnvelopesForPicker, validateEntry } from '../../domain/entry';
import { summarizePeriod } from '../../domain/envelopes';
import { balanceWith } from '../../domain/loans';
import { formatEuro, KEYPAD_MAX_DIGITS } from '../../domain/money';
import { entryFeedback } from '../../domain/movements';
import type { Card, Cents, Envelope, ISODate, Loan, LoanDirection, Period, Person, Settings, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';
import { BillTxEdit } from './BillTxEdit';
import { LoanEntryEdit } from './LoanEntryEdit';
import { PersonPicker } from './PersonPicker';

type EntryType = 'expense' | 'refund' | 'income' | 'loan';

const TYPE_PARAM: Record<string, EntryType> = { spesa: 'expense', rimborso: 'refund', prestito: 'loan' };

/** Inserimento rapido: nuovo movimento, oppure modifica con `?id=…` (da Movimenti). */
export function EntryPage() {
  const [params] = useSearchParams();
  const editId = params.get('id');
  const editing = useTransaction(editId);
  const current = useCurrentPeriod();
  const periods = usePeriods();
  const envelopes = useEnvelopes();
  const settings = useSettings();
  const people = usePeople();
  const loans = useLoans();
  const bills = useBills();
  const now = today();
  const recent = useTransactionsSince(addDays(now, -60));
  const periodId = editing ? editing.periodId : current?.id;
  const periodTxs = usePeriodTransactions(periodId);

  if (editing === undefined || current === undefined || !periods || !envelopes || !settings || !recent || !periodTxs || !people || !loans || !bills) {
    return null;
  }
  if (editId && editing === null) return <Message text={it.entry.notFound} />;
  if (editing && editing.billId) {
    return <BillTxEdit tx={editing} billName={bills.find((b) => b.id === editing.billId)?.name ?? it.casa.title} />;
  }
  if (editing && (editing.type === 'loan' || editing.type === 'debt')) {
    return <LoanEntryEdit tx={editing} people={people} />;
  }
  if (!editing && !current) {
    return <Message text={it.entry.noPeriod} action={{ to: routes.opening, label: it.entry.noPeriodAction }} />;
  }
  const period = periods.find((p) => p.id === periodId);
  if (!period) return <Message text={it.entry.noPeriod} />;

  return (
    <EntryForm
      key={editing?.id ?? 'new'}
      editing={editing}
      period={period}
      envelopes={envelopes}
      settings={settings}
      periodTxs={periodTxs}
      recentTxs={recent}
      people={people}
      loans={loans}
      today={now}
      params={params}
    />
  );
}

function Message({ text, action }: { text: string; action?: { to: string; label: string } }) {
  return (
    <>
      <TopBar />
      <div className="placeholder">
        <p>{text}</p>
        {action ? <Link to={action.to} className="text-link">{action.label}</Link> : null}
      </div>
    </>
  );
}

type FormProps = {
  editing: Transaction | null;
  period: Period;
  envelopes: Envelope[];
  settings: Settings;
  periodTxs: Transaction[];
  recentTxs: Transaction[];
  people: Person[];
  loans: Loan[];
  today: ISODate;
  params: URLSearchParams;
};

function initialAmount(params: URLSearchParams): Cents {
  const raw = params.get('importo');
  if (!raw || !/^\d+$/.test(raw) || raw.length > KEYPAD_MAX_DIGITS) return 0;
  return Number(raw);
}

function EntryForm({ editing, period, envelopes, settings, periodTxs, recentTxs, people, loans, today: now, params }: FormProps) {
  const close = useCloseScreen();
  const sorted = useMemo(() => sortEnvelopesForPicker(envelopes, recentTxs, now), [envelopes, recentTxs, now]);

  const [type, setType] = useState<EntryType>(() => {
    if (editing) return editing.type === 'income' || editing.type === 'refund' ? editing.type : 'expense';
    return TYPE_PARAM[params.get('tipo') ?? ''] ?? 'expense';
  });
  const [amount, setAmount] = useState<Cents>(() => editing?.amount ?? initialAmount(params));
  const [envelopeId, setEnvelopeId] = useState<string | null>(
    () => editing?.envelopeId ?? preselectedEnvelope(sorted, settings.lastEnvelopeId)?.id ?? null,
  );
  const [personId, setPersonId] = useState<string | null>(() => params.get('persona'));
  const [direction, setDirection] = useState<LoanDirection>('lent');
  const [note, setNote] = useState(() => editing?.note ?? params.get('nota') ?? '');
  const [date, setDate] = useState<ISODate>(() => editing?.date ?? now);
  const [card] = useState<Card | null>(() => {
    if (editing) return editing.card;
    const c = params.get('carta');
    return c === 'extra' || c === 'quotidiano' ? c : 'quotidiano';
  });
  // Con un importo già pronto (modifica o parametro) la prima cifra digitata lo sostituisce.
  const [amountTouched, setAmountTouched] = useState(() => !editing && initialAmount(params) === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Residui delle buste senza il movimento che sto modificando.
  const remaining = useMemo(() => {
    const others = editing ? periodTxs.filter((t) => t.id !== editing.id) : periodTxs;
    const summary = summarizePeriod(envelopes, period, others);
    return Object.fromEntries(summary.balances.map((b) => [b.envelope.id, b.remaining]));
  }, [editing, periodTxs, envelopes, period]);

  const isIncome = type === 'income';
  const isLoan = type === 'loan';
  const envelope = envelopes.find((e) => e.id === envelopeId) ?? null;
  const person = people.find((p) => p.id === personId) ?? null;
  const pickerEnvelopes = envelope && !sorted.some((e) => e.id === envelope.id) ? [...sorted, envelope] : sorted;
  const amountText = formatEuro(amount, { decimals: 'always' });
  const errors = validateEntry({
    type: isLoan ? 'loan' : type,
    amount,
    envelopeId: isIncome || isLoan ? 'n/a' : envelopeId,
    personId,
  });
  const canSave = errors.length === 0 && !saving;

  let feedback: { text: string; tone: 'muted' | 'over' | 'accent' } | null = null;
  if (isLoan && person) {
    const after = balanceWith(loans, person.id) + (direction === 'lent' ? amount : -amount);
    const value = formatEuro(Math.abs(after), { decimals: 'always' });
    feedback = {
      text: after > 0 ? it.entry.loanOwesYou(person.name, value) : after < 0 ? it.entry.loanYouOwe(person.name, value) : it.entry.loanEven(person.name),
      tone: 'muted',
    };
  } else if (!isIncome && !isLoan && envelope) {
    const f = entryFeedback(type === 'refund' ? 'refund' : 'expense', remaining[envelope.id] ?? 0, amount);
    const value = formatEuro(f.amount, { decimals: 'always' });
    if (f.kind === 'back') feedback = { text: it.entry.feedbackBack(envelope.name, value), tone: 'accent' };
    else if (f.kind === 'over') feedback = { text: it.entry.feedbackOver(envelope.name, value), tone: 'over' };
    else feedback = { text: it.entry.feedbackLeft(envelope.name, value), tone: 'muted' };
  }

  const saveLabel = editing
    ? it.entry.saveEdit
    : isLoan
      ? direction === 'lent'
        ? it.entry.saveLoan(amountText, person?.name ?? '…')
        : it.entry.saveDebt(amountText, person?.name ?? '…')
      : isIncome
        ? it.entry.saveIncome(amountText)
        : type === 'refund'
          ? it.entry.saveRefund(amountText, envelope?.shortName ?? '')
          : it.entry.saveExpense(amountText, envelope?.shortName ?? '');

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (isLoan) {
        if (!personId) return;
        await addLoanEntry(db, { personId, direction, amount, date, reason: note, card });
      } else {
        const t = type as 'expense' | 'refund' | 'income';
        const fields = { type: t, amount, envelopeId: isIncome ? null : envelopeId, note: note.trim(), date };
        if (editing) {
          await updateTransaction(db, editing.id, fields);
        } else {
          await addTransaction(db, {
            ...fields, card, source: params.get('fonte') === 'confronta' ? 'reconcile' : 'manual',
            recurringId: null, personId: null, loanAllocations: null, billId: null,
          });
        }
      }
      close();
    } catch (e) {
      console.error(e);
      setError(it.entry.saveError);
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing || !window.confirm(it.entry.confirmDelete)) return;
    await deleteTransaction(db, editing.id);
    close();
  }

  const dateLabel = date === now ? it.entry.today : formatShortDate(date);
  const typeOptions = editing
    ? [
        { value: 'expense' as const, label: it.entry.types.expense },
        { value: 'refund' as const, label: it.entry.types.refund },
      ]
    : [
        { value: 'expense' as const, label: it.entry.types.expense },
        { value: 'refund' as const, label: it.entry.types.refund },
        { value: 'loan' as const, label: it.entry.types.loan },
      ];

  return (
    <form
      className="entry"
      aria-label={editing ? it.entry.titleEdit : it.entry.titleNew}
      onSubmit={(e) => { e.preventDefault(); void save(); }}
    >
      <TopBar
        center={
          isIncome ? (
            <span className="entry__type-static">{it.entry.income}</span>
          ) : (
            <SegmentedControl label={it.entry.typeLabel} options={typeOptions} value={type as 'expense' | 'refund' | 'loan'} onChange={setType} />
          )
        }
        right={
          <label className="icon-button date-button" aria-label={it.entry.dateLabel(dateLabel)}>
            <IconCalendar />
            <input
              type="date"
              value={date}
              onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
            />
          </label>
        }
      />

      <div className="entry__amount-block">
        {type === 'refund' ? <p className="entry__hint">{it.entry.refundHint}</p> : null}
        {isIncome ? <p className="entry__hint">{it.entry.incomeHint}</p> : null}
        {date !== now ? <p className="entry__hint">{formatDayHeading(date)}</p> : null}
        <p className="entry__amount" aria-live="polite">
          {type === 'refund' || isIncome ? '+ ' : ''}{amountText}
        </p>
        {feedback ? <p className={`entry__feedback entry__feedback--${feedback.tone}`}>{feedback.text}</p> : null}
      </div>

      {isLoan ? (
        <>
          <div className="entry__section">
            <SegmentedControl
              label={it.entry.loanDirection}
              options={[
                { value: 'lent', label: it.entry.loanLent },
                { value: 'borrowed', label: it.entry.loanBorrowed },
              ]}
              value={direction}
              onChange={setDirection}
            />
          </div>
          <div className="entry__section">
            <h2 className="entry__label">{direction === 'lent' ? it.entry.toWhom : it.entry.fromWhom}</h2>
            <PersonPicker people={people} loans={loans} value={personId} onChange={setPersonId} />
          </div>
          <InfoBox>
            {direction === 'lent'
              ? it.entry.loanInfo(formatEuro(amount, { decimals: 'always' }))
              : it.entry.debtInfo(formatEuro(amount, { decimals: 'always' }))}
          </InfoBox>
        </>
      ) : !isIncome ? (
        <div className="entry__section">
          <h2 className="entry__label">{it.entry.whichEnvelope} <span className="entry__label-soft">{it.entry.byUse}</span></h2>
          <EnvelopePicker
            label={it.entry.envelopeLabel}
            envelopes={pickerEnvelopes}
            remaining={remaining}
            value={envelopeId}
            onChange={setEnvelopeId}
          />
        </div>
      ) : null}

      <div className="entry__section">
        <label htmlFor="entry-note" className="entry__label">{isLoan ? it.entry.reason : it.entry.note}</label>
        <input
          id="entry-note"
          className="text-input"
          type="text"
          value={note}
          placeholder={isLoan ? it.entry.reasonPlaceholder : it.entry.notePlaceholder}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            // "Fine" sulla tastiera chiude la tastiera, non salva.
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          }}
        />
      </div>

      <Keypad
        value={amount}
        replaceOnNextDigit={!amountTouched}
        onChange={(cents) => { setAmount(cents); setAmountTouched(true); }}
      />

      {error ? <p className="entry__error" role="alert">{error}</p> : null}
      <button type="submit" className="primary-button" disabled={!canSave}>{saveLabel}</button>
      {editing ? (
        <button type="button" className="quiet-button" onClick={() => void remove()}>{it.entry.delete}</button>
      ) : null}
    </form>
  );
}
