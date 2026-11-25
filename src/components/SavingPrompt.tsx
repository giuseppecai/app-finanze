import { useEffect, useRef, useState } from 'react';
import { AmountField } from './AmountField';
import { addMonthsId, monthsBetween } from '../domain/dates';
import { amountText, formatEuro, parseEuro } from '../domain/money';
import { savingPreview } from '../domain/saving';
import type { Cents, PeriodId } from '../domain/types';
import { it } from '../i18n/it';

export interface SavingChoice {
  saveFrom: PeriodId;
  fund: Cents;
}

type Props = {
  name: string;
  /** quanto serve alla scadenza */
  target: Cents;
  /** periodo della prossima scadenza; null = non si sa (quota fissa) */
  due: PeriodId | null;
  /** ogni quanti mesi (per la quota fissa) */
  frequency: number;
  /** prossimo "Inizio del mese": il primo mese in cui si può iniziare */
  opening: PeriodId;
  initial: Partial<SavingChoice>;
  onYes: (choice: SavingChoice) => void;
  onNo: () => void;
};

const monthName = (id: string) => it.months.long[Number(id.slice(5, 7)) - 1] ?? id;
const monthYear = (id: string) => `${monthName(id)} ${id.slice(0, 4)}`;

/**
 * "Iniziamo ad accantonare?" (R15): quando inizi, quanto hai già da parte, e quanto verrebbe al mese.
 * Solo con "Sì" la voce passa ad accantonare; "No" = si paga tutto nel mese della scadenza.
 */
export function SavingPrompt({ name, target, due, frequency, opening, initial, onYes, onNo }: Props) {
  const lastStart = due && due >= opening ? due : opening;
  const starts = Array.from({ length: monthsBetween(opening, lastStart) + 1 }, (_, i) => addMonthsId(opening, i));
  const [from, setFrom] = useState<PeriodId>(initial.saveFrom && starts.includes(initial.saveFrom) ? initial.saveFrom : opening);
  const [fundText, setFundText] = useState(initial.fund ? amountText(initial.fund) : '');
  const fund = fundText.trim() === '' ? 0 : parseEuro(fundText);
  const fundOk = fund !== null && fund >= 0;
  const preview = due ? savingPreview(target, fund ?? 0, from, lastStart) : { quota: Math.ceil(target / frequency), months: 0 };
  const yesRef = useRef<HTMLButtonElement>(null);
  useEffect(() => yesRef.current?.focus(), []);

  return (
    <div className="confirm-panel saving-prompt" role="alertdialog" aria-labelledby="saving-title">
      <p id="saving-title" className="confirm-panel__message">{it.saving.question(name)}</p>
      <p className="muted-note">
        {due ? it.saving.due(monthYear(lastStart), formatEuro(target)) : it.saving.dueUnknown(formatEuro(target))}
      </p>
      <div className="recurring-form__grid">
        <div className="select-field">
          <label htmlFor="saving-from">{it.saving.from}</label>
          <select id="saving-from" value={from} onChange={(e) => setFrom(e.target.value)} disabled={starts.length < 2}>
            {starts.map((id) => <option key={id} value={id}>{monthYear(id)}</option>)}
          </select>
        </div>
        <AmountField id="saving-fund" label={it.saving.already} value={fundText} onChange={setFundText} invalid={!fundOk} />
      </div>
      <p className="muted-note">{it.saving.alreadyHint}</p>
      <div className="bill-preview-box">
        <p className="bill-quota-preview">
          {preview.quota > 0
            ? due
              ? it.saving.preview(formatEuro(preview.quota), preview.months, monthName(from), monthName(lastStart))
              : it.saving.previewFixed(formatEuro(preview.quota))
            : it.saving.covered}
        </p>
        <p className="muted-note">{it.saving.where}</p>
      </div>
      <button
        ref={yesRef}
        type="button"
        className="primary-button"
        disabled={!fundOk}
        onClick={() => fundOk && onYes({ saveFrom: from, fund: fund ?? 0 })}
      >
        {it.saving.yes}
      </button>
      <button type="button" className="sheet-actions__button" onClick={onNo}>
        {due ? it.saving.no(monthName(lastStart)) : it.saving.noUnknown}
      </button>
    </div>
  );
}
