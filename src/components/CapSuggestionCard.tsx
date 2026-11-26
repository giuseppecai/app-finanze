import { useState, type ReactNode } from 'react';
import { useEnvelopeTransactions } from '../app/data';
import { formatShortDate } from '../domain/dates';
import { biggestExpenses } from '../domain/insights';
import { formatEuro } from '../domain/money';
import { roundToEuro, type CapSuggestion } from '../domain/stats';
import type { Envelope, PeriodId } from '../domain/types';
import { it } from '../i18n/it';
import { Tile } from './Symbol';

type Props = {
  envelope: Envelope;
  suggestion: CapSuggestion;
  /** periodi in cui cercare le spese più grandi (gli ultimi 3) */
  periodIds: PeriodId[];
  /** pulsante o link "Porta il tetto a € X" */
  raise: ReactNode;
  /** "Tieni € Y": salva la scelta (o la prepara per la chiusura) */
  onKeep: () => void;
};

/**
 * R25 · Una busta che sfora spesso: alzare il tetto, oppure tenerlo e vedere le spese più grandi
 * degli ultimi 3 mesi, cioè dove tagliare.
 */
export function CapSuggestionCard({ envelope, suggestion, periodIds, raise, onKeep }: Props) {
  const [kept, setKept] = useState(false);
  const txs = useEnvelopeTransactions(kept ? envelope.id : null);
  const big = txs ? biggestExpenses(txs, envelope.id, periodIds) : [];

  if (kept) {
    return (
      <div className="insight sec">
        <Tile symbol="lightbulb" />
        <div className="insight__body">
          <p className="insight__title">{it.insights.keepTitle(envelope.name)}</p>
          <p className="insight__text">{it.insights.keepText(formatEuro(roundToEuro(suggestion.averageOver)))}</p>
          {big.length === 0 ? (
            <p className="insight__text">{it.insights.keepNone}</p>
          ) : (
            <ul className="keep-list">
              {big.map((t) => (
                <li key={t.id}>
                  <span className="keep-list__name">{t.note || envelope.name}</span>
                  <span className="keep-list__date">{formatShortDate(t.date)}</span>
                  <span className="keep-list__amount">{formatEuro(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="insight__text">{it.insights.keepDone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insight sec">
      <Tile symbol="lightbulb" />
      <div className="insight__body">
        <p className="insight__title">{it.history.oftenOver(envelope.name)}</p>
        <p className="insight__text">
          {it.history.oftenOverText(suggestion.overMonths, suggestion.months, formatEuro(roundToEuro(suggestion.averageOver)), formatEuro(suggestion.suggestedCap))}
        </p>
        <div className="insight__actions">
          {raise}
          <button type="button" className="insight__action" onClick={() => { setKept(true); onKeep(); }}>
            {it.insights.keepCap(formatEuro(envelope.cap))}
          </button>
        </div>
      </div>
    </div>
  );
}
