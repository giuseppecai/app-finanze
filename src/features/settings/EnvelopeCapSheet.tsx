import { useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../app/routes';
import { AmountField } from '../../components/AmountField';
import { ConfirmPanel } from '../../components/ConfirmPanel';
import { DestinationPicker } from '../../components/DestinationPicker';
import { BottomSheet } from '../../components/BottomSheet';
import { IconChevronRight, IconMinus, IconPlus, IconTrash } from '../../components/icons';
import { amountText, formatEuro, parseEuro, stepCents } from '../../domain/money';
import { DEFAULT_DESTINATION, type DestinationOption, type FundsDestination } from '../../domain/settings';
import type { Cents } from '../../domain/types';
import { it } from '../../i18n/it';

export type CapTarget = {
  id: string;
  name: string;
  cap: Cents;
  /** "In media € 58" o simile, già pronto */
  detail: string | null;
  /** abbonamenti attivi su questa busta: la busta non si può togliere */
  recurringCount: number;
  /** busta principale degli abbonamenti: mostra il collegamento */
  showRecurringLink: boolean;
  /** residuo che la busta libera se tolta a mese aperto */
  freed: Cents;
};

type Props = {
  target: CapTarget | null;
  onClose: () => void;
  onApply: (id: string, cap: Cents) => void;
  /** senza onRemove (Benvenuto) il pannello non offre "Togli la busta" */
  onRemove?: (id: string, dest: FundsDestination) => void;
  destinations?: DestinationOption[];
  balances?: Record<string, Cents>;
};

const STEP = 500;
const asText = (c: Cents) => amountText(c);

/** Tetto di una busta: importo esatto da tastiera, ± 5 € per i ritocchi veloci, togli la busta. */
export function EnvelopeCapSheet({ target, onClose, onApply, onRemove, destinations = [], balances = {} }: Props) {
  return (
    <BottomSheet open={target !== null} onClose={onClose} title={target?.name ?? ''} subtitle={target?.detail ?? undefined}>
      {target ? (
        <CapForm
          key={target.id}
          target={target}
          destinations={destinations}
          balances={balances}
          onApply={(c) => { onApply(target.id, c); onClose(); }}
          onRemove={onRemove ? (dest) => { onRemove(target.id, dest); onClose(); } : null}
        />
      ) : null}
    </BottomSheet>
  );
}

type FormProps = {
  target: CapTarget;
  destinations: DestinationOption[];
  balances: Record<string, Cents>;
  onApply: (c: Cents) => void;
  onRemove: ((dest: FundsDestination) => void) | null;
};

function CapForm({ target, destinations, balances, onApply, onRemove }: FormProps) {
  const [confirming, setConfirming] = useState(false);
  const [dest, setDest] = useState<FundsDestination>(DEFAULT_DESTINATION);
  const [value, setValue] = useState(asText(target.cap));
  const cents = parseEuro(value);
  const valid = cents !== null;
  const nudge = (dir: 1 | -1) => setValue(asText(Math.max(0, stepCents(cents ?? target.cap, STEP, dir))));

  if (confirming) {
    return (
      <ConfirmPanel message={it.settings.removeEnvelopeConfirm(target.name)} confirmLabel={it.funds.removeAndMove('Togli', formatEuro(target.freed), destinations.find((d) => d.value === dest)?.name ?? '')} onConfirm={() => onRemove?.(dest)} onCancel={() => setConfirming(false)}>
        <DestinationPicker amount={target.freed} options={destinations} balances={balances} value={dest} onChange={setDest} />
      </ConfirmPanel>
    );
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); if (cents !== null) onApply(cents); }}>
      <div className="cap-editor">
        <button type="button" className="stepper__button cap-editor__nudge" aria-label={it.settings.minus5} disabled={(cents ?? 0) <= 0} onClick={() => nudge(-1)}>
          <IconMinus />
        </button>
        <AmountField id="cap-value" large label={it.settings.stepper(target.name)} value={value} onChange={setValue} invalid={value !== '' && !valid} />
        <button type="button" className="stepper__button cap-editor__nudge" aria-label={it.settings.plus5} onClick={() => nudge(1)}>
          <IconPlus size={18} strokeWidth={2.2} />
        </button>
      </div>
      <p className="muted-note">{it.settings.capHint}</p>
      <button type="submit" className="primary-button" disabled={!valid}>{it.settings.applyCap}</button>
      {target.showRecurringLink ? (
        <Link to={routes.recurring} className="sheet-link">
          {it.settings.recurringDetail(target.recurringCount)}<IconChevronRight size={16} />
        </Link>
      ) : null}
      {!onRemove ? null : target.recurringCount > 0 ? (
        <p className="muted-note">{it.settings.removeBlocked(target.recurringCount)}</p>
      ) : (
        <div className="sheet-actions">
          <button type="button" className="sheet-actions__button sheet-actions__button--danger" onClick={() => (target.freed > 0 ? setConfirming(true) : onRemove(DEFAULT_DESTINATION))}><IconTrash />{it.settings.removeEnvelope}</button>
        </div>
      )}
    </form>
  );
}
