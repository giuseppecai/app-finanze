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
import { SymbolIcon } from '../../components/Symbol';
import { TopBar, useCloseScreen } from '../../components/TopBar';
import { useConfirmSheet } from '../../components/ConfirmPanel';
import { announce } from '../../components/Toast';
import { db } from '../../db/database';
import {
  addLoanEntry, addTransaction, deleteTransaction, updateTransaction,
} from '../../db/repositories';
import { today } from '../../domain/clock';
import { addDays, formatShortDate } from '../../domain/dates';
import { preselectedEnvelope, sortEnvelopesForPicker, validateEntry } from '../../domain/entry';
import { barFill, summarizePeriod } from '../../domain/envelopes';
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
  const [ask, confirmSheet] = useConfirmSheet();
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
  /** R22: spesa d'impulso (solo spese) */
  const [impulse, setImpulse] = useState(() => editing?.impulse === true);
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
  const { remaining, put } = useMemo(() => {
    const others = editing ? periodTxs.filter((t) => t.id !== editing.id) : periodTxs;
    const summary = summarizePeriod(envelopes, period, others);
    return {
      remaining: Object.fromEntries(summary.balances.map((b) => [b.envelope.id, b.remaining])),
      put: Object.fromEntries(summary.balances.map((b) => [b.envelope.id, b.put])),
    };
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

  // Pillola sotto l'importo: effetto della spesa sulla busta, con la mini barra di quanto resterà.
  let feedback: { text: string; tone: 'muted' | 'over' | 'accent'; fill: number | null } | null = null;
  if (isLoan && person) {
    const after = balanceWith(loans, person.id) + (direction === 'lent' ? amount : -amount);
    const value = formatEuro(Math.abs(after), { decimals: 'always' });
    feedback = {
      text: after > 0 ? it.entry.loanOwesYou(person.name, value) : after < 0 ? it.entry.loanYouOwe(person.name, value) : it.entry.loanEven(person.name),
      tone: 'muted',
      fill: null,
    };
  } else if (!isIncome && !isLoan && envelope) {
    const before = remaining[envelope.id] ?? 0;
    const f = entryFeedback(type === 'refund' ? 'refund' : 'expense', before, amount);
    const value = formatEuro(f.amount, { decimals: 'always' });
    const after = type === 'refund' ? before + amount : before - amount;
    const fill = barFill({ remaining: after, put: put[envelope.id] ?? 0 });
    if (f.kind === 'back') feedback = { text: it.entry.feedbackBack(envelope.shortName, value), tone: 'accent', fill };
    else if (f.kind === 'over') feedback = { text: it.entry.feedbackOver(envelope.shortName, value), tone: 'over', fill: null };
    else feedback = { text: it.entry.feedbackLeft(envelope.shortName, value), tone: 'muted', fill };
  }

  const saveLabel = editing
    ? it.entry.saveEdit
    : amount === 0
      ? it.entry.writeAmount
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
        const fields = { type: t, amount, envelopeId: isIncome ? null : envelopeId, note: note.trim(), date, impulse: t === 'expense' && impulse };
        if (editing) {
          await updateTransaction(db, editing.id, fields);
        } else {
          const tx = await addTransaction(db, {
            ...fields, card, source: params.get('fonte') === 'confronta' ? 'reconcile' : 'manual',
            recurringId: null, personId: null, loanAllocations: null, billId: null,
          });
          // Torna alla schermata di prima con "Salvati € 12,40 in Vita · Annulla".
          announce(
            isIncome ? it.entry.savedIncome(amountText) : it.entry.saved(amountText, envelope?.shortName ?? ''),
            () => deleteTransaction(db, tx.id),
          );
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
    if (!editing || !(await ask({ title: it.entry.delete, message: it.entry.confirmDelete, confirmLabel: it.entry.delete }))) return;
    await deleteTransaction(db, editing.id);
    close();
  }

  const dateLabel = date === now ? it.entry.today : date === addDays(now, -1) ? it.entry.yesterday : formatShortDate(date);
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
      />

      <div className="entry__amount-block">
        {type === 'refund' ? <p className="entry__hint">{it.entry.refundHint}</p> : null}
        {isIncome ? <p className="entry__hint">{it.entry.incomeHint}</p> : null}
        <p className="entry__amount" aria-live="polite">
          {type === 'refund' || isIncome ? '+ ' : ''}<span className="cur">€</span>{amountText.replace('€\u00a0', '')}
          <span className="caret" aria-hidden="true" />
        </p>
        <div className="entry__effects">
          {/* La data è un chip con la scritta: una data diversa da oggi si vede (diventa scuro). */}
          <label className={date === now ? 'date-chip' : 'date-chip is-changed'} aria-label={it.entry.dateLabel(dateLabel)}>
            <IconCalendar size={18} />
            {dateLabel}
            <input type="date" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} />
          </label>
          {feedback ? (
            <p className={`effect effect--${feedback.tone}`}>
              {feedback.fill !== null ? <span className="effect__mini" aria-hidden="true"><i style={{ width: `${feedback.fill * 100}%` }} /></span> : null}
              {feedback.text}
            </p>
          ) : null}
        </div>
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
          {amount > 0 ? (
          <InfoBox>
            {direction === 'lent'
              ? it.entry.loanInfo(formatEuro(amount, { decimals: 'always' }))
              : it.entry.debtInfo(formatEuro(amount, { decimals: 'always' }))}
          </InfoBox>
          ) : null}
        </>
      ) : !isIncome ? (
        <div className="entry__section">
          <h2 className="entry__label">{it.entry.whichEnvelope}</h2>
          <EnvelopePicker
            label={it.entry.envelopeLabel}
            envelopes={pickerEnvelopes}
            remaining={remaining}
            put={put}
            value={envelopeId}
            onChange={setEnvelopeId}
          />
        </div>
      ) : null}

      <div className="entry__section entry__note-row">
        <label htmlFor="entry-note" className={isLoan ? 'entry__label' : 'visually-hidden'}>{isLoan ? it.entry.reason : it.entry.note}</label>
        <input
          id="entry-note"
          className="text-input"
          type="text"
          value={note}
          placeholder={isLoan ? it.entry.reasonPlaceholder : it.entry.noteOptional}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            // "Fine" sulla tastiera chiude la tastiera, non salva.
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          }}
        />
        {type === 'expense' ? (
          <button
            type="button"
            className="impulse-toggle"
            aria-pressed={impulse}
            title={it.insights.impulseHint}
            onClick={() => setImpulse((v) => !v)}
          >
            <SymbolIcon id="zap" size={16} />
            {it.insights.impulseToggle}
          </button>
        ) : null}
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
      {confirmSheet}
    </form>
  );
}
