import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, useLastReconciliation, useLoans, usePeriods, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { EnvelopeRow } from '../../components/EnvelopeRow';
import { IconCalendar, IconCompare } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { PotsCard } from '../../components/PotsCard';
import { billsAsEnvelope, billsToRegister } from '../../domain/bills';
import { today } from '../../domain/clock';
import { formatShortRange } from '../../domain/dates';
import { summarizePeriod, type EnvelopeBalance } from '../../domain/envelopes';
import { totalDebt, totalOwed } from '../../domain/loans';
import { potLines } from '../../domain/pots';
import { formatEuro } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import { daysUntilSalary, isTimeToClose } from '../../domain/periods';
import { nextUpcomingCharge, recurringRows } from '../../domain/recurring';
import type { Bill, Envelope, Period } from '../../domain/types';
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
      {period ? <CurrentPeriod period={period} envelopes={envelopes} cardReserve={settings.cardReserve} billsRow={billsRow} bills={bills} /> : <NoPeriod />}
      <PotsCard lines={lines} loansOwed={totalOwed(loans)} debtsOwed={totalDebt(loans)} />
    </>
  );
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

function CurrentPeriod({ period, envelopes, cardReserve, billsRow, bills }: { period: Period; envelopes: Envelope[]; cardReserve: number | null; billsRow: EnvelopeBalance | null; bills: Bill[] }) {
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

  // Righe di contesto delle Impegnate: il prossimo addebito e le bollette ancora da registrare.
  const next = nextUpcomingCharge(recurringRows(recurring, period, txs, now));
  const recurringMeta = next
    ? it.home.nextCharge(next.recurring.name, formatEuro(next.recurring.amount), next.status.inDays <= 0 ? it.recurring.status.today : next.status.inDays === 1 ? it.recurring.status.tomorrow : it.recurring.status.inDays(next.status.inDays))
    : recurring.some((r) => r.active) ? it.home.allCharged : null;
  const monthlyBills = bills.filter((b) => b.active && b.frequency === 1).length;
  const toRegister = billsToRegister(bills, txs).length;
  const billsMeta = monthlyBills === 0 ? null : toRegister > 0 ? it.home.billsToRegister(toRegister) : it.home.billsAllRegistered;

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

      <section className="sec" aria-labelledby="spendable-title">
        <SectionHead id="spendable-title" title={it.home.envelopes} tag={it.home.envelopesTag} />
        <ul className="env-list">
          {spendable.map((b) => <EnvelopeRow key={b.envelope.id} balance={b} to={envelopeLink(b.envelope, recurringEnvelopes)} />)}
        </ul>
      </section>

      {committed.length > 0 || billsRow ? (
        <section className="sec" aria-labelledby="committed-title">
          <SectionHead id="committed-title" title={it.home.committed} tag={it.home.committedTag} />
          <ul className="committed">
            {committed.map((b) => (
              <EnvelopeRow
                key={b.envelope.id}
                balance={b}
                to={envelopeLink(b.envelope, recurringEnvelopes)}
                committed
                meta={recurringEnvelopes.has(b.envelope.id) ? recurringMeta : null}
              />
            ))}
            {/* Bollette: la Pocket letta come una busta impegnata (stesso aspetto), apre le bollette */}
            {billsRow ? <EnvelopeRow balance={billsRow} to={routes.bills} committed meta={billsMeta} /> : null}
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
