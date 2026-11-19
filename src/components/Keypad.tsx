import { keypadBackspace, keypadPress, type KeypadKey } from '../domain/money';
import type { Cents } from '../domain/types';
import { it } from '../i18n/it';
import { IconBackspace } from './icons';

const KEYS: (KeypadKey | 'del')[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];

type Props = {
  value: Cents;
  onChange: (cents: Cents) => void;
  /** Importo arrivato già pronto (modifica, Confronta): la prima cifra lo sostituisce invece di accodarsi. */
  replaceOnNextDigit?: boolean;
};

/** Tastierino 3 × 4 in centesimi: 1–9, 00, 0, cancella. */
export function Keypad({ value, onChange, replaceOnNextDigit = false }: Props) {
  return (
    <div className="keypad">
      {KEYS.map((key) =>
        key === 'del' ? (
          <button key={key} type="button" className="keypad__key" aria-label={it.entry.backspace} onClick={() => onChange(keypadBackspace(value))}>
            <IconBackspace />
          </button>
        ) : (
          <button key={key} type="button" className="keypad__key" onClick={() => onChange(keypadPress(replaceOnNextDigit ? 0 : value, key))}>
            {key}
          </button>
        ),
      )}
    </div>
  );
}
