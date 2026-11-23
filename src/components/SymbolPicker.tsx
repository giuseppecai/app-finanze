import { useState } from 'react';
import { SYMBOL_GROUPS, symbolLabel } from '../domain/symbols';
import { it } from '../i18n/it';
import { BottomSheet } from './BottomSheet';
import { IconPencil } from './icons';
import { SymbolIcon, Tile } from './Symbol';

type PickerProps = {
  open: boolean;
  /** nome della busta o del salvadanaio */
  name: string;
  /** simbolo attuale */
  current: string;
  /** simbolo suggerito dal nome (bordo sottile nella griglia) */
  suggested?: string | null;
  onPick: (symbol: string) => void;
  onClose: () => void;
};

/**
 * "Scegli il simbolo": anteprima con il nome e "prima era …", griglia a 6 colonne divisa in gruppi,
 * "Usa questo simbolo" fisso in basso. Toccare una cella aggiorna subito l'anteprima.
 */
export function SymbolPicker({ open, name, current, suggested = null, onPick, onClose }: PickerProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={it.symbols.title(name)} tall>
      {open ? <PickerBody key={current} name={name} current={current} suggested={suggested} onPick={(s) => { onPick(s); onClose(); }} /> : null}
    </BottomSheet>
  );
}

function PickerBody({ name, current, suggested, onPick }: { name: string; current: string; suggested: string | null; onPick: (s: string) => void }) {
  const [chosen, setChosen] = useState(current);
  return (
    <>
      <div className="icon-preview">
        <Tile symbol={chosen} size="l" />
        <div>
          <p className="icon-preview__name">{name}</p>
          <p className="icon-preview__note">
            {symbolLabel(chosen)}{chosen !== current ? ` · ${it.symbols.was(symbolLabel(current))}` : ''}
          </p>
        </div>
      </div>
      <div className="icon-groups">
        {SYMBOL_GROUPS.map((g) => (
          <section key={g.name}>
            <h3 className="icon-group">{g.name}</h3>
            <div className="icon-grid" role="radiogroup" aria-label={g.name}>
              {g.symbols.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === chosen}
                  aria-label={s.label}
                  className={s.id === suggested && s.id !== chosen ? 'icon-cell is-suggested' : 'icon-cell'}
                  onClick={() => setChosen(s.id)}
                >
                  <SymbolIcon id={s.id} size={22} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="sheet-foot">
        <button type="button" className="primary-button" onClick={() => onPick(chosen)}>{it.symbols.use}</button>
      </div>
    </>
  );
}

/** Simbolo grande con la matita: toccandolo si apre "Scegli il simbolo". */
export function TileEdit({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  return (
    <button type="button" className="tile-edit" aria-label={it.symbols.editLabel(symbolLabel(symbol))} onClick={onClick}>
      <Tile symbol={symbol} size="l" />
      <span className="tile-edit__badge" aria-hidden="true"><IconPencil size={13} strokeWidth={2.4} /></span>
    </button>
  );
}
