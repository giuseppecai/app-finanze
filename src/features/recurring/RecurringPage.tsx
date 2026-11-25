import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { IconArrowRight, IconCalendar, IconPlus } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { TopBar } from '../../components/TopBar';
import { PageHeader } from '../../components/PageHeader';
import { today } from '../../domain/clock';
import { formatShortRange, monthsBetween, parseISODate } from '../../domain/dates';
import { formatEuro } from '../../domain/money';
import { calendarPeriodFor, nextOpeningId } from '../../domain/periods';
import {
  frequencyOf, mainRecurringEnvelope, paidFromFund, periodTotal, recurringQuota, recurringQuotaTotal, recurringRows, type RecurringRow, type RecurringStatus, nextUpcomingCharge,
} from '../../domain/recurring';
import type { Recurring } from '../../domain/types';
import { ScheduleRow } from '../../components/ScheduleRow';
import { it } from '../../i18n/it';
import { RecurringSheet } from './RecurringSheet';

function statusLabel(status: RecurringStatus, now: string): string {
  switch (status.kind) {
    case 'charged':
      return it.recurring.status.charged;
    case 'paused':
      return it.recurring.status.paused;
    case 'none':
      return it.recurring.status.none;
    case 'later':
      return it.recurring.status.later(monthsBetween(now.slice(0, 7), status.date.slice(0, 7)));
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
  const periods = usePeriods();
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null);
  if (!recurring || !envelopes || period === undefined || !txs || !settings || !periods) return null;

  const now = today();
  // Senza un mese aperto mostra comunque il periodo di calendario di oggi (senza movimenti).
  const range = period ?? { ...calendarPeriodFor(now, settings.periodStartDay) };
  const rows = recurringRows(recurring, range, period ? txs : [], now);
  const mainId = mainRecurringEnvelope(recurring) ?? envelopes.find((e) => e.kind === 'committed')?.id ?? envelopes[0]?.id ?? '';
  const envelope = envelopes.find((e) => e.id === mainId);
  const cap = envelope ? (period?.allocations[envelope.id] ?? envelope.cap) : 0;
  // Il totale del mese comprende gli annuali/bimestrali che cadono in questo periodo (si scalano per intero).
  const total = periodTotal(rows, range.id);
  const hasNonMonthlyNow = rows.some((r) => r.recurring.active && r.date !== null && frequencyOf(r.recurring) > 1 && !paidFromFund(r.recurring, range.id));
  // Accantonati (R15): quanto va nella Pocket Bollette al prossimo "Inizio del mese".
  const opening = nextOpeningId(periods, now, settings.periodStartDay);
  const savedQuota = recurringQuotaTotal(recurring, opening, settings.periodStartDay);
  const margin = cap - total;
  const next = period ? nextUpcomingCharge(rows) : null;
  const thisMonth = rows.filter((r) => r.date !== null);
  const later = rows.filter((r) => r.date === null);
  const showChip = (r: RecurringRow) => !!period || r.status.kind === 'paused' || r.status.kind === 'later';

  const renderRows = (list: RecurringRow[]) => (
    <ul className="card movement-list">
      {list.map((row) => {
        const { recurring: r, shownDate, status } = row;
        const { d, m } = parseISODate(shownDate);
        return (
          <li key={r.id}>
            <ScheduleRow
              boxTop={String(d)}
              boxBottom={it.months.short[m - 1]}
              title={r.name}
              detail={it.recurring.detail(it.cards[r.card], it.recurring.frequency[frequencyOf(r)] ?? '')}
              detail2={frequencyOf(r) > 1 && r.active ? (r.saving
                ? it.saving.savedRow(formatEuro(recurringQuota(r, r.saveFrom && r.saveFrom > opening ? r.saveFrom : opening, settings.periodStartDay)), formatEuro(r.fund ?? 0))
                : it.saving.lumpRow) : null}
              amount={formatEuro(r.amount)}
              paused={!r.active}
              chip={showChip(row) ? <span className={`chip chip--${status.kind}`}>{statusLabel(status, now)}</span> : null}
              ariaLabel={it.recurring.editLabel(r.name)}
              onClick={() => setEditing(r)}
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flow">
      <TopBar right={<button type="button" className="pill-button" onClick={() => setEditing('new')}><IconPlus size={20} />{it.common.add}</button>} />
      <PageHeader
        full
        title={it.recurring.title}
        chip={next ? { icon: <IconCalendar />, text: it.recurring.nextChip(next.recurring.name, next.status.inDays <= 0 ? it.recurring.status.today : next.status.inDays === 1 ? it.recurring.status.tomorrow : it.recurring.status.inDays(next.status.inDays)) } : null}
      />

      <section className="hero">
        <div className="hero__row">
          <div>
            <p className="hero__label">{hasNonMonthlyNow ? it.recurring.periodTotal : it.recurring.monthly}</p>
            <p className="hero__amount hero__amount--medium">{formatEuro(total)}</p>
            {savedQuota > 0 ? <p className="hero__sub">{it.recurring.savedHero(formatEuro(savedQuota))}</p> : null}
          </div>
          {envelope ? <span className="hero__status">{it.recurring.envelopeCap(formatEuro(cap))}</span> : null}
        </div>
        {envelope ? (
          <>
            <span className="hero__bar" aria-hidden="true">
              {/* barra = quanto RESTA nella busta (come tutte le barre delle buste) */}
              <span className={margin < 0 ? 'hero__bar-fill is-over' : 'hero__bar-fill'} style={{ width: `${margin < 0 ? 100 : cap > 0 ? (margin / cap) * 100 : 0}%` }} />
            </span>
            <div className="hero-foot">
              <span>{margin >= 0 ? it.recurring.margin(formatEuro(margin, { decimals: 'always' })) : it.recurring.overflow(formatEuro(-margin, { decimals: 'always' }))}</span>
              <Link to={routes.settings} className="hero-link">{it.recurring.changeCap}<IconArrowRight size={18} /></Link>
            </div>
          </>
        ) : null}
      </section>

      <section className="recurring-list-section">
        <h2 className="group-label">{it.recurring.thisMonth} · {formatShortRange(range.calendarStart, range.calendarEnd)}</h2>
        {rows.length === 0 ? <p className="placeholder">{it.recurring.empty}</p> : thisMonth.length > 0 ? renderRows(thisMonth) : null}
      </section>

      {later.length > 0 ? (
        <section className="recurring-list-section">
          <h2 className="group-label">{it.recurring.later}</h2>
          {renderRows(later)}
        </section>
      ) : null}

      <div className="flow__spacer" />
      <InfoBox>{it.recurring.note}</InfoBox>

      <RecurringSheet
        target={editing}
        defaultEnvelopeId={mainId}
        opening={opening}
        periodStartDay={settings.periodStartDay}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
