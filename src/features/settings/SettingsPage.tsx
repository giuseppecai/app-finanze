import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBills, useCurrentPeriod, useEnvelopes, usePeriods, usePeriodTransactions, usePots, useRecurring, useSettings } from '../../app/data';
import { routes } from '../../app/routes';
import { BottomSheet } from '../../components/BottomSheet';
import { IconChevronRight, IconCompare, IconEnvelopes, IconPlus, IconSparkles } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { Tile } from '../../components/Symbol';
import { SymbolPicker, TileEdit } from '../../components/SymbolPicker';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Stepper } from '../../components/Stepper';
import { db } from '../../db/database';
import { newId, saveEnvelopes, updateSettings } from '../../db/repositories';
import { today } from '../../domain/clock';
import { nextOpeningId, periodName } from '../../domain/periods';
import { formatEuro } from '../../domain/money';
import { potLines } from '../../domain/pots';
import { suggestSymbol, symbolFor } from '../../domain/symbols';
import {
  allocationAfterRemoval, DEFAULT_DESTINATION, fundsDestinations, planCapsChange, recurringOnEnvelope, UNASSIGNED,
  type CapsChange, type DestinationOption, type FundsDestination,
} from '../../domain/settings';
import { averageSpending } from '../../domain/stats';
import { annualCost } from '../../domain/insights';
import type { Cents, Envelope, EnvelopeKind, Period, Recurring, Settings, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';
import { PotsGroup } from './DataSection';
import { daysAgo } from '../../domain/movements';
import { localISODate } from '../../domain/dates';
import { EnvelopeCapSheet, type CapTarget } from './EnvelopeCapSheet';

type NewEnvelope = { id: string; name: string; shortName: string; kind: EnvelopeKind; cap: Cents; icon: string };

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
  const txs = usePeriodTransactions(current?.id ?? null);
  const pots = usePots();
  // Il messaggio sta qui: dopo il salvataggio l'editor si ricrea con i tetti nuovi.
  const [message, setMessage] = useState<string | null>(null);
  if (!envelopes || !settings || !periods || current === undefined || !recurring || !bills || !txs || !pots) return null;
  const lines = potLines(pots, settings.monthlyItems);
  return (
    <div className="settings">
      <PageHeader
        title={it.settings.title}
        chip={{ icon: <IconEnvelopes />, text: it.settings.capsChip(formatEuro(envelopes.filter((e) => !e.archived).reduce((s, e) => s + e.cap, 0))) }}
        muted={it.settings.envelopesCount(envelopes.filter((e) => !e.archived).length)}
      />
      <EnvelopesGroup
        key={envelopes.map((e) => `${e.id}:${e.cap}:${e.archived}`).join('|')}
        envelopes={envelopes}
        periods={periods}
        current={current}
        txs={txs}
        recurring={recurring}
        destinations={fundsDestinations(lines, null, current !== null, it.funds.unassignedName)}
        balances={Object.fromEntries(lines.map((l) => [l.id, l.balance]))}
        message={message}
        setMessage={setMessage}
      />
      <MonthGroup settings={settings} current={current} nextName={periodName(nextOpeningId(periods, today(), settings.periodStartDay)).toLowerCase()} />
      <PotsGroup settings={settings} />
      <section className="group" aria-labelledby="data-title">
        <h2 id="data-title" className="group__title">{it.settings.dataTitle}</h2>
        <ul className="card list-card list">
          <li>
            <Link to={routes.backup} className="list-row list-row--button">
              <Tile symbol="download" />
              <span className="list-row__text">
                <span className="list-row__title">{it.settings.backupRow}</span>
                <span className="list-row__detail">
                  {settings.lastBackupAt ? it.settings.lastBackup(it.relativeDays(daysAgo(localISODate(new Date(settings.lastBackupAt)), today()))) : it.settings.neverBackup}
                </span>
              </span>
              <IconChevronRight className="list-row__chevron" />
            </Link>
          </li>
        </ul>
        <p className="group__footer">{it.settings.backupHint}</p>
      </section>
      <section className="group" aria-labelledby="help-title">
        <h2 id="help-title" className="group__title">{it.insights.helpTitle}</h2>
        <ul className="card list-card list">
          <li>
            <Link to={routes.howItWorks} className="list-row list-row--button">
              <Tile symbol="lightbulb" />
              <span className="list-row__text">
                <span className="list-row__title">{it.insights.howRow}</span>
                <span className="list-row__detail">{it.insights.howDetail}</span>
              </span>
              <IconChevronRight className="list-row__chevron" />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

type EnvelopesProps = {
  envelopes: Envelope[];
  periods: Parameters<typeof averageSpending>[1];
  current: Period | null;
  txs: Transaction[];
  recurring: Recurring[];
  destinations: DestinationOption[];
  balances: Record<string, Cents>;
  message: string | null;
  setMessage: (m: string | null) => void;
};

function EnvelopesGroup({ envelopes, periods, current, txs, recurring, destinations, balances, message, setMessage }: EnvelopesProps) {
  const active = envelopes.filter((e) => !e.archived);
  const initial = () => Object.fromEntries(active.map((e) => [e.id, e.cap]));
  const [caps, setCaps] = useState<Record<string, Cents>>(initial);
  const [added, setAdded] = useState<NewEnvelope[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [removedDest, setRemovedDest] = useState<Record<string, FundsDestination>>({});
  const [target, setTarget] = useState<CapTarget | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  // Gli abbonamenti non passano più da una busta (R16): nessuna busta è "degli abbonamenti".
  const recurringEnvelope: string | null = null;
  // Da Storico/Chiusura: "Porta il tetto a € 60" apre qui il pannello della busta con € 60 già scritto.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get('busta');
    const cap = Number(params.get('tetto'));
    const e = id ? active.find((x) => x.id === id) : undefined;
    if (!e || !Number.isInteger(cap) || cap <= 0) return;
    setTarget({
      id: e.id, name: e.name, cap, detail: null, recurringCount: recurringOnEnvelope(e.id, recurring).length,
      showRecurringLink: e.id === recurringEnvelope, freed: freedBy(e.id), symbol: symbolFor(e),
    });
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const changedCaps = Object.fromEntries(Object.entries(caps).filter(([id, c]) => !removed.includes(id) && envelopes.find((e) => e.id === id)?.cap !== c));
  const changedIcons = Object.fromEntries(Object.entries(icons).filter(([id, icon]) => envelopes.find((e) => e.id === id) && symbolFor(envelopes.find((e) => e.id === id)!) !== icon));
  const dirty = Object.keys(changedCaps).length > 0 || added.length > 0 || removed.length > 0 || Object.keys(changedIcons).length > 0;
  const keptCaps = Object.fromEntries(Object.entries(caps).filter(([id]) => !removed.includes(id)));
  const allCaps = { ...keptCaps, ...Object.fromEntries(added.map((a) => [a.id, a.cap])) };
  const removedPlan = Object.fromEntries(removed.map((id) => [id, current ? allocationAfterRemoval(id, current, txs) : null]));
  const preview = planCapsChange([...envelopes, ...added.map((a) => ({ ...a, order: 0, archived: false }))], allCaps, current, removedPlan, removedDest);
  const destName = (d: FundsDestination) => destinations.find((x) => x.value === d)?.name ?? '';
  /** residuo che una busta libera se la togli adesso (0 senza mese aperto) */
  const freedBy = (id: string) => (current ? (current.allocations[id] ?? 0) - (allocationAfterRemoval(id, current, txs) ?? 0) : 0);
  const transferText = (c: CapsChange, done: boolean) => [
    c.transfer
      ? c.transfer.to === 'budget'
        ? (done ? it.settings.transferUp : it.settings.previewUp)(formatEuro(c.transfer.amount))
        : (done ? it.settings.transferDown : it.settings.previewDown)(formatEuro(c.transfer.amount))
      : null,
    ...c.moves.filter((m) => m.to !== UNASSIGNED).map((m) => it.funds.move(formatEuro(m.amount), destName(m.to))),
  ].filter(Boolean).join(' ');
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
      const change = await saveEnvelopes(db, { caps: changedCaps, added, removed, destinations: removedDest, icons: changedIcons, periodStartDay: settings?.periodStartDay ?? 27 });
      setMessage(transferText(change, true) || it.settings.saved);
      setAdded([]);
      setRemoved([]);
      setRemovedDest({});
      setIcons({});
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
    setRemoved([]);
    setRemovedDest({});
    setIcons({});
  }

  type Detail = { text: string; warn?: boolean; was?: string | null };

  function detailFor(e: Envelope): Detail | null {
    const original = envelopes.find((x) => x.id === e.id)?.cap;
    const cap = caps[e.id] ?? e.cap;
    const was = original !== undefined && original !== cap ? it.settings.was(formatEuro(original)) : null;
    if (e.id === recurringEnvelope) {
      const monthly = recurring.filter((r) => r.active && r.envelopeId === e.id).reduce((s, r) => s + r.amount, 0);
      return { text: it.settings.recurringDetailMonthly(recurring.length, formatEuro(monthly)), was };
    }
    const avg = averages[e.id];
    if (!avg) return was ? { text: '', was } : null;
    return avg.aboveCap
      ? { text: it.settings.averageOver(formatEuro(avg.average)), warn: true, was }
      : { text: it.settings.average(formatEuro(avg.average)), was };
  }

  function row(id: string, name: string, cap: Cents, detail: Detail | null, open: () => void, symbol: string) {
    return (
      <li key={id}>
        <button type="button" className="list-row list-row--button" aria-label={`${name}: ${formatEuro(cap)}. ${it.settings.tapToEdit}`} onClick={() => { setMessage(null); open(); }}>
          <Tile symbol={symbol} />
          <span className="list-row__text">
            <span className="list-row__title">{name}</span>
            {detail ? (
              <span className={detail.warn ? 'list-row__detail is-warn' : 'list-row__detail'}>
                {detail.text}
                {detail.was ? <>{detail.text ? ' · ' : ''}<b className="list-row__was">{detail.was}</b></> : null}
              </span>
            ) : null}
          </span>
          <span className="list-row__value">{formatEuro(cap)}</span>
          <IconChevronRight className="list-row__chevron" />
        </button>
      </li>
    );
  }

  function allRows() {
    const list = active.filter((e) => !removed.includes(e.id));
    const extra = added;
    return [
      ...list.map((e) => {
        const cap = caps[e.id] ?? e.cap;
        const detail = detailFor(e);
        const symbol = icons[e.id] ?? symbolFor(e);
        return row(e.id, e.name, cap, detail, () => setTarget({
          id: e.id,
          name: e.name,
          cap,
          detail: detail?.text || null,
          recurringCount: recurringOnEnvelope(e.id, recurring).length,
          showRecurringLink: e.id === recurringEnvelope,
          freed: freedBy(e.id),
          symbol,
        }), symbol);
      }),
      ...extra.map((a) => row(a.id, a.name, a.cap, { text: it.settings.newBadge }, () => setTarget({
        id: a.id, name: a.name, cap: a.cap, detail: it.settings.newBadge, recurringCount: 0, showRecurringLink: false, freed: 0, symbol: a.icon,
      }), a.icon)),
    ];
  }

  const rows = allRows();

  return (
    <section className="group" aria-labelledby="envelopes-title">
      <h2 id="envelopes-title" className="group__title">{it.settings.envelopesListTitle}</h2>
      <div className="card list-card">
        {rows.length > 0 ? <ul className="list">{rows}</ul> : null}
        {removed.length > 0 ? (
          <div className="list-card__block">
            <p className="list-card__label">{it.settings.removedTitle}</p>
            <ul className="list">
              {removed.map((id) => {
                const e = envelopes.find((x) => x.id === id);
                if (!e) return null;
                return (
                  <li key={id} className="list-row is-removed">
                    <span className="list-row__text">
                      <span className="list-row__title">{e.name}</span>
                      <span className="list-row__detail">{it.settings.removedDetail(freedBy(id) > 0 ? destName(removedDest[id] ?? DEFAULT_DESTINATION) : null)}</span>
                    </span>
                    <button type="button" className="row-undo" onClick={() => { setRemoved((xs) => xs.filter((x) => x !== id)); setRemovedDest(({ [id]: _, ...rest }) => rest); }}>{it.settings.undoRemove}</button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <button type="button" className="list-row list-row--action" onClick={() => setAdding(true)}>
          <IconPlus size={20} />{it.settings.newEnvelope.replace('+ ', '')}
        </button>
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
            <IconCompare size={18} />
            <span>{transferText(preview, false) || it.settings.unsaved}</span>
          </p>
          <div className="save-bar__actions">
            <button type="button" className="save-bar__discard" onClick={discard}>{it.settings.discard}</button>
            <button type="button" className="save-bar__save" disabled={saving} onClick={() => void save()}>{it.settings.save}</button>
          </div>
        </div>
      ) : null}

      <EnvelopeCapSheet
        target={target}
        onClose={() => setTarget(null)}
        onApply={(id, cap, icon) => {
          if (added.some((a) => a.id === id)) setAdded((xs) => xs.map((x) => (x.id === id ? { ...x, cap, icon } : x)));
          else {
            setCaps((c) => ({ ...c, [id]: cap }));
            setIcons((m) => ({ ...m, [id]: icon }));
          }
        }}
        destinations={destinations}
        balances={balances}
        onRemove={(id, dest) => {
          setMessage(null);
          if (added.some((a) => a.id === id)) setAdded((xs) => xs.filter((x) => x.id !== id));
          else {
            setRemoved((xs) => [...xs, id]);
            setRemovedDest((d) => ({ ...d, [id]: dest }));
          }
        }}
      />

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
  // Il simbolo si suggerisce dal nome finché non lo scegli a mano: da lì vince la tua scelta.
  const [manualIcon, setManualIcon] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const suggested = suggestSymbol(name);
  const icon = manualIcon ?? suggested;
  const valid = name.trim() !== '';
  return (
    <form
      className="recurring-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onAdd({ id: newId(), name: name.trim(), shortName: name.trim().split(/\s+/)[0] ?? name.trim(), kind, cap, icon });
      }}
    >
      <div className="new-envelope__name">
        <TileEdit symbol={icon} onClick={() => setPicking(true)} />
        <div className="entry__section">
          <label htmlFor="new-envelope-name" className="entry__label">{it.settings.newName}</label>
          <input id="new-envelope-name" className="text-input" value={name} placeholder={it.settings.newNamePlaceholder} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      {!manualIcon && name.trim() !== '' ? <p className="suggest-note"><IconSparkles size={15} />{it.symbols.suggested}</p> : null}
      <div className="entry__section">
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
      <div className="entry__section">
        <span className="entry__label">{it.settings.capPerMonth}</span>
        <Stepper label={it.settings.stepper(name || it.settings.newName)} value={cap} onChange={setCap} />
      </div>
      <button type="submit" className="primary-button" disabled={!valid}>{it.settings.addEnvelope}</button>
      <SymbolPicker open={picking} name={name.trim()} current={icon} suggested={suggested} onPick={setManualIcon} onClose={() => setPicking(false)} />
    </form>
  );
}

/** Spese fisse: bollette, abbonamenti e pagamenti come l'affitto, con quanto costano al mese. */
function FixedCostsRow({ settings }: { settings: Settings }) {
  const recurring = useRecurring();
  const bills = useBills();
  if (!recurring || !bills) return null;
  const n = recurring.filter((r) => r.active).length + bills.filter((b) => b.active).length
    + settings.monthlyItems.filter((i) => i.kind === 'payment' && !i.archived).length;
  const perMonth = Math.round(annualCost(recurring, bills, settings.monthlyItems).total / 12);
  return (
    <li>
      <Link to={routes.bills} className="list-row list-row--button">
        <Tile symbol="receipt" />
        <span className="list-row__text">
          <span className="list-row__title">{it.settings.billsRow}</span>
          <span className="list-row__detail">{it.settings.fixedDetail(n, formatEuro(perMonth))}</span>
        </span>
        <IconChevronRight className="list-row__chevron" />
      </Link>
    </li>
  );
}

/**
 * "Il mese": quando inizia e l'ingresso a "Inizia il mese". Voci fisse, spese fisse e buste del mese
 * si decidono dentro "Inizia il mese", passo per passo: qui non si ripetono.
 */
function MonthGroup({ settings, current, nextName }: { settings: Settings; current: Period | null; nextName: string }) {
  const to = current ? routes.closing : `${routes.opening}`;
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
        <FixedCostsRow settings={settings} />
        <li>
          <Link to={to} className="list-row list-row--button">
            <Tile symbol="wallet" />
            <span className="list-row__text">
              <span className="list-row__title">{current ? it.settings.closeAndStart(current.name.toLowerCase(), nextName) : it.settings.startMonth(nextName)}</span>
              <span className="list-row__detail">{it.settings.startMonthDetail}</span>
            </span>
            <IconChevronRight className="list-row__chevron" />
          </Link>
        </li>
      </ul>
    </section>
  );
}
