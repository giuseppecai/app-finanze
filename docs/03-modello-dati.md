# 03 · Modello dati

Database IndexedDB tramite Dexie, nome `app-finanze`. Tutti gli importi in **centesimi interi**, tutte le date `YYYY-MM-DD` (ora locale), i timestamp ISO completi. Id: `crypto.randomUUID()`.

## Tipi TypeScript

```ts
type Cents = number;          // intero
type ISODate = string;        // 'YYYY-MM-DD'
type PeriodId = string;       // 'YYYY-MM' del mese in cui il periodo finisce

interface Settings {
  id: 'settings';
  periodStartDay: number;          // default 27
  cardReserve: Cents | null;       // null finché non calibrata al primo confronto (R5)
  giftsQuota: Cents;               // Regali & Imprevisti, default 2500
  lastTravelQuota: Cents;          // ultima quota Viaggi usata, default 5000
  lastEnvelopeId: string | null;   // per la preselezione (R12)
  onboardingDone: boolean;
}

interface Envelope {
  id: string;
  name: string;            // 'Spesa alimentare'
  shortName: string;       // 'Spesa' (pulsanti, filtri)
  kind: 'spendable' | 'committed';
  cap: Cents;              // tetto attuale
  order: number;
  archived: boolean;
}

interface Period {
  id: PeriodId;            // '2026-11'
  name: string;            // 'Novembre'
  calendarStart: ISODate;  // '2026-10-27'
  calendarEnd: ISODate;    // '2026-11-26'
  startedAt: ISODate;      // quando è stato fatto "Inizio del mese"
  salary: Cents;
  allocations: Record<string, Cents>;  // envelopeId → tetto fotografato
  carryIn: Record<string, Cents>;      // envelopeId → riporto (opzione B), anche negativo
  unassigned: Cents;                   // "da assegnare" iniziale (opzione C) — le entrate si sommano a runtime
  travelQuota: Cents;
  giftsQuota: Cents;
  closedAt: string | null;
  leftoverChoice: 'toSavings' | 'carryOver' | 'half' | 'deficit' | null;
  leftovers: Record<string, Cents> | null;  // snapshot alla chiusura
}

type TxType = 'expense' | 'refund' | 'income' | 'loan' | 'loanRepayment';

interface Transaction {
  id: string;
  periodId: PeriodId;
  date: ISODate;
  type: TxType;
  amount: Cents;                 // sempre positivo; il segno lo dà il tipo
  envelopeId: string | null;     // expense/refund
  note: string;                  // nota o motivo
  card: 'quotidiano' | 'extra' | null;
  source: 'manual' | 'recurring' | 'reconcile' | 'inbox';
  recurringId: string | null;
  personId: string | null;       // loan/loanRepayment
  loanAllocations: { loanId: string; amount: Cents }[] | null; // solo loanRepayment (per l'annulla)
  createdAt: string;
}

interface Recurring {
  id: string;
  name: string;
  amount: Cents;
  dayOfMonth: number;      // 1..31
  envelopeId: string;      // default Rate & Abbonamenti
  card: 'quotidiano' | 'extra';
  active: boolean;
  createdAt: string;
}

interface Person { id: string; name: string; createdAt: string; }

interface Loan {
  id: string;
  personId: string;
  date: ISODate;
  reason: string;
  amount: Cents;
  remaining: Cents;
  closedAt: string | null;
  transactionId: string;   // il movimento 'loan' che l'ha creato
  createdAt: string;
}

interface Pot {               // specchio dei salvadanai Revolut
  id: 'savings' | 'travel' | 'gifts';
  name: string;               // 'Risparmi' | 'Viaggi' | 'Regali & Imprevisti'
  balance: Cents;             // aggiornato da R6, R7, R9; correggibile a mano
}

interface Reconciliation {
  id: string;
  date: ISODate;
  periodId: PeriodId;
  budgetPocket: Cents;
  quotidiano: Cents;
  extra: Cents;
  expected: Cents;
  diff: Cents;
  outcome: 'ok' | 'calibrated' | 'missingExpense' | 'extraIncome' | 'ignored';
}
```

## Schema Dexie (versione 1)

```ts
db.version(1).stores({
  settings: 'id',
  envelopes: 'id, order',
  periods: 'id, closedAt',
  transactions: 'id, periodId, date, envelopeId, type, personId, [recurringId+periodId]',
  recurring: 'id',
  people: 'id',
  loans: 'id, personId, closedAt, date',
  pots: 'id',
  reconciliations: 'id, date',
});
```

Ogni modifica futura allo schema = nuova `version(n)` con `upgrade()`; non modificare mai una versione già rilasciata.

## Versione 2 (M6 · Prestiti e debiti, M6b · Bollette)

```ts
type TxType = 'expense' | 'refund' | 'income' | 'loan' | 'loanRepayment' | 'debt' | 'debtRepayment';

interface Transaction {
  // …campi della v1…
  billId: string | null;          // movimento nato da una bolletta (R13)
}

interface Loan {
  // …campi della v1…
  direction: 'lent' | 'borrowed'; // prestito (ti deve) o debito (devi tu), R9-bis
  offsets: LoanAllocation[] | null; // compensazioni fatte alla nascita di questa voce
}

type PotId = 'savings' | 'travel' | 'gifts' | 'bills';   // + Pocket "Bollette"

interface Bill {
  id: string;
  name: string;                   // 'Gas'
  frequency: 1 | 2 | 3 | 6 | 12;  // mesi tra una bolletta e l'altra
  estimate: Cents;                // importo previsto della bolletta intera
  split: 'half' | 'mine';
  payer: 'me' | 'roommate';
  personId: string | null;        // la coinquilina (obbligatoria se split = 'half' o payer = 'roommate')
  envelopeId: string;             // busta delle bollette mensili (default Casa & Servizi)
  fund: Cents;                    // accantonato finora (solo periodiche), può andare sotto zero
  active: boolean;
  order: number;
  createdAt: string;
}

interface Period {
  // …campi della v1…
  billsQuota: Cents;              // giroconto → Bollette fatto a inizio periodo (0 se nessuna periodica)
}

interface Settings {
  // …campi della v1… (non indicizzati: nessuna migrazione necessaria)
  lastBackupAt?: string | null;        // ultimo backup esportato (R14)
  backupSnoozedUntil?: ISODate | null; // "Più tardi" sul promemoria (R14)
}
```

```ts
db.version(2).stores({
  // tabelle della v1 invariate, più:
  loans: 'id, personId, closedAt, date, direction',
  transactions: 'id, periodId, date, envelopeId, type, personId, billId, [recurringId+periodId]',
  bills: 'id, order',
}).upgrade(async (tx) => {
  // prestiti esistenti → direction 'lent', offsets null; movimenti → billId null;
  // periodi → billsQuota 0; nuovo salvadanaio { id: 'bills', name: 'Bollette', balance: 0 }
});
```

## Versione 3 (voci fisse dell'inizio del mese, bollette tutte accantonate)

```ts
interface MonthlyItem {            // R7
  id: string;                      // 'travel', 'gifts' o un uuid
  name: string;                    // 'Viaggi', 'Affitto'
  kind: 'pot' | 'payment';         // salvadanaio (stesso id del Pot) o uscita fissa
  amount: Cents;                   // importo proposto (l'ultimo usato)
  archived: boolean;
}

interface Settings {
  // …senza giftsQuota e lastTravelQuota, sostituiti da:
  monthlyItems: MonthlyItem[];
}

interface Period {
  // …senza travelQuota e giftsQuota, sostituiti da:
  quotas: Record<string, Cents>;   // id voce → importo usato a inizio periodo
}

type PotId = string;               // 'savings', 'bills' e gli id delle voci-salvadanaio

interface Bill {
  // …senza envelopeId: le bollette non passano più dalle buste (R13)
}
```

`db.version(3).stores({})` con `upgrade()`: `giftsQuota`/`lastTravelQuota` → `monthlyItems` (Viaggi e Regali come salvadanai), `travelQuota`/`giftsQuota` dei periodi → `quotas`, `envelopeId` tolto dalle bollette. Lo stesso passaggio vale per l'import dei backup v1/v2. Il fondo delle bollette mensili parte da 0: il primo mese dopo l'aggiornamento la bolletta mostra "Mancano € X" finché la quota non arriva.

### v4

```ts
interface Bill {
  // …
  nextDue?: PeriodId | null;      // solo periodiche: periodo in cui arriva la prossima (R13); null/assente = quota fissa
}
```

`db.version(4).stores({})` con `upgrade()`: la busta Casa & Servizi, se impegnata, diventa da spendere. `nextDue` è facoltativo: nessuna migrazione, le bollette esistenti restano a quota fissa finché non si sceglie il mese. Lo stesso vale per l'import dei backup v1–v3.

Nessuna bolletta nel seed: si creano dalla schermata Casa & Servizi (o in un passo dell'onboarding, se non ancora fatto). Le transazioni che toccano bolletta, movimenti, prestiti e salvadanai sono un'unica transazione Dexie.

## Dati iniziali (seed al primo avvio)

- `Settings`: periodStartDay 27, cardReserve null, monthlyItems Viaggi (pot, 5000) e Regali & Imprevisti (pot, 2500).
- `Envelope` (ordine):
  1. Trasporti / Trasporti — spendable — 10000
  2. Vita / Vita — spendable — 20000
  3. Spesa alimentare / Spesa — spendable — 5000
  4. Shopping / Shopping — spendable — 12000
  5. Casa & Servizi / Casa — committed — 12000
  6. Rate & Abbonamenti / Rate — committed — 11000
- `Recurring` (envelope Rate & Abbonamenti, card extra, active): Rata iPhone 7000 giorno 1 · Spotify 850 giorno 5 · Disney+ 600 giorno 12 · Prime 500 giorno 15 · iCloud 100 giorno 24. **I giorni sono da verificare con l'utente al primo avvio** (schermata di onboarding: "Controlla giorni e importi").
- `Pot`: savings, travel, gifts con balance 0 → l'onboarding chiede i saldi attuali.
- Nessun periodo: il primo avvio porta a "Inizio del mese".

## Fixture per sviluppo e test

Crea `src/db/fixtures.ts` con i dati di esempio dei documenti (oggi = 2026-11-19, periodo Novembre aperto, periodi Giugno–Ottobre chiusi con gli avanzi di R11, movimenti di Novembre di `04-schermate.md` § Movimenti, prestiti di R9). Attivabile con il parametro `?demo=1` (anche nella versione pubblicata, così si prova dall'iPhone in Safari): usa un database separato `app-finanze-demo`, si carica la prima volta (o con `&reset=1`) e poi i dati di prova restano; "oggi" è fissato al 19 novembre 2026 (o a `?oggi=YYYY-MM-DD`). L'app installata nella Home apre sempre i dati veri.

Nota: la fixture contiene anche l'entrata "Interessi conto risparmio" da € 1,12 (17 nov), quindi con la fixture completa "Puoi ancora spendere" vale € 175,12 (174 + 1,12 da assegnare). I test di R3 usano invece `daAssegnare = 0` → € 174.

## Backup

In "Imposta": **Esporta backup** (file JSON con tutte le tabelle + `schemaVersion` + data) tramite `navigator.share` se disponibile, altrimenti download; **Importa backup** con conferma (sostituisce tutto). È l'unica protezione contro la perdita dei dati: ricordalo all'utente con un promemoria se l'ultimo backup ha più di 30 giorni.
