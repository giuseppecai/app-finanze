// M10 · Le sezioni dello Storico che spiegano il mese: tutto lo stipendio (R18, R21), spese d'impulso
// (R22), quando spendi (R20), proposito (R24).
import { Tile } from '../../components/Symbol';
import { impulseSummary, monthSavings, weekdaySpending } from '../../domain/insights';
import { formatEuro } from '../../domain/money';
import { roundToEuro } from '../../domain/stats';
import type { Envelope, MonthlyItem, Period, SalarySplit, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';

const monthName = (id: string) => it.months.long[Number(id.slice(5, 7)) - 1] ?? id;
const monthShort = (id: string) => {
  const s = it.months.short[Number(id.slice(5, 7)) - 1] ?? id;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Ordine e colore delle cinque parti: prima quello che esce, per ultimo quello che resta tuo. */
const PARTS: { key: keyof SalarySplit; color: string }[] = [
  { key: 'payments', color: 'var(--committed)' },
  { key: 'fixed', color: 'var(--save-3)' },
  { key: 'pots', color: 'var(--save-2)' },
  { key: 'envelopes', color: 'var(--accent)' },
  { key: 'savings', color: 'var(--money-in)' },
];

const signed = (cents: number) => formatEuro(cents, { sign: 'always' });

/** R18 · Tutto lo stipendio: barra divisa in cinque parti, risparmiato e % sullo stipendio, andamento. */
export function WholeMonth({ period, trend, items }: { period: Period; trend: Period[]; items: readonly MonthlyItem[] }) {
  if (period.salary <= 0) return null;
  const m = monthSavings(period, items);
  const closing = m.saved - m.split.savings;
  const share = (v: number) => Math.max(0, v) / period.salary;
  const month = monthName(period.id);
  const rates = trend.map((p) => ({ id: p.id, rate: monthSavings(p, items).rate ?? 0, open: p.closedAt === null }));
  const maxRate = Math.max(10, ...rates.map((r) => r.rate));

  return (
    <section className="sec" aria-labelledby="whole-title">
      <div className="sec-head">
        <h2 id="whole-title">{it.insights.wholeTitle}</h2>
        <span className="sec-tag">{it.insights.wholeTag(formatEuro(period.salary))}</span>
      </div>
      <div className="card whole">
        <div className="whole__bar" role="img" aria-label={it.insights.wholeLabel(month)}>
          {PARTS.map((p) => (share(m.split[p.key]) > 0 ? <i key={p.key} style={{ flexGrow: share(m.split[p.key]), background: p.color }} /> : null))}
        </div>
        <ul className="whole__legend">
          {PARTS.filter((p) => m.split[p.key] !== 0 || p.key === 'savings').map((p) => {
            const v = m.split[p.key];
            return (
              <li key={p.key}>
                <span className="whole__key"><span className="whole__sw" style={{ background: p.color }} aria-hidden="true" />{it.insights.parts[p.key]}</span>
                <span className={v < 0 ? 'whole__value is-over' : 'whole__value'}>
                  {formatEuro(roundToEuro(v))}
                  <span className="whole__pct">{Math.round(share(v) * 100)}%</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className={m.saved < 0 ? 'whole__saved is-over' : m.saved === 0 ? 'whole__saved is-zero' : 'whole__saved'}>
          <div className="whole__saved-body">
            <p className="whole__saved-k">{it.insights.savedLabel}</p>
            <p className="whole__saved-main">{m.saved === 0 ? it.insights.savedNothing : formatEuro(m.saved)}</p>
            <p className="whole__saved-note">
              {period.closedAt === null
                ? it.insights.savedInProgress
                : closing !== 0
                  ? it.insights.savedClosing(signed(closing))
                  : null}
            </p>
          </div>
          {m.rate !== null && m.saved !== 0 ? (
            <p className="whole__rate">
              <span className="whole__rate-v">{m.rate}%</span>
              <span className="whole__rate-k">{it.insights.ofSalary}</span>
            </p>
          ) : null}
        </div>
        {m.goal > 0 ? (
          <p className={m.goalReached ? 'whole__goal is-reached' : 'whole__goal'}>
            {it.insights.goal(formatEuro(m.goal), formatEuro(m.split.savings))} · <strong>{m.goalReached ? it.insights.goalReached : it.insights.goalMissed}</strong>
          </p>
        ) : null}

        {rates.length > 1 ? (
          <div className="rate-trend" aria-label={it.insights.rateTrend}>
            <p className="rate-trend__title">{it.insights.rateTrend}</p>
            <ul className="rate-trend__bars">
              {rates.map((r) => (
                <li key={r.id} className={r.id === period.id ? 'is-selected' : ''} aria-label={it.insights.rateBar(monthName(r.id), `${r.rate}%`)}>
                  <span className={r.rate < 0 ? 'rate-trend__value is-over' : 'rate-trend__value'}>{r.rate}%</span>
                  <span className={r.open ? 'rate-trend__bar is-open' : 'rate-trend__bar'} style={{ height: `${(Math.max(0, r.rate) / maxRate) * 100}%` }} />
                  <span className="rate-trend__label">{monthShort(r.id)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** R22 · D'impulso: quanto, che quota della spesa, in quale busta soprattutto. */
export function ImpulseCard({ txs, spent, envById }: { txs: Transaction[]; spent: number; envById: Map<string, Envelope> }) {
  const s = impulseSummary(txs, spent);
  if (!s) return null;
  const top = s.top ? envById.get(s.top.envelopeId) : undefined;
  return (
    <div className="insight sec">
      <Tile symbol="zap" />
      <div className="insight__body">
        <p className="insight__title">{it.insights.impulseTitle}</p>
        <p className="insight__text">
          {it.insights.impulseText(formatEuro(s.total), s.share)}
          {top && s.top ? `, ${it.insights.impulseTop(top.name, formatEuro(s.top.amount))}` : ''}
        </p>
      </div>
    </div>
  );
}

/** R20 · Quando spendi: barre lunedì → domenica del mese scelto, il giorno più caro in evidenza. */
export function WhenCard({ txs }: { txs: Transaction[] }) {
  const w = weekdaySpending(txs);
  if (w.activeDays < 7 || w.top === null || w.total <= 0) return null;
  const max = Math.max(...w.days);
  const topShare = Math.round((w.days[w.top]! * 100) / w.total);
  return (
    <section className="sec" aria-labelledby="when-title">
      <div className="sec-head">
        <h2 id="when-title">{it.insights.whenTitle}</h2>
      </div>
      <div className="card when">
        <p className="when__text">{it.insights.whenTop(it.insights.weekdaysLong[w.top]!, formatEuro(roundToEuro(w.days[w.top]!)), topShare)}</p>
        <ul className="when__bars" aria-label={it.insights.whenLabel}>
          {w.days.map((v, i) => (
            <li key={i} className={i === w.top ? 'is-top' : ''} aria-label={`${it.insights.weekdaysShort[i]}: ${formatEuro(v)}`}>
              <span className="when__bar" style={{ height: `${(Math.max(0, v) / max) * 100}%` }} />
              <span className="when__label">{it.insights.weekdaysShort[i]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** R24 · Il proposito del mese e com'è andata. */
export function IntentionCard({ period }: { period: Period }) {
  if (!period.intention) return null;
  return (
    <div className="card intention-card intention-card--row sec">
      <Tile symbol="star" tone="save-1" size="sm" />
      <span>
        <span className="intention-card__label">{it.insights.intentionOf(monthName(period.id))}</span>
        <span className="intention-card__text">{period.intention}</span>
      </span>
      {period.intentionOutcome ? (
        <span className={`outcome-chip outcome-chip--${period.intentionOutcome}`}>{it.insights.outcomes[period.intentionOutcome]}</span>
      ) : null}
    </div>
  );
}
