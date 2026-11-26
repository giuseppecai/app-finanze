import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../app/routes';
import { BottomSheet } from '../../components/BottomSheet';
import { db } from '../../db/database';
import { saveReconciliation, type SaveReconciliationInput } from '../../db/repositories';
import { today } from '../../domain/clock';
import { formatEuro, parseEuro } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import type { PotLine } from '../../domain/pots';
import { reconcile, type RevolutBalances } from '../../domain/reconcile';
import type { Cents, Period, Reconciliation, ReconciliationOutcome } from '../../domain/types';
import { it } from '../../i18n/it';

type Props = {
  open: boolean;
  onClose: () => void;
  period: Period;
  /** Σ residui di tutte le buste */
  envelopesTotal: Cents;
  unassigned: Cents;
  cardReserve: Cents | null;
  last: Reconciliation | null;
  /** tutte le Pocket di "Messi da parte": compaiono e spariscono con loro */
  pots: PotLine[];
};

type Field = { key: string; label: string; hint?: string };
const potKey = (id: string) => `pot:${id}`;

/** R5 · Ricopia i saldi di Revolut (Budget del mese, le due carte e tutte le Pocket): l'app dice se torna e cosa fare. */
export function ReconcileSheet({ open, onClose, period, envelopesTotal, unassigned, cardReserve, last, pots }: Props) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups: { title: string; fields: Field[] }[] = [
    { title: it.reconcile.groupBudget, fields: [{ key: 'budgetPocket', label: it.reconcile.fields.budgetPocket }] },
    { title: it.reconcile.groupCards, fields: [{ key: 'quotidiano', label: it.reconcile.fields.quotidiano }, { key: 'extra', label: it.reconcile.fields.extra }] },
    ...(pots.length > 0
      ? [{ title: it.reconcile.groupPots, fields: pots.map((p) => ({ key: potKey(p.id), label: p.name, hint: it.reconcile.inAppHint(formatEuro(p.balance, { decimals: 'always' })) })) }]
      : []),
  ];
  const fields = groups.flatMap((g) => g.fields);
  const text = (k: string) => values[k] ?? '';
  const valueOf = (k: string) => (text(k).trim() === '' ? null : parseEuro(text(k)));

  const now = today();
  const filled = fields.every((f) => text(f.key).trim() !== '');
  const invalid = fields.some((f) => text(f.key).trim() !== '' && valueOf(f.key) === null);
  const amountOf = (k: string) => valueOf(k) ?? 0;
  const balances: RevolutBalances = { budgetPocket: amountOf('budgetPocket'), quotidiano: amountOf('quotidiano'), extra: amountOf('extra') };
  const potsRevolut = Object.fromEntries(pots.map((p) => [p.id, amountOf(potKey(p.id))]));
  const potsComparison = {
    revolut: Object.values(potsRevolut).reduce((a, b) => a + b, 0),
    app: pots.reduce((a, p) => a + p.balance, 0),
  };
  const result = reconcile(balances, envelopesTotal, unassigned, cardReserve, potsComparison);
  const ready = filled && !invalid;

  function close() {
    setValues({});
    setError(null);
    onClose();
  }

  async function save(outcome: ReconciliationOutcome, extra: Pick<SaveReconciliationInput, 'calibrateReserve' | 'income'> = {}) {
    setSaving(true);
    setError(null);
    try {
      await saveReconciliation(db, {
        reconciliation: { date: now, periodId: period.id, ...balances, pots: potsRevolut, expected: result.expected, diff: result.diff, outcome },
        ...extra,
      });
      return true;
    } catch (e) {
      console.error(e);
      setError(it.reconcile.error);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function confirmOk() {
    if (await save(result.outcome === 'calibrated' ? 'calibrated' : 'ok', result.outcome === 'calibrated' ? { calibrateReserve: result.cardReserve } : {})) close();
  }

  async function addExpense() {
    const amount = -result.diff;
    if (await save('missingExpense')) {
      close();
      navigate(`${routes.entry}?tipo=spesa&importo=${amount}&fonte=confronta`);
    }
  }

  async function ignore() {
    if (await save('ignored')) close();
  }

  async function recordIncome() {
    if (await save('extraIncome', { income: { amount: result.diff, date: now, note: it.reconcile.incomeNote } })) close();
  }

  async function isRefund() {
    const amount = result.diff;
    if (await save('extraIncome')) {
      close();
      navigate(`${routes.entry}?tipo=rimborso&importo=${amount}&fonte=confronta`);
    }
  }

  const subtitle = `${it.reconcile.intro} ${last ? it.reconcile.last(it.relativeDays(daysAgo(last.date, now))) : it.reconcile.never}`;
  const money = (c: Cents) => formatEuro(c, { decimals: 'always' });

  return (
    <BottomSheet open={open} onClose={close} title={it.reconcile.title} subtitle={subtitle}>
      {groups.map((g) => (
        <section key={g.title} className="reconcile-group" aria-label={g.title}>
          <h3 className="reconcile-group__title">{g.title}</h3>
          {g.fields.map((f) => (
            <div key={f.key} className="balance-row">
              <label htmlFor={`balance-${f.key}`} className="balance-row__label">
                {f.label}
                {f.hint ? <span className="balance-row__hint">{f.hint}</span> : null}
              </label>
              <div className={text(f.key).trim() !== '' && valueOf(f.key) === null ? 'amount-field__box is-invalid' : 'amount-field__box'}>
                <span className="amount-field__currency" aria-hidden="true">€</span>
                <input
                  id={`balance-${f.key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="next"
                  value={text(f.key)}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </section>
      ))}

      <div className="reconcile-totals">
        <span>{it.reconcile.onRevolut(ready ? money(result.real) : '—')}</span>
        <span>{it.reconcile.inApp(money(cardReserve === null ? envelopesTotal + unassigned + potsComparison.app : result.expected))}</span>
      </div>

      <div aria-live="polite">
        {!ready ? (
          <div className="outcome outcome--info">{invalid ? it.reconcile.invalid : it.reconcile.fillAll}</div>
        ) : result.outcome === 'calibrated' ? (
          result.cardReserve >= 0 ? (
            <div className="outcome outcome--info">
              <p className="outcome__title">{it.reconcile.calibrateTitle}</p>
              <p>{it.reconcile.calibrateText(money(result.cardReserve))}</p>
              <div className="outcome__actions">
                <button type="button" className="outcome__button outcome__button--accent" disabled={saving} onClick={() => void confirmOk()}>
                  {it.reconcile.calibrateConfirm(money(result.cardReserve))}
                </button>
              </div>
            </div>
          ) : (
            <div className="outcome outcome--missing">
              <p className="outcome__title">{it.reconcile.calibrateTitle}</p>
              <p>{it.reconcile.calibrateNegative}</p>
            </div>
          )
        ) : result.outcome === 'ok' ? (
          <div className="outcome outcome--ok">
            <p className="outcome__title">{it.reconcile.okTitle}</p>
            <p>{it.reconcile.okText}</p>
            <div className="outcome__actions">
              <button type="button" className="outcome__button outcome__button--accent" disabled={saving} onClick={() => void confirmOk()}>
                {it.reconcile.done}
              </button>
            </div>
          </div>
        ) : result.outcome === 'missingExpense' ? (
          <div className="outcome outcome--missing">
            <p className="outcome__title">{it.reconcile.missingTitle(money(-result.diff))}</p>
            <p>{it.reconcile.missingText}</p>
            <div className="outcome__actions">
              <button type="button" className="outcome__button outcome__button--accent" disabled={saving} onClick={() => void addExpense()}>
                {it.reconcile.addExpenseOf(money(-result.diff))}
              </button>
              <button type="button" className="outcome__button outcome__button--danger-secondary" disabled={saving} onClick={() => void ignore()}>
                {it.reconcile.ignore}
              </button>
            </div>
          </div>
        ) : (
          <div className="outcome outcome--extra">
            <p className="outcome__title">{it.reconcile.extraTitle(money(result.diff))}</p>
            <p>{it.reconcile.extraText}</p>
            <div className="outcome__actions">
              <button type="button" className="outcome__button outcome__button--dark" disabled={saving} onClick={() => void recordIncome()}>
                {it.reconcile.recordIncome}
              </button>
              <button type="button" className="outcome__button outcome__button--secondary" disabled={saving} onClick={() => void isRefund()}>
                {it.reconcile.isRefund}
              </button>
            </div>
          </div>
        )}
      </div>
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
    </BottomSheet>
  );
}
