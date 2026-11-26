import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, useRecurring } from '../../app/data';
import { routes } from '../../app/routes';
import { CapSuggestionCard } from '../../components/CapSuggestionCard';
import { InfoBox } from '../../components/InfoBox';
import { MonthHeader } from '../../components/MonthHeader';
import { OptionList } from '../../components/OptionList';
import { StepIndicator } from '../../components/StepIndicator';
import { TopBar } from '../../components/TopBar';
import { db } from '../../db/database';
import { setEnvelopeCaps } from '../../db/repositories';
import { planClosing, type ClosingOption } from '../../domain/closing';
import { formatLongRange, nextMonthId } from '../../domain/dates';
import { INTENTION_MAX, recentClosedIds } from '../../domain/insights';
import { formatEuro } from '../../domain/money';
import { closingPreview, suggestionsAtClosing } from '../../domain/monthEnd';
import type { Envelope, IntentionOutcome, Period, Recurring, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';

export function ClosingPage() {
  const period = useCurrentPeriod();
  const envelopes = useEnvelopes();
  const periods = usePeriods();
  const recurring = useRecurring();
  const txs = usePeriodTransactions(period?.id ?? null);
  if (period === undefined || !envelopes || !periods || !recurring || !txs) return null;
  if (!period) {
    return (
      <>
        <TopBar />
        <div className="placeholder">
          <p>{it.closing.noPeriod}</p>
          <Link to={routes.home} className="text-link">{it.home.envelopes} →</Link>
        </div>
      </>
    );
  }
  return <Closing period={period} envelopes={envelopes} periods={periods} recurring={recurring} txs={txs} />;
}

type Props = { period: Period; envelopes: Envelope[]; periods: Period[]; recurring: Recurring[]; txs: Transaction[] };

function signed(cents: number): string {
  return formatEuro(cents, { sign: 'always' });
}

function Closing({ period, envelopes, periods, recurring, txs }: Props) {
  const navigate = useNavigate();
  const [option, setOption] = useState<ClosingOption>('toSavings');
  const [raised, setRaised] = useState<string[]>([]);
  /** R25: buste per cui si tiene il tetto (si salva quando il mese si chiude davvero) */
  const [kept, setKept] = useState<string[]>([]);
  /** R24: com'è andato il proposito di questo mese e quello per il mese nuovo */
  const [outcome, setOutcome] = useState<IntentionOutcome | null>(null);
  const [intention, setIntention] = useState('');

  const preview = closingPreview(envelopes, period, txs, recurring);
  const plan = planClosing(preview.leftovers, preview.unassigned, option);
  const half = planClosing(preview.leftovers, preview.unassigned, 'half');
  const net = plan.net;
  const suggestions = suggestionsAtClosing(envelopes, periods, period, preview.leftovers);
  const month = period.name.toLowerCase();
  const nextMonth = it.months.long[Number(nextMonthId(period.id).slice(5, 7)) - 1] ?? '';
  const keepPeriods = [period.id, ...recentClosedIds(periods.filter((p) => p.id !== period.id), 2)];

  function next() {
    const q = new URLSearchParams({ scelta: net > 0 ? option : 'toSavings' });
    if (intention.trim()) q.set('proposito', intention.trim());
    if (outcome) q.set('esito', outcome);
    if (kept.length > 0) q.set('tieni', kept.join(','));
    navigate(`${routes.opening}?${q.toString()}`);
  }

  async function raiseCap(envelope: Envelope, cap: number) {
    await setEnvelopeCaps(db, { [envelope.id]: cap });
    setRaised((r) => [...r, envelope.id]);
  }

  return (
    <div className="flow">
      <MonthHeader title={it.closing.title(month)} subtitle={formatLongRange(period.calendarStart, period.calendarEnd)} />
      <StepIndicator steps={it.monthSteps.items} current={1} label={it.monthSteps.label} />

      {period.intention ? (
        <section className="card intention-check" aria-label={it.insights.intentionCheckLabel}>
          <p className="intention-check__text">{it.insights.intentionCheck(month, period.intention)}</p>
          <div className="segmented" role="radiogroup" aria-label={it.insights.intentionCheckLabel}>
            {(['done', 'partly', 'no'] as const).map((o) => (
              <button key={o} type="button" role="radio" aria-checked={outcome === o} className="segmented__option" onClick={() => setOutcome(outcome === o ? null : o)}>
                {it.insights.outcomes[o]}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card summary-card" aria-labelledby="how-it-went">
        <div className="summary-card__head">
          <h2 id="how-it-went" className="section-title">{it.closing.howItWent}</h2>
          <span className={net < 0 ? 'summary-card__total is-over' : 'summary-card__total'}>
            {net < 0 ? it.closing.overTotal(formatEuro(-net)) : it.closing.leftoverTotal(signed(net))}
          </span>
        </div>
        <ul className="summary-card__list">
          {preview.summary.balances.map((b) => (
            <li key={b.envelope.id}>
              <span>{b.envelope.name}</span>
              <span className={b.remaining < 0 ? 'summary-card__value is-over' : 'summary-card__value'}>{signed(b.remaining)}</span>
            </li>
          ))}
          {preview.unassigned !== 0 ? (
            <li>
              <span>{it.closing.unassigned}</span>
              <span className="summary-card__value">{signed(preview.unassigned)}</span>
            </li>
          ) : null}
        </ul>
        {preview.pending.length > 0 ? (
          <p className="summary-card__note">
            {it.closing.pending(preview.pending.map((p) => `${p.recurring.name} (${formatEuro(p.recurring.amount)})`).join(', '))}
          </p>
        ) : null}
      </section>

      {net > 0 ? (
        <OptionList
          legend={it.closing.question(formatEuro(net))}
          value={option}
          onChange={setOption}
          options={[
            { value: 'toSavings', title: it.closing.options.toSavings, detail: it.closing.toSavingsDetail(formatEuro(net)) },
            { value: 'carryOver', title: it.closing.options.carryOver, detail: it.closing.carryOverDetail },
            {
              value: 'half',
              title: it.closing.options.half,
              detail: it.closing.halfDetail(formatEuro(half.savingsDelta), formatEuro(half.nextUnassigned)),
            },
          ]}
        />
      ) : net < 0 ? (
        <InfoBox tone="warning">
          <p><strong>{it.closing.deficit(formatEuro(-net))}</strong></p>
          <p>{it.closing.deficitTransfer(formatEuro(-net))}</p>
        </InfoBox>
      ) : (
        <InfoBox>{it.closing.evenTitle}</InfoBox>
      )}

      {suggestions.map((s) => {
        const envelope = envelopes.find((e) => e.id === s.envelopeId);
        if (!envelope) return null;
        if (raised.includes(envelope.id)) {
          return <InfoBox key={s.envelopeId}>{it.closing.capRaised(envelope.name, formatEuro(envelope.cap))}</InfoBox>;
        }
        if (envelope.cap >= s.suggestedCap) return null;
        return (
          <CapSuggestionCard
            key={s.envelopeId}
            envelope={envelope}
            suggestion={s}
            periodIds={keepPeriods}
            raise={
              <button type="button" className="insight__action" onClick={() => void raiseCap(envelope, s.suggestedCap)}>
                {it.closing.raiseCap(formatEuro(s.suggestedCap))}
              </button>
            }
            onKeep={() => setKept((k) => (k.includes(envelope.id) ? k : [...k, envelope.id]))}
          />
        );
      })}

      <section className="card intention-field">
        <label htmlFor="intention" className="intention-field__label">{it.insights.intentionQuestion(nextMonth)}</label>
        <input
          id="intention"
          className="text-input"
          type="text"
          value={intention}
          maxLength={INTENTION_MAX}
          placeholder={it.insights.intentionPlaceholder}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setIntention(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        />
        <p className="intention-field__hint">{it.insights.intentionHint}</p>
      </section>

      <div className="flow__spacer" />
      <button type="button" className="primary-button" onClick={next}>
        {it.closing.continue}
      </button>
    </div>
  );
}
