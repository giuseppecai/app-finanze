import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, usePeriods, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { InfoBox } from '../../components/InfoBox';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Stepper } from '../../components/Stepper';
import { db } from '../../db/database';
import { newId, saveEnvelopes } from '../../db/repositories';
import { formatEuro } from '../../domain/money';
import { mainRecurringEnvelope } from '../../domain/recurring';
import { planCapsChange } from '../../domain/settings';
import { averageSpending } from '../../domain/stats';
import type { Cents, Envelope, EnvelopeKind } from '../../domain/types';
import { it } from '../../i18n/it';
import { DataSection } from './DataSection';

type NewEnvelope = { id: string; name: string; shortName: string; kind: EnvelopeKind; cap: Cents };

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Imposta · Modifica buste: tetti con stepper, spesa media (R10), giorno di inizio, nuova busta, Dati. */
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
    <>
      <EnvelopesEditor
        key={envelopes.map((e) => `${e.id}:${e.cap}`).join('|') + settings.periodStartDay}
        envelopes={envelopes}
        startDay={settings.periodStartDay}
        periods={periods}
        hasCurrent={current}
        recurringEnvelope={mainRecurringEnvelope(recurring)}
        recurringCount={recurring.length}
        billsCount={bills.length}
        message={message}
        setMessage={setMessage}
      />
      <DataSection settings={settings} />
    </>
  );
}

type EditorProps = {
  envelopes: Envelope[];
  startDay: number;
  periods: Parameters<typeof averageSpending>[1];
  hasCurrent: { allocations: Record<string, Cents> } | null;
  recurringEnvelope: string | null;
  recurringCount: number;
  billsCount: number;
  message: string | null;
  setMessage: (m: string | null) => void;
};

function EnvelopesEditor({ envelopes, startDay, periods, hasCurrent, recurringEnvelope, recurringCount, billsCount, message, setMessage }: EditorProps) {
  const active = envelopes.filter((e) => !e.archived);
  const [caps, setCaps] = useState<Record<string, Cents>>(() => Object.fromEntries(active.map((e) => [e.id, e.cap])));
  const [added, setAdded] = useState<NewEnvelope[]>([]);
  const [day, setDay] = useState(startDay);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const changedCaps = Object.fromEntries(Object.entries(caps).filter(([id, c]) => envelopes.find((e) => e.id === id)?.cap !== c));
  const dirty = Object.keys(changedCaps).length > 0 || added.length > 0 || day !== startDay;
  const touch = () => setMessage(null);
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
      const change = await saveEnvelopes(db, { caps: changedCaps, added, periodStartDay: day });
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

  function detailFor(e: Envelope) {
    if (e.kind === 'committed' && e.id === recurringEnvelope) {
      return <Link to={routes.recurring} className="cap-row__detail cap-row__link">{it.settings.recurringDetail(recurringCount)}</Link>;
    }
    if (e.kind === 'committed') {
      return <Link to={routes.casa} className="cap-row__detail cap-row__link">{it.settings.billsDetail(billsCount)}</Link>;
    }
    const avg = averages[e.id];
    if (!avg) return null;
    return (
      <span className={avg.aboveCap ? 'cap-row__detail is-over' : 'cap-row__detail'}>
        {avg.aboveCap ? it.settings.averageOver(formatEuro(avg.average)) : it.settings.average(formatEuro(avg.average))}
      </span>
    );
  }

  const groups: { title: string; kind: EnvelopeKind }[] = [
    { title: it.settings.spendable, kind: 'spendable' },
    { title: it.settings.committed, kind: 'committed' },
  ];

  return (
    <>
      <ScreenHeader title={it.settings.title} subtitle={it.settings.subtitle} />
      {groups.map((g) => {
        const list = active.filter((e) => e.kind === g.kind);
        const extra = added.filter((a) => a.kind === g.kind);
        if (list.length + extra.length === 0) return null;
        return (
          <section key={g.kind} className="settings-section">
            <h2 className="section-head--muted">{g.title}</h2>
            <ul className="card edit-list">
              {list.map((e) => (
                <li key={e.id} className="cap-row">
                  <span className="cap-row__text">
                    <span className="cap-row__name">{e.name}</span>
                    {detailFor(e)}
                  </span>
                  <Stepper label={it.settings.stepper(e.name)} value={caps[e.id] ?? e.cap} onChange={(c) => { touch(); setCaps((s) => ({ ...s, [e.id]: c })); }} />
                </li>
              ))}
              {extra.map((a) => (
                <li key={a.id} className="cap-row">
                  <span className="cap-row__text"><span className="cap-row__name">{a.name}</span></span>
                  <Stepper label={it.settings.stepper(a.name)} value={a.cap} onChange={(c) => setAdded((xs) => xs.map((x) => (x.id === a.id ? { ...x, cap: c } : x)))} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="card setting-row settings-section">
        <span className="cap-row__text">
          <label htmlFor="start-day" className="cap-row__name">{it.settings.startDay}</label>
          <span className="cap-row__detail">{it.settings.startDayHint}</span>
        </span>
        <select id="start-day" value={day} onChange={(e) => { touch(); setDay(Number(e.target.value)); }}>
          {DAYS.map((d) => <option key={d} value={d}>{it.settings.startDayOption(d)}</option>)}
        </select>
      </div>

      <div className="settings-section">
        {adding ? (
          <NewEnvelopeForm
            onAdd={(e) => { touch(); setAdded((xs) => [...xs, e]); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="dashed-button" onClick={() => setAdding(true)}>{it.settings.newEnvelope}</button>
        )}
      </div>

      <section className="total-dark">
        <span className="total-dark__label">
          {it.settings.total}
          <span className="total-dark__note">
            {diff > 0 ? it.settings.more(formatEuro(diff)) : diff < 0 ? it.settings.less(formatEuro(-diff)) : it.settings.same}
          </span>
        </span>
        <span className="total-dark__value">{formatEuro(total)}</span>
      </section>

      {dirty && preview.transfer ? (
        <InfoBox>
          {preview.transfer.to === 'budget'
            ? it.settings.transferUp(formatEuro(preview.transfer.amount)).replace('Buste salvate. ', 'Salvando: ')
            : it.settings.transferDown(formatEuro(preview.transfer.amount)).replace('Buste salvate. ', 'Salvando: ')}
        </InfoBox>
      ) : null}
      {message ? <InfoBox>{message}</InfoBox> : null}
      <button type="button" className="primary-button settings-save" disabled={!dirty || saving} onClick={() => void save()}>
        {it.settings.save}
      </button>
    </>
  );
}

function NewEnvelopeForm({ onAdd, onCancel }: { onAdd: (e: NewEnvelope) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<EnvelopeKind>('spendable');
  const [cap, setCap] = useState<Cents>(5000);
  return (
    <div className="card new-envelope">
      <div className="entry__section">
        <label htmlFor="new-envelope-name" className="entry__label">{it.settings.newName}</label>
        <input id="new-envelope-name" className="text-input" value={name} placeholder={it.settings.newNamePlaceholder} autoFocus onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="new-envelope__row">
        <SegmentedControl
          label={it.settings.newKind}
          options={[
            { value: 'spendable', label: it.settings.kindSpendable },
            { value: 'committed', label: it.settings.kindCommitted },
          ]}
          value={kind}
          onChange={setKind}
        />
        <Stepper label={it.settings.stepper(name || it.settings.newName)} value={cap} onChange={setCap} />
      </div>
      <div className="new-envelope__row">
        <button type="button" className="quiet-button" onClick={onCancel}>{it.settings.cancel}</button>
        <button
          type="button"
          className="outcome__button outcome__button--accent"
          disabled={name.trim() === ''}
          onClick={() => onAdd({ id: newId(), name: name.trim(), shortName: name.trim().split(/\s+/)[0] ?? name.trim(), kind, cap })}
        >
          {it.settings.add}
        </button>
      </div>
    </div>
  );
}
