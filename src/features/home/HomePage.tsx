import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, useLastReconciliation, useLoans, usePeriods, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { EnvelopeRow } from '../../components/EnvelopeRow';
import { IconCalendar, IconCompare } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { PotsCard } from '../../components/PotsCard';
import { billsToRegister } from '../../domain/bills';
import { today } from '../../domain/clock';
import { formatShortRange } from '../../domain/dates';
import { summarizePeriod } from '../../domain/envelopes';
import { totalDebt, totalOwed } from '../../domain/loans';
import { potLines, type PotLine } from '../../domain/pots';
import { formatEuro } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import { daysUntilSalary, isTimeToClose } from '../../domain/periods';
import { nextUpcomingCharge, recurringRows } from '../../domain/recurring';
import type { Bill, Envelope, Period } from '../../domain/types';
import { it } from '../../i18n/it';
import { BackupReminder } from './BackupReminder';
import { ReconcileSheet } from './ReconcileSheet';

/** Ogni busta apre i Movimenti filtrati. */
function envelopeLink(envelope: Envelope): string {
  return `${routes.movements}?busta=${encodeURIComponent(envelope.id)}`;
}

export function HomePage() {
  const period = useCurrentPeriod();
  const envelopes = useEnvelopes();
  const pots = usePots();
  const loans = useLoans();
  const settings = useSettings();
  const periods = usePeriods();
  const bills = useBills();
  if (period === undefined || !envelopes || !pots || !loans || !settings || !periods || !bills) return null;
  // Due soli concetti: le buste (soldi del Budget del mese) e le Pocket (soldi messi da parte, Bollette compresa).
  const lines = potLines(pots, settings.monthlyItems);
  // Primo avvio: prima la configurazione in 3 passi.
  if (!settings.onboardingDone && !period) return <Navigate to={routes.onboarding} replace />;

  return (
    <>
      <BackupReminder settings={settings} periods={periods} />
      {period ? <CurrentPeriod period={period} envelopes={envelopes} cardReserve={settings.cardReserve} /> : <NoPeriod />}
      <PotsSection period={period} lines={lines} bills={bills} loansOwed={totalOwed(loans)} debtsOwed={totalDebt(loans)} />
    </>
  );
}

/**
 * "Messi da parte": Risparmi, salvadanai e Spese fisse (apre le spese fisse: bollette da registrare,
 * altrimenti il prossimo addebito automatico).
 */
function PotsSection({ period, lines, bills, loansOwed, debtsOwed }: { period: Period | null; lines: PotLine[]; bills: Bill[]; loansOwed: number; debtsOwed: number }) {
  const txs = usePeriodTransactions(period?.id ?? null);
  const recurring = useRecurring();
  if (!txs || !recurring) return null;
  const toRegister = billsToRegister(bills, txs).length;
  const next = period ? nextUpcomingCharge(recurringRows(recurring, period, txs, today())) : null;
  const hint = !period
    ? null
    : toRegister > 0
      ? it.home.billsToRegister(toRegister)
      : next
        ? it.home.nextCharge(next.recurring.name, formatEuro(next.recurring.amount), next.status.inDays <= 0 ? it.recurring.status.today : next.status.inDays === 1 ? it.recurring.status.tomorrow : it.recurring.status.inDays(next.status.inDays))
        : bills.some((b) => b.active && b.frequency === 1) ? it.home.billsAllRegistered : null;
  return <PotsCard lines={lines} loansOwed={loansOwed} debtsOwed={debtsOwed} links={{ bills: routes.bills }} hints={{ bills: hint }} />;
}

/** Intestazione di sezione: titolo a sinistra, etichetta a destra ("quanto resta"). */
function SectionHead({ id, title, tag }: { id: string; title: string; tag?: string }) {
  return (
    <div className="sec-head">
      <h2 id={id}>{title}</h2>
      {tag ? <span className="sec-tag">{tag}</span> : null}
    </div>
  );
}

/** "€ 232,12" con i centesimi più piccoli, come nella card principale del redesign. */
function HeroAmount({ cents }: { cents: number }) {
  const text = formatEuro(cents, { decimals: 'always' });
  const [whole, dec] = text.split(',');
  return (
    <p className={cents < 0 ? 'hero-amount is-over' : 'hero-amount'}>
      {whole}<span className="cents">,{dec}</span>
    </p>
  );
}

function NoPeriod() {
  return (
    <>
      <PageHeader title={it.appName} />
      <section className="hero">
        <p className="hero-label">{it.home.noPeriodTitle}</p>
        <p className="hero-text">{it.home.noPeriodText}</p>
        <div className="hero-foot">
          <Link to={routes.opening} className="hero-link">{it.home.noPeriodAction}</Link>
        </div>
      </section>
    </>
  );
}

function CurrentPeriod({ period, envelopes, cardReserve }: { period: Period; envelopes: Envelope[]; cardReserve: number | null }) {
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const txs = usePeriodTransactions(period.id);
  const lastReconciliation = useLastReconciliation();
  if (!txs || lastReconciliation === undefined) return null;

  const now = today();
  const summary = summarizePeriod(envelopes, period, txs);
  const timeToClose = isTimeToClose(period, now);


  return (
    <>
      <PageHeader
        title={period.name}
        chip={{ icon: <IconCalendar />, text: it.home.salaryIn(daysUntilSalary(period, now)) }}
        muted={formatShortRange(period.calendarStart, period.calendarEnd)}
      />

      <section className="hero" aria-label={it.home.canSpend}>
        <p className="hero-label">{it.home.canSpend}</p>
        <HeroAmount cents={summary.spendable} />
        <button type="button" className="pill-btn" onClick={() => setReconcileOpen(true)}>
          <IconCompare />
          {it.reconcile.open}
        </button>
        <div className="hero-foot">
          {timeToClose ? (
            <Link to={routes.closing} className="hero-link">{it.home.closeMonth}</Link>
          ) : (
            <span>
              <span className={lastReconciliation ? 'dot' : 'dot dot--off'} aria-hidden="true" />
              {lastReconciliation
                ? it.home.lastReconcile(it.relativeDays(daysAgo(lastReconciliation.date, now)))
                : it.home.neverReconciled}
            </span>
          )}
        </div>
      </section>

      <section className="sec" aria-labelledby="envelopes-title">
        <SectionHead id="envelopes-title" title={it.home.envelopes} tag={it.home.envelopesTag} />
        <ul className="env-list">
          {summary.balances.map((b) => (
            <EnvelopeRow
              key={b.envelope.id}
              balance={b}
              to={envelopeLink(b.envelope)}
              meta={null}
            />
          ))}
        </ul>
      </section>

      <ReconcileSheet
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        period={period}
        envelopesTotal={summary.envelopesTotal}
        unassigned={summary.unassigned}
        cardReserve={cardReserve}
        last={lastReconciliation}
      />
    </>
  );
}
