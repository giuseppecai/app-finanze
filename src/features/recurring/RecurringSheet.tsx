import { useState } from 'react';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmPanel } from '../../components/ConfirmPanel';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Switch } from '../../components/Switch';
import { db } from '../../db/database';
import { deleteRecurring, newId, runRecurringCharges, saveRecurring } from '../../db/repositories';
import { nowISO, today } from '../../domain/clock';
import { addMonthsId } from '../../domain/dates';
import { parseEuro, amountText } from '../../domain/money';
import { frequencyOf, nextChargeDate, RECURRING_FREQUENCIES } from '../../domain/recurring';
import type { Card, Recurring, RecurringFrequency } from '../../domain/types';
import { it } from '../../i18n/it';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** "marzo 2027" */
function monthLabel(id: string): string {
  const [y, m] = id.split('-');
  return `${it.months.long[Number(m) - 1] ?? id} ${y}`;
}

/** Mesi proponibili per il prossimo addebito: i prossimi 12 a partire da questo. */
function monthOptions(from: string, selected: string): string[] {
  const list = Array.from({ length: 12 }, (_, i) => addMonthsId(from, i));
  return list.includes(selected) ? list : [selected, ...list];
}

type Props = {
  /** abbonamento da modificare, oppure 'new' per crearne uno; null = pannello chiuso */
  target: Recurring | 'new' | null;
  defaultEnvelopeId: string;
  onClose: () => void;
};

/** Pannello di modifica: importo, giorno, carta, attivo; Elimina / Salva (R8). */
export function RecurringSheet({ target, defaultEnvelopeId, onClose }: Props) {
  return (
    <BottomSheet
      open={target !== null}
      onClose={onClose}
      title={target === 'new' ? it.recurring.sheetNew : target?.name ?? ''}
    >
      {target !== null ? (
        <RecurringForm key={target === 'new' ? 'new' : target.id} target={target} defaultEnvelopeId={defaultEnvelopeId} onDone={onClose} />
      ) : null}
    </BottomSheet>
  );
}

function RecurringForm({ target, defaultEnvelopeId, onDone }: { target: Recurring | 'new'; defaultEnvelopeId: string; onDone: () => void }) {
  const existing = target === 'new' ? null : target;
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? amountText(existing.amount) : '');
  const [day, setDay] = useState(existing?.dayOfMonth ?? 1);
  const [frequency, setFrequency] = useState<RecurringFrequency>(existing ? frequencyOf(existing) : 1);
  const thisMonth = today().slice(0, 7);
  const [nextMonth, setNextMonth] = useState<string>(() =>
    existing && frequencyOf(existing) > 1 ? nextChargeDate(existing, today()).slice(0, 7) : thisMonth,
  );
  const [card, setCard] = useState<Card>(existing?.card ?? 'extra');
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cents = parseEuro(amount);
  const valid = name.trim() !== '' && cents !== null && cents > 0;

  async function save() {
    if (!valid || cents === null) {
      setError(it.recurring.invalid);
      return;
    }
    setSaving(true);
    try {
      await saveRecurring(db, {
        id: existing?.id ?? newId(),
        name,
        amount: cents,
        dayOfMonth: day,
        frequency,
        anchorMonth: frequency > 1 ? nextMonth : null,
        envelopeId: existing?.envelopeId ?? defaultEnvelopeId,
        card,
        active,
        createdAt: existing?.createdAt ?? nowISO(),
      });
      // Un addebito già maturato in questo mese (es. riattivato dopo una pausa) si scala subito.
      await runRecurringCharges(db, today());
      onDone();
    } catch (e) {
      console.error(e);
      setError(it.recurring.error);
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    await deleteRecurring(db, existing.id);
    onDone();
  }

  if (confirming) {
    return <ConfirmPanel message={it.recurring.confirmDelete(existing?.name ?? '')} confirmLabel={it.recurring.delete} onConfirm={() => void remove()} onCancel={() => setConfirming(false)} />;
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {existing ? null : (
        <div className="entry__section">
          <label htmlFor="rec-name" className="entry__label">{it.recurring.name}</label>
          <input id="rec-name" className="text-input" value={name} placeholder={it.recurring.namePlaceholder} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div className="recurring-form__grid">
        <AmountField id="rec-amount" label={it.recurring.amount} value={amount} onChange={setAmount} invalid={amount !== '' && (cents === null || cents <= 0)} />
        <div className="select-field">
          <label htmlFor="rec-frequency">{it.recurring.frequencyLabel}</label>
          <select id="rec-frequency" value={frequency} onChange={(e) => setFrequency(Number(e.target.value) as RecurringFrequency)}>
            {RECURRING_FREQUENCIES.map((f) => <option key={f} value={f}>{it.recurring.frequency[f]}</option>)}
          </select>
        </div>
      </div>
      <div className="recurring-form__grid">
        <div className="select-field">
          <label htmlFor="rec-day">{it.recurring.day}</label>
          <select id="rec-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {DAYS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {frequency > 1 ? (
          <div className="select-field">
            <label htmlFor="rec-next">{it.recurring.nextMonth}</label>
            <select id="rec-next" value={nextMonth} onChange={(e) => setNextMonth(e.target.value)}>
              {monthOptions(thisMonth, nextMonth).map((id) => <option key={id} value={id}>{monthLabel(id)}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      {frequency > 1 ? <p className="muted-note">{it.recurring.nextMonthHint}</p> : null}
      <div className="recurring-form__card">
        <span className="entry__label">{it.recurring.card}</span>
        <SegmentedControl
          label={it.recurring.card}
          options={[
            { value: 'extra', label: it.cards.extra },
            { value: 'quotidiano', label: it.cards.quotidiano },
          ]}
          value={card}
          onChange={setCard}
        />
      </div>
      <Switch label={it.recurring.active} hint={it.recurring.activeHint} checked={active} onChange={setActive} />
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <div className="recurring-form__actions">
        {existing ? (
          <button type="button" className="outcome__button outcome__button--secondary" onClick={() => setConfirming(true)}>{it.recurring.delete}</button>
        ) : null}
        <button type="submit" className="primary-button recurring-form__save" disabled={saving}>{it.recurring.save}</button>
      </div>
    </form>
  );
}
