import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentPeriod, usePots } from '../../app/data';
import { DestinationPicker } from '../../components/DestinationPicker';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmPanel } from '../../components/ConfirmPanel';
import { IconTrash, IconChevronRight, IconDownload, IconPlus, IconUpload } from '../../components/icons';
import { BackupError, backupFileName, buildBackup, parseBackup } from '../../db/backup';
import { db } from '../../db/database';
import { readAll, replaceAll } from '../../db/dataset';
import { addPot, newId, removePot, renamePot, saveMonthlyItem, setCardReserve, setPotBalances, updateSettings, setPotIcon } from '../../db/repositories';
import { nowISO, today } from '../../domain/clock';
import { formatShortDate, localISODate } from '../../domain/dates';
import { formatEuro, parseEuro, amountText } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import { potLines } from '../../domain/pots';
import { DEFAULT_DESTINATION, FIXED_POTS, fundsDestinations, UNASSIGNED, type DestinationOption, type FundsDestination } from '../../domain/settings';
import type { Cents, Settings } from '../../domain/types';
import { it } from '../../i18n/it';
import { Tile } from '../../components/Symbol';
import { SymbolPicker, TileEdit } from '../../components/SymbolPicker';
import { suggestSymbol, symbolFor } from '../../domain/symbols';
import { OtherAccountsList } from './AccountsGroup';

const text = (c: number) => amountText(c);

/** Quello che si corregge: un salvadanaio (nome, saldo), uno nuovo, o la riserva delle carte. */
type Editing =
  | { kind: 'pot'; id: string; name: string; value: Cents; icon: string }
  | { kind: 'newPot' }
  | { kind: 'reserve'; value: Cents | null };

/**
 * Conti: Revolut con dentro le sue Pocket e le sue carte (un tocco su una Pocket apre il pannello per
 * correggere il saldo, rinominare o togliere), poi gli altri conti (Isybank…) con le loro carte.
 */
export function PotsGroup({ settings }: { settings: Settings }) {
  const pots = usePots();
  const current = useCurrentPeriod();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!pots || current === undefined) return null;
  const lines = potLines(pots, settings.monthlyItems);
  const balances = Object.fromEntries(lines.map((l) => [l.id, l.balance]));
  return (
    <section className="group" aria-labelledby="pots-group-title">
      <h2 id="pots-group-title" className="group__title">{it.accounts2.title}</h2>
      {/* Revolut: un conto con dentro le sue Pocket e le sue carte (le Pocket esistono solo qui). */}
      <ul className="card list-card list" aria-label="Revolut">
        <li className="list-row account-head">
          <Tile symbol="wallet" />
          <span className="list-row__text">
            <span className="list-row__title">Revolut</span>
            <span className="list-row__detail">{settings.salaryAccountId ? it.accounts2.revolutPlain : it.accounts2.salaryHere}</span>
          </span>
        </li>
        <li className="list-subhead">{it.accounts2.pocketsLabel}</li>
        {lines.map((p) => (
          <li key={p.id}>
            <button type="button" className="list-row list-row--button" onClick={() => setEditing({ kind: 'pot', id: p.id, name: p.name, value: p.balance, icon: symbolFor(p) })}>
              <Tile symbol={symbolFor(p)} />
              <span className="list-row__text">
                <span className="list-row__title">{p.name}</span>
                <span className="list-row__detail">{p.id === 'bills' ? it.settings.pocketBalance : it.settings.balanceLabel}</span>
              </span>
              <span className={p.balance < 0 ? 'list-row__value is-over' : 'list-row__value'}>{formatEuro(p.balance)}</span>
              <IconChevronRight className="list-row__chevron" />
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="list-row list-row--action" onClick={() => { setMessage(null); setEditing({ kind: 'newPot' }); }}>
            <IconPlus size={20} />{it.accounts2.newPocket}
          </button>
        </li>
        <li className="list-subhead">{it.accounts2.cards}</li>
        <li className="list-row">
          <Tile symbol="credit-card" />
          <span className="list-row__text">
            <span className="list-row__title">{it.accounts2.revolutCardsTitle}</span>
            <span className="list-row__detail">{it.accounts2.revolutCardsDetail}</span>
          </span>
        </li>
        <li>
          <button type="button" className="list-row list-row--button" onClick={() => setEditing({ kind: 'reserve', value: settings.cardReserve })}>
            <Tile symbol="credit-card" />
            <span className="list-row__text">
              <span className="list-row__title">{it.settings.reserve}</span>
              <span className="list-row__detail">{it.settings.reserveDetail}</span>
            </span>
            <span className="list-row__value">{settings.cardReserve === null ? it.settings.reserveNotSet : formatEuro(settings.cardReserve)}</span>
            <IconChevronRight className="list-row__chevron" />
          </button>
        </li>
      </ul>
      <OtherAccountsList settings={settings} />
      <p className="group__footer">{it.settings.potsHint}</p>
      {message ? <p className="group__message" role="status">{message}</p> : null}
      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'pot' ? editing.name : editing?.kind === 'newPot' ? it.settings.newPotTitle : it.settings.reserve}
        subtitle={editing?.kind === 'pot' ? it.settings.balanceHint : editing?.kind === 'newPot' ? undefined : it.settings.reserveHint}
      >
        {editing?.kind === 'newPot' ? <NewPotForm onDone={() => setEditing(null)} /> : null}
        {editing && editing.kind !== 'newPot' ? (
          <BalanceForm
            key={editing.kind === 'pot' ? editing.id : 'reserve'}
            editing={editing}
            destinations={fundsDestinations(lines, editing.kind === 'pot' ? editing.id : null, current !== null, it.funds.unassignedName)}
            balances={balances}
            onDone={(m) => { setEditing(null); setMessage(m ?? null); }}
          />
        ) : null}
      </BottomSheet>
    </section>
  );
}

function NewPotForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('0');
  const [monthly, setMonthly] = useState('');
  const [manualIcon, setManualIcon] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const icon = manualIcon ?? suggestSymbol(name);
  const [error, setError] = useState<string | null>(null);
  const cents = parseEuro(value);
  const monthlyCents = monthly.trim() === '' ? 0 : parseEuro(monthly);
  const valid = name.trim() !== '' && cents !== null && monthlyCents !== null;

  async function save() {
    if (!valid || cents === null || monthlyCents === null) {
      setError(it.settings.invalid);
      return;
    }
    try {
      if (monthlyCents > 0) {
        // Con un giroconto mensile diventa anche una voce fissa dell'inizio del mese (stesso id).
        const id = newId();
        await saveMonthlyItem(db, { id, name, kind: 'pot', amount: monthlyCents, archived: false, icon });
        if (cents !== 0) await setPotBalances(db, { [id]: cents });
      } else {
        await addPot(db, name, cents, icon);
      }
      onDone();
    } catch (e) {
      console.error(e);
      setError(it.settings.error);
    }
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="new-envelope__name">
        <TileEdit symbol={icon} onClick={() => setPicking(true)} />
        <div className="entry__section">
          <label htmlFor="pot-name" className="entry__label">{it.settings.potName}</label>
          <input id="pot-name" className="text-input" value={name} placeholder={it.settings.potNamePlaceholder} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <SymbolPicker open={picking} name={name.trim()} current={icon} suggested={suggestSymbol(name)} onPick={setManualIcon} onClose={() => setPicking(false)} />
      <AmountField id="pot-balance" label={it.settings.potBalance} value={value} onChange={setValue} invalid={value !== '' && cents === null} />
      <AmountField id="pot-monthly" label={it.settings.potMonthly} value={monthly} placeholder="0" onChange={setMonthly} invalid={monthlyCents === null} />
      <p className="muted-note">{it.settings.potBalanceHint}</p>
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <button type="submit" className="primary-button" disabled={!valid}>{it.settings.addPot}</button>
    </form>
  );
}

type BalanceEditing = Exclude<Editing, { kind: 'newPot' }>;

type BalanceFormProps = {
  editing: BalanceEditing;
  destinations: DestinationOption[];
  balances: Record<string, Cents>;
  onDone: (message?: string) => void;
};

function BalanceForm({ editing, destinations, balances, onDone }: BalanceFormProps) {
  const [dest, setDest] = useState<FundsDestination>(DEFAULT_DESTINATION);
  const removable = editing.kind === 'pot' && !FIXED_POTS.includes(editing.id);
  const [name, setName] = useState(editing.kind === 'pot' ? editing.name : '');
  const [icon, setIcon] = useState(editing.kind === 'pot' ? editing.icon : 'credit-card');
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState(editing.value === null ? '' : text(editing.value));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const neg = value.trim().startsWith('-');
  const abs = parseEuro(value.replace('-', ''));
  const cents = abs === null ? null : neg ? -abs : abs;
  const empty = value.trim() === '';
  const valid = editing.kind === 'reserve' ? empty || cents !== null : cents !== null;

  async function save() {
    if (!valid || (removable && name.trim() === '')) {
      setError(it.settings.invalid);
      return;
    }
    if (editing.kind === 'pot') {
      await setPotBalances(db, { [editing.id]: cents! });
      if (removable && name.trim() !== editing.name) await renamePot(db, editing.id, name);
      if (icon !== editing.icon) await setPotIcon(db, editing.id, icon);
    } else await setCardReserve(db, empty ? null : cents);
    onDone();
  }

  async function remove() {
    if (editing.kind !== 'pot') return;
    const amount = editing.value !== 0 ? formatEuro(editing.value) : null;
    const destName = destinations.find((d) => d.value === dest)?.name ?? '';
    try {
      await removePot(db, editing.id, dest);
      onDone(it.settings.potRemoved(editing.name, amount, dest === UNASSIGNED ? it.funds.unassignedName : destName));
    } catch (e) {
      console.error(e);
      setError(it.settings.error);
    }
  }

  if (confirming && editing.kind === 'pot') {
    return (
      <ConfirmPanel
        message={it.settings.removePotConfirm(editing.name)}
        confirmLabel={editing.value !== 0
          ? it.funds.removeAndMove('Togli', formatEuro(editing.value), destinations.find((d) => d.value === dest)?.name ?? '')
          : it.settings.removePot}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      >
        {editing.value !== 0 ? (
          <DestinationPicker amount={editing.value} options={destinations} balances={balances} value={dest} onChange={setDest} />
        ) : null}
      </ConfirmPanel>
    );
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {editing.kind === 'pot' ? (
        <div className="new-envelope__name">
          <TileEdit symbol={icon} onClick={() => setPicking(true)} />
          {removable ? (
            <div className="entry__section">
              <label htmlFor="pot-rename" className="entry__label">{it.settings.potName}</label>
              <input id="pot-rename" className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          ) : <p className="list-row__title">{editing.name}</p>}
          <SymbolPicker open={picking} name={name.trim()} current={icon} onPick={setIcon} onClose={() => setPicking(false)} />
        </div>
      ) : null}
      <AmountField
        id="balance-value"
        large
        label={editing.kind === 'pot' ? it.settings.potBalance : it.settings.reserve}
        value={value}
        placeholder={editing.kind === 'reserve' ? it.settings.reserveNotSet : undefined}
        onChange={setValue}
        invalid={!empty && cents === null}
      />
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <button type="submit" className="primary-button" disabled={!valid}>{it.settings.saveBalance}</button>
      {removable ? (
        <div className="sheet-actions">
          <button type="button" className="sheet-actions__button sheet-actions__button--danger" onClick={() => setConfirming(true)}>
            <IconTrash />{it.settings.removePot}
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** Backup: esporta (condivisione iOS) e importa. */
export function BackupGroup({ settings }: { settings: Settings }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [params] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: ReturnType<typeof parseBackup>; date: string } | null>(null);
  const last = settings.lastBackupAt ?? null;

  // Dal promemoria in Home: porta direttamente qui.
  useEffect(() => {
    if (params.get('backup') === '1') sectionRef.current?.scrollIntoView({ block: 'center' });
  }, [params]);

  async function exportBackup() {
    setMessage(null);
    try {
      const exportedAt = nowISO();
      const file = buildBackup(await readAll(db), exportedAt);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const name = backupFileName(exportedAt);
      const asFile = new File([blob], name, { type: 'application/json' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [asFile] })) {
        await nav.share({ files: [asFile], title: name });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      await updateSettings(db, { lastBackupAt: exportedAt, backupSnoozedUntil: null });
    } catch (e) {
      // Condivisione annullata dall'utente: nessun errore da mostrare.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error(e);
      setMessage(it.settings.exportError);
    }
  }

  async function importBackup(file: File) {
    setMessage(null);
    try {
      const backup = parseBackup(await file.text());
      const date = backup.exportedAt ? formatShortDate(localISODate(new Date(backup.exportedAt))) : '?';
      setPending({ backup, date });
    } catch (e) {
      console.error(e);
      setMessage(e instanceof BackupError ? e.message : it.settings.invalid);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function confirmImport() {
    if (!pending) return;
    try {
      await replaceAll(db, pending.backup.data);
      setMessage(it.settings.imported);
    } catch (e) {
      console.error(e);
      setMessage(it.settings.invalid);
    } finally {
      setPending(null);
    }
  }

  return (
    <section ref={sectionRef} id="backup" className="group" aria-labelledby="backup-title">
      <h2 id="backup-title" className="group__title">{it.settings.backup}</h2>
      <ul className="card list-card list">
        <li>
          <button type="button" className="list-row list-row--button" onClick={() => void exportBackup()}>
            <span className="list-row__lead" aria-hidden="true"><IconDownload /></span>
            <span className="list-row__text">
              <span className="list-row__title">{it.settings.export}</span>
              <span className="list-row__detail">
                {last ? it.settings.lastBackup(it.relativeDays(daysAgo(localISODate(new Date(last)), today()))) : it.settings.neverBackup}
              </span>
            </span>
            <IconChevronRight className="list-row__chevron" />
          </button>
        </li>
        <li>
          <label className="list-row list-row--button">
            <span className="list-row__lead" aria-hidden="true"><IconUpload /></span>
            <span className="list-row__text">
              <span className="list-row__title">{it.settings.import}</span>
              <span className="list-row__detail">{it.settings.importDetail}</span>
            </span>
            <IconChevronRight className="list-row__chevron" />
            <input
              ref={fileRef}
              className="file-input"
              type="file"
              accept="application/json,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); }}
            />
          </label>
        </li>
      </ul>
      <p className="group__footer">{it.settings.backupHint}</p>
      {message ? <p className="group__message" role="status">{message}</p> : null}
      <BottomSheet open={pending !== null} onClose={() => setPending(null)} title={it.settings.import}>
        {pending ? (
          <ConfirmPanel
            message={it.settings.importConfirm(pending.date)}
            confirmLabel={it.settings.importAction}
            onConfirm={() => void confirmImport()}
            onCancel={() => setPending(null)}
          />
        ) : null}
      </BottomSheet>
    </section>
  );
}
