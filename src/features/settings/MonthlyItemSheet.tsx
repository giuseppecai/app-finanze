import { useState } from 'react';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { SegmentedControl } from '../../components/SegmentedControl';
import { db } from '../../db/database';
import { newId, saveMonthlyItem } from '../../db/repositories';
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
  const cents = parseEuro(amount);
  const valid = name.trim() !== '' && cents !== null;

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
      <div className="recurring-form__actions">
        {item ? (
          <button type="button" className="outcome__button outcome__button--secondary" onClick={() => void save(!item.archived)}>
            {item.archived ? it.items.restore : it.items.archive}
          </button>
        ) : null}
        <button type="submit" className="primary-button recurring-form__save" disabled={!valid}>{it.items.save}</button>
      </div>
    </form>
  );
}
