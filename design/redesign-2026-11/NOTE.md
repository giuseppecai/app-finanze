# Note per l'integrazione · Redesign App Finanze

Contenuto della cartella:

| Percorso | Cosa contiene |
|---|---|
| `css/tokens.css` | Tutte le variabili: colori (con il loro significato), font, scala tipografica, spaziature, raggi, ombre, durate |
| `css/app.css` | I componenti, in CSS semplice. Le classi `.is-pressed` / `.is-disabled` servono solo a mostrare gli stati nei mockup: nell'app bastano `:active` / `:disabled` |
| `fonts/Geist-Variable.woff2` | Font self-hosted (Geist, licenza SIL OFL), un solo file variabile da 100 a 900 |
| `schermate/*.html` | Mockup a 390 × 844 con i dati di prova. Le pagine che scorrono si possono vedere intere aprendo il file nel browser |
| `componenti.html` | Componenti con tutti gli stati |
| `index.html` | Galleria con tutte le schermate, con il pulsante "Pagina intera" |
| `png/` | Screenshot dei mockup: a 390 × 844 e, per le pagine che scorrono, interi (`-intera.png`) |

Icone: Lucide (`lucide-static` o `lucide-react`) con `stroke-width` 2 e `currentColor`. Nomi usati: `wallet, list, chart-column, settings, plus, x, calendar, delete, arrow-left-right, arrow-right, chevron-right, chevron-down, repeat, receipt, hand-coins, piggy-bank, credit-card, download, upload, info, lightbulb, triangle-alert, circle-check, trash-2, minus, pencil, search, arrow-down-left, arrow-up-right`, più un'icona per busta: `train-front` (Trasporti), `coffee` (Vita), `shopping-basket` (Spesa alimentare), `shopping-bag` (Shopping), `house` (Casa & Servizi), `repeat` (Rate & Abbonamenti).

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

## 4 · Accessibilità (controllata)

- Testo: tutto ≥ 4,5:1. `--text-muted` 6,6:1 sul bianco e 5,9:1 su `--bg`; `--state-over-text` 5,6:1; `--state-low-text` 6,4:1; `--accent` 7,4:1; il bianco su `--accent` 7,4:1.
- Barre: viola profondo sul binario 10,5:1, arancione 3,0:1, grigio delle impegnate 3,4:1. L’ambra (1,7:1) e il terzo lilla (1,9:1) sono sotto 3:1, ma non portano mai l'informazione da soli: c'è sempre la parola o l'importo accanto.
- Aree di tocco ≥ 44 pt ovunque. Le pillole filtro (40 pt di altezza) e il chip della data (32 pt) hanno l'area di tocco allargata con uno pseudo-elemento.
- Ruoli ARIA nei mockup: `radiogroup` per la scelta della busta e il controllo segmentato, `switch` per gli interruttori, `dialog` / `alertdialog` per i pannelli, `aria-current` sulla scheda attiva, `aria-pressed` sui filtri.

## 5 · Tema scuro

Non è incluso. I token sono già divisi per significato (superfici, testo, stati), quindi un tema scuro richiede solo un blocco `@media (prefers-color-scheme: dark)` che ridefinisce le variabili, senza toccare i componenti.
