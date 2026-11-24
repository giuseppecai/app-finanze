// R13 · Bollette: tutte accantonate nella Pocket Bollette (mensili comprese), divisione con la coinquilina.
import { addMonthsId, monthsBetween } from './dates';
import type { EnvelopeBalance } from './envelopes';
import type { Bill, Cents, LoanDirection, PeriodId, PotId } from './types';

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
 * Giroconti mensili che restano prima della prossima bolletta, contando quello di `nextOpening`
 * (il prossimo "Inizio del mese"). Minimo 1: se la bolletta è già in ritardo, tutto al prossimo.
 */
export function depositsLeft(nextDue: PeriodId, nextOpening: PeriodId): number {
  return Math.max(1, monthsBetween(nextOpening, nextDue) + 1);
}

/**
 * Quota da accantonare ogni mese nella Pocket Bollette (al centesimo, per eccesso).
 * - mensili: tutta la tua quota prevista;
 * - periodiche con la prossima bolletta nota: quello che manca (quota prevista − fondo) diviso
 *   per i giroconti che restano prima di quel mese, così ci arrivi pronto;
 * - periodiche senza data: la tua quota divisa per i mesi del ciclo.
 */
export function monthlyQuota(
  bill: Pick<Bill, 'estimate' | 'split' | 'frequency'> & Partial<Pick<Bill, 'fund' | 'nextDue'>>,
  nextOpening?: PeriodId,
): Cents {
  // Mensili: quello che è avanzato dal mese prima (bolletta più bassa del previsto) si sottrae.
  if (!isPeriodic(bill)) return Math.max(0, expectedShare(bill) - Math.max(0, bill.fund ?? 0));
  if (!bill.nextDue || !nextOpening) return Math.ceil(expectedShare(bill) / bill.frequency);
  const missing = Math.max(0, expectedShare(bill) - (bill.fund ?? 0));
  return Math.ceil(missing / depositsLeft(bill.nextDue, nextOpening));
}

/** Giroconto mensile → Bollette: Σ quote delle bollette attive (`nextOpening` = periodo del giroconto). */
export function billsQuotaTotal(bills: readonly Bill[], nextOpening?: PeriodId): Cents {
  return bills.reduce((s, b) => (b.active ? s + monthlyQuota(b, nextOpening) : s), 0);
}

export interface BillsTransfer {
  /** Σ quote del mese delle bollette attive */
  quota: Cents;
  /** soldi già nella Pocket che non appartengono a nessuna bolletta: si tolgono dal giroconto */
  credit: Cents;
  /** giroconto → Bollette = quota − credito (mai negativo) */
  amount: Cents;
}

/**
 * Giroconto → Bollette a inizio mese, tenendo conto di quello che c'è già nella Pocket:
 * servono 180 e ce ne sono 80 → ne metti 100. Il credito è il saldo della Pocket meno i fondi già
 * assegnati alle singole bollette (quelli delle periodiche restano lì ad accumularsi).
 */
export function billsTransfer(bills: readonly Bill[], potBalance: Cents, nextOpening?: PeriodId): BillsTransfer {
  const quota = billsQuotaTotal(bills, nextOpening);
  const assigned = bills.reduce((s, b) => s + b.fund, 0);
  const credit = Math.max(0, potBalance - assigned);
  return { quota, credit, amount: Math.max(0, quota - credit) };
}

/** Dopo aver registrato una periodica, la prossima arriva un ciclo dopo il periodo del pagamento. */
export function nextDueAfterPayment(bill: Pick<Bill, 'frequency'>, paidInPeriod: PeriodId): PeriodId | null {
  return isPeriodic(bill) ? addMonthsId(paidInPeriod, bill.frequency) : null;
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

/**
 * La Pocket Bollette letta come una busta impegnata, per la Home (stesso aspetto di Rate & Abbonamenti):
 * "messo" = Σ tue quote previste delle bollette attive (quanto serve se arrivassero tutte adesso),
 * "residuo" = saldo della Pocket. La barra mostra la parte che manca (come lo speso di una busta).
 */
export function billsAsEnvelope(bills: readonly Bill[], potBalance: Cents): EnvelopeBalance {
  const target = bills.reduce((s, b) => (b.active ? s + expectedShare(b) : s), 0);
  return {
    envelope: { id: 'bills', name: 'Bollette', shortName: 'Bollette', kind: 'committed', cap: target, order: 0, archived: false },
    allocated: target,
    carryIn: 0,
    put: target,
    spent: Math.max(0, target - potBalance),
    remaining: potBalance,
  };
}

/** Bollette mensili attive non ancora registrate nel periodo (Home: "2 da registrare questo mese"). */
export function billsToRegister(bills: readonly Bill[], periodTxs: readonly { billId: string | null; type: string }[]): Bill[] {
  return bills.filter((b) => b.active && !isPeriodic(b) && !periodTxs.some((t) => t.billId === b.id && t.type === 'expense'));
}
