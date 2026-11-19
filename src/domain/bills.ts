// R13 · Bollette di Casa & Servizi: quote, accantonamento, divisione con la coinquilina.
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

/** Quota da accantonare ogni mese per una bolletta periodica (al centesimo, per eccesso). 0 per le mensili. */
export function monthlyQuota(bill: Pick<Bill, 'estimate' | 'split' | 'frequency'>): Cents {
  if (!isPeriodic(bill)) return 0;
  return Math.ceil(expectedShare(bill) / bill.frequency);
}

/** Giroconto mensile → Bollette: Σ quote delle periodiche attive. */
export function billsQuotaTotal(bills: readonly Bill[]): Cents {
  return bills.reduce((s, b) => (b.active ? s + monthlyQuota(b) : s), 0);
}

/** Quanto valgono le bollette mensili nella busta (Σ tue quote previste). */
export function monthlyBillsShare(bills: readonly Bill[], envelopeId?: string): Cents {
  return bills.reduce(
    (s, b) => (b.active && !isPeriodic(b) && (envelopeId === undefined || b.envelopeId === envelopeId) ? s + expectedShare(b) : s),
    0,
  );
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
  /** la tua spesa: nella busta (mensili) o senza busta, dal fondo (periodiche) */
  expense: { amount: Cents; envelopeId: string | null };
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
  const periodic = isPeriodic(bill);
  const transfers: BillTransfer[] = [];
  let loan: BillPaymentPlan['loan'] = null;

  if (payer === 'me') {
    if (periodic) transfers.push({ from: 'bills', to: 'card', amount: q });
    if (o > 0) {
      loan = { direction: 'lent', amount: o };
      transfers.push({ from: 'savings', to: 'card', amount: o });
    }
  } else {
    // Ha pagato lei: la tua quota diventa un debito; i soldi aspettano in Risparmi.
    loan = { direction: 'borrowed', amount: q };
    transfers.push({ from: periodic ? 'bills' : 'budget', to: 'savings', amount: q });
  }

  return {
    amount,
    myShare: q,
    otherShare: o,
    expense: { amount: q, envelopeId: periodic ? null : bill.envelopeId },
    loan,
    fundDelta: periodic ? -q : 0,
    potDeltas: periodic ? { bills: -q } : {},
    transfers,
  };
}

/** Stato del fondo di una bolletta periodica rispetto alla tua quota prevista. */
export function fundStatus(bill: Pick<Bill, 'fund' | 'estimate' | 'split'>): { fund: Cents; target: Cents; missing: Cents } {
  const target = expectedShare(bill);
  return { fund: bill.fund, target, missing: bill.fund < 0 ? -bill.fund : 0 };
}
