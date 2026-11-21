import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, usePeriods, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { BottomSheet } from '../../components/BottomSheet';
import { IconChevronRight } from '../../components/icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Stepper } from '../../components/Stepper';
import { db } from '../../db/database';
import { newId, saveEnvelopes, updateSettings } from '../../db/repositories';
import { billsQuotaTotal } from '../../domain/bills';
import { formatEuro } from '../../domain/money';
import { mainRecurringEnvelope } from '../../domain/recurring';
import { planCapsChange } from '../../domain/settings';
import { averageSpending } from '../../domain/stats';
import type { Bill, Cents, Envelope, EnvelopeKind, MonthlyItem, Settings } from '../../domain/types';
import { it } from '../../i18n/it';
import { BackupGroup, PotsGroup } from './DataSection';
import { MonthlyItemSheet } from './MonthlyItemSheet';

type NewEnvelope = { id: string; name: string; shortName: string; kind: EnvelopeKind; cap: Cents };

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Imposta: elenco raggruppato come le Impostazioni di iOS.
 * Buste (tetti con stepper, salvataggio in una barra che compare solo con modifiche),
 * Inizio del mese (giorno, voci fisse, bollette), Salvadanai e carte, Backup.
 */
export function SettingsPage() {
  const envelopes = useEnvelopes();
  const settings = useSettings();
  const periods = usePeriods();
  const current = useCurrentPeriod();
  const recurring = useRecurring();
  const bills = useBills();
  // Il messaggio sta qui: dopo il salvataggio l'editor si ricrea con i tetti nuovi.
  const [message, setMessage] = useState<string | null>(null);
  if (!envelopes || !settings || !periods || current === undefined || !recurring || !bills) return null;
  return (
    <div className="settings">
      <ScreenHeader title={it.settings.title} subtitle={it.settings.subtitle} />
      <EnvelopesGroup
        key={envelopes.map((e) => `${e.id}:${e.cap}`).join('|')}
        envelopes={envelopes}
        periods={periods}
        hasCurrent={current}
        recurringEnvelope={mainRecurringEnvelope(recurring)}
        recurringCount={recurring.length}
        message={message}
        setMessage={setMessage}
      />
      <MonthGroup settings={settings} bills={bills} />
      <PotsGroup settings={settings} />
      <BackupGroup settings={settings} />
    </div>
  );
}

type EnvelopesProps = {
  envelopes: Envelope[];
  periods: Parameters<typeof averageSpending>[1];
  hasCurrent: { allocations: Record<string, Cents> } | null;
  recurringEnvelope: string | null;
  recurringCount: number;
  message: string | null;
  setMessage: (m: string | null) => void;
};

function EnvelopesGroup({ envelopes, periods, hasCurrent, recurringEnvelope, recurringCount, message, setMessage }: EnvelopesProps) {
  const active = envelopes.filter((e) => !e.archived);
  const initial = () => Object.fromEntries(active.map((e) => [e.id, e.cap]));
  const [caps, setCaps] = useState<Record<string, Cents>>(initial);
  const [added, setAdded] = useState<NewEnvelope[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const changedCaps = Object.fromEntries(Object.entries(caps).filter(([id, c]) => envelopes.find((e) => e.id === id)?.cap !== c));
  const dirty = Object.keys(changedCaps).length > 0 || added.length > 0;
  const allCaps = { ...caps, ...Object.fromEntries(added.map((a) => [a.id, a.cap])) };
  const preview = planCapsChange([...envelopes, ...added.map((a) => ({ ...a, order: 0, archived: false }))], allCaps, hasCurrent);
  const total = Object.values(allCaps).reduce((s, v) => s + v, 0);
  const before = active.reduce((s, e) => s + e.cap, 0);
  const diff = total - before;

  const averages = useMemo(
    () => Object.fromEntries(active.map((e) => [e.id, averageSpending({ id: e.id, cap: caps[e.id] ?? e.cap }, periods)])),
    [active, caps, periods],
  );

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const settings = await db.settings.get('settings');
      const change = await saveEnvelopes(db, { caps: changedCaps, added, periodStartDay: settings?.periodStartDay ?? 27 });
      const t = change.transfer;
      setMessage(t ? (t.to === 'budget' ? it.settings.transferUp(formatEuro(t.amount)) : it.settings.transferDown(formatEuro(t.amount))) : it.settings.saved);
      setAdded([]);
    } catch (e) {
      console.error(e);
      setMessage(it.settings.error);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setCaps(initial());
    setAdded([]);
  }

  function detailFor(e: Envelope) {
    if (e.id === recurringEnvelope) {
      return (
        <Link to={routes.recurring} className="list-row__chip">
          {it.settings.recurringDetail(recurringCount)}<IconChevronRight size={14} />
        </Link>
      );
    }
    const avg = averages[e.id];
    if (!avg) return null;
    return (
      <span className={avg.aboveCap ? 'list-row__detail is-over' : 'list-row__detail'}>
        {avg.aboveCap ? it.settings.averageOver(formatEuro(avg.average)) : it.settings.average(formatEuro(avg.average))}
      </span>
    );
  }

  const groups: { title: string; kind: EnvelopeKind }[] = [
    { title: it.settings.spendable, kind: 'spendable' },
    { title: it.settings.committed, kind: 'committed' },
  ];

  return (
    <section className="group" aria-labelledby="envelopes-title">
      <h2 id="envelopes-title" className="group__title">{it.settings.envelopesTitle}</h2>
      <div className="card list-card">
        {groups.map((g) => {
          const list = active.filter((e) => e.kind === g.kind);
          const extra = added.filter((a) => a.kind === g.kind);
          if (list.length + extra.length === 0) return null;
          return (
            <div key={g.kind} className="list-card__block">
              <p className="list-card__label">{g.title}</p>
              <ul className="list">
                {list.map((e) => (
                  <li key={e.id} className="list-row">
                    <span className="list-row__text">
                      <span className="list-row__title">{e.name}</span>
                      {detailFor(e)}
                    </span>
                    <Stepper label={it.settings.stepper(e.name)} value={caps[e.id] ?? e.cap} onChange={(c) => { setMessage(null); setCaps((s) => ({ ...s, [e.id]: c })); }} />
                  </li>
                ))}
                {extra.map((a) => (
                  <li key={a.id} className="list-row">
                    <span className="list-row__text"><span className="list-row__title">{a.name}</span></span>
                    <Stepper label={it.settings.stepper(a.name)} value={a.cap} onChange={(c) => setAdded((xs) => xs.map((x) => (x.id === a.id ? { ...x, cap: c } : x)))} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <button type="button" className="list-row list-row--action" onClick={() => setAdding(true)}>{it.settings.newEnvelope}</button>
        <div className="list-row list-row--total">
          <span className="list-row__text">
            <span className="list-row__title">{it.settings.total}</span>
            <span className="list-row__detail">
              {diff > 0 ? it.settings.more(formatEuro(diff)) : diff < 0 ? it.settings.less(formatEuro(-diff)) : it.settings.totalNote}
            </span>
          </span>
          <span className="list-row__total">{formatEuro(total)}</span>
        </div>
      </div>
      <p className="group__footer">{it.settings.envelopesHint}</p>
      {message ? <p className="group__message" role="status">{message}</p> : null}

      {dirty ? (
        <div className="save-bar" role="region" aria-label={it.settings.unsaved}>
          <p className="save-bar__text">
            {preview.transfer
              ? preview.transfer.to === 'budget'
                ? it.settings.previewUp(formatEuro(preview.transfer.amount))
                : it.settings.previewDown(formatEuro(preview.transfer.amount))
              : it.settings.unsaved}
          </p>
          <div className="save-bar__actions">
            <button type="button" className="save-bar__discard" onClick={discard}>{it.settings.discard}</button>
            <button type="button" className="save-bar__save" disabled={saving} onClick={() => void save()}>{it.settings.save}</button>
          </div>
        </div>
      ) : null}

      <BottomSheet open={adding} onClose={() => setAdding(false)} title={it.settings.newEnvelope.replace('+ ', '')}>
        {adding ? (
          <NewEnvelopeForm
            onAdd={(e) => { setMessage(null); setAdded((xs) => [...xs, e]); setAdding(false); }}
          />
        ) : null}
      </BottomSheet>
    </section>
  );
}

function NewEnvelopeForm({ onAdd }: { onAdd: (e: NewEnvelope) => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<EnvelopeKind>('spendable');
  const [cap, setCap] = useState<Cents>(5000);
  const valid = name.trim() !== '';
  return (
    <form
      className="recurring-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onAdd({ id: newId(), name: name.trim(), shortName: name.trim().split(/\s+/)[0] ?? name.trim(), kind, cap });
      }}
    >
      <div className="entry__section">
        <label htmlFor="new-envelope-name" className="entry__label">{it.settings.newName}</label>
        <input id="new-envelope-name" className="text-input" value={name} placeholder={it.settings.newNamePlaceholder} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="recurring-form__card">
        <span className="entry__label">{it.settings.newKind}</span>
        <SegmentedControl
          label={it.settings.newKind}
          options={[
            { value: 'spendable', label: it.settings.kindSpendable },
            { value: 'committed', label: it.settings.kindCommitted },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>
      <div className="list-row list-row--flat">
        <span className="list-row__title">{it.settings.stepper(name.trim() || it.settings.newName)}</span>
        <Stepper label={it.settings.stepper(name || it.settings.newName)} value={cap} onChange={setCap} />
      </div>
      <button type="submit" className="primary-button" disabled={!valid}>{it.settings.add}</button>
    </form>
  );
}

function MonthGroup({ settings, bills }: { settings: Settings; bills: Bill[] }) {
  const [target, setTarget] = useState<MonthlyItem | 'new' | null>(null);
  const activeBills = bills.filter((b) => b.active);
  return (
    <section className="group" aria-labelledby="month-title">
      <h2 id="month-title" className="group__title">{it.settings.monthTitle}</h2>
      <ul className="card list-card list">
        <li className="list-row">
          <span className="list-row__text">
            <label htmlFor="start-day" className="list-row__title">{it.settings.startDay}</label>
            <span className="list-row__detail">{it.settings.startDayDetail}</span>
          </span>
          <span className="list-row__select">
            <select
              id="start-day"
              value={settings.periodStartDay}
              onChange={(e) => void updateSettings(db, { periodStartDay: Number(e.target.value) })}
            >
              {DAYS.map((d) => <option key={d} value={d}>{it.settings.startDayOption(d)}</option>)}
            </select>
          </span>
        </li>
        {settings.monthlyItems.map((item) => (
          <li key={item.id}>
            <button type="button" className="list-row list-row--button" onClick={() => setTarget(item)}>
              <span className="list-row__text">
                <span className={item.archived ? 'list-row__title is-muted' : 'list-row__title'}>{item.name}</span>
                <span className="list-row__detail">
                  {item.kind === 'pot' ? it.items.kindPot : it.items.kindPayment}{item.archived ? ` · ${it.settings.archived}` : ''}
                </span>
              </span>
              <span className={item.archived ? 'list-row__value is-muted' : 'list-row__value'}>{formatEuro(item.amount)}</span>
              <IconChevronRight className="list-row__chevron" />
            </button>
          </li>
        ))}
        <li>
          <Link to={routes.bills} className="list-row list-row--button">
            <span className="list-row__text">
              <span className="list-row__title">{it.settings.billsRow}</span>
              <span className="list-row__detail">{it.settings.billsDetail(activeBills.length)}</span>
            </span>
            <span className="list-row__value">{it.settings.billsAmount(formatEuro(billsQuotaTotal(bills)))}</span>
            <IconChevronRight className="list-row__chevron" />
          </Link>
        </li>
        <li>
          <button type="button" className="list-row list-row--action" onClick={() => setTarget('new')}>{it.items.add}</button>
        </li>
      </ul>
      <p className="group__footer">{it.settings.monthHint}</p>
      <MonthlyItemSheet target={target} onClose={() => setTarget(null)} />
    </section>
  );
}
