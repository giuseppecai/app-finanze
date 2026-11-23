import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, useLastReconciliation, useLoans, usePeriods, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { EnvelopeRow } from '../../components/EnvelopeRow';
import { IconCompare } from '../../components/icons';
import { PotsCard } from '../../components/PotsCard';
import { billsAsEnvelope } from '../../domain/bills';
import { today } from '../../domain/clock';
import { formatShortRange } from '../../domain/dates';
import { summarizePeriod, type EnvelopeBalance } from '../../domain/envelopes';
import { totalDebt, totalOwed } from '../../domain/loans';
import { potLines } from '../../domain/pots';
import { formatEuro } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import { daysUntilSalary, isTimeToClose } from '../../domain/periods';
import type { Envelope, Period } from '../../domain/types';
import { it } from '../../i18n/it';
import { BackupReminder } from './BackupReminder';
import { ReconcileSheet } from './ReconcileSheet';

/** Rate & Abbonamenti apre Abbonamenti, le altre (Casa & Servizi compresa) i Movimenti filtrati. */
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
  const periods = usePeriods();
  const bills = useBills();
  if (period === undefined || !envelopes || !pots || !loans || !settings || !periods || !bills) return null;
  // Bollette sta tra le Impegnate (spese fisse), non tra i soldi messi da parte.
  const lines = potLines(pots, settings.monthlyItems).filter((l) => l.id !== 'bills');
  const billsBalance = pots.find((p) => p.id === 'bills')?.balance ?? 0;
  const billsRow = bills.some((b) => b.active) || billsBalance !== 0 ? billsAsEnvelope(bills, billsBalance) : null;
  // Primo avvio: prima la configurazione in 3 passi.
  if (!settings.onboardingDone && !period) return <Navigate to={routes.onboarding} replace />;

  return (
    <>
      <BackupReminder settings={settings} periods={periods} />
      {period ? <CurrentPeriod period={period} envelopes={envelopes} cardReserve={settings.cardReserve} billsRow={billsRow} /> : <NoPeriod />}
      <PotsCard lines={lines} loansOwed={totalOwed(loans)} debtsOwed={totalDebt(loans)} />
    </>
  );
}

/** Intestazione di sezione della Home: titolo, importo a destra, una riga di spiegazione. */
function SectionHead({ id, title, meta, caption }: { id: string; title: string; meta?: string; caption?: string }) {
  return (
    <div className="home-section__head">
      <div className="home-section__titles">
        <h2 id={id} className="home-section__title">{title}</h2>
        {caption ? <p className="home-section__caption">{caption}</p> : null}
      </div>
      {meta ? <span className="home-section__meta">{meta}</span> : null}
    </div>
  );
}

function NoPeriod() {
  return (
    <>
      <header className="home-header">
        <h1 className="screen-title">{it.appName}</h1>
      </header>
      <section className="hero">
        <p className="hero__label">{it.home.noPeriodTitle}</p>
        <p className="hero__text">{it.home.noPeriodText}</p>
        <Link to={routes.opening} className="hero__link">{it.home.noPeriodAction}</Link>
      </section>
    </>
  );
}

function CurrentPeriod({ period, envelopes, cardReserve, billsRow }: { period: Period; envelopes: Envelope[]; cardReserve: number | null; billsRow: EnvelopeBalance | null }) {
  const [reconcileOpen, setReconcileOpen] = useState(false);
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
      </header>

      <section className="hero" aria-label={it.home.canSpend}>
        <p className="hero__label">{it.home.canSpend}</p>
        <div className="hero__row">
          <p className={summary.spendable < 0 ? 'hero__amount is-over' : 'hero__amount'}>{formatEuro(summary.spendable)}</p>
          <button type="button" className="hero__pill" onClick={() => setReconcileOpen(true)}>
            <IconCompare />
            {it.reconcile.open}
          </button>
        </div>
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

      <section className="home-section" aria-labelledby="spendable-title">
        <SectionHead id="spendable-title" title={it.home.envelopes} caption={it.home.envelopesCaption} />
        <ul className="envelope-list">
          {spendable.map((b) => <EnvelopeRow key={b.envelope.id} balance={b} to={envelopeLink(b.envelope, recurringEnvelopes)} />)}
        </ul>
      </section>

      {committed.length > 0 || billsRow ? (
        <section className="home-section" aria-labelledby="committed-title">
          <SectionHead id="committed-title" title={it.home.committed} caption={it.home.committedCaption} />
          <ul className="card envelope-group">
            {committed.map((b) => <EnvelopeRow key={b.envelope.id} balance={b} to={envelopeLink(b.envelope, recurringEnvelopes)} plain />)}
            {/* Bollette: la Pocket letta come una busta impegnata (stesso aspetto), apre le bollette */}
            {billsRow ? <EnvelopeRow balance={billsRow} to={routes.bills} plain /> : null}
          </ul>
        </section>
      ) : null}

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
