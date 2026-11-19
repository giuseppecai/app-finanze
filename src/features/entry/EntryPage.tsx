import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, useSettings, useTransaction, useTransactionsSince,
} from '../../app/data';
import { routes } from '../../app/routes';
import { EnvelopePicker } from '../../components/EnvelopePicker';
import { IconCalendar } from '../../components/icons';
import { Keypad } from '../../components/Keypad';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TopBar, useCloseScreen } from '../../components/TopBar';
import { db } from '../../db/database';
import { addTransaction, deleteTransaction, updateTransaction } from '../../db/repositories';
import { today } from '../../domain/clock';
import { addDays, formatDayHeading, formatShortDate } from '../../domain/dates';
import { preselectedEnvelope, sortEnvelopesForPicker, validateEntry } from '../../domain/entry';
import { summarizePeriod } from '../../domain/envelopes';
import { formatEuro, KEYPAD_MAX_DIGITS } from '../../domain/money';
import { entryFeedback } from '../../domain/movements';
import type { Card, Cents, Envelope, ISODate, Period, Settings, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';

type EntryType = 'expense' | 'refund' | 'income';

const TYPE_PARAM: Record<string, EntryType> = { spesa: 'expense', rimborso: 'refund' };

/** Inserimento rapido: nuovo movimento, oppure modifica con `?id=…` (da Movimenti). */
export function EntryPage() {
  const [params] = useSearchParams();
  const editId = params.get('id');
  const editing = useTransaction(editId);
  const current = useCurrentPeriod();
  const periods = usePeriods();
  const envelopes = useEnvelopes();
  const settings = useSettings();
  const now = today();
  const recent = useTransactionsSince(addDays(now, -60));
  const periodId = editing ? editing.periodId : current?.id;
  const periodTxs = usePeriodTransactions(periodId);

  if (editing === undefined || current === undefined || !periods || !envelopes || !settings || !recent || !periodTxs) {
    return null;
  }
  if (editId && editing === null) return <Message text={it.entry.notFound} />;
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
  today: ISODate;
  params: URLSearchParams;
};

function initialAmount(params: URLSearchParams): Cents {
  const raw = params.get('importo');
  if (!raw || !/^\d+$/.test(raw) || raw.length > KEYPAD_MAX_DIGITS) return 0;
  return Number(raw);
}

function EntryForm({ editing, period, envelopes, settings, periodTxs, recentTxs, today: now, params }: FormProps) {
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
  const envelope = envelopes.find((e) => e.id === envelopeId) ?? null;
  const pickerEnvelopes = envelope && !sorted.some((e) => e.id === envelope.id) ? [...sorted, envelope] : sorted;
  const amountText = formatEuro(amount, { decimals: 'always' });
  const errors = validateEntry({ type, amount, envelopeId: isIncome ? 'n/a' : envelopeId, personId: null });
  const canSave = errors.length === 0 && !saving;

  let feedback: { text: string; tone: 'muted' | 'over' | 'accent' } | null = null;
  if (!isIncome && envelope) {
    const f = entryFeedback(type === 'refund' ? 'refund' : 'expense', remaining[envelope.id] ?? 0, amount);
    const value = formatEuro(f.amount, { decimals: 'always' });
    if (f.kind === 'back') feedback = { text: it.entry.feedbackBack(envelope.name, value), tone: 'accent' };
    else if (f.kind === 'over') feedback = { text: it.entry.feedbackOver(envelope.name, value), tone: 'over' };
    else feedback = { text: it.entry.feedbackLeft(envelope.name, value), tone: 'muted' };
  }

  const saveLabel = editing
    ? it.entry.saveEdit
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
      const fields = { type, amount, envelopeId: isIncome ? null : envelopeId, note: note.trim(), date };
      if (editing) {
        await updateTransaction(db, editing.id, fields);
      } else {
        await addTransaction(db, {
          ...fields, card, source: 'manual', recurringId: null, personId: null, loanAllocations: null,
        });
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
            <SegmentedControl
              label={it.entry.typeLabel}
              options={[
                { value: 'expense', label: it.entry.types.expense },
                { value: 'refund', label: it.entry.types.refund },
              ]}
              value={type === 'refund' ? 'refund' : 'expense'}
              onChange={setType}
            />
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

      {!isIncome ? (
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
        <label htmlFor="entry-note" className="entry__label">{it.entry.note}</label>
        <input
          id="entry-note"
          className="text-input"
          type="text"
          value={note}
          placeholder={it.entry.notePlaceholder}
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
