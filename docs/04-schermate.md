# 04 · Schermate

Viewport di riferimento: **iPhone, 390 × 844**. Tutte le schermate devono funzionare anche a 375 px di larghezza. Il mockup di ogni schermata è in `design/mockups/` (nome tra parentesi).

## Navigazione

Barra in basso (solo su Home, Movimenti, Storico, Imposta), alta 84 px con area sicura iOS:

| Voce | Va a |
|---|---|
| Buste | Home |
| Movimenti | Movimenti |
| **＋** (cerchio pieno accento, rialzato) | Inserimento rapido |
| Storico | Storico |
| Imposta | Modifica buste e impostazioni |

Le altre schermate (Inserimento, Chiusura, Inizio, Prestiti, Abbonamenti) si aprono a tutto schermo con un pulsante indietro/chiudi in alto a sinistra.

Rotte (`HashRouter`): `/`, `/nuovo`, `/movimenti`, `/storico`, `/imposta`, `/chiudi`, `/inizio`, `/prestiti`, `/bollette` (Spese fisse; `/abbonamenti` e il vecchio `/casa` rimandano qui), `/benvenuto` (onboarding). `/nuovo` accetta parametri `?tipo=spesa|rimborso|prestito&importo=1240&nota=...&carta=quotidiano|extra` (usati da Confronta e, in futuro, dall'inbox).

---

## 1 · Home (`Main.dc.html`)

Dall'alto:
1. **Intestazione**: nome del periodo ("Novembre") e sotto "Stipendio tra 8 giorni · 27 ott – 26 nov". Nessun pulsante di modifica: si modifica solo dalla scheda **Imposta**.
2. **Card scura**:
   - "Puoi ancora spendere", importo grande (R3: € 174);
   - a destra, sulla stessa riga, pulsante pillola **Confronta** (apre il pannello del Confronta);
   - riga in basso: se è ora di chiudere (R2) il link "Stipendio arrivato? Chiudi il mese →", altrimenti "Ultimo confronto con Revolut: 3 giorni fa" (o "Mai confrontato").
Tre sezioni con titolo grande e una riga di spiegazione, ognuna con un aspetto diverso:
3. **Da spendere** ("Le buste per le spese di tutti i giorni"): una scheda per busta *da spendere* (Casa & Servizi compresa). Ogni riga: nome, residuo, "di € tetto" (o "oltre il tetto"), barra. Tocco → Movimenti filtrati per quella busta.
4. **Messi da parte** (Pocket): Risparmi, salvadanai delle voci fisse e **Spese fisse** (riga che apre `/bollette`, con "N da registrare questo mese" o il prossimo addebito automatico). Bollette e abbonamenti non sono tra le buste (R16): Home ha solo **Buste** e **Messi da parte**.
5. **Messi da parte** ("Le Pocket su Revolut", totale a destra): riquadro lilla, barra divisa in tonalità (Risparmi in accento, gli altri salvadanai in viola chiaro), elenco con importi; ultima riga "Prestiti da riavere · € 55 ›" → Prestiti (nascosta se 0; con debiti aperti aggiunge "· devi € Y"). Bollette qui non compare.

**Pannello Confronta** (bottom sheet): sottotitolo con la data dell'ultimo confronto, campi importo in tre gruppi — **Buste** (Budget del mese), **Carte** (Quotidiano, Extra), **Pocket** (tutte quelle di "Messi da parte", ognuna con "nell'app € X" sotto il nome), riga "Su Revolut € X · Nell'app € Y", riquadro esito secondo R5 con le azioni. Al primo confronto: calibrazione della riserva.

## 2 · Inserimento rapido (`NuovaSpesa.dc.html`)

- In alto: chiudi (X) · selettore **Spesa / Rimborso / Prestito** · pulsante data (icona calendario, default oggi).
- Etichetta di provenienza (solo se arriva dall'inbox Apple Pay): "Da Apple Pay · ‹esercente› · ‹carta›". In modalità Rimborso: "Reso, cashback o soldi restituiti".
- **Importo** grande (con "+ " davanti in Rimborso) e sotto una riga di feedback live:
  - Spesa: "‹Busta›: restano € X dopo questa spesa" oppure, in arancione, "‹Busta›: sfori di € X — puoi spostare soldi da un'altra busta";
  - Rimborso: "‹Busta›: torna a € X" (colore accento);
  - Prestito: "‹Persona› ti dovrà € X".
- Spesa/Rimborso: **"In quale busta?"** griglia 3 × 2 (nome breve + residuo; residuo negativo in arancione), ordinate per uso (R12).
- Prestito: **"A chi lo presti?"** pulsanti persona con "ti deve € X" + "+ Persona" (crea al volo, chiede solo il nome) e riquadro informativo "Non è una spesa: non tocca le buste. Dopo il salvataggio sposta € X da Risparmi a Quotidiano."
- Campo **Nota** (in Prestito si chiama **Motivo**, placeholder "es. monete Homescapes").
- **Tastierino** 3 × 4: 1–9, 00, 0, cancella.
- Pulsante principale: "Salva € 4,80 in Vita" / "Rimborso di € 4,80 in Vita" / "Presta € 4,80 a Mamma". Disabilitato con importo 0.
- Usata anche per **modificare** un movimento esistente (da Movimenti): stessi campi precompilati + pulsante "Elimina movimento" in fondo.

## 3 · Movimenti (`Movimenti.dc.html`)

- Intestazione: "Movimenti", riepilogo "Speso € 448,50 · 16 spese", selettore periodo ("27 ott – 26 nov", apre l'elenco dei periodi).
- **Filtri** a pillola, scorrevoli: Tutte, poi le buste (nome breve). Con una busta selezionata compare una riga "‹Busta›: speso € X di € Y · resta € Z". Il filtro arriva anche dalla Home (`/movimenti?busta=id`).
- Lista **raggruppata per giorno** (Oggi, Ieri, "Lunedì 16 novembre"), con il totale del giorno. Riga: iniziale della busta in un quadratino, nome/nota, "‹Busta completa› · ‹Carta›" (+ "· auto" per gli abbonamenti), importo ("− € 24,00"; entrate "+ € 1,12" in colore accento). Prestiti e restituzioni compaiono con l'iniziale della persona e "Prestito · ‹Persona›".
- Tocco su una riga → Inserimento rapido in modalità modifica.

Movimenti di esempio (periodo Novembre): 19 Pranzo con colleghi (Vita, 22) · 19 Conad (Spesa, 24) · 18 Aperitivo (Vita, 24) · 17 Interessi conto risparmio (entrata +1,12) · 16 Cinema (Vita, 18) · 15 Prime (Rate, 5, auto) · 15 Treno Roma – Capaccio (Trasporti, 46) · 14 Zalando (Shopping, 45) · 12 Cena fuori (Vita, 42) · 12 Disney+ (Rate, 6, auto) · 10 Lampadine e prese (Casa, 38) · 8 Carrefour (Spesa, 34) · 6 Detersivi e casa (Casa, 25) · 5 Caffè della settimana (Vita, 25) · 5 Spotify (Rate, 8,50, auto) · 3 ATAC (Trasporti, 16) · 1 Rata iPhone (Rate, 70, auto).

## 4 · Storico (`Storico.dc.html`)

- Sottotitolo "Ultimi 6 mesi · ogni mese va dal 27 al 26".
- **Grafico a barre** dei 6 periodi più recenti (spesa totale), linea tratteggiata = somma dei tetti. Barre sopra il budget in arancione chiaro (selezionata: arancione pieno), altre viola chiaro `--accent-3` (selezionata: accento), periodo in corso tratteggiato. Le barre sono pulsanti: tocco → seleziona il periodo. Legenda sotto: "– – Budget € 700", "■ Sopra il budget".
- In alto nella card: nome del periodo selezionato e "€ speso di € 700".
- **Tabella** del periodo selezionato: Busta · Messo · Speso · Avanzo (in corso: Resta) + riga Totale (R11). Nomi completi.
- **Segnalazione** (R6, suggerimento tetto) con link "Modifica le buste →".

## 5 · Chiusura del mese (`ChiusuraMese.dc.html`)

- Titolo "Chiudi ottobre" + intervallo "27 settembre – 26 ottobre". Indicatore a 3 passi (Rivedi · Avanzi · Assegna).
- Card "Com'è andata": avanzo totale e una riga per busta (+/−).
- "Cosa fai con i € 96?": 3 opzioni radio (R6), con dettaglio sotto il titolo. Se netto ≤ 0, al posto delle opzioni il messaggio di copertura da Risparmi.
- Segnalazione suggerimento tetto (se applicabile) con pulsante "Porta il tetto a € 60" → Imposta.
- Pulsante "Continua: assegna lo stipendio" → Inizio del mese.

## 6 · Inizio del mese (`InizioMese.dc.html`)

Percorso a **5 passi** (indicatore "Stipendio · Spese · Pocket · Buste · Giroconti"), con **Indietro** / **Avanti** in basso. Titolo "Inizia dicembre" + intervallo.

1. **Stipendio**: "Quanto è arrivato?", campo "Stipendio arrivato il 27". Avanti solo con un importo valido.
2. **Spese fisse del mese**: elenco di abbonamenti e bollette con la quota di questo mese (R16; tag Abbonamento/Bolletta, frequenza per i non mensili), riga di totale "Abbonamenti e bollette". Sotto, **Uscite fisse** (affitto) a parte, con l'importo modificabile per questo mese. In fondo "In tutto, spese fisse e uscite € X".
3. **Le tue Pocket**: per ogni Pocket di "Messi da parte" (Risparmi, Viaggi, Regali, Spese fisse, altre) il **saldo adesso** da ricopiare da Revolut (precompilato con quello dell'app) e **questo mese**: modificabile per le Pocket con quota (Viaggi, Regali…), calcolato per Spese fisse (al netto di quello che c'è già, "Servono € X, € Y sono già nella Pocket"), "il resto" per Risparmi. "+ Aggiungi una voce fissa". Budget del mese non c'è: le buste si decidono al passo dopo.
4. **Quanto metti nelle buste**: card scura "Ti restano per le buste € X" (= stipendio − giroconto Spese fisse − uscite − quote delle Pocket), sotto ogni busta con lo stepper, partendo dai tetti di Imposta. In fondo "Quello che avanza va a Risparmi € Y" (arancione "Le buste superano lo stipendio di € Y" se negativo). I tetti scelti diventano quelli di Imposta.
5. **Giroconti da fare su Revolut**: righe spuntabili (R7) con destinazione, nota e importo; nota sulle carte a € 100. Pulsante "Giroconti fatti: N di M" → con tutto spuntato "Fatto: inizia il mese" (aggiorna i saldi delle Pocket a quelli ricopiati, salva i tetti, crea il periodo, R7) → Home.

## 7 · Imposta (`ModificaBuste.dc.html`, rivista)

Elenco raggruppato come le Impostazioni di iOS: titoletti di gruppo grigi, card bianche con righe separate da filetti, nota sotto ogni gruppo.

- **Buste**: un'unica card con **un solo elenco** di buste (nessuna distinzione tra da spendere e impegnate). Riga: nome, sotto "In media € X" (R10, arancione "In media € X: tetto basso" se sopra il tetto), stepper − € tetto + (passo 5 €). Poi "+ Nuova busta" (pannello dal basso) e la riga di riepilogo "Totale buste € 700" ("+ € X rispetto a prima"). Nota: "Le modifiche valgono da questo mese."
- **Barra di salvataggio**: compare solo con modifiche alle buste, fissa sopra la tab bar: anteprima del giroconto ("Dopo il salvataggio sposta € X da Risparmi a Budget del mese"), **Annulla** e **Salva le buste**.
- **Il mese**: "Il mese inizia · il 27" (selettore, salva subito) e la riga **"Chiudi novembre e inizia dicembre ›"** (o "Inizia dicembre ›" senza un mese aperto) che apre "Inizia il mese" in qualsiasi giorno. Voci fisse, spese fisse e buste del mese non si ripetono qui: si decidono dentro "Inizia il mese" (dove le voci fisse hanno anche "Modifica" per rinominarle o toglierle).
- **Salvadanai e carte**: una riga per salvadanaio e la riserva carte, in sola lettura; tocco → pannello per correggere il saldo.
- **Backup**: "Esporta backup" (con data dell'ultimo) e "Importa backup".

## 8 · Prestiti (`Prestiti.dc.html`)

- "Prestiti" · "Escono e rientrano da Risparmi" · pulsante "+ Nuovo" (→ Inserimento in modalità Prestito).
- Card scura: "Da riavere € 55" · "da 2 persone".
- **"Chi ti deve · tocca un nome"**: una card per persona (iniziale, nome, "3 prestiti · dal 23 ott", totale, freccia). **Tocco = apre/chiude la card sul posto** (una aperta alla volta):
  - prestiti aperti dal più vecchio (motivo, data, importo) con anteprima live: "si chiude" (barrato) / "restano € X";
  - campo "Ti ha restituito" + "Tutto" + **Registra**; riga di anteprima ("Ti dovrà ancora € 15. Rimetti € 25 in Risparmi.").
- Dopo Registra: i chiusi spariscono, avviso in basso "Registrati € 25 da Mamma · 2 prestiti chiusi" con **Annulla** (resta finché non si fa un'altra azione o per 8 secondi).
- Stato vuoto: "Nessuno ti deve niente. Tutto in pari."
- In fondo: "Prestiti chiusi · storico ›" (lista semplice dei chiusi, raggruppati per persona).
- **Debiti (R9-bis)**: la card di una persona mostra il **saldo unico**. Saldo positivo: come sopra ("ti deve € X", "Ti ha restituito"). Saldo negativo: "Devi € X" (testo normale, non arancione), voci aperte = debiti, campo "Le hai dato" + "Tutto" + **Registra**, anteprima "Togli € X da Risparmi". La card scura in alto: "Da riavere € X" e, se serve, sotto "Devi € Y".
- Le voci nate da una bolletta mostrano il nome della bolletta come motivo (es. "Luce · novembre", "Gas · metà tua").
- "+ Nuovo" apre l'inserimento in modalità Prestito; un debito a mano si registra dalla stessa modalità con l'opzione "Mi ha prestato lei/lui".

## 9 · Spese fisse (bollette e abbonamenti, R16)

Un'unica schermata (`/bollette`; `/abbonamenti` e `/casa` rimandano qui). Si apre dalla riga **Spese fisse** tra i Messi da parte in Home e da Imposta. Schermo intero con chiudi.

- "Spese fisse" · chip "N da registrare" (o "Prossimo: Spotify domani") · "dalla Pocket Spese fisse" · "+ Aggiungi".
- **Card scura**: "Nella Pocket Spese fisse € X", a destra "+ € Y al mese" (il giroconto di inizio mese), sotto "Abbonamenti € A · bollette € B al mese".
- **Con Elisa**: riga con il saldo unico → Prestiti.
- **Questo mese · 27 ott – 26 nov**: abbonamenti con addebito nel periodo (riquadro giorno + mese, "scalato" / "tra N giorni") e bollette del mese (riquadro mese, "registrata il 1 nov" / "da registrare" / "in ritardo"). **Più avanti**: annuali e bollette periodiche dei mesi dopo ("tra N mesi" / "a febbraio").
- Riga: nome, "Abbonamento · ogni mese" oppure "Bolletta · metà, paghi tu" / "solo tua"; per i non mensili una seconda riga "ogni anno · + € 3,16/mese, ne hai € 12" (accantonato) o "tutto nel mese"; a destra l'importo (tua quota per le bollette).
- **+ Aggiungi** → scelta "Abbonamento o rata" (importo fisso, si scala da solo) / "Bolletta" (importo che cambia, la registri tu), poi il pannello relativo.
- Pannello abbonamento: importo, ogni quanto, giorno, prossimo addebito (non mensili, 24 mesi), **Accantona ogni mese** (popup R15), carta, attivo, Elimina, Salva.
- Pannello bolletta: **Registra bolletta** e **Modifica** come in R13, con **Accantona ogni mese** per le periodiche.

## 10 · Onboarding (non c'è mockup — stesso stile)

Al primo avvio, 3 passi brevi:
1. "Le tue buste": conferma tetti (riusa la schermata Imposta).
2. "Abbonamenti": conferma giorni e importi (poi si gestiscono in Spese fisse).
3. "I tuoi salvadanai": saldi attuali di Risparmi e dei salvadanai delle voci fisse (Viaggi, Regali & Imprevisti).
Poi "Inizio del mese" per creare il primo periodo, e suggerimento di aggiungere l'app alla schermata Home se non è in modalità standalone.
