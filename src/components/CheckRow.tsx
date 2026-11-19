import type { ReactNode } from 'react';
import { IconCheck } from './icons';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  note: string;
  amount: ReactNode;
  warn?: boolean;
};

/** Riga spuntabile della checklist dei giroconti. */
export function CheckRow({ checked, onChange, title, note, amount, warn = false }: Props) {
  return (
    <label className={checked ? 'check-row is-checked' : 'check-row'}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-row__box" aria-hidden="true"><IconCheck /></span>
      <span className="check-row__text">
        <span className="check-row__title">{title}</span>
        <span className={warn ? 'check-row__note is-over' : 'check-row__note'}>{note}</span>
      </span>
      <span className={warn ? 'check-row__amount is-over' : 'check-row__amount'}>{amount}</span>
    </label>
  );
}
