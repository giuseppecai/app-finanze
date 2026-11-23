import { useRef, useState } from 'react';
import { formatEuro, parseEuro, stepCents } from '../domain/money';
import type { Cents } from '../domain/types';
import { IconMinus, IconPlus } from './icons';

type Props = {
  label: string;
  value: Cents;
  onChange: (cents: Cents) => void;
  step?: Cents;
  min?: Cents;
};

const asText = (c: Cents) => formatEuro(c, { decimals: 'always' }).replace('€ ', '');

/**
 * − € valore + con pulsanti 44 × 44. I pulsanti vanno a passi di 5 €; per un importo esatto
 * (es. € 140,49) si tocca il valore e lo si scrive con la tastiera numerica.
 */
export function Stepper({ label, value, onChange, step = 500, min = 0 }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = draft === null ? null : parseEuro(draft);
  const invalid = draft !== null && draft.trim() !== '' && (parsed === null || parsed < min);

  function startEditing() {
    setDraft(asText(value));
    // Su iOS la tastiera si apre solo se il focus arriva nello stesso gesto del tocco.
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function commit() {
    if (draft !== null && parsed !== null && parsed >= min && parsed !== value) onChange(parsed);
    setDraft(null);
  }

  const down = stepCents(value, step, -1);
  const up = stepCents(value, step, 1);

  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__button" aria-label={`${label}: meno`} disabled={down < min} onClick={() => onChange(Math.max(min, down))}>
        <IconMinus />
      </button>
      {draft === null ? (
        <button type="button" className="stepper__value" aria-label={`${label}: ${formatEuro(value)}. Tocca per scrivere l’importo`} onClick={startEditing}>
          {formatEuro(value)}
        </button>
      ) : (
        <input
          ref={inputRef}
          autoFocus
          className={invalid ? 'stepper__input is-invalid' : 'stepper__input'}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') setDraft(null);
          }}
        />
      )}
      <button type="button" className="stepper__button" aria-label={`${label}: più`} onClick={() => onChange(up)}>
        <IconPlus size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
