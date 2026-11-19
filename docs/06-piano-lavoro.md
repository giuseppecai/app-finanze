# 06 · Piano di lavoro

Una milestone alla volta. Ognuna finisce con: test verdi, `npm run build` pulito, deploy, riepilogo di cosa provare sull'iPhone. Non iniziare la successiva finché l'utente non conferma.

---

## M0 · Fondamenta
- Progetto Vite + React + TS strict, struttura cartelle di `CLAUDE.md`.
- `tokens.css`, `base.css`, font Inter e Space Grotesk self-hosted.
- `HashRouter` con le rotte di `04-schermate.md` (pagine vuote con titolo) e `TabBar`.
- `vite-plugin-pwa`: manifest (nome "Finanze", `display: standalone`, colore tema `#F4F3EF`, icone 192/512 + `apple-touch-icon` 180), service worker con precache di tutto.
- Meta iOS: `apple-mobile-web-app-capable`, `viewport-fit=cover`, padding con `env(safe-area-inset-*)`.
- GitHub Action che pubblica su **GitHub Pages** a ogni push su `main` (`base` di Vite = nome del repo).

**Accettazione**: dall'iPhone, Safari → Condividi → "Aggiungi alla schermata Home"; l'app si apre a tutto schermo, la tab bar rispetta l'area sicura, funziona in modalità aereo.

## M1 · Dominio e database
- `src/domain/`: `money.ts` (formatEuro, parse), `periods.ts` (R2), `envelopes.ts` (R3), `reconcile.ts` (R5), `closing.ts` (R6), `opening.ts` (R7), `recurring.ts` (R8), `loans.ts` (R9), `stats.ts` (R10, R11, suggerimento tetto).
- **Un test per ogni esempio di `02-regole-e-calcoli.md`**, con `today()` fissato.
- `src/db/`: schema Dexie v1, seed, repository, fixture demo (`?demo=1`).

**Accettazione**: `npm run test` copre tutte le tabelle di esempio; nessuna funzione di dominio importa React o Dexie.

## M2 · Il giro quotidiano
- **Home** (senza Confronta e senza "Messi da parte" dinamici: valori dai salvadanai).
- **Inserimento rapido** in modalità Spesa e Rimborso, anche in modifica/eliminazione.
- **Movimenti** con raggruppamento per giorno, filtri, tocco per modificare.

**Accettazione**: con `?demo=1` le tre schermate mostrano i numeri dei mockup (€ 174 / 175,12 con l'entrata — vedi nota in 03); registrare una spesa aggiorna subito Home e Movimenti; dopo il riavvio dell'app i dati ci sono ancora.

## M3 · Inizio e chiusura del mese + onboarding
- Onboarding (3 passi) al primo avvio.
- **Inizio del mese** con checklist (R7) → crea il periodo.
- **Chiusura del mese** con le 3 opzioni e il caso deficit (R6); link in Home quando è ora (R2).

**Accettazione**: partendo da zero si arriva al primo periodo aperto in meno di 2 minuti; chiudendo un periodo con la fixture si ottengono netto € 96 e le istruzioni corrette per ogni opzione.

## M4 · Confronta con Revolut
- Bottom sheet dalla Home, calibrazione della riserva al primo uso, i 3 esiti con le azioni (R5), "Ultimo confronto: N giorni fa".

**Accettazione**: con riserva 200 e saldi 339,10 / 62 / 38 l'esito è "Manca una spesa da € 12,40" e "Aggiungi la spesa" apre l'inserimento con 12,40.

## M5 · Abbonamenti
- Schermata Abbonamenti, pannello di modifica, pausa, eliminazione.
- Generazione automatica idempotente all'avvio e al ritorno in primo piano (`visibilitychange`).

**Accettazione**: con oggi = 19 nov risultano 4 scalati e iCloud "tra 5 giorni"; riaprire l'app 10 volte non crea duplicati; spostando la data al 24 compare iCloud in Movimenti con "· auto".

## M6 · Prestiti
- Modalità Prestito nell'inserimento (persona + motivo, creazione persona al volo).
- Schermata Prestiti con card espandibili, restituzione FIFO, toast con Annulla, storico dei chiusi.
- Riga "Prestiti da riavere" in Home.

- Debiti e saldo unico per persona con compensazione automatica (R9-bis); migrazione Dexie alla versione 2 (`03-modello-dati.md`).

**Accettazione**: l'esempio di R9 (Mamma 10/10/20, restituzione 25 → resta 15, Annulla → 40) funziona dall'interfaccia; l'esempio Elisa di R9-bis (40 + 14 − 30 → saldo 24, "Ti ha dato 24" → 0) torna anche con prestiti e debiti inseriti a mano; un database v1 si aggiorna alla v2 senza perdere dati.

## M6b · Casa & Servizi e bollette
- Schermata `/casa` (04 § 9-bis): bollette mensili e periodiche, saldo con la coinquilina, pannello Registra / Modifica.
- Salvadanaio e Pocket **Bollette**; quinto giroconto a inizio mese (R7, R13); `fund` per bolletta.
- Registrare una bolletta crea in un'unica transazione: spesa (busta o fondo), prestito o debito con compensazione, aggiornamento dei salvadanai, con le istruzioni dei giroconti.
- Passo "Bollette" nell'onboarding (facoltativo) e Home: Casa & Servizi → `/casa`.

**Accettazione**: con le 4 bollette di esempio di R13 la quota mensile è € 25 e Risparmi a inizio mese € 700; il gas da € 62 pagato da Elisa dà quota 31, `fund` − 1 e saldo Elisa aggiornato; la luce da € 80,01 dà 40,01 in Casa e 40 a Elisa; Confronta resta "Tutto in ordine" dopo ogni registrazione fatta seguendo i giroconti indicati.

## M7 · Storico e Imposta
- Storico: grafico, selezione periodo, tabella, segnalazione.
- Imposta: tetti con stepper e spesa media, giorno di inizio mese, nuova busta, sezione Dati (riserva carte, saldi salvadanai, esporta/importa backup).

**Accettazione**: con la fixture, Luglio è arancione, Spesa alimentare mostra "Spendi in media € 58 · più del tetto" e la segnalazione "5 mesi su 5"; esporta → reinstalla → importa ripristina tutto.

## M8 · Rifinitura
- Stati vuoti in ogni schermata, testi di errore, `prefers-reduced-motion`, verifica contrasti e aree di tocco, promemoria backup dopo 30 giorni.
- Prova completa sull'iPhone di un mese simulato.

## M9 · Apple Pay → app (sperimentale)
Vedi `07-apple-pay-comandi-rapidi.md`. Da fare **solo dopo** che l'utente ha usato l'app manualmente per qualche settimana e lo chiede. Richiede verifica sul dispositivo prima di qualsiasi implementazione definitiva.
