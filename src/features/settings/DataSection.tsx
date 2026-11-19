import { useRef, useState } from 'react';
import { usePots } from '../../app/data';
import { AmountField } from '../../components/AmountField';
import { InfoBox } from '../../components/InfoBox';
import { BackupError, backupFileName, buildBackup, parseBackup } from '../../db/backup';
import { db } from '../../db/database';
import { readAll, replaceAll } from '../../db/dataset';
import { setCardReserve, setPotBalances, updateSettings } from '../../db/repositories';
import { nowISO, today } from '../../domain/clock';
import { formatShortDate, localISODate } from '../../domain/dates';
import { formatEuro, parseEuro } from '../../domain/money';
import { daysAgo } from '../../domain/movements';
import type { Pot, PotId, Settings } from '../../domain/types';
import { it } from '../../i18n/it';

const POT_ORDER: PotId[] = ['savings', 'travel', 'gifts', 'bills'];
const text = (c: number) => formatEuro(c, { decimals: 'always' }).replace('€ ', '').replace('− ', '-');

/** Sezione Dati: riserva carte, saldi dei salvadanai (correggibili), esporta / importa backup. */
export function DataSection({ settings }: { settings: Settings }) {
  const pots = usePots();
  if (!pots) return null;
  return (
    <>
      <section className="settings-section">
        <h2 className="section-head--muted">{it.settings.data}</h2>
        <BalancesForm key={pots.map((p) => `${p.id}:${p.balance}`).join('|') + String(settings.cardReserve)} settings={settings} pots={pots} />
      </section>
      <BackupCard settings={settings} />
    </>
  );
}

function BalancesForm({ settings, pots }: { settings: Settings; pots: Pot[] }) {
  const [reserve, setReserve] = useState(settings.cardReserve === null ? '' : text(settings.cardReserve));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(pots.map((p) => [p.id, text(p.balance)])));
  const [message, setMessage] = useState<string | null>(null);
  const parse = (v: string) => {
    const neg = v.trim().startsWith('-');
    const c = parseEuro(v.replace('-', ''));
    return c === null ? null : neg ? -c : c;
  };

  async function save() {
    const r = reserve.trim() === '' ? null : parse(reserve);
    const parsed = Object.fromEntries(Object.entries(values).map(([id, v]) => [id, parse(v)]));
    if ((reserve.trim() !== '' && r === null) || Object.values(parsed).some((v) => v === null)) {
      setMessage(it.settings.invalid);
      return;
    }
    await setCardReserve(db, r);
    await setPotBalances(db, parsed as Partial<Record<PotId, number>>);
    setMessage(it.settings.dataSaved);
  }

  return (
    <div className="card data-card">
      <AmountField id="card-reserve" label={it.settings.reserve} value={reserve} placeholder={it.settings.reserveNotSet} onChange={setReserve} />
      <p className="muted-note">{it.settings.reserveHint}</p>
      <span className="entry__label">{it.settings.pots}</span>
      {POT_ORDER.filter((id) => pots.some((p) => p.id === id)).map((id) => (
        <AmountField
          key={id}
          id={`pot-balance-${id}`}
          label={it.accounts[id]}
          value={values[id] ?? ''}
          onChange={(v) => setValues((s) => ({ ...s, [id]: v }))}
        />
      ))}
      <p className="muted-note">{it.settings.potsHint}</p>
      {message ? <p className="muted-note" role="status">{message}</p> : null}
      <button type="button" className="outcome__button outcome__button--secondary" onClick={() => void save()}>{it.settings.saveData}</button>
    </div>
  );
}

function BackupCard({ settings }: { settings: Settings }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const last = settings.lastBackupAt ?? null;

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
      await updateSettings(db, { lastBackupAt: exportedAt });
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
    <section className="settings-section">
      <h2 className="section-head--muted">{it.settings.backup}</h2>
      <div className="card data-card">
        <p className="muted-note">
          {it.settings.backupHint} {last ? it.settings.lastBackup(it.relativeDays(daysAgo(localISODate(new Date(last)), today()))) : it.settings.neverBackup}
        </p>
        <div className="data-card__actions">
          <button type="button" className="outcome__button outcome__button--accent" onClick={() => void exportBackup()}>{it.settings.export}</button>
          <label className="outcome__button outcome__button--secondary file-label">
            {it.settings.import}
            <input
              ref={fileRef}
              className="file-input"
              type="file"
              accept="application/json,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); }}
            />
          </label>
        </div>
        {message ? <InfoBox>{message}</InfoBox> : null}
      </div>
    </section>
  );
}
