import { useState } from 'react';
import { db } from '../../db/database';
import { addPerson } from '../../db/repositories';
import { balanceWith } from '../../domain/loans';
import { formatEuro } from '../../domain/money';
import type { Loan, Person } from '../../domain/types';
import { it } from '../../i18n/it';

type Props = {
  people: readonly Person[];
  loans: readonly Loan[];
  value: string | null;
  onChange: (personId: string) => void;
};

/** Persone con il loro saldo ("ti deve € 40" / "gli devi € 6") + "+ Persona" per crearne una al volo. */
export function PersonPicker({ people, loans, value, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  async function create() {
    if (name.trim() === '') return;
    const person = await addPerson(db, name);
    setName('');
    setAdding(false);
    onChange(person.id);
  }

  return (
    <div className="person-picker">
      <div role="radiogroup" aria-label={it.entry.personLabel} className="person-picker__list">
        {people.map((p) => {
          const balance = balanceWith(loans, p.id);
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === value}
              className="envelope-picker__option person-picker__option"
              onClick={() => onChange(p.id)}
            >
              <span className="envelope-picker__name">{p.name}</span>
              <span className="envelope-picker__rest">
                {balance > 0 ? it.entry.owesYou(formatEuro(balance)) : balance < 0 ? it.entry.youOwe(formatEuro(-balance)) : it.entry.even}
              </span>
            </button>
          );
        })}
        {!adding ? (
          <button type="button" className="person-picker__add" onClick={() => setAdding(true)}>{it.entry.addPerson}</button>
        ) : null}
      </div>
      {adding ? (
        <div className="person-picker__new">
          <input
            className="text-input"
            aria-label={it.entry.newPersonName}
            placeholder={it.entry.newPersonName}
            value={name}
            autoFocus
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void create(); } }}
          />
          <button type="button" className="outcome__button outcome__button--dark" disabled={name.trim() === ''} onClick={() => void create()}>
            {it.entry.addPersonConfirm}
          </button>
        </div>
      ) : null}
    </div>
  );
}
