import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentPeriod, useEnvelopes, usePeriodTransactions, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { InfoBox } from '../../components/InfoBox';
import { TopBar } from '../../components/TopBar';
import { today } from '../../domain/clock';
import { formatShortRange, parseISODate } from '../../domain/dates';
import { formatEuro } from '../../domain/money';
import { calendarPeriodFor } from '../../domain/periods';
import { mainRecurringEnvelope, monthlyTotal, recurringRows, type RecurringStatus } from '../../domain/recurring';
import type { Recurring } from '../../domain/types';
import { it } from '../../i18n/it';
import { RecurringSheet } from './RecurringSheet';

function statusLabel(status: RecurringStatus): string {
  switch (status.kind) {
    case 'charged':
      return it.recurring.status.charged;
    case 'paused':
      return it.recurring.status.paused;
    case 'none':
      return it.recurring.status.none;
    case 'upcoming':
      return status.inDays <= 0 ? it.recurring.status.today : status.inDays === 1 ? it.recurring.status.tomorrow : it.recurring.status.inDays(status.inDays);
  }
}

export function RecurringPage() {
  const recurring = useRecurring();
  const envelopes = useEnvelopes();
  const period = useCurrentPeriod();
  const txs = usePeriodTransactions(period?.id ?? null);
  const settings = useSettings();
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null);
  if (!recurring || !envelopes || period === undefined || !txs || !settings) return null;

  const now = today();
  // Senza un mese aperto mostra comunque il periodo di calendario di oggi (senza movimenti).
  const range = period ?? { ...calendarPeriodFor(now, settings.periodStartDay) };
  const rows = recurringRows(recurring, range, period ? txs : [], now);
  const mainId = mainRecurringEnvelope(recurring) ?? envelopes.find((e) => e.kind === 'committed')?.id ?? envelopes[0]?.id ?? '';
  const envelope = envelopes.find((e) => e.id === mainId);
  const cap = envelope ? (period?.allocations[envelope.id] ?? envelope.cap) : 0;
  const total = monthlyTotal(recurring);
  const margin = cap - total;

  return (
    <div className="flow">
      <TopBar right={<button type="button" className="pill-button" onClick={() => setEditing('new')}>{it.recurring.add}</button>} />
      <header className="screen-header">
        <h1 className="screen-title">{it.recurring.title}</h1>
        {envelope ? <p className="screen-subtitle">{it.recurring.subtitle(envelope.name)}</p> : null}
      </header>

      <section className="hero">
        <div className="hero__row">
          <div>
            <p className="hero__label">{it.recurring.monthly}</p>
            <p className="hero__amount hero__amount--medium">{formatEuro(total, { decimals: 'always' })}</p>
          </div>
          {envelope ? <span className="hero__status">{it.recurring.envelopeCap(formatEuro(cap))}</span> : null}
        </div>
        {envelope ? (
          <>
            <span className="hero__bar" aria-hidden="true">
              <span className={margin < 0 ? 'hero__bar-fill is-over' : 'hero__bar-fill'} style={{ width: `${cap > 0 ? Math.min(100, (total / cap) * 100) : 100}%` }} />
            </span>
            <Link to={routes.settings} className="hero__link">
              {margin >= 0 ? it.recurring.margin(formatEuro(margin, { decimals: 'always' })) : it.recurring.overflow(formatEuro(-margin, { decimals: 'always' }))}
            </Link>
          </>
        ) : null}
      </section>

      <section className="recurring-list-section">
        <div className="section-head">
          <h2 className="section-title">{it.recurring.thisMonth}</h2>
          <span className="summary-card__note">{formatShortRange(range.calendarStart, range.calendarEnd)} · {it.recurring.tapToEdit}</span>
        </div>
        {rows.length === 0 ? (
          <p className="placeholder">{it.recurring.empty}</p>
        ) : (
          <ul className="card movement-list">
            {rows.map(({ recurring: r, date, status }) => {
              const past = status.kind === 'charged';
              const { d, m } = date ? parseISODate(date) : { d: r.dayOfMonth, m: 0 };
              return (
                <li key={r.id}>
                  <button type="button" className="recurring-row" aria-label={it.recurring.editLabel(r.name)} onClick={() => setEditing(r)}>
                    <span className={past ? 'date-box is-past' : 'date-box'} aria-hidden="true">
                      <span className="date-box__day">{d}</span>
                      {m ? <span className="date-box__month">{it.months.short[m - 1]}</span> : null}
                    </span>
                    <span className="movement__text">
                      <span className={r.active ? 'movement__title' : 'movement__title is-muted'}>{r.name}</span>
                      <span className="movement__detail">{it.recurring.detail(it.cards[r.card], r.dayOfMonth)}</span>
                    </span>
                    <span className="recurring-row__right">
                      <span className={r.active ? 'movement__amount' : 'movement__amount is-paused'}>{formatEuro(r.amount, { decimals: 'always' })}</span>
                      {period || status.kind === 'paused' ? <span className={`chip chip--${status.kind}`}>{statusLabel(status)}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flow__spacer" />
      <InfoBox>{it.recurring.note}</InfoBox>

      <RecurringSheet target={editing} defaultEnvelopeId={mainId} onClose={() => setEditing(null)} />
    </div>
  );
}
