import { useState } from 'react';
import { useCurrentPeriod, usePots, useSettings } from '../../app/data';
import { DestinationPicker } from '../../components/DestinationPicker';
import { potLines } from '../../domain/pots';
import { DEFAULT_DESTINATION, fundsDestinations, type FundsDestination } from '../../domain/settings';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmPanel } from '../../components/ConfirmPanel';
import { SegmentedControl } from '../../components/SegmentedControl';
import { db } from '../../db/database';
import { deleteMonthlyItem, newId, saveMonthlyItem } from '../../db/repositories';
import { formatEuro, parseEuro } from '../../domain/money';
import type { MonthlyItem } from '../../domain/types';
import { it } from '../../i18n/it';

type Props = {
  /** 'new' per una voce nuova, null = chiuso */
  target: MonthlyItem | 'new' | null;
  onClose: () => void;
};

const text = (c: number) => formatEuro(c, { decimals: 'always' }).replace('€ ', '');

/** Crea o modifica una voce fissa dell'inizio del mese (salvadanaio o uscita, es. affitto). */
export function MonthlyItemSheet({ target, onClose }: Props) {
  return (
    <BottomSheet open={target !== null} onClose={onClose} title={target === 'new' ? it.items.newTitle : target?.name ?? ''}>
      {target !== null ? <ItemForm key={target === 'new' ? 'new' : target.id} item={target === 'new' ? null : target} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function ItemForm({ item, onDone }: { item: MonthlyItem | null; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<MonthlyItem['kind']>(item?.kind ?? 'payment');
  const [amount, setAmount] = useState(item ? text(item.amount) : '');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ message: string; balance: number } | null>(null);
  const [dest, setDest] = useState<FundsDestination>(DEFAULT_DESTINATION);
  const pots = usePots();
  const settings = useSettings();
  const current = useCurrentPeriod();
  const lines = pots && settings ? potLines(pots, settings.monthlyItems) : [];
  const balances = Object.fromEntries(lines.map((l) => [l.id, l.balance]));
  const cents = parseEuro(amount);
  const valid = name.trim() !== '' && cents !== null;

  async function askRemove() {
    if (!item) return;
    const balance = item.kind === 'pot' ? (await db.pots.get(item.id))?.balance ?? 0 : 0;
    setConfirming({ message: it.items.deleteConfirm(item.name, balance !== 0), balance });
  }

  async function remove() {
    if (!item) return;
    try {
      await deleteMonthlyItem(db, item.id, dest);
      onDone();
    } catch (e) {
      console.error(e);
      setError(it.items.error);
    }
  }

  async function save(archived = item?.archived ?? false) {
    if (!valid || cents === null) {
      setError(it.items.invalid);
      return;
    }
    try {
      await saveMonthlyItem(db, { id: item?.id ?? newId(), name, kind, amount: cents, archived });
      onDone();
    } catch (e) {
      console.error(e);
      setError(it.items.error);
    }
  }

  if (confirming) {
    return (
      <ConfirmPanel message={confirming.message} confirmLabel={it.items.delete} onConfirm={() => void remove()} onCancel={() => setConfirming(null)}>
        {confirming.balance !== 0 && item ? (
          <DestinationPicker
            amount={confirming.balance}
            options={fundsDestinations(lines, item.id, !!current, it.funds.unassignedName)}
            balances={balances}
            value={dest}
            onChange={setDest}
          />
        ) : null}
      </ConfirmPanel>
    );
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="entry__section">
        <label htmlFor="item-name" className="entry__label">{it.items.name}</label>
        <input id="item-name" className="text-input" value={name} placeholder={it.items.namePlaceholder} onChange={(e) => setName(e.target.value)} />
      </div>
      {/* Il tipo non cambia dopo la creazione: un salvadanaio ha già i suoi soldi. */}
      {item ? null : (
        <div className="recurring-form__card">
          <span className="entry__label">{it.items.kind}</span>
          <SegmentedControl
            label={it.items.kind}
            options={[
              { value: 'payment', label: it.items.kindPayment },
              { value: 'pot', label: it.items.kindPot },
            ]}
            value={kind}
            onChange={setKind}
          />
          <p className="muted-note">{kind === 'pot' ? it.items.kindPotHint : it.items.kindPaymentHint}</p>
        </div>
      )}
      <AmountField id="item-amount" label={it.items.amount} value={amount} onChange={setAmount} invalid={amount !== '' && cents === null} />
      <p className="muted-note">{it.items.amountHint}</p>
      {item?.archived ? <p className="muted-note">{it.items.archivedNote}</p> : null}
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <button type="submit" className="primary-button" disabled={!valid}>{it.items.save}</button>
      {item ? (
        <>
          <div className="sheet-actions">
            <button type="button" className="sheet-actions__button" onClick={() => void save(!item.archived)}>
              {item.archived ? it.items.restore : it.items.archive}
            </button>
            <button type="button" className="sheet-actions__button sheet-actions__button--danger" onClick={() => void askRemove()}>
              {it.items.delete}
            </button>
          </div>
          <p className="muted-note">{it.items.actionsHint}</p>
        </>
      ) : null}
    </form>
  );
}
