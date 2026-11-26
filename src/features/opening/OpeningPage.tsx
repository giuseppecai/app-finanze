import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { AmountField } from '../../components/AmountField';
import { CheckRow } from '../../components/CheckRow';
import { IconPlus } from '../../components/icons';
import { InfoBox } from '../../components/InfoBox';
import { MonthHeader } from '../../components/MonthHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { Stepper } from '../../components/Stepper';
import { Tile } from '../../components/Symbol';
import { db } from '../../db/database';
import { startPeriod } from '../../db/repositories';
import { billsTransfer, expectedShare, monthlyQuota } from '../../domain/bills';
import { today } from '../../domain/clock';
import { planClosing, type ClosingOption, type ClosingPlan } from '../../domain/closing';
import { formatLongRange } from '../../domain/dates';
import { amountText, formatEuro, parseEuro } from '../../domain/money';
import { closingPreview, transferChecklist, type ChecklistItem } from '../../domain/monthEnd';
import { activeEnvelopes, availableForEnvelopes, itemQuotas, planOpening, withCaps } from '../../domain/opening';
import { nextPeriodToStart } from '../../domain/periods';
import { potLines, type PotLine } from '../../domain/pots';
import { symbolFor } from '../../domain/symbols';
import { frequencyOf, recurringQuota, savedSubscriptions } from '../../domain/recurring';
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
  const pots = usePots();
  if (current === undefined || !periods || !envelopes || !settings || !recurring || !txs || !bills || !pots) return null;

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
      pots={potLines(pots, settings.monthlyItems)}
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
  pots: PotLine[];
};

/** I passi dell'Inizio del mese: prima i numeri, poi le scelte, i giroconti solo alla fine. */
const STEPS = ['salary', 'fixed', 'pots', 'envelopes', 'transfers'] as const;
type Step = (typeof STEPS)[number];

/** Testo → centesimi (vuoto = null); `ok` = valido e non negativo (i saldi possono essere negativi). */
function parse(text: string, allowNegative = false): { cents: Cents | null; ok: boolean } {
  if (text.trim() === '') return { cents: null, ok: false };
  const neg = allowNegative && text.trim().startsWith('-');
  const cents = parseEuro(neg ? text.trim().slice(1) : text);
  return { cents: cents === null ? null : neg ? -cents : cents, ok: cents !== null };
}

function Opening({ current, option, periods, envelopes, settings, recurring, txs, bills, pots }: Props) {
  const navigate = useNavigate();
  const now = today();
  const startDay = settings.periodStartDay;
  const [step, setStep] = useState<Step>('salary');
  const [salaryText, setSalaryText] = useState('');
  /** importi delle voci fisse cambiati per questo mese (id voce → testo) */
  const [itemTexts, setItemTexts] = useState<Record<string, string>>({});
  /** saldi delle Pocket ricopiati da Revolut (id → testo), partono da quelli dell'app */
  const [balanceTexts, setBalanceTexts] = useState<Record<string, string>>(() => Object.fromEntries(pots.map((p) => [p.id, amountText(p.balance)])));
  /** tetti delle buste scelti per questo mese (id → centesimi), partono da quelli di Imposta */
  const [caps, setCaps] = useState<Record<string, Cents>>(() => Object.fromEntries(activeEnvelopes(envelopes).map((e) => [e.id, e.cap])));
  const [newItem, setNewItem] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = periods.reduce<Period | null>((a, p) => (!a || p.id > a.id ? p : a), null);
  const target = nextPeriodToStart(last, now, startDay);
  const closing: ClosingPlan | null = current
    ? (() => {
        const preview = closingPreview(envelopes, current, txs, recurring);
        return planClosing(preview.leftovers, preview.unassigned, option);
      })()
    : null;

  // 1 · Stipendio
  const salary = parseEuro(salaryText);
  const salaryOk = salary !== null && salary > 0;

  // 2 · Spese fisse: abbonamenti e bollette di questo mese (le loro quote), l'affitto a parte
  const fixedRows = [
    ...recurring
      .filter((r) => r.active)
      .map((r) => ({ id: r.id, name: r.name, tag: it.fixed.tagSubscription, freq: frequencyOf(r), amount: recurringQuota(r, target.id, startDay) })),
    ...bills
      .filter((b) => b.active)
      .map((b) => ({ id: b.id, name: b.name, tag: it.fixed.tagBill, freq: b.frequency as number, amount: monthlyQuota(b, target.id), share: expectedShare(b) })),
  ].filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const fixedQuota = fixedRows.reduce((s, r) => s + r.amount, 0);
  const itemAmount = (id: string, fallback: Cents) => {
    const t = itemTexts[id];
    if (t === undefined) return fallback;
    const p = parse(t);
    return p.ok && p.cents !== null && p.cents >= 0 ? p.cents : fallback;
  };
  const itemInvalid = Object.values(itemTexts).some((t) => !parse(t).ok);
  const quotas = itemQuotas(settings.monthlyItems).map((q) => ({ ...q, amount: itemAmount(q.item.id, q.amount) }));
  const payments = quotas.filter((q) => q.item.kind === 'payment');
  const paymentsTotal = payments.reduce((s, q) => s + q.amount, 0);

  // 3 · Pocket: saldi come su Revolut adesso; Spese fisse si calcola (al netto di quello che c'è già), Risparmi è il resto
  const balanceOf = (id: string) => parse(balanceTexts[id] ?? '', true).cents ?? 0;
  const balancesInvalid = pots.some((p) => !parse(balanceTexts[p.id] ?? '', true).ok);
  const billsInfo = billsTransfer(bills, balanceOf('bills'), target.id, savedSubscriptions(recurring, target.id, startDay));
  const potQuotas = quotas.filter((q) => q.item.kind === 'pot');

  // 4 · Buste: quanto resta, e quello che le buste non usano va a Risparmi
  const available = availableForEnvelopes(salary ?? 0, quotas, billsInfo.amount);
  const capsTotal = Object.values(caps).reduce((s, c) => s + c, 0);
  const toSavings = available - capsTotal;

  // 5 · Giroconti
  const opening = planOpening(salary ?? 0, withCaps(envelopes, caps), quotas, billsInfo.amount);
  const items = transferChecklist(opening, closing);
  const keyOf = (i: ChecklistItem) => `${i.key}:${i.amount}`;
  const done = items.filter((i) => checked.has(keyOf(i))).length;
  const allDone = done === items.length;
  const closingMonth = current?.name.toLowerCase() ?? '';

  const index = STEPS.indexOf(step);
  // Ogni passo si apre dall'inizio, non a metà pagina.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);
  const canNext =
    step === 'salary' ? salaryOk : step === 'fixed' ? !itemInvalid : step === 'pots' ? !balancesInvalid && !itemInvalid : true;

  function titleOf(item: ChecklistItem): string {
    if (item.kind === 'closing') return item.to === 'savings' ? it.opening.closingTitle(closingMonth) : it.accounts[item.to] ?? '';
    if (item.item) return item.item.kind === 'payment' ? it.opening.payTitle(item.item.name) : item.item.name;
    return it.accounts[item.to] ?? '';
  }

  function noteOf(item: ChecklistItem): string {
    switch (item.kind) {
      case 'closing':
        return item.to === 'savings' ? it.opening.notes.toSavings : it.opening.notes.closingDeficit(closingMonth);
      case 'budget':
        return it.opening.notes.budget(activeEnvelopes(envelopes).length);
      case 'item':
        return item.item?.kind === 'payment' ? it.opening.notes.payment : it.opening.notes.pot;
      case 'bills':
        return it.opening.notes.fixed(fixedRows.length);
      case 'savings':
        return item.warn ? it.opening.notes.short : it.opening.notes.savings;
    }
  }

  async function start() {
    if (!allDone || salary === null || !salaryOk) return;
    setSaving(true);
    setError(null);
    try {
      await startPeriod(db, {
        salary,
        quotas: Object.fromEntries(quotas.map((q) => [q.item.id, q.amount])),
        closingOption: option,
        today: now,
        caps,
        potBalances: Object.fromEntries(pots.map((p) => [p.id, balanceOf(p.id)])),
      });
      navigate(routes.home, { replace: true });
    } catch (e) {
      console.error(e);
      setError(it.opening.error);
      setSaving(false);
    }
  }

  const amountInput = (id: string, label: string, value: Cents) => (
    <AmountField
      id={`item-${id}`}
      label={label}
      value={itemTexts[id] ?? amountText(value)}
      onChange={(v) => setItemTexts((t) => ({ ...t, [id]: v }))}
      invalid={itemTexts[id] !== undefined && !parse(itemTexts[id]!).ok}
    />
  );

  return (
    <div className="flow">
      <MonthHeader title={it.opening.title(target.name.toLowerCase())} subtitle={formatLongRange(target.calendarStart, target.calendarEnd)} />
      <StepIndicator steps={it.opening.steps} current={index} label={it.monthSteps.label} />

      {step === 'salary' ? (
        <section className="opening-step" aria-labelledby="step-title">
          <h2 id="step-title" className="opening-step__title">{it.opening.salaryTitle}</h2>
          <AmountField
            id="salary"
            large
            label={it.opening.salary(startDay)}
            placeholder={it.opening.salaryPlaceholder}
            value={salaryText}
            onChange={setSalaryText}
            invalid={salaryText !== '' && !salaryOk}
          />
        </section>
      ) : null}

      {step === 'fixed' ? (
        <section className="opening-step" aria-labelledby="step-title">
          <h2 id="step-title" className="opening-step__title">{it.opening.fixedTitle}</h2>
          <section className="hero" aria-label={it.opening.fixedSum}>
            <p className="hero__label">{it.opening.fixedSum}</p>
            <p className="hero__amount hero__amount--medium">{formatEuro(fixedQuota + paymentsTotal)}</p>
            <div className="hero-foot">
              <span>{paymentsTotal > 0 ? it.opening.fixedFoot(formatEuro(fixedQuota), formatEuro(paymentsTotal)) : it.opening.fixedFootOnly}</span>
            </div>
          </section>
          <p className="muted-note">{it.opening.fixedText}</p>
          <ul className="card opening-list">
            {fixedRows.length === 0 ? <li className="opening-list__row"><span className="muted-note">{it.opening.fixedNone}</span></li> : null}
            {fixedRows.map((r) => (
              <li key={r.id} className="opening-list__row">
                <span className="opening-list__text">
                  <span className="opening-list__name">{r.name}</span>
                  <span className="opening-list__detail">{r.freq > 1 ? `${r.tag} · ${it.recurring.frequency[r.freq] ?? ''}` : r.tag}</span>
                </span>
                <span className="opening-list__amount">{formatEuro(r.amount)}</span>
              </li>
            ))}
            <li className="opening-list__row opening-list__row--total">
              <span className="opening-list__name">{it.opening.fixedTotal}</span>
              <span className="opening-list__amount">{formatEuro(fixedQuota)}</span>
            </li>
          </ul>
          {payments.length > 0 ? (
            <>
              <h3 className="group-label">{it.opening.paymentsTitle}</h3>
              <div className="card opening-fields">
                {payments.map((q) => <div key={q.item.id}>{amountInput(q.item.id, q.item.name, q.amount)}</div>)}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {step === 'pots' ? (
        <section className="opening-step" aria-labelledby="step-title">
          <h2 id="step-title" className="opening-step__title">{it.opening.potsTitle}</h2>
          <p className="muted-note">{it.opening.potsText}</p>
          <ul className="card opening-list">
            {pots.map((p) => {
              const q = potQuotas.find((x) => x.item.id === p.id);
              const balance = parse(balanceTexts[p.id] ?? '', true);
              return (
                <li key={p.id} className="opening-pot">
                  <span className="opening-pot__head">
                    <Tile symbol={symbolFor(p)} tone={p.id === "savings" ? "save-1" : "save-2"} size="sm" />
                    <span className="opening-list__name">{p.name}</span>
                  </span>
                  <div className="recurring-form__grid">
                    <AmountField
                      id={`balance-${p.id}`}
                      label={it.opening.potBalance}
                      value={balanceTexts[p.id] ?? ''}
                      onChange={(v) => setBalanceTexts((t) => ({ ...t, [p.id]: v }))}
                      invalid={!balance.ok}
                    />
                    {q ? (
                      amountInput(q.item.id, it.opening.potThisMonth, q.amount)
                    ) : (
                      <div className="opening-pot__computed">
                        <span className="opening-pot__label">{it.opening.potThisMonth}</span>
                        <span className="opening-pot__value">
                          {p.id === 'bills' ? formatEuro(billsInfo.amount) : p.id === 'savings' ? it.opening.rest : '—'}
                        </span>
                        <span className="opening-pot__note">
                          {p.id === 'bills' ? it.opening.potComputed : p.id === 'savings' ? it.opening.potRest : it.opening.potNoQuota}
                        </span>
                      </div>
                    )}
                  </div>
                  {p.id === 'bills' && billsInfo.credit > 0 && billsInfo.quota > 0 ? (
                    <span className="opening-list__detail">{it.opening.billsNet(formatEuro(billsInfo.quota), formatEuro(Math.min(billsInfo.credit, billsInfo.quota)))}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button type="button" className="list-row list-row--action" onClick={() => setNewItem(true)}>
            <IconPlus size={20} />{it.opening.addItem}
          </button>
        </section>
      ) : null}

      {step === 'envelopes' ? (
        <section className="opening-step" aria-labelledby="step-title">
          <h2 id="step-title" className="opening-step__title">{it.opening.envelopesTitle}</h2>
          <section className="hero" aria-label={it.opening.availableLabel}>
            <p className="hero__label">{it.opening.availableLabel}</p>
            <p className={available < 0 ? 'hero__amount hero__amount--medium is-over' : 'hero__amount hero__amount--medium'}>{formatEuro(available)}</p>
            <div className="hero-foot">
              <span>{it.opening.availableFoot(formatEuro(salary ?? 0), formatEuro(billsInfo.amount + quotas.reduce((s, q) => s + q.amount, 0)))}</span>
            </div>
          </section>
          <ul className="card opening-list">
            {activeEnvelopes(envelopes).map((e) => (
              <li key={e.id} className="opening-list__row">
                <span className="opening-env">
                  <Tile symbol={symbolFor(e)} size="sm" />
                  <span className="opening-list__name">{e.shortName || e.name}</span>
                </span>
                <Stepper label={it.caps.stepperLabel(e.name)} value={caps[e.id] ?? e.cap} onChange={(c) => setCaps((x) => ({ ...x, [e.id]: c }))} />
              </li>
            ))}
          </ul>
          <div className="card opening-summary">
            <div className="opening-summary__row">
              <span>{it.opening.envelopesTotal}</span>
              <strong>{formatEuro(capsTotal)}</strong>
            </div>
            <div className={toSavings < 0 ? 'opening-summary__row is-over' : 'opening-summary__row opening-summary__row--main'}>
              <span>{toSavings < 0 ? it.opening.envelopesOver : it.opening.envelopesToSavings}</span>
              <strong>{formatEuro(Math.abs(toSavings))}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {step === 'transfers' ? (
        <section className="opening-step" aria-labelledby="step-title">
          <h2 id="step-title" className="opening-step__title">{it.opening.transfers}</h2>
          <div className="card check-list">
            {items.map((item) => (
              <CheckRow
                key={item.key}
                checked={checked.has(keyOf(item))}
                onChange={(on) => setChecked((prev) => {
                  const next = new Set(prev);
                  if (on) next.add(keyOf(item));
                  else next.delete(keyOf(item));
                  return next;
                })}
                title={titleOf(item)}
                note={noteOf(item)}
                amount={formatEuro(item.amount)}
                warn={item.warn}
              />
            ))}
          </div>
          <InfoBox>{it.opening.cardsNote}</InfoBox>
        </section>
      ) : null}

      {error ? <InfoBox>{error}</InfoBox> : null}
      <MonthlyItemSheet target={newItem ? 'new' : null} onClose={() => setNewItem(false)} />
      <div className="flow__spacer" />
      <div className="opening-nav">
        {index > 0 ? (
          <button type="button" className="outcome__button outcome__button--secondary" onClick={() => setStep(STEPS[index - 1]!)}>{it.opening.back}</button>
        ) : null}
        {step === 'transfers' ? (
          <button type="button" className="primary-button opening-nav__next" disabled={!allDone || saving} onClick={() => void start()}>
            {allDone ? it.opening.start : it.opening.progress(done, items.length)}
          </button>
        ) : (
          <button type="button" className="primary-button opening-nav__next" disabled={!canNext} onClick={() => setStep(STEPS[index + 1]!)}>
            {step === 'salary' && !salaryOk ? it.opening.needSalary : it.opening.next}
          </button>
        )}
      </div>
    </div>
  );
}
