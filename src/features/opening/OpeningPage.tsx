import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { CheckRow } from '../../components/CheckRow';
import { IconPlus } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { MonthHeader } from '../../components/MonthHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { db } from '../../db/database';
import { startPeriod } from '../../db/repositories';
import { today } from '../../domain/clock';
import { planClosing, type ClosingOption, type ClosingPlan } from '../../domain/closing';
import { formatLongRange } from '../../domain/dates';
import { formatEuro, parseEuro, amountText } from '../../domain/money';
import { closingPreview, transferChecklist, type ChecklistItem } from '../../domain/monthEnd';
import { activeEnvelopes, itemQuotas, planOpening, type ItemQuota } from '../../domain/opening';
import { nextPeriodToStart } from '../../domain/periods';
import { billsQuotaTotal } from '../../domain/bills';
import type { Bill, Cents, Envelope, Period, Recurring, Settings, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';
import { MonthlyItemSheet } from '../settings/MonthlyItemSheet';

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
  /** importi cambiati solo per questo mese (id voce → importo) */
  const [overrides, setOverrides] = useState<Record<string, Cents>>({});
  const [editing, setEditing] = useState<ItemQuota | null>(null);
  const [newItem, setNewItem] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
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
  const salaryOk = salary !== null && salary > 0;
  const quotas = itemQuotas(settings.monthlyItems, overrides);
  const activeBills = bills.filter((b) => b.active);
  const opening = planOpening(salary ?? 0, envelopes, quotas, billsQuotaTotal(bills, target.id));
  const items = transferChecklist(opening, closing);
  // La spunta vale per quell'importo: se l'importo cambia, la riga torna da fare.
  const keyOf = (i: ChecklistItem) => `${i.key}:${i.amount}`;
  const done = items.filter((i) => checked.has(keyOf(i))).length;
  const allDone = done === items.length;
  const canStart = allDone && salaryOk && !saving;
  const closingMonth = current?.name.toLowerCase() ?? '';

  function toggle(item: ChecklistItem, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(keyOf(item));
      else next.delete(keyOf(item));
      return next;
    });
  }

  function titleOf(item: ChecklistItem): string {
    // Il titolo è la destinazione; il sottotitolo spiega da dove arrivano i soldi.
    if (item.kind === 'closing') return it.accounts[item.to] ?? '';
    if (item.item) return item.item.kind === 'payment' ? it.opening.payTitle(item.item.name) : item.item.name;
    return it.accounts[item.to] ?? '';
  }

  function noteOf(item: ChecklistItem): string {
    switch (item.kind) {
      case 'closing':
        return item.to === 'savings' ? it.opening.notes.closingSurplus(closingMonth) : it.opening.notes.closingDeficit(closingMonth);
      case 'budget':
        return it.opening.notes.budget(activeEnvelopes(envelopes).length);
      case 'item':
        return item.item?.kind === 'payment' ? it.opening.notes.payment : it.opening.notes.pot;
      case 'bills':
        return it.opening.notes.bills(activeBills.length);
      case 'savings':
        return item.warn && salaryOk ? it.opening.notes.short : it.opening.notes.savings;
    }
  }

  function amountOf(item: ChecklistItem): string {
    if (item.kind === 'savings' && !salaryOk) return it.opening.rest;
    return formatEuro(item.amount);
  }

  function quotaOf(item: ChecklistItem): ItemQuota | undefined {
    return item.item ? quotas.find((q) => q.item.id === item.item?.id) : undefined;
  }

  async function start() {
    if (!canStart || salary === null) return;
    setSaving(true);
    setError(null);
    try {
      const used = Object.fromEntries(quotas.map((q) => [q.item.id, q.amount]));
      await startPeriod(db, { salary, quotas: used, closingOption: option, today: now });
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

      <AmountField
        id="salary"
        large
        label={it.opening.salary(settings.periodStartDay)}
        placeholder={it.opening.salaryPlaceholder}
        value={salaryText}
        onChange={setSalaryText}
        invalid={salaryText !== '' && !salaryOk}
      />

      <section aria-labelledby="transfers-title">
        <h2 id="transfers-title" className="group-label">{it.opening.transfers}</h2>
        <div className="card check-list">
        {items.map((item) => {
          const q = quotaOf(item);
          return (
            <CheckRow
              key={item.key}
              checked={checked.has(keyOf(item))}
              onChange={(on) => toggle(item, on)}
              title={titleOf(item)}
              note={noteOf(item)}
              amount={amountOf(item)}
              warn={item.warn && salaryOk}
              onEditAmount={q ? () => setEditing(q) : undefined}
              editLabel={q ? it.items.editAmount(q.item.name, formatEuro(q.amount)) : undefined}
            />
          );
        })}
        <button type="button" className="list-row list-row--action" onClick={() => setNewItem(true)}>
          <IconPlus size={20} />{it.opening.addItem}
        </button>
        </div>
      </section>

      <InfoBox>{it.opening.cardsNote}</InfoBox>

      {/* Un solo modo per cambiare i tetti: Imposta (lì valgono anche per il mese aperto). */}
      <Link to={routes.settings} className="link-button">{it.opening.editEnvelopes}</Link>

      {error ? <InfoBox>{error}</InfoBox> : null}
      <QuotaSheet
        quota={editing}
        onClose={() => setEditing(null)}
        onApply={(id, amount) => { setOverrides((o) => ({ ...o, [id]: amount })); setEditing(null); }}
      />
      <MonthlyItemSheet target={newItem ? 'new' : null} onClose={() => setNewItem(false)} />
      <div className="flow__spacer" />
      <button type="button" className="primary-button" disabled={!canStart} onClick={() => void start()}>
        {!salaryOk ? it.opening.needSalary : allDone ? it.opening.start : it.opening.progress(done, items.length)}
      </button>
    </div>
  );
}

/** Cambia l'importo di una voce fissa solo per questo mese. */
function QuotaSheet({ quota, onClose, onApply }: { quota: ItemQuota | null; onClose: () => void; onApply: (id: string, amount: Cents) => void }) {
  return (
    <BottomSheet open={quota !== null} onClose={onClose} title={quota ? it.items.thisMonth(quota.item.name) : ''} subtitle={it.items.thisMonthHint}>
      {quota ? <QuotaForm key={quota.item.id} quota={quota} onApply={onApply} /> : null}
    </BottomSheet>
  );
}

function QuotaForm({ quota, onApply }: { quota: ItemQuota; onApply: (id: string, amount: Cents) => void }) {
  const [value, setValue] = useState(amountText(quota.amount));
  const cents = parseEuro(value);
  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); if (cents !== null) onApply(quota.item.id, cents); }}>
      <AmountField id="quota-amount" large label={quota.item.name} value={value} onChange={setValue} invalid={value !== '' && cents === null} />
      <button type="submit" className="primary-button" disabled={cents === null}>{it.items.apply}</button>
    </form>
  );
}
