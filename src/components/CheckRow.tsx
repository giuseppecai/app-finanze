import type { ReactNode } from 'react';
import { IconCheck, IconPencil } from './icons';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  note: string;
  amount: ReactNode;
  warn?: boolean;
  /** se c'è, l'importo diventa un pulsante per cambiarlo (la spunta resta sul resto della riga) */
  onEditAmount?: () => void;
  editLabel?: string;
};

/** Riga spuntabile della checklist dei giroconti. */
export function CheckRow({ checked, onChange, title, note, amount, warn = false, onEditAmount, editLabel }: Props) {
  const amountClass = warn ? 'check-row__amount is-over' : 'check-row__amount';
  return (
    <div className={checked ? 'check-row is-checked' : 'check-row'}>
      <label className="check-row__hit">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="check-row__box" aria-hidden="true"><IconCheck /></span>
        <span className="check-row__text">
          <span className="check-row__title">{title}</span>
          <span className={warn ? 'check-row__note is-over' : 'check-row__note'}>{note}</span>
        </span>
        {onEditAmount ? null : <span className={amountClass}>{amount}</span>}
      </label>
      {onEditAmount ? (
        <button type="button" className={`${amountClass} check-row__edit`} aria-label={editLabel} onClick={onEditAmount}>
          {amount}
          <IconPencil size={14} />
        </button>
      ) : null}
    </div>
  );
}
