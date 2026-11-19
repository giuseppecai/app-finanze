import { formatEuro } from '../domain/money';
import type { Cents } from '../domain/types';
import { IconMinus, IconPlus } from './icons';

type Props = {
  label: string;
  value: Cents;
  onChange: (cents: Cents) => void;
  step?: Cents;
  min?: Cents;
};

/** − € valore + con pulsanti 44 × 44 (passo 5 €). */
export function Stepper({ label, value, onChange, step = 500, min = 0 }: Props) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__button" aria-label={`${label}: meno ${formatEuro(step)}`} disabled={value - step < min} onClick={() => onChange(Math.max(min, value - step))}>
        <IconMinus />
      </button>
      <output className="stepper__value" aria-live="polite">{formatEuro(value)}</output>
      <button type="button" className="stepper__button" aria-label={`${label}: più ${formatEuro(step)}`} onClick={() => onChange(value + step)}>
        <IconPlus size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
