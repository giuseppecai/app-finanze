import { useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../app/routes';
import { InfoBox } from '../../components/InfoBox';
import { TopBar, useCloseScreen } from '../../components/TopBar';
import { db } from '../../db/database';
import { deleteBillPayment } from '../../db/repositories';
import { formatDayHeading } from '../../domain/dates';
import { formatEuro } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { it } from '../../i18n/it';

/** Movimento nato da una bolletta: si elimina tutta la registrazione (spesa, parte della coinquilina, fondo). */
export function BillTxEdit({ tx, billName }: { tx: Transaction; billName: string }) {
  const close = useCloseScreen();
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(it.entry.confirmDelete)) return;
    try {
      await deleteBillPayment(db, tx.id);
      close();
    } catch (e) {
      console.error(e);
      setError(it.casa.deleteBlocked);
    }
  }

  return (
    <div className="entry">
      <TopBar center={<span className="entry__type-static">{billName}</span>} />
      <div className="entry__amount-block">
        <p className="entry__hint">{formatDayHeading(tx.date)}</p>
        <p className="entry__amount">{formatEuro(tx.amount, { decimals: 'always' })}</p>
        <p className="entry__feedback entry__feedback--muted">{tx.note}</p>
      </div>
      <InfoBox>
        {it.casa.billTxInfo(billName)} <Link to={routes.bills} className="text-link">{it.casa.title} →</Link>
      </InfoBox>
      {error ? <p className="outcome outcome--info" role="alert">{error}</p> : null}
      <div className="flow__spacer" />
      <button type="button" className="quiet-button" onClick={() => void remove()}>{it.casa.deleteRegistration}</button>
    </div>
  );
}
