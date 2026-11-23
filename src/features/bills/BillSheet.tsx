import { useState } from 'react';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmPanel } from '../../components/ConfirmPanel';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Switch } from '../../components/Switch';
import { db } from '../../db/database';
import { deleteBill, newId, registerBill, saveBill } from '../../db/repositories';
import { nowISO, today } from '../../domain/clock';
import { isPeriodic, monthlyQuota, planBillPayment, type BillTransfer } from '../../domain/bills';
import { addMonthsId } from '../../domain/dates';
import { balanceWith } from '../../domain/loans';
import { amountText, formatEuro, parseEuro } from '../../domain/money';
import type { Bill, BillFrequency, Loan, Person } from '../../domain/types';
import { it } from '../../i18n/it';
import { PersonPicker } from '../entry/PersonPicker';

type Props = {
  target: Bill | 'new' | null;
  people: Person[];
  loans: Loan[];
  hasPeriod: boolean;
  defaultPersonId: string | null;
  /** periodo del prossimo giroconto (per la quota e per i mesi proposti) */
  opening: string;
  onClose: () => void;
};

/** Pannello di una bolletta: Registra (bolletta arrivata) o Modifica. Per una bolletta nuova solo Modifica. */
export function BillSheet({ target, people, loans, hasPeriod, defaultPersonId, opening, onClose }: Props) {
  return (
    <BottomSheet open={target !== null} onClose={onClose} title={target === 'new' ? it.casa.sheetNew : target?.name ?? ''}>
      {target !== null ? (
        <BillSheetBody
          key={target === 'new' ? 'new' : target.id}
          target={target}
          people={people}
          loans={loans}
          hasPeriod={hasPeriod}
          defaultPersonId={defaultPersonId}
          opening={opening}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function BillSheetBody({ target, people, loans, hasPeriod, defaultPersonId, opening, onDone }: Omit<Props, 'onClose'> & { target: Bill | 'new'; onDone: () => void }) {
  const [tab, setTab] = useState<'register' | 'edit'>(target === 'new' || !target.active ? 'edit' : 'register');
  if (target === 'new') {
    return <BillForm bill={null} people={people} loans={loans} defaultPersonId={defaultPersonId} opening={opening} onDone={onDone} />;
  }
  return (
    <>
      <SegmentedControl
        label={target.name}
        options={[
          { value: 'register', label: it.casa.tabRegister },
          { value: 'edit', label: it.casa.tabEdit },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'register' ? (
        <RegisterForm bill={target} people={people} loans={loans} hasPeriod={hasPeriod} onDone={onDone} />
      ) : (
        <BillForm bill={target} people={people} loans={loans} defaultPersonId={defaultPersonId} opening={opening} onDone={onDone} />
      )}
    </>
  );
}

function transferText(t: BillTransfer): string {
  return it.casa.transfer(it.casa.fromAccount[t.from], it.casa.toAccount[t.to], formatEuro(t.amount, { decimals: 'always' }));
}

function RegisterForm({ bill, people, loans, hasPeriod, onDone }: { bill: Bill; people: Person[]; loans: Loan[]; hasPeriod: boolean; onDone: () => void }) {
  const [amountValue, setAmountValue] = useState(amountText(bill.estimate));
  const [date, setDate] = useState(today());
  const [payer, setPayer] = useState<Bill['payer']>(bill.payer);
  const [done, setDone] = useState<BillTransfer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const person = people.find((p) => p.id === bill.personId);
  const name = person?.name ?? it.movements.unknownPerson;
  const amount = parseEuro(amountValue);
  const plan = amount && amount > 0 ? planBillPayment(bill, amount, payer) : null;
  const money = (c: number) => formatEuro(c, { decimals: 'always' });

  if (done) {
    return (
      <div className="recurring-form">
        <p className="outcome outcome--ok"><span className="outcome__title">{it.casa.registered}</span></p>
        {done.length > 0 ? (
          <>
            <h3 className="entry__label">{it.casa.transfersTitle}</h3>
            <ul className="bill-preview">{done.map((t, i) => <li key={i}>{transferText(t)}</li>)}</ul>
          </>
        ) : null}
        <button type="button" className="primary-button" onClick={onDone}>{it.casa.done}</button>
      </div>
    );
  }

  async function register() {
    if (!plan || !amount) return;
    setSaving(true);
    setError(null);
    try {
      const r = await registerBill(db, { billId: bill.id, amount, date, payer });
      setDone(r.plan.transfers);
    } catch (e) {
      console.error(e);
      setError(it.casa.error);
    } finally {
      setSaving(false);
    }
  }

  // Il saldo dopo la registrazione serve solo se con la coinquilina c'era già qualcosa in sospeso.
  const balanceBefore = bill.personId ? balanceWith(loans, bill.personId) : 0;
  const balanceAfter = plan?.loan && bill.personId && balanceBefore !== 0
    ? balanceBefore + (plan.loan.direction === 'lent' ? plan.loan.amount : -plan.loan.amount)
    : null;

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void register(); }}>
      {!hasPeriod ? <p className="outcome outcome--info">{it.casa.noPeriod}</p> : null}
      <div className="recurring-form__grid">
        <AmountField id="bill-amount" label={it.casa.amount} value={amountValue} onChange={setAmountValue} invalid={amountValue !== '' && !plan} />
        <div className="select-field">
          <label htmlFor="bill-date">{it.casa.date}</label>
          <input id="bill-date" className="text-input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      </div>
      {bill.personId ? (
        <div className="recurring-form__card">
          <span className="entry__label">{it.casa.whoPaid}</span>
          <SegmentedControl
            label={it.casa.whoPaid}
            options={[
              { value: 'me', label: it.casa.paidByMe },
              { value: 'roommate', label: name },
            ]}
            value={payer}
            onChange={setPayer}
          />
        </div>
      ) : null}
      {plan ? (
        <div className="bill-preview-box">
          <h3 className="entry__label">{it.casa.preview}</h3>
          <ul className="bill-preview">
            <li>
              {it.casa.previewExpenseFund(money(plan.myShare))}
            </li>
            {plan.loan ? (
              <li>{plan.loan.direction === 'lent' ? it.casa.previewLent(name, money(plan.loan.amount)) : it.casa.previewBorrowed(name, money(plan.loan.amount))}</li>
            ) : null}
            {balanceAfter !== null ? (
              <li className="bill-preview__soft">
                {balanceAfter > 0 ? it.casa.owesYou(name, money(balanceAfter)) : balanceAfter < 0 ? it.casa.youOwe(name, money(-balanceAfter)) : `${name}: ${it.casa.even}`}
              </li>
            ) : null}
            <li className={bill.fund + plan.fundDelta < 0 ? 'is-over' : ''}>{it.casa.previewFundAfter(formatEuro(bill.fund + plan.fundDelta, { decimals: 'always' }))}</li>
          </ul>
          {plan.transfers.length > 0 ? (
            <>
              <h3 className="entry__label">{it.casa.transfersTitle}</h3>
              <ul className="bill-preview">{plan.transfers.map((t, i) => <li key={i}>{transferText(t)}</li>)}</ul>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <button type="submit" className="primary-button" disabled={!plan || !hasPeriod || saving}>{it.casa.register}</button>
    </form>
  );
}

const FREQUENCIES: BillFrequency[] = [1, 2, 3, 6, 12];

type FormProps = {
  bill: Bill | null;
  people: Person[];
  loans: Loan[];
  defaultPersonId: string | null;
  opening: string;
  onDone: () => void;
};

/** Mesi proposti per la prossima bolletta: dal prossimo giroconto per due anni (più quello salvato, se è fuori). */
function dueOptions(opening: string, current: string | null): string[] {
  const list = Array.from({ length: 24 }, (_, i) => addMonthsId(opening, i));
  return current && !list.includes(current) ? [current, ...list] : list;
}

function monthLabel(id: string): string {
  const [y, m] = id.split('-');
  return it.casa.nextDueOption(it.months.long[Number(m) - 1] ?? id, y ?? '');
}

function BillForm({ bill, people, loans, defaultPersonId, opening, onDone }: FormProps) {
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(bill?.name ?? '');
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? 1);
  const [estimate, setEstimate] = useState(bill ? amountText(bill.estimate) : '');
  const [split, setSplit] = useState<Bill['split']>(bill?.split ?? 'half');
  const [personId, setPersonId] = useState<string | null>(bill?.personId ?? defaultPersonId);
  const [payer, setPayer] = useState<Bill['payer']>(bill?.payer ?? 'me');
  const [active, setActive] = useState(bill?.active ?? true);
  const [nextDue, setNextDue] = useState<string | null>(bill?.nextDue ?? null);
  const [error, setError] = useState<string | null>(null);
  const cents = parseEuro(estimate);
  const periodic = isPeriodic({ frequency });
  const previewQuota = cents !== null && cents > 0
    ? monthlyQuota({ estimate: cents, split, frequency, fund: bill?.fund ?? 0, nextDue: periodic ? nextDue : null }, opening)
    : null;
  const needsPerson = split === 'half' || payer === 'roommate';
  const valid = name.trim() !== '' && cents !== null && cents > 0 && (!needsPerson || !!personId);

  async function save() {
    if (!valid || cents === null) {
      setError(it.casa.invalid);
      return;
    }
    try {
      await saveBill(db, {
        id: bill?.id ?? newId(),
        name,
        frequency,
        estimate: cents,
        split,
        payer: split === 'mine' ? 'me' : payer,
        personId: needsPerson ? personId : null,
        fund: bill?.fund ?? 0,
        nextDue: periodic ? nextDue : null,
        active,
        order: bill?.order ?? Date.now(),
        createdAt: bill?.createdAt ?? nowISO(),
      });
      onDone();
    } catch (e) {
      console.error(e);
      setError(it.casa.error);
    }
  }

  async function remove() {
    if (!bill) return;
    await deleteBill(db, bill.id);
    onDone();
  }

  if (confirming) {
    return <ConfirmPanel message={it.casa.confirmDelete(bill?.name ?? '')} confirmLabel={it.casa.delete} onConfirm={() => void remove()} onCancel={() => setConfirming(false)} />;
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="entry__section">
        <label htmlFor="bill-name" className="entry__label">{it.casa.name}</label>
        <input id="bill-name" className="text-input" value={name} placeholder={it.casa.namePlaceholder} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="recurring-form__grid">
        <div className="select-field">
          <label htmlFor="bill-frequency">{it.casa.frequencyLabel}</label>
          <select id="bill-frequency" value={frequency} onChange={(e) => setFrequency(Number(e.target.value) as BillFrequency)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{it.casa.frequency[f]}</option>)}
          </select>
        </div>
        <AmountField id="bill-estimate" label={it.casa.estimate} value={estimate} onChange={setEstimate} invalid={estimate !== '' && (cents === null || cents <= 0)} />
      </div>
      {periodic ? (
        <div className="due-field">
          <div className="select-field">
            <label htmlFor="bill-next-due">{it.casa.nextDue}</label>
            <select id="bill-next-due" value={nextDue ?? ''} onChange={(e) => setNextDue(e.target.value || null)}>
              <option value="">{it.casa.nextDueUnknown}</option>
              {dueOptions(opening, bill?.nextDue ?? null).map((id) => <option key={id} value={id}>{monthLabel(id)}</option>)}
            </select>
          </div>
          {previewQuota !== null ? <p className="bill-quota-preview">{it.casa.quotaPreview(formatEuro(previewQuota))}</p> : null}
          <p className="muted-note">{it.casa.nextDueHint}</p>
        </div>
      ) : null}
      <div className="recurring-form__card">
        <span className="entry__label">{it.casa.split}</span>
        <SegmentedControl
          label={it.casa.split}
          options={[
            { value: 'half', label: it.casa.splitHalfShort },
            { value: 'mine', label: it.casa.splitMineShort },
          ]}
          value={split}
          onChange={setSplit}
        />
      </div>
      {split === 'half' ? (
        <>
          <div className="entry__section">
            <span className="entry__label">{it.casa.roommate}</span>
            <PersonPicker people={people} loans={loans} value={personId} onChange={setPersonId} />
          </div>
          <div className="recurring-form__card">
            <span className="entry__label">{it.casa.payer}</span>
            <SegmentedControl
              label={it.casa.payer}
              options={[
                { value: 'me', label: it.casa.payerMeShort },
                { value: 'roommate', label: people.find((p) => p.id === personId)?.name ?? it.casa.payerOtherShort },
              ]}
              value={payer}
              onChange={setPayer}
            />
          </div>
        </>
      ) : null}
      <Switch label={it.casa.active} hint={it.casa.activeHint} checked={active} onChange={setActive} />
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <div className="recurring-form__actions">
        {bill ? <button type="button" className="outcome__button outcome__button--secondary" onClick={() => setConfirming(true)}>{it.casa.delete}</button> : null}
        <button type="submit" className="primary-button recurring-form__save">{it.casa.save}</button>
      </div>
    </form>
  );
}
