import { formatEuro } from '../domain/money';
import type { Cents, Envelope } from '../domain/types';

type Props = {
  label: string;
  envelopes: readonly Envelope[];
  remaining: Record<string, Cents>;
  value: string | null;
  onChange: (id: string) => void;
};

/** Griglia 3 colonne: nome breve + residuo (negativo in arancione). */
export function EnvelopePicker({ label, envelopes, remaining, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="envelope-picker">
      {envelopes.map((e) => {
        const rest = remaining[e.id] ?? 0;
        return (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={e.id === value}
            className="envelope-picker__option"
            onClick={() => onChange(e.id)}
          >
            <span className="envelope-picker__name">{e.shortName}</span>
            <span className={rest < 0 ? 'envelope-picker__rest is-over' : 'envelope-picker__rest'}>{formatEuro(rest)}</span>
          </button>
        );
      })}
    </div>
  );
}
