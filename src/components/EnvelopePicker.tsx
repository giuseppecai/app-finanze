import { barFill, barState } from '../domain/envelopes';
import { formatEuro } from '../domain/money';
import type { Cents, Envelope } from '../domain/types';

type Props = {
  label: string;
  envelopes: readonly Envelope[];
  remaining: Record<string, Cents>;
  /** quanto è stato messo in ogni busta (per la mini barra) */
  put: Record<string, Cents>;
  value: string | null;
  onChange: (id: string) => void;
};

/** Griglia 3 colonne: nome breve, residuo e mini barra di quanto resta (stessi stati della Home). */
export function EnvelopePicker({ label, envelopes, remaining, put, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="envelope-picker">
      {envelopes.map((e) => {
        const balance = { remaining: remaining[e.id] ?? 0, put: put[e.id] ?? 0, envelope: e };
        const state = barState(balance);
        return (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={e.id === value}
            className={`envelope-picker__option is-${state}`}
            onClick={() => onChange(e.id)}
          >
            <span className="envelope-picker__name">{e.shortName}</span>
            <span className="envelope-picker__rest">{formatEuro(balance.remaining)}</span>
            <span className="envelope-picker__mini" aria-hidden="true">
              <i style={{ width: `${barFill(balance) * 100}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
