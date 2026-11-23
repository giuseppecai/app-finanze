import { Link } from 'react-router-dom';
import { routes } from '../app/routes';
import { formatEuro } from '../domain/money';
import { potsTotal, type PotLine } from '../domain/pots';
import type { Cents } from '../domain/types';
import { it } from '../i18n/it';
import { IconChevronRight, IconHandCoins } from './icons';

type Props = { lines: readonly PotLine[]; loansOwed: Cents; debtsOwed?: Cents };

/** Tonalità lilla: Risparmi la più scura, gli altri salvadanai alternano due lilla più chiari. */
function tone(id: string, index: number): string {
  if (id === 'savings') return 'var(--save-1)';
  return index % 2 === 1 ? 'var(--save-2)' : 'var(--save-3)';
}

/** "Messi da parte": area lilla con totale nel titolo, barra divisa per salvadanaio, elenco, prestiti da riavere. */
export function PotsCard({ lines, loansOwed, debtsOwed = 0 }: Props) {
  const total = potsTotal(lines);
  const positive = lines.reduce((s, p) => s + Math.max(p.balance, 0), 0);
  return (
    <section className="sec" aria-labelledby="pots-title">
      <div className="sec-head">
        <h2 id="pots-title">{it.home.savedAside}</h2>
        <span className="sec-total">{formatEuro(total)}</span>
      </div>
      <div className="save">
        <div className="save-split" role="img" aria-label={lines.map((p) => `${p.name} ${formatEuro(p.balance)}`).join(', ')}>
          {lines.map((p, i) => (
            <i key={p.id} style={{ flexGrow: positive > 0 ? Math.max(p.balance, 0) : 1, background: tone(p.id, i) }} />
          ))}
        </div>
        <ul className="save-list">
          {lines.map((p, i) => (
            <li key={p.id} className="srow">
              <span className="k"><span className="sw" style={{ background: tone(p.id, i) }} aria-hidden="true" />{p.name}</span>
              <span className={p.balance < 0 ? 'v is-over' : 'v'}>{formatEuro(p.balance)}</span>
            </li>
          ))}
          {loansOwed > 0 || debtsOwed > 0 ? (
            <li>
              <Link to={routes.loans} className="srow srow--link">
                <span className="k">
                  <IconHandCoins size={18} />
                  {it.home.loansToGet}{debtsOwed > 0 ? ` · ${it.home.youOwe(formatEuro(debtsOwed))}` : ''}
                </span>
                <span className="v">{formatEuro(loansOwed)}<IconChevronRight size={16} /></span>
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
