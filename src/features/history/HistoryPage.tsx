import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CapSuggestionCard } from '../../components/CapSuggestionCard';
import { db } from '../../db/database';
import { keepCap } from '../../db/repositories';
import { capKeptHides, recentClosedIds } from '../../domain/insights';
import { ImpulseCard, IntentionCard, WhenCard, WholeMonth } from './MonthInsights';
import { useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { IconArrowUp, IconCalendar, IconTrendingDown } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { Tile } from '../../components/Symbol';
import { today } from '../../domain/clock';
import { addDays, diffDays, formatShortDate, formatShortRange } from '../../domain/dates';
import { summarizePeriod } from '../../domain/envelopes';
import { formatEuro } from '../../domain/money';
import { calendarPeriodById } from '../../domain/periods';
import { capSuggestion, cumulativeSpending, monthPace, recentHistory, roundToEuro, whereItWent, type HistoryPeriod } from '../../domain/stats';
import { symbolFor } from '../../domain/symbols';
import type { Envelope, Period } from '../../domain/types';
import { it } from '../../i18n/it';

const monthName = (id: string) => it.months.long[Number(id.slice(5, 7)) - 1] ?? id;
const monthShort = (id: string) => {
  const s = it.months.short[Number(id.slice(5, 7)) - 1] ?? id;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Txs = Parameters<typeof cumulativeSpending>[0];

/**
 * Storico (redesign v2): il racconto del mese. Scelta del mese, card "Speso a novembre" con la spesa
 * cumulata confrontata con il mese prima, "Dove sono andati", ultimi 6 mesi, consiglio sul tetto.
 */
export function HistoryPage() {
  const periods = usePeriods();
  const envelopes = useEnvelopes();
  const settings = useSettings();
  const current = useCurrentPeriod();
  const txs = usePeriodTransactions(current?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  /** buste per cui si è appena scelto "Tieni": restano visibili con le spese più grandi */
  const [keptNow, setKeptNow] = useState<string[]>([]);

  // Movimenti del mese scelto e del mese prima (per la curva e il confronto)
  const ids = (periods ?? []).map((p) => p.id).sort();
  const selId = selected ?? current?.id ?? ids[ids.length - 1] ?? null;
  const prevId = selId ? ids[ids.indexOf(selId) - 1] ?? null : null;
  const selTxs = usePeriodTransactions(selId);
  const prevTxs = usePeriodTransactions(prevId);

  if (!periods || !envelopes || !settings || current === undefined || !txs || !selTxs || !prevTxs) return null;

  const now = today();
  let header = <PageHeader title={it.history.title} />;
  if (current) {
    const days = diffDays(current.calendarStart, current.calendarEnd) + 1;
    const day = Math.min(days, diffDays(current.calendarStart, now) + 1);
    header = (
      <PageHeader
        title={it.history.title}
        chip={{ icon: <IconCalendar />, text: it.history.dayOf(day, days) }}
        muted={formatShortRange(current.calendarStart, current.calendarEnd)}
      />
    );
  }

  const order = envelopes.map((e) => e.id);
  const currentData = current ? { period: current, balances: summarizePeriod(envelopes, current, txs).balances } : null;
  const history = recentHistory(periods, order, currentData);
  if (history.length === 0) {
    return (
      <>
        {header}
        <p className="placeholder">{it.history.empty}</p>
      </>
    );
  }

  const sel = history.find((h) => h.periodId === selId) ?? history[history.length - 1]!;
  const selPeriod = periods.find((p) => p.id === sel.periodId)!;
  const envById = new Map(envelopes.map((e) => [e.id, e]));
  const lastClosed = recentClosedIds(periods, 3);
  const suggestions = envelopes
    .filter((e) => !e.archived)
    .map((e) => ({ envelope: e, s: capSuggestion(e, periods) }))
    .filter((x) => x.s !== null && x.envelope.cap < x.s.suggestedCap && (keptNow.includes(x.envelope.id) || !capKeptHides(settings.capKept, x.envelope.id, lastClosed[0] ?? null)));
  const trend = history.map((h) => periods.find((p) => p.id === h.periodId)!).filter(Boolean);

  return (
    <>
      {header}

      <div className="segmented month-seg" role="radiogroup" aria-label={it.history.chooseMonth}>
        {history.map((h) => (
          <button
            key={h.periodId}
            type="button"
            role="radio"
            aria-checked={h.periodId === sel.periodId}
            className="segmented__option"
            onClick={() => setSelected(h.periodId)}
          >
            {monthShort(h.periodId)}
          </button>
        ))}
      </div>

      <PaceCard sel={sel} period={selPeriod} txs={selTxs} prevId={prevId} prevTxs={prevTxs} history={history} now={now} />

      <section className="sec" aria-labelledby="where-title">
        <div className="sec-head">
          <h2 id="where-title">{it.history.whereTitle}</h2>
          <span className="sec-tag">{formatEuro(sel.spent)}</span>
        </div>
        <WhereList sel={sel} envById={envById} />
      </section>

      <ImpulseCard txs={selTxs} spent={sel.spent} envById={envById} />

      <WholeMonth period={selPeriod} trend={trend} items={settings.monthlyItems} />

      <WhenCard txs={selTxs} />

      <IntentionCard period={selPeriod} />

      <section className="sec" aria-labelledby="months-title">
        <div className="sec-head">
          <h2 id="months-title">{it.history.lastMonths}</h2>
          <span className="sec-tag">{it.history.tapMonth}</span>
        </div>
        <MonthsChart history={history} selected={sel} onSelect={setSelected} />
      </section>

      {suggestions.map(({ envelope, s }) =>
        s ? (
          <CapSuggestionCard
            key={envelope.id}
            envelope={envelope}
            suggestion={s}
            periodIds={lastClosed}
            // Un solo modo per cambiare un tetto: il pannello di Imposta, con il tetto suggerito già scritto
            raise={
              <Link to={`${routes.settings}?busta=${encodeURIComponent(envelope.id)}&tetto=${s.suggestedCap}`} className="insight__action insight__action--primary">
                {it.history.raiseCap(formatEuro(s.suggestedCap))}
              </Link>
            }
            onKeep={() => {
              setKeptNow((k) => [...k, envelope.id]);
              if (lastClosed[0]) void keepCap(db, envelope.id, lastClosed[0]);
            }}
          />
        ) : null,
      )}
    </>
  );
}

type PaceProps = {
  sel: HistoryPeriod;
  period: Period;
  txs: Txs;
  prevId: string | null;
  prevTxs: Txs;
  history: HistoryPeriod[];
  now: string;
};

/** Card scura "Speso a novembre": totale, confronto con il mese prima, curva cumulata, tre numeri. */
function PaceCard({ sel, period, txs, prevId, prevTxs, history, now }: PaceProps) {
  const days = diffDays(period.calendarStart, period.calendarEnd) + 1;
  const day = sel.inProgress ? Math.min(days, diffDays(period.calendarStart, now) + 1) : days;
  const curve = cumulativeSpending(txs, period.calendarStart, days).slice(0, day);
  const prevPeriod = prevId ? calendarPeriodById(prevId, Number(period.calendarStart.slice(8, 10))) : null;
  const prevDays = prevPeriod ? diffDays(prevPeriod.calendarStart, prevPeriod.calendarEnd) + 1 : 0;
  const prevCurve = prevPeriod && prevTxs.some((t) => t.envelopeId !== null) ? cumulativeSpending(prevTxs, prevPeriod.calendarStart, prevDays) : null;
  const closedSpent = history.filter((h) => !h.inProgress).map((h) => h.spent);
  const pace = monthPace({ spent: sel.spent, day, days, previous: prevCurve, closedSpent });
  const prevName = prevId ? monthName(prevId) : '';
  const [whole, cents] = formatEuro(sel.spent, { decimals: 'always' }).split(',');

  return (
    <section className="hero pace-card" aria-label={it.history.spentIn(monthName(sel.periodId))}>
      <p className="hero-label">{it.history.spentIn(monthName(sel.periodId))}</p>
      <p className="hero-amount pace-card__amount">
        {whole}<span className="cents">,{cents}</span>
        <span className="pace-card__of"> {it.history.of(formatEuro(sel.capsTotal))}</span>
      </p>
      {pace.diff !== null ? (
        <span className={pace.diff <= 0 ? 'good-chip' : 'good-chip good-chip--more'}>
          {pace.diff <= 0 ? <IconTrendingDown size={14} /> : <IconArrowUp size={14} />}
          {pace.diff <= 0
            ? it.history.lessThan(formatEuro(-pace.diff), prevName, sel.inProgress)
            : it.history.moreThan(formatEuro(pace.diff), prevName, sel.inProgress)}
        </span>
      ) : null}

      <PaceChart curve={curve} prev={prevCurve} days={days} budget={sel.capsTotal} start={period.calendarStart}
        names={{ cur: it.history.sameDay(monthName(sel.periodId)), prev: it.history.sameDay(prevName) }} />

      <div className="stats">
        <div><span className="k">{it.history.sameDay(prevName)}</span><span className="v">{pace.previousSameDay === null ? '—' : formatEuro(roundToEuro(pace.previousSameDay))}</span></div>
        <div><span className="k">{it.history.perDay}</span><span className="v">{formatEuro(pace.perDay)}</span></div>
        <div><span className="k">{it.history.average6}</span><span className="v">{pace.average === null ? '—' : formatEuro(roundToEuro(pace.average))}</span></div>
      </div>
    </section>
  );
}

/** Curva a gradini della spesa cumulata (lilla, con velo), mese prima tratteggiato, linea del budget. */
function PaceChart({ curve, prev, days, budget, start, names }: {
  curve: number[]; prev: number[] | null; days: number; budget: number; start: string; names: { cur: string; prev: string };
}) {
  const W = 320;
  const H = 150;
  const top = 18;
  const bottom = 126;
  const max = Math.max(budget, ...curve, ...(prev ?? [0])) * 1.06 || 1;
  const x = (i: number) => (days <= 1 ? 0 : (i / (days - 1)) * W);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const steps = (c: number[]) => c.map((v, i) => (i === 0 ? `M0 ${y(v)}` : `H${x(i)} V${y(v)}`)).join(' ');
  const end = curve.length - 1;
  const mid = Math.floor((days - 1) / 2);
  const prevEnd = prev ? prev[Math.min(prev.length, days) - 1] ?? 0 : 0;
  return (
    <svg className="pace" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={it.history.paceLabel(names.cur)}>
      <line x1="0" x2={W} y1={y(budget)} y2={y(budget)} stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      <text className="lbl" x="0" y={y(budget) - 6}>{it.history.budgetLabel(formatEuro(budget))}</text>
      {prev ? <path d={steps(prev.slice(0, days))} fill="none" stroke="#8C84A0" strokeWidth="1.6" strokeDasharray="4 4" /> : null}
      {prev ? <text className="lbl" x={W} y={y(prevEnd) - 6} textAnchor="end">{names.prev}</text> : null}
      {end >= 0 ? (
        <>
          <path d={`${steps(curve)} V${bottom} H0 Z`} fill="rgba(201,181,234,.14)" />
          <path d={steps(curve)} fill="none" stroke="#C9B5EA" strokeWidth="2.2" />
          <circle cx={x(end)} cy={y(curve[end]!)} r="4" fill="#C9B5EA" />
          <text className="lbl strong" x={x(end) > W - 70 ? x(end) - 8 : x(end) + 8} y={y(curve[end]!) - 8} textAnchor={x(end) > W - 70 ? 'end' : 'start'}>{names.cur}</text>
        </>
      ) : null}
      <line x1="0" x2={W} y1={bottom} y2={bottom} stroke="rgba(255,255,255,.12)" strokeWidth="1" />
      <text className="lbl" x="0" y={H - 4}>{formatShortDate(start)}</text>
      <text className="lbl" x={x(mid)} y={H - 4} textAnchor="middle">{formatShortDate(addDays(start, mid))}</text>
      <text className="lbl" x={W} y={H - 4} textAnchor="end">{formatShortDate(addDays(start, days - 1))}</text>
    </svg>
  );
}

/** "Dove sono andati": buste dalla più spesa, barra di QUOTA (sottile, viola medio, senza binario). */
function WhereList({ sel, envById }: { sel: HistoryPeriod; envById: Map<string, Envelope> }) {
  const rows = whereItWent(sel.rows);
  if (rows.length === 0) return <p className="placeholder">{it.history.nothingSpent}</p>;
  return (
    <ul className="card cats">
      {rows.map((r) => {
        const e = envById.get(r.envelopeId);
        const over = r.final < 0;
        return (
          <li key={r.envelopeId}>
            <Link to={`${routes.movements}?busta=${encodeURIComponent(r.envelopeId)}&periodo=${sel.periodId}`} className="cat">
              <Tile symbol={e ? symbolFor(e) : 'tag'} />
              <span className="cat-body">
                <span className="cat-top">
                  <span className="cat-n">{e?.name ?? '—'}</span>
                  <span className={over ? 'cat-v over' : 'cat-v'}>{formatEuro(r.spent)}</span>
                </span>
                <span className={e?.kind === 'committed' ? 'cat-bar is-committed' : 'cat-bar'} aria-hidden="true"><i style={{ width: `${r.scale * 100}%` }} /></span>
                <span className="cat-sub">
                  <span>
                    {over ? <span className="over-t">{it.history.overBy(formatEuro(-r.final))}</span> : it.history.leftShort(formatEuro(r.final))}
                    {' · '}{it.history.putShort(formatEuro(r.put))}
                  </span>
                  <span>{Math.round(r.share * 100)}%</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Ultimi 6 mesi: colonne con la linea del budget; il valore solo sul mese scelto e su quelli sopra il budget. */
function MonthsChart({ history, selected, onSelect }: { history: HistoryPeriod[]; selected: HistoryPeriod; onSelect: (id: string) => void }) {
  const budget = history[history.length - 1]!.capsTotal;
  const max = Math.max(budget, ...history.map((h) => h.spent)) * 1.15 || 1;
  const pct = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <section className="card chart" aria-label={it.history.chartLabel}>
      <div className="chart__plot">
        <div className="chart__budget" style={{ bottom: pct(budget) }} aria-hidden="true"><span>{it.history.budgetLabel(formatEuro(budget))}</span></div>
        {history.map((h) => {
          const isSel = h.periodId === selected.periodId;
          const cls = ['chart__bar', h.overBudget ? 'is-over' : '', isSel ? 'is-selected' : '', h.inProgress ? 'is-current' : ''].join(' ');
          return (
            <button
              key={h.periodId}
              type="button"
              className="chart__col"
              aria-pressed={isSel}
              aria-label={it.history.barLabel(monthName(h.periodId), formatEuro(h.spent), h.inProgress, h.overBudget)}
              onClick={() => onSelect(h.periodId)}
            >
              {isSel || h.overBudget ? <span className={h.overBudget ? 'chart__value is-over' : 'chart__value'}>{formatEuro(roundToEuro(h.spent))}</span> : null}
              <span className={cls} style={{ height: pct(h.spent) }} />
            </button>
          );
        })}
      </div>
      <div className="chart__labels" aria-hidden="true">
        {history.map((h) => (
          <span key={h.periodId} className={h.periodId === selected.periodId ? 'is-selected' : ''}>{monthShort(h.periodId)}</span>
        ))}
      </div>
      <div className="chart__legend">
        <span><span className="chart__legend-box chart__legend-box--selected" aria-hidden="true" />{it.history.selectedLegend}</span>
        <span><span className="chart__legend-box" aria-hidden="true" />{it.history.overBudget}</span>
        <span><span className="chart__legend-box chart__legend-box--current" aria-hidden="true" />{it.history.inProgressLegend}</span>
      </div>
    </section>
  );
}
