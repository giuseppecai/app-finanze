// R13 · Bollette: tutte accantonate nella Pocket Bollette (mensili comprese), divisione con la coinquilina.
import type { Bill, Cents, LoanDirection, PotId } from './types';

export function isPeriodic(bill: Pick<Bill, 'frequency'>): boolean {
  return bill.frequency > 1;
}

/** Tua quota di una bolletta di importo B: tutta tua, oppure B − floor(B/2) (il centesimo dispari è tuo). */
export function myShare(amount: Cents, split: Bill['split']): Cents {
  return split === 'mine' ? amount : amount - Math.floor(amount / 2);
}

/** Parte dell'altra persona. */
export function otherShare(amount: Cents, split: Bill['split']): Cents {
  return amount - myShare(amount, split);
}

/** Tua quota prevista (sull'importo previsto). */
export function expectedShare(bill: Pick<Bill, 'estimate' | 'split'>): Cents {
  return myShare(bill.estimate, bill.split);
}

/**
 * Quota da accantonare ogni mese nella Pocket Bollette (al centesimo, per eccesso):
 * per le mensili è tutta la tua quota prevista, per le periodiche la tua quota divisa per i mesi.
 */
export function monthlyQuota(bill: Pick<Bill, 'estimate' | 'split' | 'frequency'>): Cents {
  return Math.ceil(expectedShare(bill) / bill.frequency);
}

/** Giroconto mensile → Bollette: Σ quote delle bollette attive. */
export function billsQuotaTotal(bills: readonly Bill[]): Cents {
  return bills.reduce((s, b) => (b.active ? s + monthlyQuota(b) : s), 0);
}

export type Account = 'budget' | 'card' | 'savings' | 'bills';

export interface BillTransfer {
  from: Account;
  to: Account;
  amount: Cents;
}

export interface BillPaymentPlan {
  amount: Cents;
  myShare: Cents;
  otherShare: Cents;
  /** la tua spesa: senza busta, pagata dal fondo della bolletta (Pocket Bollette) */
  expense: { amount: Cents; envelopeId: null };
  /** prestito (lei ti deve la sua metà) o debito (le devi la tua) verso la coinquilina */
  loan: { direction: LoanDirection; amount: Cents } | null;
  /** variazione del fondo della bolletta */
  fundDelta: Cents;
  /** variazioni dei salvadanai dell'app (Risparmi le gestisce già il prestito/debito, qui solo Bollette) */
  potDeltas: Partial<Record<PotId, Cents>>;
  /** giroconti da fare su Revolut */
  transfers: BillTransfer[];
}

/**
 * Registrare una bolletta (tabella di R13): chi paga, cosa diventa spesa, prestito o debito,
 * quali salvadanai si muovono e quali giroconti fare.
 */
export function planBillPayment(bill: Bill, amount: Cents, payer: Bill['payer']): BillPaymentPlan {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Importo non valido');
  const q = myShare(amount, bill.split);
  const o = amount - q;
  const transfers: BillTransfer[] = [];
  let loan: BillPaymentPlan['loan'] = null;

  if (payer === 'me') {
    transfers.push({ from: 'bills', to: 'card', amount: q });
    if (o > 0) {
      loan = { direction: 'lent', amount: o };
      transfers.push({ from: 'savings', to: 'card', amount: o });
    }
  } else {
    // Ha pagato lei: la tua quota diventa un debito; i soldi aspettano in Risparmi.
    loan = { direction: 'borrowed', amount: q };
    transfers.push({ from: 'bills', to: 'savings', amount: q });
  }

  return {
    amount,
    myShare: q,
    otherShare: o,
    expense: { amount: q, envelopeId: null },
    loan,
    fundDelta: -q,
    potDeltas: { bills: -q },
    transfers,
  };
}

/** Stato del fondo di una bolletta rispetto alla tua quota prevista. */
export function fundStatus(bill: Pick<Bill, 'fund' | 'estimate' | 'split'>): { fund: Cents; target: Cents; missing: Cents } {
  const target = expectedShare(bill);
  return { fund: bill.fund, target, missing: bill.fund < 0 ? -bill.fund : 0 };
}
