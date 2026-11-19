import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { InfoBox } from '../../components/InfoBox';
import { ScreenHeader } from '../../components/ScreenHeader';
import { summarizePeriod } from '../../domain/envelopes';
import { formatEuro } from '../../domain/money';
import { capSuggestion, recentHistory, roundToEuro, type HistoryPeriod } from '../../domain/stats';
import { it } from '../../i18n/it';

export function HistoryPage() {
  const periods = usePeriods();
  const envelopes = useEnvelopes();
  const settings = useSettings();
  const current = useCurrentPeriod();
  const txs = usePeriodTransactions(current?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  if (!periods || !envelopes || !settings || current === undefined || !txs) return null;

  const startDay = settings.periodStartDay;
  const subtitle = it.history.subtitle(startDay, startDay === 1 ? 'fine mese' : String(startDay - 1));
  const order = envelopes.map((e) => e.id);
  const currentData = current ? { period: current, balances: summarizePeriod(envelopes, current, txs).balances } : null;
  const history = recentHistory(periods, order, currentData);

  if (history.length === 0) {
    return (
      <>
        <ScreenHeader title={it.history.title} subtitle={subtitle} />
        <p className="placeholder">{it.history.empty}</p>
      </>
    );
  }

  const sel = history.find((h) => h.periodId === selected) ?? history[history.length - 1]!;
  const names = new Map(envelopes.map((e) => [e.id, e.name]));
  const periodName = (id: string) => periods.find((p) => p.id === id)?.name ?? id;
  const suggestions = envelopes
    .filter((e) => !e.archived)
    .map((e) => ({ envelope: e, s: capSuggestion(e, periods) }))
    .filter((x) => x.s !== null && x.envelope.cap < x.s.suggestedCap);

  return (
    <>
      <ScreenHeader title={it.history.title} subtitle={subtitle} />
      <Chart history={history} selected={sel} onSelect={setSelected} periodName={periodName} />

      <section className="card history-table" aria-label={it.history.tableLabel}>
        <table>
          <thead>
            <tr>
              <th scope="col">{it.history.envelope}</th>
              <th scope="col">{it.history.put}</th>
              <th scope="col">{it.history.spent}</th>
              <th scope="col">{sel.inProgress ? it.history.left : it.history.leftover}</th>
            </tr>
          </thead>
          <tbody>
            {sel.rows.map((r) => (
              <tr key={r.envelopeId}>
                <th scope="row">{names.get(r.envelopeId) ?? '—'}</th>
                <td>{formatEuro(r.put)}</td>
                <td>{formatEuro(r.spent)}</td>
                <td className={r.final < 0 ? 'is-over' : ''}>{sel.inProgress ? formatEuro(r.final) : formatEuro(r.final, { sign: 'always' })}</td>
              </tr>
            ))}
            <tr className="history-table__total">
              <th scope="row">{it.history.total}</th>
              <td>{formatEuro(sel.rows.reduce((s, r) => s + r.put, 0))}</td>
              <td>{formatEuro(sel.spent)}</td>
              <td className={sel.final < 0 ? 'is-over' : 'is-good'}>{sel.inProgress ? formatEuro(sel.final) : formatEuro(sel.final, { sign: 'always' })}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {suggestions.map(({ envelope, s }) =>
        s ? (
          <InfoBox key={envelope.id} tone="warning">
            <p>
              <strong>{envelope.name}</strong> {it.history.suggestion(s.overMonths, s.months, formatEuro(roundToEuro(s.averageOver)), formatEuro(s.suggestedCap))}
            </p>
            <Link to={routes.settings} className="text-link warning-link">{it.history.editEnvelopes}</Link>
          </InfoBox>
        ) : null,
      )}
    </>
  );
}

type ChartProps = {
  history: HistoryPeriod[];
  selected: HistoryPeriod;
  onSelect: (id: string) => void;
  periodName: (id: string) => string;
};

/** Grafico a barre della spesa per periodo; linea tratteggiata = somma dei tetti. Le barre sono pulsanti. */
function Chart({ history, selected, onSelect, periodName }: ChartProps) {
  const budget = history[history.length - 1]!.capsTotal;
  const max = Math.max(budget, ...history.map((h) => h.spent)) * 1.1 || 1;
  const pct = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  const short = (id: string) => it.months.short[Number(id.slice(5, 7)) - 1] ?? id;

  return (
    <section className="card chart" aria-label={it.history.chartLabel}>
      <div className="chart__head">
        <span className="chart__name">{periodName(selected.periodId)}{selected.inProgress ? ` · ${it.history.inProgress}` : ''}</span>
        <span className="chart__value">
          {formatEuro(selected.spent)} <span className="chart__of">{it.history.of(formatEuro(selected.capsTotal))}</span>
        </span>
      </div>
      <div className="chart__plot">
        <div className="chart__budget" style={{ bottom: pct(budget) }} aria-hidden="true" />
        {history.map((h) => {
          const isSel = h.periodId === selected.periodId;
          const cls = ['chart__bar', h.overBudget ? 'is-over' : '', isSel ? 'is-selected' : '', h.inProgress ? 'is-current' : ''].join(' ');
          return (
            <button
              key={h.periodId}
              type="button"
              className="chart__col"
              aria-pressed={isSel}
              aria-label={it.history.barLabel(periodName(h.periodId), formatEuro(h.spent), h.inProgress, h.overBudget)}
              onClick={() => onSelect(h.periodId)}
            >
              <span className={cls} style={{ height: pct(h.spent) }} />
            </button>
          );
        })}
      </div>
      <div className="chart__labels" aria-hidden="true">
        {history.map((h) => (
          <span key={h.periodId} className={h.periodId === selected.periodId ? 'is-selected' : ''}>
            {short(h.periodId).charAt(0).toUpperCase() + short(h.periodId).slice(1)}
          </span>
        ))}
      </div>
      <div className="chart__legend">
        <span><span className="chart__legend-line" aria-hidden="true" />{it.history.budget(formatEuro(budget))}</span>
        <span><span className="chart__legend-box" aria-hidden="true" />{it.history.overBudget}</span>
      </div>
    </section>
  );
}
