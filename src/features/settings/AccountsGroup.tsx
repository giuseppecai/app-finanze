import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmPanel } from '../../components/ConfirmPanel';
import { IconChevronRight, IconPlus, IconTrash } from '../../components/icons';
import { Switch } from '../../components/Switch';
import { Tile } from '../../components/Symbol';
import { db } from '../../db/database';
import { newId, removeAccount, saveAccount } from '../../db/repositories';
import type { AccountCard, OtherAccount, Settings } from '../../domain/types';
import { it } from '../../i18n/it';

type Target = OtherAccount | 'new' | null;

/**
 * Altri conti fuori da Revolut (Isybank…), da aggiungere e togliere, ognuno con le sue carte. Su uno può
 * arrivare lo stipendio; da lì possono partire uscite fisse e rate. Le Pocket restano solo su Revolut.
 */
export function OtherAccountsList({ settings }: { settings: Settings }) {
  const [target, setTarget] = useState<Target>(null);
  const accounts = settings.accounts ?? [];
  const salaryName = (settings.accounts ?? []).find((a) => a.id === settings.salaryAccountId)?.name ?? 'Revolut';
  return (
    <>
      <ul className="card list-card list account-others" aria-label={it.accounts2.othersLabel}>
        {accounts.map((a) => {
          const n = (a.cards ?? []).length;
          const detail = [settings.salaryAccountId === a.id ? it.accounts2.salaryHere : null, n > 0 ? it.accounts2.cardsCount(n) : null].filter(Boolean).join(' · ');
          return (
            <li key={a.id}>
              <button type="button" className="list-row list-row--button" onClick={() => setTarget(a)}>
                <Tile symbol="credit-card" />
                <span className="list-row__text">
                  <span className="list-row__title">{a.name}</span>
                  {detail ? <span className="list-row__detail">{detail}</span> : null}
                </span>
                <IconChevronRight className="list-row__chevron" />
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className="list-row list-row--action" onClick={() => setTarget('new')}>
            <IconPlus size={20} />{it.accounts2.add}
          </button>
        </li>
      </ul>
      <BottomSheet open={target !== null} onClose={() => setTarget(null)} title={target === 'new' ? it.accounts2.newTitle : target?.name ?? ''}>
        {target !== null ? (
          <AccountForm
            key={target === 'new' ? 'new' : target.id}
            account={target === 'new' ? null : target}
            settings={settings}
            salaryName={salaryName}
            onDone={() => setTarget(null)}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}

function AccountForm({ account, settings, salaryName, onDone }: { account: OtherAccount | null; settings: Settings; salaryName: string; onDone: () => void }) {
  const [name, setName] = useState(account?.name ?? '');
  const [cards, setCards] = useState<AccountCard[]>(account?.cards ?? []);
  const wasSalary = account ? settings.salaryAccountId === account.id : false;
  // Conto nuovo: lo stipendio resta dov'è, finché non lo sposti tu.
  const [salary, setSalary] = useState(wasSalary);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim() !== '';

  async function save() {
    if (!valid) return;
    try {
      await saveAccount(db, { id: account?.id ?? newId(), name, cards }, salary);
      onDone();
    } catch (e) {
      console.error(e);
      setError(it.accounts2.error);
    }
  }

  if (confirming && account) {
    return (
      <ConfirmPanel
        message={it.accounts2.removeConfirm(account.name)}
        confirmLabel={it.accounts2.remove}
        onConfirm={() => void removeAccount(db, account.id).then(onDone)}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <form className="recurring-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="entry__section">
        <label htmlFor="account-name" className="entry__label">{it.accounts2.name}</label>
        <input id="account-name" className="text-input" value={name} placeholder={it.accounts2.namePlaceholder} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="entry__section">
        <span className="entry__label">{it.accounts2.cards}</span>
        <ul className="account-cards">
          {cards.map((c, i) => (
            <li key={c.id} className="account-cards__row">
              <input
                className="text-input"
                aria-label={it.accounts2.cardName(i + 1)}
                value={c.name}
                placeholder={it.accounts2.cardPlaceholder}
                onChange={(e) => setCards((list) => list.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
              />
              <button type="button" className="account-cards__remove" aria-label={it.accounts2.removeCard(c.name || it.accounts2.cardName(i + 1))} onClick={() => setCards((list) => list.filter((x) => x.id !== c.id))}>
                <IconTrash />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="list-row list-row--action" onClick={() => setCards((list) => [...list, { id: newId(), name: '' }])}>
          <IconPlus size={20} />{it.accounts2.addCard}
        </button>
      </div>
      <Switch
        label={it.accounts2.salarySwitch}
        hint={salary && !wasSalary ? it.accounts2.salaryMoves(salaryName) : it.accounts2.salaryHint}
        checked={salary}
        onChange={setSalary}
      />
      <p className="muted-note">{it.accounts2.formNote}</p>
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <div className="recurring-form__actions">
        {account ? (
          <button type="button" className="outcome__button outcome__button--secondary" onClick={() => setConfirming(true)}>{it.accounts2.remove}</button>
        ) : null}
        <button type="submit" className="primary-button recurring-form__save" disabled={!valid}>{it.accounts2.save}</button>
      </div>
    </form>
  );
}
