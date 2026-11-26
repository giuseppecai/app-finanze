import { useState } from 'react';
import { useCurrentPeriod, usePots, useSettings } from '../../app/data';
import { DestinationPicker } from '../../components/DestinationPicker';
import { potLines } from '../../domain/pots';
import { DEFAULT_DESTINATION, fundsDestinations, type FundsDestination } from '../../domain/settings';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { IconTrash } from '../../components/icons';
import { ConfirmPanel } from '../../components/ConfirmPanel';
import { SegmentedControl } from '../../components/SegmentedControl';
import { db } from '../../db/database';
import { deleteMonthlyItem, newId, saveMonthlyItem } from '../../db/repositories';
import { parseEuro, amountText } from '../../domain/money';
import type { MonthlyItem } from '../../domain/types';
import { it } from '../../i18n/it';
import { SymbolPicker, TileEdit } from '../../components/SymbolPicker';
import { suggestSymbol, symbolFor } from '../../domain/symbols';

type Props = {
  /** 'new' per una voce nuova, null = chiuso */
  target: MonthlyItem | 'new' | null;
  /** per una voce nuova: tipo già deciso (da Spese fisse un pagamento, dal passo Pocket una Pocket) */
  kind?: MonthlyItem['kind'];
  onClose: () => void;
};

const text = (c: number) => amountText(c);

/** Crea o modifica una voce fissa dell'inizio del mese (salvadanaio o uscita, es. affitto). */
export function MonthlyItemSheet({ target, kind, onClose }: Props) {
  const newTitle = kind === 'payment' ? it.items.newPayment : kind === 'pot' ? it.items.newPot : it.items.newTitle;
  return (
    <BottomSheet open={target !== null} onClose={onClose} title={target === 'new' ? newTitle : target?.name ?? ''}>
      {target !== null ? <ItemForm key={target === 'new' ? 'new' : target.id} item={target === 'new' ? null : target} fixedKind={kind} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function ItemForm({ item, fixedKind, onDone }: { item: MonthlyItem | null; fixedKind?: MonthlyItem['kind']; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  // simbolo: quello salvato; per una voce nuova si suggerisce dal nome finché non lo scegli a mano
  const [manualIcon, setManualIcon] = useState<string | null>(item ? symbolFor(item) : null);
  const [picking, setPicking] = useState(false);
  const icon = manualIcon ?? suggestSymbol(name);
  const [kind, setKind] = useState<MonthlyItem['kind']>(item?.kind ?? fixedKind ?? 'payment');
  const [amount, setAmount] = useState(item ? text(item.amount) : '');
  /** uscite: da quale conto parte (null = Revolut) */
  const [payFrom, setPayFrom] = useState<string | null>(item?.payFrom ?? null);
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
      const from = kind === 'payment' && settings?.accounts?.some((a) => a.id === payFrom) ? payFrom : null;
      await saveMonthlyItem(db, { id: item?.id ?? newId(), name, kind, amount: cents, archived, icon, payFrom: from });
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
      <div className="new-envelope__name">
        <TileEdit symbol={icon} onClick={() => setPicking(true)} />
        <div className="entry__section">
          <label htmlFor="item-name" className="entry__label">{it.items.name}</label>
          <input id="item-name" className="text-input" value={name} placeholder={it.items.namePlaceholder} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <SymbolPicker open={picking} name={name.trim()} current={icon} suggested={suggestSymbol(name)} onPick={setManualIcon} onClose={() => setPicking(false)} />
      {/* Il tipo non cambia dopo la creazione: un salvadanaio ha già i suoi soldi. */}
      {item || fixedKind ? null : (
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
      {kind === 'payment' && (settings?.accounts?.length ?? 0) > 0 ? (
        <div className="select-field">
          <label htmlFor="item-pay-from">{it.accounts2.payFrom}</label>
          <select id="item-pay-from" value={payFrom ?? ''} onChange={(e) => setPayFrom(e.target.value || null)}>
            <option value="">{it.accounts2.payFromRevolut}</option>
            {settings?.accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      ) : null}
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
              <IconTrash />{it.items.delete}
            </button>
          </div>
          <p className="muted-note">{it.items.actionsHint}</p>
        </>
      ) : null}
    </form>
  );
}
