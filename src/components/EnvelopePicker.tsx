import { useState } from 'react';
import { pickerGrid } from '../domain/entry';
import { barFill, barState } from '../domain/envelopes';
import { formatEuro } from '../domain/money';
import { symbolFor } from '../domain/symbols';
import type { Cents, Envelope } from '../domain/types';
import { it } from '../i18n/it';
import { BottomSheet } from './BottomSheet';
import { IconLayoutGrid } from './icons';
import { SymbolIcon, Tile } from './Symbol';

type Props = {
  label: string;
  /** buste già ordinate per uso (R12) */
  envelopes: readonly Envelope[];
  remaining: Record<string, Cents>;
  /** quanto è stato messo in ogni busta (per la mini barra) */
  put: Record<string, Cents>;
  value: string | null;
  onChange: (id: string) => void;
};

/**
 * Griglia fissa di 6 caselle: le 5 buste più usate (nome breve con simbolo, residuo, mini barra di
 * quanto resta) più "Altre", che apre l'elenco di tutte le buste. Così Salva resta sempre nello schermo.
 */
export function EnvelopePicker({ label, envelopes, remaining, put, value, onChange }: Props) {
  const [more, setMore] = useState(false);
  const { visible, hidden } = pickerGrid(envelopes, value);
  return (
    <>
      <div role="radiogroup" aria-label={label} className="envelope-picker">
        {visible.map((e) => {
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
              <span className="envelope-picker__name">
                <SymbolIcon id={symbolFor(e)} size={15} />
                <span>{e.shortName}</span>
              </span>
              <span className="envelope-picker__rest">{formatEuro(balance.remaining)}</span>
              <span className="envelope-picker__mini" aria-hidden="true">
                <i style={{ width: `${barFill(balance) * 100}%` }} />
              </span>
            </button>
          );
        })}
        {hidden.length > 0 ? (
          <button type="button" className="envelope-picker__option envelope-picker__more" onClick={() => setMore(true)}>
            <IconLayoutGrid size={16} />
            <span className="envelope-picker__name">{it.entry.otherEnvelopes}</span>
            <span className="envelope-picker__rest">{hidden.map((e) => e.shortName).join(', ')}</span>
          </button>
        ) : null}
      </div>

      <BottomSheet open={more} onClose={() => setMore(false)} title={it.entry.allEnvelopes}>
        {more ? (
          <ul className="card list-card list">
            {envelopes.map((e) => {
              const rest = remaining[e.id] ?? 0;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="list-row list-row--button"
                    aria-current={e.id === value ? 'true' : undefined}
                    onClick={() => { onChange(e.id); setMore(false); }}
                  >
                    <Tile symbol={symbolFor(e)} />
                    <span className="list-row__text"><span className="list-row__title">{e.name}</span></span>
                    <span className={rest < 0 ? 'list-row__value is-over' : 'list-row__value'}>{formatEuro(rest)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </BottomSheet>
    </>
  );
}
