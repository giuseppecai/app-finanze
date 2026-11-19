import { Stepper } from '../../components/Stepper';
import { db } from '../../db/database';
import { setEnvelopeCaps } from '../../db/repositories';
import { formatEuro } from '../../domain/money';
import { capsTotal } from '../../domain/opening';
import type { Envelope } from '../../domain/types';
import { it } from '../../i18n/it';

type Props = { envelopes: readonly Envelope[] };

/**
 * Tetti delle buste con stepper (passo 5 €). Ogni tocco salva subito: i tetti valgono dal prossimo
 * "Inizio del mese". Usato nell'onboarding e in Inizio del mese (la schermata Imposta arriva in M7).
 */
export function CapsEditor({ envelopes }: Props) {
  const active = envelopes.filter((e) => !e.archived);
  const groups = [
    { title: it.caps.spendable, list: active.filter((e) => e.kind === 'spendable') },
    { title: it.caps.committed, list: active.filter((e) => e.kind === 'committed') },
  ];
  return (
    <>
      {groups.map((g) =>
        g.list.length > 0 ? (
          <section key={g.title} className="caps-group">
            <h2 className="section-head--muted">{g.title}</h2>
            <ul className="card edit-list">
              {g.list.map((e) => (
                <li key={e.id} className="cap-row">
                  <span className="cap-row__text">
                    <span className="cap-row__name">{e.name}</span>
                  </span>
                  <Stepper
                    label={it.caps.stepperLabel(e.name)}
                    value={e.cap}
                    onChange={(cap) => void setEnvelopeCaps(db, { [e.id]: cap })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      <div className="card total-card">
        <span>
          <span className="section-title">{it.caps.total}</span>
          <br />
          <span className="summary-card__note">{it.caps.totalNote}</span>
        </span>
        <span className="total-card__value">{formatEuro(capsTotal(envelopes))}</span>
      </div>
    </>
  );
}
