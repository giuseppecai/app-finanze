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

Rotte (`HashRouter`): `/`, `/nuovo`, `/movimenti`, `/storico`, `/imposta`, `/chiudi`, `/inizio`, `/prestiti`, `/abbonamenti`. `/nuovo` accetta parametri `?tipo=spesa|rimborso|prestito&importo=1240&nota=...&carta=quotidiano|extra` (usati da Confronta e, in futuro, dall'inbox).

---

## 1 · Home (`Main.dc.html`)

Dall'alto:
1. **Intestazione**: nome del periodo ("Novembre") e sotto "Stipendio tra 8 giorni · 27 ott – 26 nov". Pulsante impostazioni rapide a destra (44 px).
2. **Card scura**:
   - "Puoi ancora spendere", importo grande (R3: € 174);
   - a destra, sulla stessa riga, pulsante pillola **Confronta** (apre il pannello del Confronta);
   - riga in basso: se è ora di chiudere (R2) il link "Stipendio arrivato? Chiudi il mese →", altrimenti "Ultimo confronto con Revolut: 3 giorni fa" (o "Mai confrontato").
3. **Buste** (titolo + link "Modifica" → Imposta): righe delle buste *da spendere*. Ogni riga: nome, residuo, "di € tetto" (o "oltre il tetto"), barra. Tocco → Movimenti filtrati per quella busta.
4. **Impegnate · si scalano da sole** con a destra "€ 77,50 rimasti": Casa & Servizi (→ Movimenti filtrati), Rate & Abbonamenti (→ Abbonamenti).
5. **Messi da parte**: totale dei salvadanai, barra divisa in 3 tonalità (Risparmi, Viaggi, Regali & Imprevisti), legenda con importi; ultima riga "Prestiti da riavere · € 55 ›" → Prestiti (nascosta se 0).

**Pannello Confronta** (bottom sheet): sottotitolo con la data dell'ultimo confronto, 3 campi importo (Budget del mese, Carta Quotidiano, Carta Extra), riga "Su Revolut € X · Nell'app € Y", riquadro esito secondo R5 con le azioni. Al primo confronto: calibrazione della riserva.

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

Movimenti di esempio (periodo Novembre): 19 Pranzo con colleghi (Vita, 22) · 19 Conad (Spesa, 24) · 18 Aperitivo (Vita, 24) · 17 Interessi conto risparmio (entrata +1,12) · 16 Cinema (Vita, 18) · 15 Prime (Rate, 5, auto) · 15 Treno Roma – Capaccio (Trasporti, 46) · 14 Zalando (Shopping, 45) · 12 Cena fuori (Vita, 42) · 12 Disney+ (Rate, 6, auto) · 10 Bolletta luce (Casa, 38) · 8 Carrefour (Spesa, 34) · 6 Detersivi e casa (Casa, 25) · 5 Caffè della settimana (Vita, 25) · 5 Spotify (Rate, 8,50, auto) · 3 ATAC (Trasporti, 16) · 1 Rata iPhone (Rate, 70, auto).

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

- Titolo "Inizia novembre" + intervallo. Passo 3 dell'indicatore.
- Campo "Stipendio arrivato il 27" (importo).
- "Giroconti da fare su Revolut": 4 righe spuntabili (R7) con destinazione, nota e importo.
- Nota: "Le due carte restano a € 100: quando scendono le ricarichi da Budget del mese, senza registrare niente."
- Link "Vuoi cambiare le buste di questo mese? Modifica →".
- Pulsante: "Giroconti fatti: N di 4" → con 4/4 "Fatto: inizia il mese" (crea il periodo, R7) → Home.

## 7 · Imposta / Modifica buste (`ModificaBuste.dc.html`)

- "Buste" · "Le modifiche valgono da questo mese" (aggiornano `cap`; il periodo corrente aggiorna anche `allocations`).
- **Da spendere**: riga con nome, sotto "Spendi in media € X" (R10, arancione se sopra il tetto), stepper − € tetto + (passo 5 €).
- **Impegnate · si scalano da sole**: stesse righe; sotto Rate & Abbonamenti "5 voci · si scalano da sole" (tocco → Abbonamenti).
- **Il mese inizia**: "Quando arriva lo stipendio" + selettore giorno (default 27).
- "+ Nuova busta".
- Card riepilogo: "Totale buste € 700" + "€ X in più/in meno rispetto a prima" oppure "Va nel Budget del mese a inizio mese".
- Pulsante "Salva le buste".
- In fondo (fuori dal mockup, da aggiungere): sezione **Dati** con riserva carte, saldi dei salvadanai (correggibili), Esporta / Importa backup.

## 8 · Prestiti (`Prestiti.dc.html`)

- "Prestiti" · "Escono e rientrano da Risparmi" · pulsante "+ Nuovo" (→ Inserimento in modalità Prestito).
- Card scura: "Da riavere € 55" · "da 2 persone".
- **"Chi ti deve · tocca un nome"**: una card per persona (iniziale, nome, "3 prestiti · dal 23 ott", totale, freccia). **Tocco = apre/chiude la card sul posto** (una aperta alla volta):
  - prestiti aperti dal più vecchio (motivo, data, importo) con anteprima live: "si chiude" (barrato) / "restano € X";
  - campo "Ti ha restituito" + "Tutto" + **Registra**; riga di anteprima ("Ti dovrà ancora € 15. Rimetti € 25 in Risparmi.").
- Dopo Registra: i chiusi spariscono, avviso in basso "Registrati € 25 da Mamma · 2 prestiti chiusi" con **Annulla** (resta finché non si fa un'altra azione o per 8 secondi).
- Stato vuoto: "Nessuno ti deve niente. Tutto in pari."
- In fondo: "Prestiti chiusi · storico ›" (lista semplice dei chiusi, raggruppati per persona).

## 9 · Abbonamenti (`Abbonamenti.dc.html`)

- "Abbonamenti" · "Si scalano da soli da Rate & Abbonamenti" · "+ Aggiungi".
- Card scura: "Ogni mese € 90,50", "busta € 110", barra, link "Avanzano € 19,50 al mese · modifica la busta →" (o "Sfori la busta di € X · alza il tetto →").
- "Questo mese · 27 ott – 26 nov": righe con riquadro data (giorno + mese), nome, "Carta Extra · il 5 di ogni mese", importo e stato: **scalato** (accento), **tra N giorni / domani** (giallo), **in pausa** (grigio, importo barrato).
- Tocco → pannello: importo, giorno del mese, carta, interruttore **Attivo**, Elimina, Salva (R8).
- Nota in fondo: "Il giorno dell'addebito l'app scala l'importo dalla busta… Se un prezzo aumenta, te ne accorgi al Confronta con Revolut e lo aggiorni qui."

## 10 · Onboarding (non c'è mockup — stesso stile)

Al primo avvio, 3 passi brevi:
1. "Le tue buste": conferma tetti (riusa la schermata Imposta).
2. "Abbonamenti": conferma giorni e importi (riusa Abbonamenti).
3. "I tuoi salvadanai": saldi attuali di Risparmi, Viaggi, Regali & Imprevisti.
Poi "Inizio del mese" per creare il primo periodo, e suggerimento di aggiungere l'app alla schermata Home se non è in modalità standalone.
