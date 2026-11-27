import { formatEuro } from '../domain/money';
import type { PotLine } from '../domain/pots';
import { symbolFor } from '../domain/symbols';
import { SymbolIcon } from './Symbol';

type Props = {
  label: string;
  pots: readonly PotLine[];
  value: string | null;
  onChange: (id: string) => void;
};

/** Griglia delle Pocket per il rimborso messo da parte (R4): nome con simbolo e saldo attuale. */
export function PotPicker({ label, pots, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="envelope-picker">
      {pots.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={p.id === value}
          className="envelope-picker__option"
          onClick={() => onChange(p.id)}
        >
          <span className="envelope-picker__name">
            <SymbolIcon id={symbolFor({ name: p.name, icon: p.icon })} size={15} />
            <span>{p.name}</span>
          </span>
          <span className="envelope-picker__rest">{formatEuro(p.balance)}</span>
        </button>
      ))}
    </div>
  );
}
