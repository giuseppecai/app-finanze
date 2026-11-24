import { Link } from 'react-router-dom';
import { routes } from '../app/routes';
import { formatEuro } from '../domain/money';
import { potsTotal, type PotLine } from '../domain/pots';
import type { Cents } from '../domain/types';
import { it } from '../i18n/it';
import { IconChevronRight } from './icons';
import { Tile } from './Symbol';
import { symbolFor } from '../domain/symbols';

type Props = { lines: readonly PotLine[]; loansOwed: Cents; debtsOwed?: Cents; /** righe che aprono una pagina (es. Bollette) */ links?: Readonly<Record<string, string>>; /** nota sotto il nome (es. "2 da registrare") */ hints?: Readonly<Record<string, string | null>> };

/** Tonalità lilla: Risparmi la più scura, gli altri salvadanai alternano due lilla più chiari. */
function toneOf(id: string, index: number): 'save-1' | 'save-2' | 'save-3' {
  if (id === 'savings') return 'save-1';
  return index % 2 === 1 ? 'save-2' : 'save-3';
}
const tone = (id: string, index: number) => `var(--${toneOf(id, index)})`;

/** "Messi da parte": area lilla con totale nel titolo, barra divisa per salvadanaio, elenco, prestiti da riavere. */
export function PotsCard({ lines, loansOwed, debtsOwed = 0, links = {}, hints = {} }: Props) {
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
          {lines.map((p, i) => {
            const inner = (
              <>
                <span className="k">
                  <Tile symbol={symbolFor(p)} tone={toneOf(p.id, i)} size="sm" />
                  <span>{p.name}{hints[p.id] ? <small className="srow__hint">{hints[p.id]}</small> : null}</span>
                </span>
                <span className={p.balance < 0 ? 'v is-over' : 'v'}>{formatEuro(p.balance)}{links[p.id] ? <IconChevronRight size={16} /> : null}</span>
              </>
            );
            return links[p.id] ? (
              <li key={p.id}><Link to={links[p.id]!} className="srow">{inner}</Link></li>
            ) : (
              <li key={p.id} className="srow">{inner}</li>
            );
          })}
          {loansOwed > 0 || debtsOwed > 0 ? (
            <li>
              <Link to={routes.loans} className="srow srow--link">
                <span className="k">
                  <Tile symbol="hand-coins" tone="neutral" size="sm" />
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
