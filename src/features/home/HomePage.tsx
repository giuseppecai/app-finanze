import { Link, Navigate } from 'react-router-dom';
import { useCurrentPeriod, useEnvelopes, useLastReconciliation, useLoans, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { EnvelopeRow } from '../../components/EnvelopeRow';
import { IconSliders } from '../../components/icons';
import { PotsCard } from '../../components/PotsCard';
import { today } from '../../domain/clock';
import { formatShortRange } from '../../domain/dates';
import { summarizePeriod } from '../../domain/envelopes';
import { totalOwed } from '../../domain/loans';
import { formatEuro } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import { daysUntilSalary, isTimeToClose } from '../../domain/periods';
import type { Envelope, Period } from '../../domain/types';
import { it } from '../../i18n/it';

/** Rate & Abbonamenti (la busta degli abbonamenti) apre Abbonamenti, le altre i Movimenti filtrati. */
function envelopeLink(envelope: Envelope, recurringEnvelopes: ReadonlySet<string>): string {
  if (envelope.kind === 'committed' && recurringEnvelopes.has(envelope.id)) return routes.recurring;
  return `${routes.movements}?busta=${encodeURIComponent(envelope.id)}`;
}

export function HomePage() {
  const period = useCurrentPeriod();
  const envelopes = useEnvelopes();
  const pots = usePots();
  const loans = useLoans();
  const settings = useSettings();
  if (period === undefined || !envelopes || !pots || !loans || !settings) return null;
  // Primo avvio: prima la configurazione in 3 passi.
  if (!settings.onboardingDone && !period) return <Navigate to={routes.onboarding} replace />;

  return (
    <>
      {period ? <CurrentPeriod period={period} envelopes={envelopes} /> : <NoPeriod />}
      <PotsCard pots={pots} loansOwed={totalOwed(loans)} />
    </>
  );
}

function SettingsLink() {
  return (
    <Link to={routes.settings} className="icon-button" aria-label={it.home.settings}>
      <IconSliders />
    </Link>
  );
}

function NoPeriod() {
  return (
    <>
      <header className="home-header">
        <h1 className="screen-title">{it.appName}</h1>
        <SettingsLink />
      </header>
      <section className="hero">
        <p className="hero__label">{it.home.noPeriodTitle}</p>
        <p className="hero__text">{it.home.noPeriodText}</p>
        <Link to={routes.opening} className="hero__link">{it.home.noPeriodAction}</Link>
      </section>
    </>
  );
}

function CurrentPeriod({ period, envelopes }: { period: Period; envelopes: Envelope[] }) {
  const txs = usePeriodTransactions(period.id);
  const lastReconciliation = useLastReconciliation();
  const recurring = useRecurring();
  if (!txs || lastReconciliation === undefined || !recurring) return null;
  const recurringEnvelopes = new Set(recurring.map((r) => r.envelopeId));

  const now = today();
  const summary = summarizePeriod(envelopes, period, txs);
  const spendable = summary.balances.filter((b) => b.envelope.kind === 'spendable');
  const committed = summary.balances.filter((b) => b.envelope.kind === 'committed');
  const timeToClose = isTimeToClose(period, now);

  return (
    <>
      <header className="home-header">
        <div className="screen-header">
          <h1 className="screen-title">{period.name}</h1>
          <p className="screen-subtitle">
            {it.home.salaryIn(daysUntilSalary(period, now))} · {formatShortRange(period.calendarStart, period.calendarEnd)}
          </p>
        </div>
        <SettingsLink />
      </header>

      <section className="hero" aria-label={it.home.canSpend}>
        <p className="hero__label">{it.home.canSpend}</p>
        <p className={summary.spendable < 0 ? 'hero__amount is-over' : 'hero__amount'}>{formatEuro(summary.spendable)}</p>
        {timeToClose ? (
          <Link to={routes.closing} className="hero__link">{it.home.closeMonth}</Link>
        ) : (
          <p className="hero__status">
            {lastReconciliation
              ? it.home.lastReconcile(it.relativeDays(daysAgo(lastReconciliation.date, now)))
              : it.home.neverReconciled}
          </p>
        )}
      </section>

      <div className="section-head">
        <h2 className="section-title">{it.home.envelopes}</h2>
        <Link to={routes.settings} className="section-head__link">{it.home.edit}</Link>
      </div>
      <ul className="envelope-list">
        {spendable.map((b) => <EnvelopeRow key={b.envelope.id} balance={b} to={envelopeLink(b.envelope, recurringEnvelopes)} />)}
      </ul>

      {committed.length > 0 ? (
        <>
          <div className="section-head section-head--muted">
            <span>{it.home.committed}</span>
            <span>{it.home.committedLeft(formatEuro(summary.committedRemaining))}</span>
          </div>
          <ul className="envelope-list">
            {committed.map((b) => <EnvelopeRow key={b.envelope.id} balance={b} to={envelopeLink(b.envelope, recurringEnvelopes)} />)}
          </ul>
        </>
      ) : null}
    </>
  );
}
