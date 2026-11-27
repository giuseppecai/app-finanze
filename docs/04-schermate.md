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
- Rimborso: sopra la griglia un selettore **In una busta / In una Pocket** (R4); con "In una Pocket" la griglia mostra le Pocket (tranne Spese fisse) con il saldo, la riga di feedback dice "‹Pocket›: sale a € X" e il pulsante "Rimborso di € X in ‹Pocket›".
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
5. **Giroconti da fare su Revolut**: con lo stipendio su un altro conto, prima "Lascia su Isybank € X" (nota: affitto, rata…) e "Isybank → Revolut € Y" (R17); poi righe spuntabili (R7) con destinazione, nota e importo; nota sulle carte a € 100. Pulsante "Giroconti fatti: N di M" → con tutto spuntato "Fatto: inizia il mese" (aggiorna i saldi delle Pocket a quelli ricopiati, salva i tetti, crea il periodo, R7) → Home.

## 7 · Imposta (`ModificaBuste.dc.html`, rivista)

Elenco raggruppato come le Impostazioni di iOS: titoletti di gruppo grigi, card bianche con righe separate da filetti, nota sotto ogni gruppo.

- **Buste**: un'unica card con **un solo elenco** di buste (nessuna distinzione tra da spendere e impegnate). Riga: nome, sotto "In media € X" (R10, arancione "In media € X: tetto basso" se sopra il tetto), stepper − € tetto + (passo 5 €). Poi "+ Nuova busta" (pannello dal basso) e la riga di riepilogo "Totale buste € 700" ("+ € X rispetto a prima"). Nota: "Le modifiche valgono da questo mese."
- **Barra di salvataggio**: compare solo con modifiche alle buste, fissa sopra la tab bar: anteprima del giroconto ("Dopo il salvataggio sposta € X da Risparmi a Budget del mese"), **Annulla** e **Salva le buste**.
- **Conti** (un solo gruppo, R17): la card **Revolut** ("Qui arriva lo stipendio" o "Pocket e carte") con dentro **Pocket** (una riga per Pocket con il saldo, tocco → pannello per correggerlo, rinominare o togliere; "+ Nuova Pocket") e **Carte** ("Quotidiano · Extra" e la riserva delle carte). Sotto, gli **altri conti** (Isybank…: "Qui arriva lo stipendio · 1 carta") e "+ Aggiungi un conto". Tocco su un conto → pannello con nome, **Carte** (elenco con "+ Aggiungi una carta" e il cestino), interruttore **"Qui arriva lo stipendio"** (se lo stipendio arriva altrove: "Adesso arriva su Revolut: salvando lo sposti qui") e **Togli il conto**. Nei pannelli di abbonamento e voce fissa (uscita), se ci sono altri conti, c'è **"Si paga da"**; la scelta della carta compare solo per Revolut (Quotidiano/Extra) o per un conto con due o più carte.
- **Il mese**: "Il mese inizia · il 27" (selettore, salva subito) e la riga **"Chiudi novembre e inizia dicembre ›"** (o "Inizia dicembre ›" senza un mese aperto) che apre "Inizia il mese" in qualsiasi giorno. Voci fisse, spese fisse e buste del mese non si ripetono qui: si decidono dentro "Inizia il mese" (dove le voci fisse hanno anche "Modifica" per rinominarle o toglierle).
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
- **Card scura**: in grande "Dalla Pocket, questo mese € X" (quello che esce ancora in questo periodo: abbonamenti non ancora scalati, bollette mensili da registrare, periodiche attese ora, tua quota prevista), a destra "nella Pocket € Y" (lo stesso saldo di Home). Sotto: "Restano € Y − X per le prossime scadenze (Acqua, Metro, Prime)" (le voci con soldi accantonati, dalla parte più grande; se negativo, in arancione "Mancano € Z nella Pocket per questo mese") e "Dallo stipendio, a parte: € W" (pagamenti e abbonamenti da altri conti del mese). Il costo medio ("circa € X al mese") sta nella card "Quanto costano in un anno".
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

---

## Aggiunte M10 · Capire dove vanno i soldi

- **Home**: sotto "Puoi ancora spendere", riga **"Oggi puoi spendere € X"** (o "Oggi: € speso di € quota", "Oggi sei oltre di € X") e **"Questa settimana € Y · la scorsa € Z"** (R20). Se c'è, card chiara **"Il proposito di ‹mese›: «…»"** (R24). La riga Spese fisse dice "È ora di controllare gli abbonamenti" quando serve (R23).
- **Inserimento rapido** (Spesa): pulsante a interruttore **"D'impulso"** accanto alla nota (R22), anche in modifica.
- **Movimenti**: campo **Cerca** sotto l'intestazione. Con almeno 2 caratteri: risultati di tutti i periodi raggruppati per giorno, riepilogo "N movimenti · € T · in M mesi" al posto del riepilogo del periodo (R19). Il selettore del periodo si nasconde durante la ricerca.
- **Storico**: dopo "Dove sono andati", sezione **"Tutto lo stipendio"** (R18): barra divisa in Spese fisse · Pagamenti · Pocket · Buste · Risparmi con legenda e importi, riga "Risparmiato € X · Y% dello stipendio" (con l'obiettivo, R21), andamento della % di risparmio negli ultimi 6 mesi. Poi **"D'impulso"** (R22), **"Quando spendi"** (barre lun–dom, R20) e, se c'è, **proposito ed esito** del mese (R24). Il consiglio sul tetto ha **Alza** e **Tieni** (R25).
- **Chiusura del mese**: in cima, se il mese aveva un proposito, "Com'è andata?" con Fatto · A metà · No. Prima di Continua, il campo **"Una cosa da fare diversamente a ‹mese›?"** (R24). Il consiglio sul tetto ha **Alza** e **Tieni** (R25).
- **Inizia il mese**, passo Buste: in cima il campo **"Prima metti da parte"** (R21); la card scura diventa "Ti restano per le buste" al netto dell'obiettivo; avviso ambra se le buste erodono l'obiettivo.
- **Spese fisse**: card **"In un anno"** con totale, abbonamenti/bollette e gli abbonamenti dal più caro; avviso **"Li usi ancora tutti?"** ogni 6 mesi (R23).
- **Imposta**: riga **"Come funziona"** (gruppo Aiuto) → schermata `/come-funziona`: il modello in 5 righe e il glossario dei nomi (R7 · Nomi). In tutta l'app "voce fissa" sparisce: si dice **Pocket** (con quota) o **Pagamento** (affitto).

### Spese fisse e pagamenti (dicembre 2026)

- I **pagamenti** come l'affitto sono spese fisse: compaiono nella schermata **Spese fisse** (riga con il simbolo, "Pagamento · ogni mese · dallo stipendio", tocco → pannello per cambiare importo, sospendere, togliere) e si creano da **+ Aggiungi → Pagamento**. La card scura somma tutto ("Nella Pocket € X · pagamenti dallo stipendio € Y"); "Quanto costano in un anno" li comprende.
- **Imposta → Il mese** ha la riga **Spese fisse** ("N voci · circa € X al mese") che apre la schermata.
- **Inizia il mese, passo Spese**: un solo elenco (abbonamenti, bollette, pagamenti) in sola lettura, con totale "In tutto". In alto il pulsante **Modifica**: ogni voce diventa toccabile e apre il suo pannello (anche quelle con quota 0 questo mese e quelle sospese), più "Aggiungi una spesa fissa"; **Fine** torna all'elenco. Nessun campo importo sparso nella pagina. Le modifiche valgono da subito (anche per i mesi dopo).
- Al passo **Pocket** "Aggiungi una Pocket" crea solo Pocket.
- Storico, "Tutto lo stipendio": quattro parti (Spese fisse con l'affitto dentro, Pocket, Buste, Risparmi).
