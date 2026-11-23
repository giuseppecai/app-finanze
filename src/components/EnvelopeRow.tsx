import { Link } from 'react-router-dom';
import { barFill, barState, type EnvelopeBalance } from '../domain/envelopes';
import { formatEuro } from '../domain/money';
import { it } from '../i18n/it';

type Props = { balance: EnvelopeBalance; to: string; /** riga dentro un riquadro unico (Impegnate) */ plain?: boolean };

/** Riga di una busta: nome, residuo, "di € tetto" (o "oltre il tetto"), barra colorata secondo R3. */
export function EnvelopeRow({ balance, to, plain = false }: Props) {
  const state = barState(balance);
  const over = balance.remaining < 0;
  return (
    <li>
      <Link to={to} className={plain ? 'envelope-row envelope-row--plain' : 'envelope-row'}>
        <span className="envelope-row__top">
          <span className="envelope-row__name">{balance.envelope.name}</span>
          <span className="envelope-row__amounts">
            <span className={over ? 'envelope-row__amount is-over' : state === 'empty' ? 'envelope-row__amount is-empty' : 'envelope-row__amount'}>
              {formatEuro(balance.remaining)}
            </span>
            <span className="envelope-row__label">
              {over ? it.home.overCap : it.home.ofCap(formatEuro(balance.put))}
            </span>
          </span>
        </span>
        <span className="bar" aria-hidden="true">
          <span className={`bar__fill bar__fill--${state}`} style={{ width: `${barFill(balance) * 100}%` }} />
        </span>
      </Link>
    </li>
  );
}
