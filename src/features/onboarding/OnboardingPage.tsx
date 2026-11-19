import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnvelopes, usePots, useRecurring } from '../../app/data';
import { routes } from '../../app/routes';
import { AmountField } from '../../components/AmountField';
import { IconShare } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { db } from '../../db/database';
import { newId, replaceRecurring, setPotBalances, updateSettings } from '../../db/repositories';
import { nowISO } from '../../domain/clock';
import { formatEuro, parseEuro } from '../../domain/money';
import { monthlyTotal } from '../../domain/recurring';
import type { Envelope, Pot, PotId, Recurring } from '../../domain/types';
import { it } from '../../i18n/it';
import { CapsEditor } from '../settings/CapsEditor';

/** Primo avvio: buste, abbonamenti, salvadanai; poi "Inizio del mese". */
export function OnboardingPage() {
  const envelopes = useEnvelopes();
  const recurring = useRecurring();
  const pots = usePots();
  const [step, setStep] = useState(0);
  if (!envelopes || !recurring || !pots) return null;

  return (
    <div className="flow">
      <p className="screen-subtitle">{it.onboarding.welcome}</p>
      <StepIndicator steps={it.onboarding.steps} current={step} label={it.onboarding.stepsLabel} />
      {step === 0 ? <EnvelopesStep envelopes={envelopes} onNext={() => setStep(1)} /> : null}
      {step === 1 ? <RecurringStep initial={recurring} envelopes={envelopes} onBack={() => setStep(0)} onNext={() => setStep(2)} /> : null}
      {step === 2 ? <PotsStep pots={pots} onBack={() => setStep(1)} /> : null}
    </div>
  );
}

function EnvelopesStep({ envelopes, onNext }: { envelopes: Envelope[]; onNext: () => void }) {
  return (
    <>
      <ScreenHeader title={it.onboarding.envelopesTitle} subtitle={it.onboarding.envelopesText} />
      <CapsEditor envelopes={envelopes} />
      <div className="flow__spacer" />
      <button type="button" className="primary-button" onClick={onNext}>{it.onboarding.next}</button>
    </>
  );
}

type RecurringDraft = { id: string; name: string; amount: string; dayOfMonth: number; active: boolean; base: Recurring | null };

function toDraft(r: Recurring): RecurringDraft {
  return { id: r.id, name: r.name, amount: formatEuro(r.amount, { decimals: 'always' }).replace('€ ', ''), dayOfMonth: r.dayOfMonth, active: r.active, base: r };
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function RecurringStep({ initial, envelopes, onBack, onNext }: { initial: Recurring[]; envelopes: Envelope[]; onBack: () => void; onNext: () => void }) {
  const [drafts, setDrafts] = useState<RecurringDraft[]>(() => initial.slice().sort((a, b) => a.dayOfMonth - b.dayOfMonth).map(toDraft));
  const [error, setError] = useState<string | null>(null);
  // Gli abbonamenti nuovi vanno nella busta degli abbonamenti (o nell'ultima impegnata).
  const defaultEnvelope = initial[0]?.envelopeId ?? envelopes.filter((e) => e.kind === 'committed').at(-1)?.id ?? envelopes[0]?.id ?? '';

  const update = (id: string, patch: Partial<RecurringDraft>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const parsed = drafts.map((d) => ({ d, amount: parseEuro(d.amount) }));
  const valid = parsed.every(({ d, amount }) => d.name.trim() !== '' && amount !== null && amount > 0);
  const total = monthlyTotal(parsed.map(({ d, amount }) => ({ ...(d.base ?? ({} as Recurring)), amount: amount ?? 0, active: d.active })));

  async function next() {
    if (!valid) {
      setError(it.onboarding.recurringInvalid);
      return;
    }
    const createdAt = nowISO();
    await replaceRecurring(
      db,
      parsed.map(({ d, amount }) => ({
        id: d.id,
        name: d.name.trim(),
        amount: amount ?? 0,
        dayOfMonth: d.dayOfMonth,
        active: d.active,
        envelopeId: d.base?.envelopeId ?? defaultEnvelope,
        card: d.base?.card ?? 'extra',
        createdAt: d.base?.createdAt ?? createdAt,
      })),
    );
    onNext();
  }

  return (
    <>
      <ScreenHeader title={it.onboarding.recurringTitle} subtitle={it.onboarding.recurringText} />
      <ul className="card edit-list">
        {drafts.map((d) => (
          <li key={d.id} className="rec-row">
            <div className="rec-row__head">
              <input
                className="text-input rec-row__name"
                aria-label={it.onboarding.recurringName}
                value={d.name}
                placeholder={it.onboarding.recurringNew}
                onChange={(e) => update(d.id, { name: e.target.value })}
              />
              <button type="button" className="rec-row__remove" onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}>
                {it.onboarding.recurringRemove}
              </button>
            </div>
            <div className="rec-row__fields">
              <AmountField id={`rec-amount-${d.id}`} label={it.onboarding.recurringAmount} value={d.amount} onChange={(v) => update(d.id, { amount: v })} />
              <div className="select-field">
                <label htmlFor={`rec-day-${d.id}`}>{it.onboarding.recurringDay}</label>
                <select id={`rec-day-${d.id}`} value={d.dayOfMonth} onChange={(e) => update(d.id, { dayOfMonth: Number(e.target.value) })}>
                  {DAYS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <label className="switch-row">
                <input type="checkbox" checked={d.active} onChange={(e) => update(d.id, { active: e.target.checked })} />
                {it.onboarding.recurringActive}
              </label>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="link-button"
        onClick={() => setDrafts((ds) => [...ds, { id: newId(), name: '', amount: '', dayOfMonth: 1, active: true, base: null }])}
      >
        {it.onboarding.recurringAdd}
      </button>
      <div className="card total-card">
        <span className="section-title">{it.onboarding.recurringTotal}</span>
        <span className="total-card__value">{formatEuro(total)}</span>
      </div>
      {error ? <InfoBox>{error}</InfoBox> : null}
      <div className="flow__spacer" />
      <button type="button" className="primary-button" onClick={() => void next()}>{it.onboarding.next}</button>
      <button type="button" className="quiet-button" onClick={onBack}>{it.onboarding.back}</button>
    </>
  );
}

const POTS: PotId[] = ['savings', 'travel', 'gifts'];

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function PotsStep({ pots, onBack }: { pots: Pot[]; onBack: () => void }) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<PotId, string>>(() => {
    const byId = new Map(pots.map((p) => [p.id, p.balance]));
    const text = (id: PotId) => {
      const b = byId.get(id) ?? 0;
      return b === 0 ? '' : formatEuro(b, { decimals: 'always' }).replace('€ ', '');
    };
    return { savings: text('savings'), travel: text('travel'), gifts: text('gifts') };
  });
  const [error, setError] = useState<string | null>(null);
  const parsed = POTS.map((id) => [id, values[id].trim() === '' ? 0 : parseEuro(values[id])] as const);
  const valid = parsed.every(([, v]) => v !== null);

  async function finish() {
    if (!valid) {
      setError(it.onboarding.potsInvalid);
      return;
    }
    await setPotBalances(db, Object.fromEntries(parsed) as Record<PotId, number>);
    await updateSettings(db, { onboardingDone: true });
    navigate(routes.opening, { replace: true });
  }

  return (
    <>
      <ScreenHeader title={it.onboarding.potsTitle} subtitle={it.onboarding.potsText} />
      <section className="card summary-card">
        {POTS.map((id) => (
          <AmountField
            key={id}
            id={`pot-${id}`}
            label={it.accounts[id]}
            placeholder="0"
            value={values[id]}
            onChange={(v) => setValues((s) => ({ ...s, [id]: v }))}
            invalid={values[id].trim() !== '' && parseEuro(values[id]) === null}
          />
        ))}
      </section>
      {!isStandalone() ? (
        <InfoBox>
          <p><strong>{it.onboarding.installTitle}</strong> <IconShare aria-hidden="true" /></p>
          <p>{it.onboarding.installText}</p>
        </InfoBox>
      ) : null}
      {error ? <InfoBox>{error}</InfoBox> : null}
      <div className="flow__spacer" />
      <button type="button" className="primary-button" onClick={() => void finish()}>{it.onboarding.finish}</button>
      <button type="button" className="quiet-button" onClick={onBack}>{it.onboarding.back}</button>
    </>
  );
}
