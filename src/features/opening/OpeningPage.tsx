import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, useLoans, usePeople, usePeriods, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { AmountField } from '../../components/AmountField';
import { CheckRow } from '../../components/CheckRow';
import { IconChevronRight, IconPlus } from '../../components/icons';
import { BottomSheet } from '../../components/BottomSheet';
import { BillSheet } from '../bills/BillSheet';
import { RecurringSheet } from '../recurring/RecurringSheet';
import { InfoBox } from '../../components/InfoBox';
import { MonthHeader } from '../../components/MonthHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { Stepper } from '../../components/Stepper';
import { Tile } from '../../components/Symbol';
import { db } from '../../db/database';
import { startPeriod } from '../../db/repositories';
import { billsTransfer, monthlyQuota } from '../../domain/bills';
import { today } from '../../domain/clock';
import { planClosing, type ClosingOption, type ClosingPlan } from '../../domain/closing';
import { formatLongRange } from '../../domain/dates';
import { amountText, formatEuro, parseEuro } from '../../domain/money';
import { closingPreview, transferChecklist, type ChecklistItem } from '../../domain/monthEnd';
import { activeEnvelopes, availableForEnvelopes, itemQuotas, planOpening, savingsGoalCheck, withCaps } from '../../domain/opening';
import { nextPeriodToStart } from '../../domain/periods';
import { potLines, type PotLine } from '../../domain/pots';
import { symbolFor } from '../../domain/symbols';
import { frequencyOf, mainRecurringEnvelope, recurringDateInPeriod, recurringQuota, savedSubscriptions } from '../../domain/recurring';
import { accountPayments, otherAccountsRecurring, salaryAccountPlan } from '../../domain/accounts';
import type { Bill, Cents, Envelope, IntentionOutcome, Loan, MonthlyItem, Period, Person, Recurring, Settings, Transaction } from '../../domain/types';
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
  const people = usePeople();
  const loans = useLoans();
  if (current === undefined || !periods || !envelopes || !settings || !recurring || !txs || !bills || !pots || !people || !loans) return null;

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
      people={people}
      loans={loans}
      fromClosing={{
        intention: params.get('proposito'),
        outcome: (['done', 'partly', 'no'] as const).find((o) => o === params.get('esito')) ?? null,
        keepCaps: (params.get('tieni') ?? '').split(',').filter(Boolean),
      }}
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
  people: Person[];
  loans: Loan[];
  /** R24, R25: quello che si è deciso alla chiusura, da salvare quando il mese inizia davvero */
  fromClosing: { intention: string | null; outcome: IntentionOutcome | null; keepCaps: string[] };
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

function Opening({ current, option, periods, envelopes, settings, recurring, txs, bills, pots, people, loans, fromClosing }: Props) {
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
  /** voce fissa da creare o modificare (rinominare, togliere): si gestiscono qui, non più in Imposta */
  const [itemTarget, setItemTarget] = useState<MonthlyItem | 'new' | null>(null);
  /** passo Spese: "Modifica" rende modificabile ogni spesa fissa (abbonamenti, bollette, pagamenti) */
  const [editingFixed, setEditingFixed] = useState(false);
  const [subTarget, setSubTarget] = useState<Recurring | 'new' | null>(null);
  const [billTarget, setBillTarget] = useState<Bill | 'new' | null>(null);
  const [payTarget, setPayTarget] = useState<MonthlyItem | 'new' | null>(null);
  const [choosingFixed, setChoosingFixed] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  /** R21: prima i risparmi (vuoto = nessun obiettivo) */
  const [goalText, setGoalText] = useState(() => (settings.savingsGoal ? amountText(settings.savingsGoal) : ''));
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
  const accountName = (id: string | null | undefined) => (id ? settings.accounts?.find((a) => a.id === id)?.name ?? null : null);
  type FixedRow = { id: string; name: string; tag: string; freq: number; amount: Cents; from: string | null; paused: boolean; open: () => void; pocket: boolean };
  const allFixedRows: FixedRow[] = [
    ...recurring
      .map((r) => ({
        id: r.id,
        paused: !r.active,
        pocket: !r.payFrom,
        open: () => setSubTarget(r),
        name: r.name,
        tag: it.fixed.tagSubscription,
        freq: frequencyOf(r),
        // Da un altro conto (rata da Isybank): l'importo se si addebita questo mese, non passa dalla Pocket.
        amount: r.payFrom ? (recurringDateInPeriod(r, target) !== null ? r.amount : 0) : recurringQuota(r, target.id, startDay),
        from: accountName(r.payFrom),
      })),
    ...bills
      .map((b) => ({
        id: b.id, name: b.name, tag: it.fixed.tagBill, freq: b.frequency as number, amount: b.active ? monthlyQuota(b, target.id) : 0,
        from: null as string | null, paused: !b.active, pocket: true, open: () => setBillTarget(b),
      })),
    ...settings.monthlyItems
      .filter((i) => i.kind === 'payment')
      .map((i) => ({
        id: i.id, name: i.name, tag: it.fixed.tagPayment, freq: 1, amount: i.archived ? 0 : i.amount,
        from: accountName(i.payFrom), paused: i.archived, pocket: false, open: () => setPayTarget(i),
      })),
  ].map((r) => (r.paused ? { ...r, amount: 0 } : r)).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'it'));
  // Fuori da "Modifica" solo quello che si paga questo mese; in modifica tutte le voci.
  const fixedRows = editingFixed ? allFixedRows : allFixedRows.filter((r) => r.amount > 0);
  const pocketRows = allFixedRows.filter((r) => r.amount > 0 && r.pocket);
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
  const fixedTotal = allFixedRows.reduce((s, r) => s + r.amount, 0);
  const fixedQuota = fixedTotal - paymentsTotal;

  // 3 · Pocket: saldi come su Revolut adesso; Spese fisse si calcola (al netto di quello che c'è già), Risparmi è il resto
  const balanceOf = (id: string) => parse(balanceTexts[id] ?? '', true).cents ?? 0;
  const balancesInvalid = pots.some((p) => !parse(balanceTexts[p.id] ?? '', true).ok);
  const billsInfo = billsTransfer(bills, balanceOf('bills'), target.id, savedSubscriptions(recurring, target.id, startDay));
  const potQuotas = quotas.filter((q) => q.item.kind === 'pot');

  // 4 · Buste: quanto resta, e quello che le buste non usano va a Risparmi
  const otherRecurring = otherAccountsRecurring(recurring, target);
  const available = availableForEnvelopes(salary ?? 0, quotas, billsInfo.amount, otherRecurring);
  const capsTotal = Object.values(caps).reduce((s, c) => s + c, 0);
  const goalParsed = goalText.trim() === '' ? { cents: 0, ok: true } : parse(goalText);
  const goal = goalParsed.ok ? goalParsed.cents ?? 0 : 0;
  const goalCheck = savingsGoalCheck(available, goal, capsTotal);
  const toSavings = goalCheck.savings;

  // 5 · Giroconti
  const opening = planOpening(salary ?? 0, withCaps(envelopes, caps), quotas, billsInfo.amount, otherRecurring);
  // Stipendio su un altro conto (Isybank): lì restano i suoi pagamenti, il resto va su Revolut.
  const salaryAccount = salaryAccountPlan(settings, salary ?? 0, settings.salaryAccountId ? accountPayments(settings.salaryAccountId, recurring, quotas, target) : []);
  const items = transferChecklist(opening, closing, salaryAccount);
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
    step === 'salary' ? salaryOk : step === 'fixed' ? !itemInvalid : step === 'pots' ? !balancesInvalid && !itemInvalid : step === 'envelopes' ? goalParsed.ok : true;

  function titleOf(item: ChecklistItem): string {
    if (item.kind === 'leave') return it.opening.leaveTitle(salaryAccount?.account.name ?? '');
    if (item.kind === 'move') return it.opening.moveTitle(salaryAccount?.account.name ?? '');
    if (item.kind === 'closing') return item.to === 'savings' ? it.opening.closingTitle(closingMonth) : it.accounts[item.to] ?? '';
    if (item.item) return item.item.kind === 'payment' ? it.opening.payTitle(item.item.name) : item.item.name;
    return it.accounts[item.to] ?? '';
  }

  function noteOf(item: ChecklistItem): string {
    switch (item.kind) {
      case 'leave':
        return salaryAccount?.payments.map((p) => p.name).join(', ') ?? '';
      case 'move':
        return item.warn ? it.opening.notes.short : it.opening.notes.move;
      case 'closing':
        return item.to === 'savings' ? it.opening.notes.toSavings : it.opening.notes.closingDeficit(closingMonth);
      case 'budget':
        return it.opening.notes.budget(activeEnvelopes(envelopes).length);
      case 'item':
        return item.item?.kind === 'payment' ? it.opening.notes.payment : it.opening.notes.pot;
      case 'bills':
        return it.opening.notes.fixed(pocketRows.length);
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
        savingsGoal: goal,
        intention: fromClosing.intention,
        intentionOutcome: fromClosing.outcome,
        keepCaps: fromClosing.keepCaps,
      });
      navigate(routes.home, { replace: true });
    } catch (e) {
      console.error(e);
      setError(it.opening.error);
      setSaving(false);
    }
  }

  const editButton = (id: string, name: string) => {
    const item = settings.monthlyItems.find((i) => i.id === id);
    return item ? (
      <button type="button" className="text-link opening-edit" aria-label={it.opening.editItem(name)} onClick={() => setItemTarget(item)}>
        {it.opening.edit}
      </button>
    ) : null;
  };

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
            label={accountName(settings.salaryAccountId) ? it.opening.salaryOn(accountName(settings.salaryAccountId)!, startDay) : it.opening.salary(startDay)}
            placeholder={it.opening.salaryPlaceholder}
            value={salaryText}
            onChange={setSalaryText}
            invalid={salaryText !== '' && !salaryOk}
          />
        </section>
      ) : null}

      {step === 'fixed' ? (
        <section className="opening-step" aria-labelledby="step-title">
          <div className="opening-step__head">
            <h2 id="step-title" className="opening-step__title">{it.opening.fixedTitle}</h2>
            <button type="button" className="pill-button" aria-pressed={editingFixed} onClick={() => setEditingFixed((v) => !v)}>
              {editingFixed ? it.opening.editDone : it.opening.edit}
            </button>
          </div>
          <section className="hero" aria-label={it.opening.fixedHero}>
            <p className="hero__label">{it.opening.fixedHero}</p>
            <p className="hero__amount hero__amount--medium">{formatEuro(fixedTotal)}</p>
            <div className="hero-foot">
              <span>{paymentsTotal > 0 ? it.opening.fixedFoot(formatEuro(fixedQuota), formatEuro(paymentsTotal)) : it.opening.fixedFootOnly}</span>
            </div>
          </section>
          <p className="muted-note">{editingFixed ? it.opening.fixedEditText : it.opening.fixedText}</p>
          <ul className="card opening-list">
            {fixedRows.length === 0 ? <li className="opening-list__row"><span className="muted-note">{it.opening.fixedNone}</span></li> : null}
            {fixedRows.map((r) => {
              const content = (
                <>
                  <span className="opening-list__text">
                    <span className={r.paused ? 'opening-list__name is-muted' : 'opening-list__name'}>{r.name}</span>
                    <span className="opening-list__detail">
                      {[r.tag, r.freq > 1 ? it.recurring.frequency[r.freq] : null, r.from ? it.opening.fromAccount(r.from) : null, r.paused ? it.fixed.paused : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="opening-list__amount">{formatEuro(r.amount)}</span>
                </>
              );
              return editingFixed ? (
                <li key={r.id}>
                  <button type="button" className="opening-list__row opening-list__row--button" aria-label={it.opening.editItem(r.name)} onClick={r.open}>
                    {content}
                    <IconChevronRight className="chev" />
                  </button>
                </li>
              ) : (
                <li key={r.id} className="opening-list__row">{content}</li>
              );
            })}
            <li className="opening-list__row opening-list__row--total">
              <span className="opening-list__name">{it.opening.fixedTotal}</span>
              <span className="opening-list__amount">{formatEuro(fixedTotal)}</span>
            </li>
          </ul>
          {editingFixed ? (
            <button type="button" className="list-row list-row--action" onClick={() => setChoosingFixed(true)}>
              <IconPlus size={20} />{it.opening.addFixed}
            </button>
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
                    {q ? editButton(q.item.id, p.name) : null}
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
          <button type="button" className="list-row list-row--action" onClick={() => setItemTarget('new')}>
            <IconPlus size={20} />{it.opening.addItem}
          </button>
        </section>
      ) : null}

      {step === 'envelopes' ? (
        <section className="opening-step" aria-labelledby="step-title">
          <h2 id="step-title" className="opening-step__title">{it.opening.envelopesTitle}</h2>
          <div className="card goal-field">
            <AmountField
              id="savings-goal"
              label={it.insights.goalField}
              placeholder="0"
              value={goalText}
              onChange={setGoalText}
              invalid={!goalParsed.ok}
            />
            <p className="goal-field__hint">{it.insights.goalHint}</p>
          </div>
          <section className="hero" aria-label={it.opening.availableLabel}>
            <p className="hero__label">{it.opening.availableLabel}</p>
            <p className={goalCheck.forEnvelopes < 0 ? 'hero__amount hero__amount--medium is-over' : 'hero__amount hero__amount--medium'}>{formatEuro(goalCheck.forEnvelopes)}</p>
            <div className="hero-foot">
              <span>
                {goal > 0
                  ? it.insights.availableFootGoal(formatEuro(salary ?? 0), formatEuro(billsInfo.amount + otherRecurring + quotas.reduce((s, q) => s + q.amount, 0)), formatEuro(goal))
                  : it.opening.availableFoot(formatEuro(salary ?? 0), formatEuro(billsInfo.amount + otherRecurring + quotas.reduce((s, q) => s + q.amount, 0)))}
              </span>
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
            {goalCheck.eroded > 0 ? (
              <div className="opening-summary__row is-warn">
                <span>{it.insights.goalEroded(formatEuro(goalCheck.eroded))}</span>
              </div>
            ) : null}
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
      <MonthlyItemSheet target={itemTarget} kind={itemTarget === 'new' ? 'pot' : undefined} onClose={() => setItemTarget(null)} />
      <MonthlyItemSheet target={payTarget} kind="payment" onClose={() => setPayTarget(null)} />
      <RecurringSheet
        target={subTarget}
        defaultEnvelopeId={mainRecurringEnvelope(recurring) ?? envelopes.find((e) => !e.archived)?.id ?? ''}
        opening={target.id}
        periodStartDay={startDay}
        onClose={() => setSubTarget(null)}
      />
      <BillSheet
        target={billTarget}
        people={people}
        loans={loans}
        hasPeriod={!!current}
        defaultPersonId={bills.find((b) => b.personId)?.personId ?? null}
        opening={target.id}
        onClose={() => setBillTarget(null)}
      />
      <BottomSheet open={choosingFixed} onClose={() => setChoosingFixed(false)} title={it.fixed.chooseTitle}>
        <div className="choose-kind">
          <button type="button" className="choose-kind__option" onClick={() => { setChoosingFixed(false); setSubTarget('new'); }}>
            <span className="choose-kind__title">{it.fixed.chooseSubscription}</span>
            <span className="choose-kind__hint">{it.fixed.chooseSubscriptionHint}</span>
          </button>
          <button type="button" className="choose-kind__option" onClick={() => { setChoosingFixed(false); setBillTarget('new'); }}>
            <span className="choose-kind__title">{it.fixed.chooseBill}</span>
            <span className="choose-kind__hint">{it.fixed.chooseBillHint}</span>
          </button>
          <button type="button" className="choose-kind__option" onClick={() => { setChoosingFixed(false); setPayTarget('new'); }}>
            <span className="choose-kind__title">{it.fixed.choosePayment}</span>
            <span className="choose-kind__hint">{it.fixed.choosePaymentHint}</span>
          </button>
        </div>
      </BottomSheet>
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
