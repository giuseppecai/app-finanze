import { Link } from 'react-router-dom';
import { routes } from '../app/routes';
import { formatEuro } from '../domain/money';
import type { Cents, Pot, PotId } from '../domain/types';
import { it } from '../i18n/it';
import { IconChevronRight } from './icons';

const ORDER: PotId[] = ['savings', 'travel', 'gifts', 'bills'];

type Props = { pots: readonly Pot[]; loansOwed: Cents; debtsOwed?: Cents };

/** "Messi da parte": totale dei salvadanai, barra in 3 tonalità, legenda, prestiti da riavere. */
export function PotsCard({ pots, loansOwed, debtsOwed = 0 }: Props) {
  const byId = new Map(pots.map((p) => [p.id, p]));
  // Bollette compare solo quando c'è qualcosa accantonato (R13).
  const list = ORDER.filter((id) => id !== 'bills' || (byId.get(id)?.balance ?? 0) !== 0)
    .map((id) => ({ id, balance: byId.get(id)?.balance ?? 0 }));
  const total = list.reduce((s, p) => s + p.balance, 0);
  return (
    <section className="card pots" aria-labelledby="pots-title">
      <div className="pots__head">
        <h2 id="pots-title" className="section-title">{it.home.savedAside}</h2>
        <span className="pots__total">{formatEuro(total)}</span>
      </div>
      <div className="pots__bar" aria-hidden="true">
        {list.map((p) => (
          <span key={p.id} className={`pots__segment pots__segment--${p.id}`} style={{ flexGrow: Math.max(p.balance, 0) || 0.0001 }} />
        ))}
      </div>
      <dl className="pots__legend">
        {list.map((p) => (
          <div key={p.id} className="pots__item">
            <dt><span className={`pots__dot pots__dot--${p.id}`} aria-hidden="true" />{it.home.pots[p.id]}</dt>
            <dd>{formatEuro(p.balance)}</dd>
          </div>
        ))}
      </dl>
      {loansOwed > 0 || debtsOwed > 0 ? (
        <Link to={routes.loans} className="pots__loans">
          <span>{it.home.loansToGet}{debtsOwed > 0 ? ` · ${it.home.youOwe(formatEuro(debtsOwed))}` : ''}</span>
          <span className="pots__loans-amount">{formatEuro(loansOwed)}<IconChevronRight /></span>
        </Link>
      ) : null}
    </section>
  );
}
