# Note per l'integrazione · Redesign App Finanze

Contenuto della cartella:

| Percorso | Cosa contiene |
|---|---|
| `css/tokens.css` | Tutte le variabili: colori (con il loro significato), font, scala tipografica, spaziature, raggi, ombre, durate |
| `css/app.css` | I componenti, in CSS semplice. Le classi `.is-pressed` / `.is-disabled` servono solo a mostrare gli stati nei mockup: nell'app bastano `:active` / `:disabled` |
| `fonts/Geist-Variable.woff2` | Font self-hosted (Geist, licenza SIL OFL), un solo file variabile da 100 a 900 |
| `schermate/*.html` | Mockup a 390 × 844 con i dati di prova. Le pagine che scorrono si possono vedere intere aprendo il file nel browser |
| `componenti.html` | Componenti con tutti gli stati |
| `simboli.json` | Catalogo dei 57 simboli selezionabili, simboli predefiniti e parole chiave per il suggerimento automatico |
| `index.html` | Galleria con tutte le schermate, con il pulsante "Pagina intera" |
| `png/` | Screenshot dei mockup: a 390 × 844 e, per le pagine che scorrono, interi (`-intera.png`) |

Icone: Lucide (`lucide-static` o `lucide-react`) con `stroke-width` 2 e `currentColor`. Nomi usati: `wallet, list, chart-column, settings, plus, x, calendar, delete, arrow-left-right, arrow-right, chevron-right, chevron-down, repeat, receipt, hand-coins, piggy-bank, credit-card, download, upload, info, lightbulb, triangle-alert, circle-check, trash-2, minus, pencil, search, arrow-down-left, arrow-up-right`, più i simboli delle buste (sezione 6 e `simboli.json`).

---

## 1 · Il linguaggio dei colori (la modifica principale)

- **Il viola resta la personalità dell'app**, ma ogni tonalità ha un compito preciso:
  - `--accent` `#6B3FA0`: azioni (＋, pulsante primario, selezione, link, scheda attiva);
  - `--surface-ink` `#241A33` "viola notte": card principale, toast, filtro attivo;
  - `--state-ok` `#3B2363` "viola profondo": barre delle buste in salute;
  - famiglia lilla `--save-*`: area Messi da parte.
- **Le barre mostrano quanto RESTA** e si svuotano spendendo, come un serbatoio. Oggi la barra mostra lo speso mentre il numero mostra il residuo. Formula: `larghezza = max(0, residuo / tetto)`. Vale anche per le impegnate (Rate: 20,50 / 110) e per Bollette (saldo della Pocket / Σ quote previste).
- **Stati delle buste**:
  - **ambra** = quasi finita (sotto il 20% del tetto);
  - **grigio chiaro** = svuotata (a zero), con nome e importo spenti;
  - **arancione** = sforata (sotto zero): la barra diventa tutta arancione e l'importo è "− € 8 oltre il tetto".
  
  Ogni stato è scritto anche a parole. Il viola profondo delle barre in salute ha una luminosità molto diversa dall'arancione (3,4:1), quindi una busta sforata si stacca dalle altre anche in scala di grigi. Con il viola `#6B3FA0` di prima il rapporto era 1,3:1 e le due barre si confondevano.
- **Le tre aree della Home si distinguono**: card bianche con barre viola (da spendere), riquadro compatto con barre grigie sottili (impegnate), area lilla con barra divisa (messi da parte).
- **L'arancione non si usa più** per: "In media € 58: tetto basso" (ora in ambra), i consigli dello Storico e della Chiusura (ora neutri con icona lampadina), "Togli la busta" (ora pulsante silenzioso). Resta dove un valore è sotto zero, compreso "La Pocket va sotto di € 70" nel pannello bolletta.
- **I soldi in entrata** (rimborsi, interessi, restituzioni) sono in verde `--money-in`, con il "+".
- **Chip di stato**: "fatto" (scalato, in pari) verde tenue; "in arrivo / da fare" con contorno; "in pausa / a febbraio" grigio. L'ambra non si usa più per i promemoria.

## 1-bis · Niente a capo brutti

- Tra "€" e la cifra, in "− € 8" e in "di € 100" c'è sempre uno spazio non separabile (`&nbsp;`, `\u00a0`). Nella funzione di formattazione dell'app: `'€\u00a0' + importo`.
- Gli importi, i chip e le pillole hanno `white-space: nowrap`. Nelle righe, il nome a sinistra può accorciarsi con "…", mentre l'importo a destra non si comprime mai (`flex: none`).
- Sono stati accorciati i testi che andavano a capo a 375 pt:
  - in Movimenti il sottotitolo usa il nome breve della busta ("Rate · Extra · auto");
  - le Impegnate in Home non hanno più l'icona;
  - in Abbonamenti il sottotitolo è "Carta Extra · ogni mese" (il giorno è già nel riquadro della data);
  - nei prestiti la data va sotto il nome e "restano € 5" sotto l'importo.
  
  Ho controllato ogni testo, uno per uno, a 375, 390 e 430: vanno a capo solo le note e i paragrafi.

## 2 · Cambi di struttura (da verificare con le regole dell'app)

1. **Home, Impegnate**: sotto ogni riga c'è una riga di contesto nuova: "Prossimo: iCloud € 1 tra 5 giorni" per Rate & Abbonamenti, "2 da registrare questo mese" per Bollette. Sono dati che l'app ha già (abbonamenti e stato delle bollette). Se è troppo, si possono togliere senza cambiare il resto.
2. **Home, card principale**: la riga in basso dice "Confrontato con Revolut 3 giorni fa" con un pallino. Allo stipendio (R2) diventa "Stipendio arrivato? · Chiudi il mese →", come prima.
3. **Home, Messi da parte**: il totale si allinea al titolo della sezione. "Prestiti da riavere" resta l'ultima riga, con l'icona. Nessuna informazione spostata.
4. **Inserimento**: la data è ora un chip con la scritta ("Oggi" / "Ieri" / "18 nov") accanto alla riga di effetto, invece della sola icona in alto. Così una data diversa da oggi si vede. Quando non è oggi, il chip diventa scuro (classe `.date-chip.changed`, oppure `.effect` con sfondo viola notte).
5. **Inserimento**: la riga di effetto ha una mini barra che mostra il residuo *dopo* la spesa. Se si sfora diventa una pillola arancione: "Spesa: sfori di € 20,40" (vedi `componenti.html`).
6. **Movimenti**: i **prestiti non sembrano più spese**. L'avatar è tondo con l'iniziale della persona, il testo è "Prestato a Marco · non è una spesa", l'importo è grigio, senza "−", con una freccia. Il totale del giorno dice cosa conta: "spese − € 48,00" il 12 nov (il prestito di € 15 resta escluso, come oggi), "entrate + € 1,12", "nessuna spesa" il 27 ott. **Nessun cambio di regola**: cambia solo l'etichetta.
7. **Movimenti**: un solo riquadro per giorno con le intestazioni dei giorni fisse in alto (sticky). Al posto della lettera iniziale c'è l'icona della busta.
8. **Imposta**: le buste sono divise in due gruppi ("Buste da spendere · tetto al mese" e "Buste impegnate"). Le quote dell'Inizio del mese hanno "/mese" e il sottotitolo "Al salvadanaio". I saldi dei Salvadanai hanno l'icona salvadanaio e niente "/mese": così "Viaggi € 50/mese" e "Viaggi € 180" non si confondono più. Esporta e Importa backup hanno lo stesso aspetto.
9. **Imposta, barra "Salva le buste"**: invariata nella logica. La busta modificata mostra "era € 200" in viola finché non si salva.
10. **Benvenuto**: i tetti si cambiano con la stessa riga e lo stesso pannello di Imposta (niente stepper in linea), per rispettare "un solo modo per fare ogni cosa".
11. **Inizio del mese**: niente più frecce "→" davanti ai nomi. Il titolo è la destinazione, il sottotitolo spiega da dove arrivano i soldi. L'importo modificabile è un piccolo pulsante con la matita (area di tocco di tutta la riga, almeno 44 pt). Il pulsante disabilitato dice cosa manca: "Scrivi lo stipendio per iniziare".
12. **Confronta**: l'esito "manca una spesa" ha un'azione primaria, "Aggiungi la spesa di € 12,40", che apre `/nuovo?importo=1240`, e una secondaria, "Ricontrolla più tardi". Gli altri esiti di R5 seguono lo stesso schema: riquadro neutro con icona, azione primaria, azione silenziosa.
13. **Togli il salvadanaio**: nuovo pannello di conferma (`15-conferma-togli-salvadanaio.html`). Risparmi è già selezionato e c'è l'anteprima del nuovo saldo. Il pulsante di conferma è viola notte (non viola acceso, che è per le azioni normali) e dice l'effetto: "Togli e sposta € 180 in Risparmi".
14. **Simboli**: nuovo campo `icona` su buste e salvadanai, la riga busta ridisposta, e i nuovi pannelli "Scegli il simbolo" e "Nuova busta" (vedi sezione 5).
15. **Intestazioni**: tutte le schede hanno titolo grande e pillola (vedi 3-bis). In Movimenti il selettore del periodo è diventato una pillola sotto il titolo. In Imposta compare il totale "€ 700 al mese nelle buste" (lo stesso del Totale buste).
16. **Storico**: rifatto (vedi 3-ter). La tabella diventa la lista "Dove sono andati", e si aggiungono il confronto con il mese prima e la media dei 6 mesi.

## 2-ter · Revisione dopo la critica (questa versione)

17. **Un solo significato per le barre delle buste: quanto resta.** In Abbonamenti la barra della card ora mostra € 19,50 rimasti su € 110 (prima mostrava € 90,50 usati), con il testo "Restano € 19,50 nella busta". In Storico le barre di "Dove sono andati" misurano un'altra cosa (la quota sul totale speso), quindi hanno un aspetto diverso: 4 px, viola medio `--save-2`, senza binario grigio.
18. **Inserimento, griglia fissa a 6 caselle**: le 5 buste più usate (ordinate per uso negli ultimi 30 giorni, l'ultima usata già selezionata) più la casella **"Altre"**, con contorno, icona `layout-grid` e i nomi delle buste nascoste. "Altre" apre un pannello con l'elenco di tutte le buste, con simbolo e residuo. Scegliendo una busta lì, quella prende il posto della quinta nella griglia per questa spesa. Così il pulsante Salva resta sempre nello schermo, anche a 375 × 812 e con molte buste. **Cambio di struttura**: Rate & Abbonamenti non è più sempre visibile nella griglia (si usa poco a mano, perché si scala da sola).
19. **Prestiti, un solo modo per crearli**: ＋ → Prestito. In Prestiti non c'è più "+ Nuovo", e in fondo una nota spiega dove si crea. Restano le restituzioni ("Ti ha restituito").
20. **Consiglio sul tetto uguale ovunque**: in Storico e in Chiusura c'è la stessa card (simbolo, titolo, testo) con il pulsante "Porta il tetto a € 60". Il pulsante apre **lo stesso pannello del tetto di Imposta** (`13-pannello-tetto-busta`), con € 60 già scritto. Il modo di cambiare un tetto è quindi sempre uno: quel pannello, con conferma tramite "Salva le buste".
21. **Imposta più corta**: "Esporta backup" e "Importa backup" diventano una sola riga, "Backup e dati ›", che apre una schermata con le due azioni.
22. **Pulsanti in alto a destra**: "+ Aggiungi" ovunque (Bollette, Abbonamenti).
23. **Gerarchia della Home**: i titoli delle schede passano a 34 px (32 sotto la X) e "Puoi ancora spendere" a 52 px. Ora vince il numero.
24. **Card chiara** (`.hero.light`) in Bollette e Prestiti, dove c'è un solo saldo. La card scura resta per Home, Storico e Abbonamenti.
25. **Tre riquadri soli**: consiglio (`.insight`), nota (`.info`), avviso sotto zero (`.alert-over`).
26. **Centesimi**: si scrivono solo quando non sono zero ("€ 70", "€ 8,50"), tranne in Movimenti, dove gli importi stanno in colonna e restano tutti con i centesimi.
27. **Benvenuto**: la pillola "Benvenuto · passo 1 di 3" e una frase sola.
28. **Aree di tocco** allargate a 44 pt per le caselle di spunta e gli importi con la matita dell'Inizio del mese.

## 2-bis · Larghezze

Il layout è fluido: margini fissi di 20 px e contenuto che si allarga, verificato a 375, 390 e 430 pt. La tab bar, i pannelli, il toast e la barra di salvataggio occupano tutta la larghezza, fino a un massimo di 430 px. A 375 × 812 l'Inserimento sta tutto nello schermo, pulsante Salva compreso, senza scorrere.

## 3 · Interazioni

**Risposta al tocco (sempre, entro 90 ms).**
- Righe, card buste, tasti: lo sfondo passa a `--surface-press` mentre il dito è sopra. Le card si rimpiccioliscono leggermente (`scale(.98)`).
- Pulsante primario: `--accent-press` e `scale(.985)`. ＋: `scale(.92)`.
- Su iOS serve `-webkit-tap-highlight-color: transparent` (già impostato) e un `ontouchstart=""` sul `body`, perché `:active` funzioni.
- Tastierino: si può aggiungere una vibrazione leggera dove disponibile. Su iOS le web app non hanno la vibrazione, quindi il riscontro è solo visivo.

**Transizioni.**
- Pannello dal basso: sale in 220 ms (`--ease-out`) e il velo appare in 150 ms. Si chiude in 180 ms (`--ease-in`). Si chiude con la X, toccando il velo o trascinando la maniglia verso il basso di più di 80 px.
- Schermate a tutto schermo (Inserimento, Bollette, Abbonamenti, Prestiti, Inizio, Chiusura): salgono dal basso in 220 ms come un pannello alto quanto lo schermo. La X in alto a sinistra le richiude.
- Tra le schede in basso: nessuna animazione. Il cambio è istantaneo, così sembra più veloce.
- Le barre delle buste si accorciano in 250 ms dopo un salvataggio, così si vede l'effetto della spesa.
- Con `prefers-reduced-motion`: tutte le durate vanno a 0 (già nei token) e il cursore lampeggiante si ferma.

**Cosa si apre dove.**

| Tocco su | Apre |
|---|---|
| Riga busta "Da spendere" (Home) | Movimenti filtrati per quella busta |
| Rate & Abbonamenti (Home) | Abbonamenti, a tutto schermo |
| Bollette (Home) | Bollette, a tutto schermo |
| Prestiti da riavere (Home) | Prestiti, a tutto schermo |
| Confronta (card principale) | Pannello Confronta |
| Chiudi il mese → (allo stipendio) | Chiusura del mese, poi Inizio del mese |
| ＋ | Inserimento rapido: tastierino attivo subito, ultima busta usata già selezionata |
| Chip della data (Inserimento) | Pannello con "Oggi, Ieri, Altro giorno…" (quest'ultimo apre il calendario nativo) |
| Salva (Inserimento) | Chiude e torna alla schermata di prima, con il toast "Salvati € 12,40 in Vita · Annulla" |
| Riga movimento | Inserimento in modalità modifica, con "Elimina movimento" in fondo |
| Barra di un mese (Storico) | Seleziona il mese, e la tabella si aggiorna |
| Riga busta (Imposta) | Pannello del tetto. "Usa questo tetto" chiude il pannello e fa comparire la barra "Salva le buste" |
| Riga voce fissa / salvadanaio (Imposta) | Pannello per correggere importo o saldo (si salva subito) |
| Riga bolletta | Pannello Registra / Modifica |
| Riga abbonamento | Pannello con importo, giorno, carta, interruttore Attivo, Elimina, Salva |
| Card persona (Prestiti) | Si apre sul posto, una alla volta (freccia che ruota in 150 ms) |

**Toast.** Compare sopra la tab bar e resta 6 secondi o fino alla prossima azione. "Annulla" ripristina tutto. Un toast alla volta: il nuovo sostituisce il vecchio.

**Tastierino.** I numeri entrano da destra come al bancomat: 1 → € 0,01, 12 → € 0,12, 1240 → € 12,40. "00" aggiunge due zeri. ⌫ cancella l'ultima cifra, e tenuto premuto azzera. Con l'importo a 0 il pulsante Salva è disabilitato e dice "Scrivi un importo".

## 3-bis · Intestazione uniforme (tutte le schede)

Ogni schermata apre allo stesso modo: titolo grande (40 px, peso 720; 36 px sotto la X nelle schermate a tutto schermo) e, sotto, una **pillola lilla con icona** con l'informazione più utile, più un testo grigio facoltativo. Nel codice è un solo componente, `hdr(titolo, pillola, icona, testo grigio)`; le classi sono `.month`, `.month-meta`, `.pay-chip` e `.period-chip`.

| Schermata | Pillola | Accanto |
|---|---|---|
| Home | 📅 Stipendio tra 8 giorni | 27 ott – 26 nov |
| Movimenti | 🧾 Speso € 448,50 | pulsante periodo "27 ott – 26 nov ⌄" |
| Storico | 📅 Giorno 24 di 31 | 27 ott – 26 nov |
| Imposta | 👛 € 700 al mese nelle buste | 6 buste |
| Bollette | 🧾 2 da registrare | dalla Pocket Bollette |
| Abbonamenti | 📅 Prossimo: iCloud tra 5 giorni | — |
| Prestiti | 🐷 Rientrano in Risparmi | — |
| Inizio / Chiusura | 📅 periodo del mese | — |

Il testo "ogni mese va dal 27 al 26" è sparito: il periodo si legge già nelle date.

## 3-ter · Storico rifatto

Prende spunto da app come Copilot, Monarch e le statistiche di Revolut. Si passa da "una tabella con un grafico" a "racconto del mese".

1. **Scelta del mese**: un controllo segmentato con 6 mesi (Giu … Nov), con il mese scelto in viola notte. Tutto quello che c'è sotto si riferisce a quel mese. Anche toccare una colonna del grafico "Ultimi 6 mesi" sceglie il mese.
2. **Card "Speso a novembre"** (viola notte):
   - totale grande "€ 448,50 di € 700";
   - una pillola verde con il confronto "€ 71,50 meno di ottobre allo stesso giorno" (se è di più: pillola neutra con freccia in su, *mai arancione*, perché non è uno sforamento);
   - il **grafico della spesa cumulata**: linea a gradini di questo mese (lilla chiaro, con un velo sotto), il mese precedente tratteggiato in grigio, la linea del budget e un segmento verticale che unisce "oggi" al mese prima nello stesso giorno;
   - tre numeri sotto: Ottobre allo stesso giorno, Al giorno (speso ÷ giorni passati), Media 6 mesi (solo i mesi chiusi).
3. **Dove sono andati**: buste ordinate da chi ha speso di più. Ogni riga ha il simbolo, lo speso, una barra proporzionale alla busta più grande, "resta € 69 · messi € 200" e la percentuale sul totale. Una busta sforata ha l'importo arancione e "oltre di € 8". Rate & Abbonamenti ha la barra grigia. Una riga toccata apre Movimenti filtrato per quella busta e quel mese.
4. **Ultimi 6 mesi**: colonne arrotondate (24 px), linea del budget. Il valore si scrive solo sul mese scelto e sui mesi sopra il budget (colonna arancione). Il mese in corso è a righe. C'è una legenda.
5. **Consiglio**: "Spesa alimentare sfora spesso", con il tetto suggerito e il link a Imposta (un solo modo per modificare).

**Dati.** Tutto si calcola dai movimenti che l'app ha già, niente di nuovo da salvare:
- la curva è la somma delle spese giorno per giorno, dal giorno 1 del periodo (il 27) a oggi;
- "allo stesso giorno" confronta lo stesso numero di giorni dall'inizio del periodo;
- i prestiti e le entrate restano esclusi, come nel totale di Movimenti.

La curva di ottobre nei mockup è inventata; quella di novembre viene dai movimenti di prova.

**Interazione del grafico.** Trascinando il dito sulla curva compare una linea verticale con l'etichetta "13 nov · € 178,50 (ottobre € 160)". Si toglie lasciando il dito. Con `prefers-reduced-motion` non c'è animazione di entrata; senza, la curva si disegna in 400 ms solo alla prima apertura.

**Cambio di struttura da verificare.** La tabella Busta · Messo · Speso · Resta è sostituita da "Dove sono andati", che ha gli stessi quattro dati per ogni busta, ordinati per speso. Il totale "Resta € 251,50" non è più scritto nello Storico, perché in Home c'è già "Puoi ancora spendere".

**Colori dei grafici** (controllati con lo strumento di validazione delle palette):
- sul viola notte, novembre `#C9B5EA` e ottobre `#8C84A0` sono ben distinguibili (ΔE 18, anche per i daltonici), e in più ottobre è tratteggiato ed entrambe le linee hanno l'etichetta scritta;
- nelle colonne, quella scelta `#3B2363` e quella sopra il budget `#E0561F` sono molto distanti (ΔE 50);
- le colonne lilla chiaro di contesto hanno poco contrasto con il bianco, ma il valore è scritto sul mese scelto e la legenda accompagna sempre il grafico.

## 4 · Accessibilità (controllata)

- Testo: tutto ≥ 4,5:1. `--text-muted` 6,6:1 sul bianco e 5,9:1 su `--bg`; `--state-over-text` 5,6:1; `--state-low-text` 6,4:1; `--accent` 7,4:1; il bianco su `--accent` 7,4:1.
- Barre: viola profondo sul binario 10,5:1, arancione 3,0:1, grigio delle impegnate 3,4:1. L’ambra (1,7:1) e il terzo lilla (1,9:1) sono sotto 3:1, ma non portano mai l'informazione da soli: c'è sempre la parola o l'importo accanto.
- Aree di tocco ≥ 44 pt ovunque. Le pillole filtro (40 pt di altezza) e il chip della data (32 pt) hanno l'area di tocco allargata con uno pseudo-elemento.
- Ruoli ARIA nei mockup: `radiogroup` per la scelta della busta e il controllo segmentato, `switch` per gli interruttori, `dialog` / `alertdialog` per i pannelli, `aria-current` sulla scheda attiva, `aria-pressed` sui filtri.

## 5 · Simboli delle buste e dei salvadanai

**Dati.** Ogni busta e ogni salvadanaio ha un campo nuovo `icona` di tipo testo: il nome dell'icona Lucide, per esempio `"coffee"`. Nei dati salvati si scrive solo il nome, mai l'SVG. Se il nome non è nel catalogo, per esempio in un backup vecchio, si usa il `fallback` (`tag`). Per le buste di oggi la migrazione assegna i simboli predefiniti:

| Busta / salvadanaio | Simbolo |
|---|---|
| Trasporti | `train-front` |
| Vita | `coffee` |
| Spesa alimentare | `shopping-basket` |
| Shopping | `shopping-bag` |
| Casa & Servizi | `house` |
| Rate & Abbonamenti | `repeat` |
| Bollette | `receipt` |
| Risparmi | `piggy-bank` |
| Viaggi | `plane` |
| Regali & Imprevisti | `gift` |
| Riserva delle carte | `credit-card` |
| Affitto (voce fissa) | `key-round` |
| Prestiti | `hand-coins` |

**Come appare (tile).** Il simbolo è dentro un quadrato arrotondato. Il colore dice l'area, non lo stato:
- lilla = da spendere;
- grigio = impegnate;
- lilla pieno nei tre toni = messi da parte (la tile fa anche da legenda della barra divisa);
- neutro = carte e strumenti.

Gli stati (ambra, arancione, grigio chiaro) restano sull'importo e sulla barra. Una busta svuotata ha la tile più chiara. Misure: 28 pt nelle liste dense, 36 pt nelle righe, 56 pt nei pannelli. Classi `.tile`, `.tile-sm`, `.tile-l`, `.tile-committed`, `.tile-save-1/2/3`, `.tile-neutral`.

**Uniformità.** I colori d'area delle tile si usano **solo in Home**, dove servono a distinguere le tre aree e a fare da legenda alla barra di Messi da parte. In tutte le liste (Imposta, Movimenti, Storico, Benvenuto, Inserimento) la tile è sempre la stessa: lilla chiaro con l'icona viola. Lì l'area si capisce già dal gruppo in cui sta la riga.

**Dove compare:**
- Home: tutte e tre le aree;
- Inserimento: piccolo, accanto al nome nella griglia delle buste;
- Movimenti: al posto della lettera iniziale;
- Imposta: buste, voci fisse, salvadanai, backup;
- Benvenuto.

Non compare nello Storico, perché la tabella è stretta.

**Riga busta, nuova disposizione.** Tile a sinistra, nome e residuo sulla prima riga, barra e "di € tetto" sulla seconda. Così anche a 375 pt c'è spazio per il simbolo senza andare a capo. Gli stati si scrivono al posto di "di € X": "quasi finita · di € 200", "svuotata · di € 120", "oltre il tetto di € 50".

**Cambiare il simbolo (un solo modo, da Imposta).**
1. In Imposta tocchi la busta o il salvadanaio e si apre il suo pannello. In alto a sinistra c'è la tile grande con una matita.
2. Tocchi la tile e si apre il pannello **Scegli il simbolo** (`16-pannello-scegli-simbolo.html`). In alto c'è l'anteprima con il nome della busta e "prima era Caffè". Sotto, la griglia a 6 colonne divisa in gruppi: Casa, Cibo, Spostamenti, Tempo libero, Persone e cura, Soldi. Il pulsante "Usa questo simbolo" resta fisso in basso.
3. Toccando una cella l'anteprima si aggiorna subito. "Usa questo simbolo" torna al pannello della busta, e il simbolo si salva insieme al resto delle modifiche (per le buste con la barra "Salva le buste", per i salvadanai subito).

**Nuova busta con simbolo suggerito** (`17-pannello-nuova-busta.html`). Mentre scrivi il nome, l'app propone un simbolo con le `keywords` di `simboli.json`. Esempio: "Palestra" → `dumbbell`. Sotto compare "Suggerito dal nome. Toccalo per cambiarlo."
- Il suggerimento si aggiorna a ogni lettera, ma solo finché non scegli un simbolo a mano. Da quel momento la tua scelta vince.
- Se nessuna parola corrisponde resta `tag`.
- Nel selettore, il simbolo suggerito ha un bordo sottile (`.is-suggested`).

Algoritmo:
1. Togli gli accenti dal nome e scrivilo in minuscolo.
2. Dividilo in parole.
3. Per ogni simbolo, nell'ordine del catalogo, controlla se una parola del nome **inizia** con una delle sue `keywords`. Il primo che corrisponde vince.

**Accessibilità.**
- La tile è decorativa (`aria-hidden`): il nome della busta è sempre scritto accanto.
- Nel selettore ogni cella è un `radio` con `aria-label` in italiano (l'`etichetta` di `simboli.json`) ed è grande 50 pt.
- La tile modificabile ha l'etichetta "Simbolo: Caffè. Cambia simbolo".

**Non incluso (proposta per dopo).** Scegliere anche il colore della tile. L'ho lasciato fuori di proposito: il colore oggi dice l'area, e se diventasse libero le tre aree della Home tornerebbero a confondersi.

## 6 · Tema scuro e testo più grande

Non è incluso. I token sono già divisi per significato (superfici, testo, stati), quindi un tema scuro richiede solo un blocco `@media (prefers-color-scheme: dark)` che ridefinisce le variabili, senza toccare i componenti.

**Testo più grande di iOS.** Oggi le dimensioni sono in px, quindi l'app non segue l'impostazione "Testo più grande". Quando serve, si possono passare i token `--fs-*` in `rem` e impostare `html { font: -apple-system-body; }`: tutta la scala crescerà insieme.
