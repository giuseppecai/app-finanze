import { Link } from 'react-router-dom';
import { barFill, barState, type EnvelopeBalance } from '../domain/envelopes';
import { formatEuro } from '../domain/money';
import { it } from '../i18n/it';
import { IconChevronRight } from './icons';

type Props = {
  balance: EnvelopeBalance;
  to: string;
  /** riga dentro il riquadro unico delle Impegnate (barra grigia sottile, riga di contesto sotto) */
  committed?: boolean;
  /** riga di contesto sotto la barra (solo Impegnate): "Prossimo: iCloud € 1 tra 5 giorni" */
  meta?: string | null;
};

/**
 * Riga di una busta: nome, residuo, "di € tetto" e barra che mostra quanto RESTA (R3).
 * Stati: ok · quasi finita (ambra) · svuotata (grigio, barra vuota) · sforata (tutta arancione).
 */
export function EnvelopeRow({ balance, to, committed = false, meta = null }: Props) {
  const state = barState(balance);
  const over = state === 'over';
  const label = it.home.envelopeLabel(balance.envelope.name, formatEuro(balance.remaining), formatEuro(balance.put), over);
  return (
    <li>
      <Link to={to} className={`${committed ? 'crow' : 'env'} is-${state}`} aria-label={label}>
        <span className="env-top">
          <span className="env-name">{balance.envelope.name}</span>
          <span className="env-amounts">
            <span className="env-amt">{formatEuro(balance.remaining)}</span>
            {over ? <span className="env-state">{it.home.overCap}</span> : <span className="env-of">{it.home.ofCap(formatEuro(balance.put))}</span>}
          </span>
        </span>
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${barFill(balance) * 100}%` }} />
        </span>
        {committed && meta ? (
          <span className="crow-meta">
            <span>{meta}</span>
            <IconChevronRight size={16} className="chev" />
          </span>
        ) : null}
      </Link>
    </li>
  );
}
