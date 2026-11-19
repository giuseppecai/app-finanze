# App Finanze — istruzioni per Claude Code

PWA personale di budgeting a buste, usata da **una sola persona** (Giuseppe) su **iPhone**, installata nella schermata Home. Nessun backend nel MVP: i dati vivono sul telefono.

Prima di scrivere codice leggi, in quest'ordine:
1. `docs/01-prodotto.md` — cosa fa l'app e perché (il modello Revolut).
2. `docs/02-regole-e-calcoli.md` — **le regole di dominio. Sono la parte più importante**: ogni esempio numerico lì dentro deve diventare un test.
3. `docs/03-modello-dati.md` — entità e schema IndexedDB.
4. `docs/04-schermate.md` — le 9 schermate, una per una.
5. `docs/05-design-system.md` — colori, tipografia, componenti.
6. `docs/06-piano-lavoro.md` — milestone in ordine, con criteri di accettazione.
7. `docs/07-apple-pay-comandi-rapidi.md` — integrazione con l'iPhone (milestone tardiva).

I mockup in `design/mockups/` sono il riferimento visivo (vedi `design/README.md`).

## Stack (deciso, non cambiarlo senza chiedere)

- **Vite + React + TypeScript** (strict).
- **Dexie** per IndexedDB, con `useLiveQuery` di `dexie-react-hooks` per leggere i dati nei componenti.
- **React Router** con `HashRouter` (deploy statico su GitHub Pages senza configurazioni server).
- **vite-plugin-pwa** per manifest e service worker (offline, installabile).
- **Vitest** per i test della logica di dominio.
- CSS semplice con variabili (`src/styles/tokens.css`), niente librerie UI, niente Tailwind.
- Nessuna libreria per le date: usa helper propri su stringhe ISO `YYYY-MM-DD` (vedi regole).
- Icone: SVG inline copiati dai mockup, oppure `lucide-react` (unica dipendenza UI ammessa).

Obiettivo: **poche dipendenze**, così tra un anno compila ancora. Prima di aggiungere una dipendenza non elencata qui, chiedi.

## Architettura

```
src/
  domain/        logica pura, zero React, zero Dexie: calcoli, periodi, FIFO, ricorrenze
  db/            schema Dexie, migrazioni, repository (funzioni che leggono/scrivono)
  features/      una cartella per schermata (home, entry, movements, history, ...)
  components/    componenti UI riusabili (EnvelopeRow, Sheet, Stepper, Keypad, ...)
  styles/        tokens.css, base.css
  i18n/it.ts     tutte le stringhe UI in italiano
```

- `domain/` deve essere testabile senza browser. Le schermate chiamano funzioni di dominio, mai calcoli inline nei componenti.
- Gli importi sono **sempre interi in centesimi** (`number`, es. `1240` = € 12,40). Mai float per i soldi. Converti solo in visualizzazione con `formatEuro(cents)` → `€ 12,40` (locale `it-IT`).
- Date: stringhe `YYYY-MM-DD` in ora locale (Europe/Rome). "Oggi" arriva da una funzione `today()` iniettabile, così i test possono fissare la data.

## Convenzioni

- Codice e nomi in **inglese**, testi UI in **italiano** (in `i18n/it.ts`). Glossario:
  busta = `Envelope`, periodo/mese = `Period`, movimento = `Transaction`, abbonamento = `Recurring`, prestito = `Loan`, restituzione = `LoanRepayment`, confronto = `Reconciliation`, salvadanaio (Pocket Revolut) = `Pot`.
- Componenti piccoli, una responsabilità. Niente stato globale oltre a Dexie: la fonte di verità è il database.
- Ogni scrittura che tocca più tabelle va in una transazione Dexie.
- Accessibilità: elementi interattivi veri (`button`, `a`, `input` con `label`), aree di tocco ≥ 44 px, contrasti come in `05-design-system.md`.

## Comandi

```
npm install
npm run dev        # sviluppo
npm run test       # vitest
npm run build      # build di produzione
npm run preview    # prova la build
```

## Come lavorare

- Procedi **una milestone alla volta** (`docs/06-piano-lavoro.md`). A fine milestone: test verdi, `npm run build` pulito, breve riepilogo di cosa è stato fatto e cosa provare sull'iPhone.
- Se una regola in `02-regole-e-calcoli.md` è ambigua o contraddice un mockup, **vince il documento delle regole**; segnala la discrepanza invece di inventare.
- Non aggiungere funzioni non richieste (grafici extra, login, sync, categorie automatiche). La semplicità è un requisito: l'utente vuole un'app che non gli venga a noia.
