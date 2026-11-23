import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../app/routes';
import { InfoBox } from '../../components/InfoBox';
import { TopBar, useCloseScreen } from '../../components/TopBar';
import { useConfirmSheet } from '../../components/ConfirmPanel';
import { db } from '../../db/database';
import { canDeleteLoanTransaction, deleteLoanTransaction, updateTransaction } from '../../db/repositories';
import { formatDayHeading } from '../../domain/dates';
import { formatEuro } from '../../domain/money';
import type { Person, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';

/**
 * Un prestito o un debito già registrato: si cambia solo il motivo, oppure si elimina
 * (se nessuna restituzione l'ha toccato). Per cambiare l'importo: elimina e registra di nuovo.
 */
export function LoanEntryEdit({ tx, people }: { tx: Transaction; people: Person[] }) {
  const close = useCloseScreen();
  const [ask, confirmSheet] = useConfirmSheet();
  const [note, setNote] = useState(tx.note);
  const [deletable, setDeletable] = useState<boolean | null>(null);
  const person = people.find((p) => p.id === tx.personId);
  const name = person?.name ?? it.movements.unknownPerson;
  const lent = tx.type === 'loan';

  useEffect(() => {
    void canDeleteLoanTransaction(db, tx.id).then(setDeletable);
  }, [tx.id]);

  async function save() {
    await updateTransaction(db, tx.id, { note: note.trim() });
    close();
  }

  async function remove() {
    if (!(await ask({ title: it.entry.delete, message: it.entry.confirmDelete, confirmLabel: it.entry.delete }))) return;
    await deleteLoanTransaction(db, tx.id);
    close();
  }

  return (
    <form className="entry" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <TopBar center={<span className="entry__type-static">{lent ? it.entry.types.loan : it.entry.debt}</span>} />
      <div className="entry__amount-block">
        <p className="entry__hint">{formatDayHeading(tx.date)}</p>
        <p className="entry__amount">{formatEuro(tx.amount, { decimals: 'always' })}</p>
        <p className="entry__feedback entry__feedback--muted">{lent ? it.entry.lentTo(name) : it.entry.borrowedFrom(name)}</p>
      </div>
      <div className="entry__section">
        <label htmlFor="loan-note" className="entry__label">{it.entry.reason}</label>
        <input id="loan-note" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <InfoBox>
        {it.entry.loanEditInfo} <Link to={routes.loans} className="text-link">{it.entry.goToLoans}</Link>
      </InfoBox>
      <div className="flow__spacer" />
      <button type="submit" className="primary-button">{it.entry.saveEdit}</button>
      {deletable === false ? (
        <p className="muted-note">{it.entry.loanNotDeletable}</p>
      ) : (
        <button type="button" className="quiet-button" disabled={deletable === null} onClick={() => void remove()}>{it.entry.delete}</button>
      )}
      {confirmSheet}
    </form>
  );
}
