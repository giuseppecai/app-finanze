import { Link } from 'react-router-dom';
import { barFill, barState, type EnvelopeBalance } from '../domain/envelopes';
import { formatEuro } from '../domain/money';
import { symbolFor } from '../domain/symbols';
import { it } from '../i18n/it';
import { IconChevronRight } from './icons';
import { Tile } from './Symbol';

type Props = {
  balance: EnvelopeBalance;
  to: string;
  /** riga dentro il riquadro unico delle Impegnate (tile grigia, barra sottile, riga di contesto) */
  committed?: boolean;
  /** riga di contesto sotto la barra (solo Impegnate): "Prossimo: iCloud € 1 tra 5 giorni" */
  meta?: string | null;
};

/**
 * Riga di una busta: simbolo | nome e residuo / barra (quanto RESTA) e "di € tetto".
 * Gli stati si scrivono al posto di "di € X": "quasi finita · di € 200", "svuotata · di € 120",
 * "oltre il tetto di € 50".
 */
export function EnvelopeRow({ balance, to, committed = false, meta = null }: Props) {
  const state = barState(balance);
  const put = formatEuro(balance.put);
  const of =
    state === 'over' ? it.home.overCapOf(put)
      : state === 'low' && !committed ? it.home.lowOf(put)
        : state === 'empty' ? it.home.emptyOf(put)
          : it.home.ofCap(put);
  const label = it.home.envelopeLabel(balance.envelope.name, formatEuro(balance.remaining), put, state === 'over');
  return (
    <li>
      <Link to={to} className={`${committed ? 'crow' : 'env'} is-${state}`} aria-label={label}>
        <Tile symbol={symbolFor(balance.envelope)} tone={committed ? 'committed' : 'spend'} />
        <span className="env-body">
          <span className="env-top">
            <span className="env-name">{balance.envelope.name}</span>
            <span className="env-amt">{formatEuro(balance.remaining)}</span>
          </span>
          <span className="env-bot">
            <span className="bar" aria-hidden="true">
              <i style={{ width: `${barFill(balance) * 100}%` }} />
            </span>
            <span className="env-of">{of}</span>
          </span>
          {committed && meta ? (
            <span className="crow-meta">
              <span>{meta}</span>
              <IconChevronRight size={16} className="chev" />
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
