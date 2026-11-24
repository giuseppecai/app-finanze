import { useState } from 'react';
import { IconChevronRight } from '../../components/icons';
import { db } from '../../db/database';
import { setEnvelopeCaps } from '../../db/repositories';
import { formatEuro } from '../../domain/money';
import { capsTotal } from '../../domain/opening';
import { symbolFor } from '../../domain/symbols';
import { Tile } from '../../components/Symbol';
import type { Envelope } from '../../domain/types';
import { it } from '../../i18n/it';
import { EnvelopeCapSheet, type CapTarget } from './EnvelopeCapSheet';

type Props = { envelopes: readonly Envelope[] };

/**
 * Tetti delle buste nel Benvenuto: stesse righe e stesso pannello di Imposta ("un solo modo per
 * fare ogni cosa"). Ogni tetto si salva subito e vale dal primo "Inizio del mese".
 */
export function CapsEditor({ envelopes }: Props) {
  const [target, setTarget] = useState<CapTarget | null>(null);
  const active = envelopes.filter((e) => !e.archived);
  const groups = [{ title: it.settings.envelopesListTitle, list: active }];
  return (
    <>
      {groups.map((g) =>
        g.list.length > 0 ? (
          <section key={g.title}>
            <h2 className="group-label">{g.title}</h2>
            <ul className="card list-card list">
              {g.list.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="list-row list-row--button"
                    onClick={() => setTarget({ id: e.id, name: e.name, cap: e.cap, detail: null, recurringCount: 0, showRecurringLink: false, freed: 0, symbol: symbolFor(e) })}
                  >
                    <Tile symbol={symbolFor(e)} />
                    <span className="list-row__text"><span className="list-row__title">{e.name}</span></span>
                    <span className="list-row__value">{formatEuro(e.cap)}</span>
                    <IconChevronRight className="list-row__chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      <div className="card list-card">
        <div className="list-row list-row--total">
          <span className="list-row__text">
            <span className="list-row__title">{it.caps.total}</span>
            <span className="list-row__detail">{it.caps.totalNote}</span>
          </span>
          <span className="list-row__total">{formatEuro(capsTotal(envelopes))}</span>
        </div>
      </div>
      <EnvelopeCapSheet
        target={target}
        onClose={() => setTarget(null)}
        onApply={(id, cap, icon) => void Promise.all([setEnvelopeCaps(db, { [id]: cap }), db.envelopes.update(id, { icon })])}
      />
    </>
  );
}
