import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePots } from '../../app/data';
import { AmountField } from '../../components/AmountField';
import { BottomSheet } from '../../components/BottomSheet';
import { IconChevronRight, IconShare } from '../../components/icons';
import { BackupError, backupFileName, buildBackup, parseBackup } from '../../db/backup';
import { db } from '../../db/database';
import { readAll, replaceAll } from '../../db/dataset';
import { setCardReserve, setPotBalances, updateSettings } from '../../db/repositories';
import { nowISO, today } from '../../domain/clock';
import { formatShortDate, localISODate } from '../../domain/dates';
import { formatEuro, parseEuro } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import { potLines } from '../../domain/pots';
import type { Cents, Settings } from '../../domain/types';
import { it } from '../../i18n/it';

const text = (c: number) => formatEuro(c, { decimals: 'always' }).replace('€ ', '').replace('− ', '-');

/** Quello che si corregge: il saldo di un salvadanaio o la riserva delle carte. */
type Editing = { kind: 'pot'; id: string; name: string; value: Cents } | { kind: 'reserve'; value: Cents | null };

/** Salvadanai e carte: righe in sola lettura, un tocco apre il pannello per correggere il saldo. */
export function PotsGroup({ settings }: { settings: Settings }) {
  const pots = usePots();
  const [editing, setEditing] = useState<Editing | null>(null);
  if (!pots) return null;
  const lines = potLines(pots, settings.monthlyItems);
  return (
    <section className="group" aria-labelledby="pots-group-title">
      <h2 id="pots-group-title" className="group__title">{it.settings.potsTitle}</h2>
      <ul className="card list-card list">
        {lines.map((p) => (
          <li key={p.id}>
            <button type="button" className="list-row list-row--button" onClick={() => setEditing({ kind: 'pot', id: p.id, name: p.name, value: p.balance })}>
              <span className="list-row__text"><span className="list-row__title">{p.name}</span></span>
              <span className={p.balance < 0 ? 'list-row__value is-over' : 'list-row__value'}>{formatEuro(p.balance)}</span>
              <IconChevronRight className="list-row__chevron" />
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="list-row list-row--button" onClick={() => setEditing({ kind: 'reserve', value: settings.cardReserve })}>
            <span className="list-row__text">
              <span className="list-row__title">{it.settings.reserve}</span>
              <span className="list-row__detail">{it.settings.reserveDetail}</span>
            </span>
            <span className="list-row__value">{settings.cardReserve === null ? it.settings.reserveNotSet : formatEuro(settings.cardReserve)}</span>
            <IconChevronRight className="list-row__chevron" />
          </button>
        </li>
      </ul>
      <p className="group__footer">{it.settings.potsHint}</p>
      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'pot' ? it.settings.editBalance(editing.name) : it.settings.reserve}
        subtitle={editing?.kind === 'pot' ? it.settings.balanceHint : it.settings.reserveHint}
      >
        {editing ? <BalanceForm key={editing.kind === 'pot' ? editing.id : 'reserve'} editing={editing} onDone={() => setEditing(null)} /> : null}
      </BottomSheet>
    </section>
  );
}

function BalanceForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const [value, setValue] = useState(editing.value === null ? '' : text(editing.value));
  const [error, setError] = useState<string | null>(null);
  const neg = value.trim().startsWith('-');
  const abs = parseEuro(value.replace('-', ''));
  const cents = abs === null ? null : neg ? -abs : abs;
  const empty = value.trim() === '';
  const valid = editing.kind === 'reserve' ? empty || cents !== null : cents !== null;

  async function save() {
    if (!valid) {
      setError(it.settings.invalid);
      return;
    }
    if (editing.kind === 'pot') await setPotBalances(db, { [editing.id]: cents! });
    else await setCardReserve(db, empty ? null : cents);
    onDone();
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <AmountField
        id="balance-value"
        large
        label={editing.kind === 'pot' ? editing.name : it.settings.reserve}
        value={value}
        placeholder={editing.kind === 'reserve' ? it.settings.reserveNotSet : undefined}
        onChange={setValue}
        invalid={!empty && cents === null}
      />
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <button type="submit" className="primary-button" disabled={!valid}>{it.settings.saveBalance}</button>
    </form>
  );
}

/** Backup: esporta (condivisione iOS) e importa. */
export function BackupGroup({ settings }: { settings: Settings }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [params] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
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
      if (!window.confirm(it.settings.importConfirm(date))) return;
      await replaceAll(db, backup.data);
      setMessage(it.settings.imported);
    } catch (e) {
      console.error(e);
      setMessage(e instanceof BackupError ? e.message : it.settings.invalid);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <section ref={sectionRef} id="backup" className="group" aria-labelledby="backup-title">
      <h2 id="backup-title" className="group__title">{it.settings.backup}</h2>
      <ul className="card list-card list">
        <li>
          <button type="button" className="list-row list-row--button" onClick={() => void exportBackup()}>
            <span className="list-row__text">
              <span className="list-row__title list-row__title--accent">{it.settings.export}</span>
              <span className="list-row__detail">
                {last ? it.settings.lastBackup(it.relativeDays(daysAgo(localISODate(new Date(last)), today()))) : it.settings.neverBackup}
              </span>
            </span>
            <IconShare className="list-row__chevron list-row__chevron--accent" />
          </button>
        </li>
        <li>
          <label className="list-row list-row--button">
            <span className="list-row__text"><span className="list-row__title">{it.settings.import}</span></span>
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
    </section>
  );
}
