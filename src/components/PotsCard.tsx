import { Link } from 'react-router-dom';
import { routes } from '../app/routes';
import { formatEuro } from '../domain/money';
import { potsTotal, type PotLine } from '../domain/pots';
import type { Cents } from '../domain/types';
import { it } from '../i18n/it';
import { IconChevronRight } from './icons';

type Props = { lines: readonly PotLine[]; loansOwed: Cents; debtsOwed?: Cents };

/** Tonalità: Risparmi accento pieno, Bollette grigio (soldi già impegnati), gli altri salvadanai alternano due viola chiari. */
function tone(id: string, index: number): string {
  if (id === 'savings') return 'savings';
  if (id === 'bills') return 'bills';
  return index % 2 === 1 ? 'light' : 'mid';
}

/** "Messi da parte": totale dei salvadanai, barra in tonalità, legenda; Bollette apre le bollette. */
export function PotsCard({ lines, loansOwed, debtsOwed = 0 }: Props) {
  const total = potsTotal(lines);
  return (
    <section className="card pots" aria-labelledby="pots-title">
      <div className="pots__head">
        <h2 id="pots-title" className="section-title">{it.home.savedAside}</h2>
        <span className="pots__total">{formatEuro(total)}</span>
      </div>
      <div className="pots__bar" aria-hidden="true">
        {lines.map((p, i) => (
          <span key={p.id} className={`pots__segment pots__tone--${tone(p.id, i)}`} style={{ flexGrow: Math.max(p.balance, 0) || 0.0001 }} />
        ))}
      </div>
      <ul className="pots__legend">
        {lines.map((p, i) => {
          const body = (
            <>
              <span className="pots__name"><span className={`pots__dot pots__tone--${tone(p.id, i)}`} aria-hidden="true" /><span className="pots__label">{p.name}</span></span>
              <span className="pots__value">{formatEuro(p.balance)}</span>
            </>
          );
          return p.id === 'bills' ? (
            <li key={p.id}>
              <Link to={routes.bills} className="pots__item pots__item--link" aria-label={it.home.billsLink(formatEuro(p.balance))}>
                {body}
              </Link>
            </li>
          ) : (
            <li key={p.id} className="pots__item">{body}</li>
          );
        })}
      </ul>
      {loansOwed > 0 || debtsOwed > 0 ? (
        <Link to={routes.loans} className="pots__loans">
          <span>{it.home.loansToGet}{debtsOwed > 0 ? ` · ${it.home.youOwe(formatEuro(debtsOwed))}` : ''}</span>
          <span className="pots__loans-amount">{formatEuro(loansOwed)}<IconChevronRight /></span>
        </Link>
      ) : null}
    </section>
  );
}
