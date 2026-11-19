import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { AmountField } from '../../components/AmountField';
import { CheckRow } from '../../components/CheckRow';
import { InfoBox } from '../../components/InfoBox';
import { MonthHeader } from '../../components/MonthHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { db } from '../../db/database';
import { startPeriod } from '../../db/repositories';
import { today } from '../../domain/clock';
import { planClosing, type ClosingOption, type ClosingPlan } from '../../domain/closing';
import { formatLongRange } from '../../domain/dates';
import { formatEuro, parseEuro } from '../../domain/money';
import { closingPreview, transferChecklist, type ChecklistItem } from '../../domain/monthEnd';
import { activeEnvelopes, planOpening } from '../../domain/opening';
import { nextPeriodToStart } from '../../domain/periods';
import { billsQuotaTotal } from '../../domain/bills';
import type { Bill, Envelope, Period, Recurring, Settings, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';
import { CapsEditor } from '../settings/CapsEditor';

const OPTIONS: ClosingOption[] = ['toSavings', 'carryOver', 'half'];

export function OpeningPage() {
  const [params] = useSearchParams();
  const current = useCurrentPeriod();
  const periods = usePeriods();
  const envelopes = useEnvelopes();
  const settings = useSettings();
  const recurring = useRecurring();
  const txs = usePeriodTransactions(current?.id ?? null);
  const bills = useBills();
  if (current === undefined || !periods || !envelopes || !settings || !recurring || !txs || !bills) return null;

  const raw = params.get('scelta');
  const option = OPTIONS.find((o) => o === raw) ?? null;
  // C'è un mese aperto: prima si chiude (e si sceglie cosa fare dell'avanzo).
  if (current && !option) return <Navigate to={routes.closing} replace />;

  return (
    <Opening
      current={current}
      option={option ?? 'toSavings'}
      periods={periods}
      envelopes={envelopes}
      settings={settings}
      recurring={recurring}
      txs={txs}
      bills={bills}
    />
  );
}

type Props = {
  current: Period | null;
  option: ClosingOption;
  periods: Period[];
  envelopes: Envelope[];
  settings: Settings;
  recurring: Recurring[];
  txs: Transaction[];
  bills: Bill[];
};

function Opening({ current, option, periods, envelopes, settings, recurring, txs, bills }: Props) {
  const navigate = useNavigate();
  const now = today();
  const [salaryText, setSalaryText] = useState('');
  const [travelText, setTravelText] = useState(() => formatEuro(settings.lastTravelQuota, { decimals: 'always' }).replace('€ ', ''));
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [editCaps, setEditCaps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = periods.reduce<Period | null>((a, p) => (!a || p.id > a.id ? p : a), null);
  const target = nextPeriodToStart(last, now, settings.periodStartDay);
  const closing: ClosingPlan | null = current
    ? (() => {
        const preview = closingPreview(envelopes, current, txs, recurring);
        return planClosing(preview.leftovers, preview.unassigned, option);
      })()
    : null;

  const salary = parseEuro(salaryText);
  const travel = parseEuro(travelText);
  const salaryOk = salary !== null && salary > 0;
  const travelOk = travel !== null;
  const opening = planOpening(salary ?? 0, envelopes, travel ?? 0, settings.giftsQuota, billsQuotaTotal(bills));
  const items = transferChecklist(opening, closing);
  // La spunta vale per quell'importo: se l'importo cambia, la riga torna da fare.
  const keyOf = (i: ChecklistItem) => `${i.id}:${i.amount}`;
  const done = items.filter((i) => checked.has(keyOf(i))).length;
  const allDone = done === items.length;
  const canStart = allDone && salaryOk && travelOk && !saving;
  const closingMonth = current?.name.toLowerCase() ?? '';
  const names = activeEnvelopes(envelopes).map((e) => e.shortName).join(', ');

  function toggle(item: ChecklistItem, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(keyOf(item));
      else next.delete(keyOf(item));
      return next;
    });
  }

  function titleOf(item: ChecklistItem): string {
    if (item.id === 'closing') return `${it.accounts[item.from]} → ${it.accounts[item.to]}`;
    return `→ ${it.accounts[item.to]}`;
  }

  function noteOf(item: ChecklistItem): string {
    switch (item.id) {
      case 'closing':
        return item.to === 'savings' ? it.opening.notes.closingSurplus(closingMonth) : it.opening.notes.closingDeficit(closingMonth);
      case 'budget':
        return it.opening.notes.budget(names);
      case 'travel':
        return it.opening.notes.travel;
      case 'gifts':
        return it.opening.notes.gifts;
      case 'bills':
        return it.opening.notes.bills;
      case 'savings':
        return item.warn && salaryOk ? it.opening.notes.short : it.opening.notes.savings;
    }
  }

  function amountOf(item: ChecklistItem): string {
    if (item.id === 'savings' && !salaryOk) return it.opening.rest;
    return formatEuro(item.amount);
  }

  async function start() {
    if (!canStart || salary === null || travel === null) return;
    setSaving(true);
    setError(null);
    try {
      await startPeriod(db, { salary, travel, closingOption: option, today: now });
      navigate(routes.home, { replace: true });
    } catch (e) {
      console.error(e);
      setError(it.opening.error);
      setSaving(false);
    }
  }

  return (
    <div className="flow">
      <MonthHeader title={it.opening.title(target.name.toLowerCase())} subtitle={formatLongRange(target.calendarStart, target.calendarEnd)} />
      {current ? <StepIndicator steps={it.monthSteps.items} current={2} label={it.monthSteps.label} /> : null}

      <section className="card summary-card">
        <AmountField
          id="salary"
          large
          label={it.opening.salary(settings.periodStartDay)}
          placeholder={it.opening.salaryPlaceholder}
          value={salaryText}
          onChange={setSalaryText}
          invalid={salaryText !== '' && !salaryOk}
        />
        <AmountField id="travel" label={it.opening.travel} value={travelText} onChange={setTravelText} invalid={!travelOk} />
      </section>

      <section className="check-list" aria-labelledby="transfers-title">
        <h2 id="transfers-title" className="section-title">{it.opening.transfers}</h2>
        {items.map((item) => (
          <CheckRow
            key={item.id}
            checked={checked.has(keyOf(item))}
            onChange={(on) => toggle(item, on)}
            title={titleOf(item)}
            note={noteOf(item)}
            amount={amountOf(item)}
            warn={item.warn && salaryOk}
          />
        ))}
      </section>

      <p className="muted-note">{it.opening.cardsNote}</p>

      <button type="button" className="link-button" aria-expanded={editCaps} onClick={() => setEditCaps((v) => !v)}>
        {editCaps ? it.opening.hideEnvelopes : it.opening.editEnvelopes}
      </button>
      {editCaps ? <CapsEditor envelopes={envelopes} /> : null}

      {error ? <InfoBox>{error}</InfoBox> : null}
      <div className="flow__spacer" />
      <button type="button" className="primary-button" disabled={!canStart} onClick={() => void start()}>
        {!salaryOk ? it.opening.needSalary : allDone ? it.opening.start : it.opening.progress(done, items.length)}
      </button>
    </div>
  );
}
