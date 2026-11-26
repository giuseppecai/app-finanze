# 02 · Regole e calcoli

Questo è il documento di riferimento per la logica. **Ogni esempio numerico deve diventare un test Vitest** in `src/domain/__tests__/`. Se un mockup contraddice queste regole, vincono le regole.

---

## R1 · Soldi e formattazione

- Tutti gli importi sono **interi in centesimi**. `1240` = € 12,40.
- `formatEuro(cents)`:
  - locale `it-IT`, simbolo davanti con spazio: `€ 12,40`, `€ 1.240`;
  - se i centesimi sono zero, niente decimali nelle liste (`€ 57`); con decimali se presenti (`€ 20,50`);
  - opzione `{ decimals: 'always' }` per tastierino, confronto e importi appena digitati (`€ 4,80`, `€ 12,00`);
  - negativi con il segno meno tipografico U+2212 e spazio: `− € 8`.
- Il tastierino lavora in centesimi: digitare `4`,`8`,`0` → `480` → `€ 4,80`. Tasto `00`, tasto cancella. Massimo 7 cifre.

## R2 · Periodi (mese da stipendio a stipendio)

Impostazione `periodStartDay` (default **27**, modificabile in "Imposta").

Per una data `d` il periodo "di calendario" è:
- se `giorno(d) >= startDay`: dal `startDay` del mese di `d` al `startDay − 1` del mese successivo;
- altrimenti: dal `startDay` del mese precedente al `startDay − 1` del mese di `d`.

Il periodo prende **il nome e l'id del mese in cui finisce**: id `YYYY-MM`, nome "Novembre".
Se `startDay` supera i giorni del mese, si usa l'ultimo giorno del mese.

Test:
| Data | Periodo | Intervallo |
|---|---|---|
| 2026-11-19 | `2026-11` Novembre | 27 ott 2026 – 26 nov 2026 |
| 2026-11-27 | `2026-12` Dicembre | 27 nov 2026 – 26 dic 2026 |
| 2026-12-27 | `2027-01` Gennaio | 27 dic 2026 – 26 gen 2027 |
| 2026-02-26 | `2026-02` Febbraio | 27 gen 2026 – 26 feb 2026 |

**Periodo reale**: un periodo inizia davvero quando l'utente completa "Inizio del mese" (salva `startedAt`), anche se è un giorno prima del 27. Il **periodo corrente** è l'ultimo iniziato e non chiuso. I movimenti appartengono al periodo corrente al momento dell'inserimento (campo `periodId` salvato sul movimento, non ricalcolato dalla data).

Se `today()` è oltre la fine di calendario del periodo corrente, oppure è il giorno `startDay − 1` o successivo, la Home mostra il link "Stipendio arrivato? Chiudi il mese →".

## R3 · Residuo di una busta

```
residuo(busta, periodo) = assegnato + riportato − Σ spese + Σ rimborsi
```
dove `assegnato` è il tetto fotografato all'inizio del periodo e `riportato` è l'avanzo portato dal mese prima (solo con l'opzione "Lascia nel Budget del mese", R6).

Esempio di riferimento (periodo Novembre, oggi 19 nov), da usare come fixture:

| Busta | Tipo | Tetto | Speso | Residuo |
|---|---|---|---|---|
| Trasporti | da spendere | 100 | 62 | **38** |
| Vita | da spendere | 200 | 131 | **69** |
| Spesa alimentare | da spendere | 50 | 58 | **− 8** |
| Shopping | da spendere | 120 | 45 | **75** |
| Casa & Servizi | da spendere | 120 | 63 | **57** |
| Rate & Abbonamenti | impegnata | 110 | 89,50 | **20,50** |

- **Puoi ancora spendere** = Σ residui delle buste *da spendere* + `daAssegnare` = 38 + 69 − 8 + 75 + 57 + 0 = **€ 231**. I residui negativi riducono il totale.
- **Rate & Abbonamenti rimasti** = **€ 20,50** (busta `committed`: in Home sta nell'elenco delle buste, ma non conta in "Puoi ancora spendere").

(Casa & Servizi è *da spendere* dalla v4: le bollette hanno la loro Pocket, la busta resta per detersivi e piccole spese di casa.)
- Totale buste = **€ 251,50**.

Barra (dal redesign di novembre 2026): **mostra quanto resta**, `larghezza = max(0, residuo / messo)`, e si svuota spendendo come un serbatoio (Trasporti 38 su 100 → 38%). Vale anche per le impegnate e per Bollette in Home. Colore:
- residuo < 0 → **barra tutta arancione** `--state-over`, testo importo arancione, etichetta "oltre il tetto";
- residuo esattamente 0 (con qualcosa messo) → barra vuota, nome e importo grigi: la busta è svuotata (vale anche per le impegnate);
- residuo / tetto < 20% → ambra `--warning`;
- busta impegnata → grigio `--committed`;
- altrimenti → viola profondo `--state-ok`.

## R4 · Tipi di movimento

| Tipo | Effetto sulle buste | Effetto sui salvadanai (app) | Note |
|---|---|---|---|
| `expense` (spesa) | − importo sulla busta | — | anche quelle generate dagli abbonamenti (`source: 'recurring'`) |
| `refund` (rimborso) | + importo sulla busta | — | reso, cashback, soldi restituiti da un negozio |
| `income` (entrata) | + importo su `daAssegnare` del periodo | — | tipicamente interessi trovati col Confronta |
| `loan` (prestito) | nessuno | Risparmi − importo | l'app ricorda di spostare l'importo da Risparmi alla carta |
| `loanRepayment` (restituzione) | nessuno | Risparmi + importo | l'app ricorda di rimettere l'importo in Risparmi |
| `debt` (debito, R9-bis) | nessuno | Risparmi + importo | soldi tuoi che spettano a un'altra persona |
| `debtRepayment` (paghi un debito) | nessuno | Risparmi − importo | l'app ricorda di spostare l'importo da Risparmi |

Le bollette (R13) generano questi stessi movimenti; la spesa di una bolletta periodica è un `expense` senza busta, pagato dal salvadanaio Bollette.

Le **ricariche delle carte** dal Budget del mese **non sono movimenti** e non si registrano.
I **buoni pasto** non si registrano.

## R5 · Confronta con Revolut

L'utente ricopia **tutti i saldi** di Revolut: Pocket **Budget del mese**, carta **Quotidiano**, carta **Extra** e **ogni Pocket di "Messi da parte"** (Risparmi, Viaggi, Regali & Imprevisti, Spese fisse, e qualsiasi altra). L'elenco delle Pocket è quello di Home: una Pocket aggiunta compare nel Confronta, una tolta sparisce. Sotto ogni Pocket c'è "nell'app € X" (il suo saldo nell'app), per vedere subito quale non torna.

```
reale    = budgetDelMese + quotidiano + extra + Σ Pocket ricopiate
atteso   = Σ residui di TUTTE le buste + daAssegnare + riservaCarte + Σ Pocket nell'app
diff     = reale − atteso
```
Si confronta il **totale**: così un abbonamento addebitato sulla carta Extra ma pagato nell'app dalla Pocket Spese fisse (R16) non crea differenze (la carta scende su Revolut, la Pocket scende nell'app).

`riservaCarte` (in `Settings`) è la parte dei soldi sulle carte che non appartiene a nessuna busta (i ~100 € di "fondo" per carta). Si **calibra al primo confronto** dopo il primo "Inizio del mese": `riservaCarte = reale − (Σ residui + daAssegnare + Σ Pocket nell'app)`, con il messaggio "Primo confronto: ho registrato € X come riserva delle carte". Si può correggere in "Imposta".

Esiti:
- `diff == 0` → "Tutto in ordine", salva il confronto (data) → in Home "Ultimo confronto: 3 giorni fa".
- `diff < 0` → "Manca una spesa da € |diff|" → pulsante **Aggiungi la spesa** (apre l'inserimento con l'importo precompilato) oppure **Ignora per ora** (salva il confronto con esito `ignored`).
- `diff > 0` → "€ diff in più su Revolut" (interessi o rimborso) → **Registra come entrata** (crea `income`) oppure **È un rimborso** (apre l'inserimento in modalità Rimborso con l'importo).

Esempio: riservaCarte = 200,00; residui = 251,50; daAssegnare = 0 → atteso 451,50.
Saldi inseriti 339,10 + 62,00 + 38,00 = 439,10 → diff = **− 12,40** → "Manca una spesa da € 12,40" (Pocket a parte, qui uguali su Revolut e nell'app).
Con le Pocket: Risparmi 1.240 + Viaggi 180 + Regali 75 + Spese fisse 134 = 1.629 nell'app; se su Revolut Viaggi è 170 → diff − 10, e sotto Viaggi si legge "nell'app € 180,00".
(Nel mockup la riserva non compare: nell'app va inclusa.)

## R6 · Chiusura del mese

Per ogni busta: `avanzo = residuo a fine periodo`. `netto = Σ avanzi + daAssegnare`.

Se `netto > 0`, tre opzioni:
- **A · Tutto in Risparmi** (default): istruzione "Giroconto Budget del mese → Risparmi: € netto". Salvadanaio Risparmi + netto. Il periodo nuovo parte senza riporti.
- **B · Lascia nel Budget del mese**: ogni busta riparte da *tetto nuovo + proprio avanzo* (riporti anche negativi). Nessun giroconto verso Risparmi.
- **C · Metà e metà**: `aRisparmi = floor(netto / 2)` (al centesimo) va in Risparmi; il resto diventa `daAssegnare` del periodo nuovo.

Se `netto <= 0`: niente scelta. Messaggio "Hai sforato di € |netto|: coprili da Risparmi" → istruzione "Giroconto Risparmi → Budget del mese: € |netto|"; Risparmi − |netto|.

Esempio Ottobre: avanzi Casa +22, Rate +0,50, Trasporti +14, Vita +31, Spesa alimentare −12, Shopping +40,50 → **netto € 96**.
A → Risparmi + 96. C → 48 in Risparmi, 48 da assegnare.

Chiudere il periodo salva `closedAt`, `leftoverChoice` e gli avanzi per busta (snapshot, servono allo Storico).

**Suggerimento tetto** (in Chiusura e in Storico): una busta *da spendere* che è andata sotto zero in **almeno 3 degli ultimi 5 periodi chiusi** genera "‹Busta› ha sforato in N mesi su M, in media di € X". Tetto suggerito = spesa media arrotondata **per eccesso ai 5 €**. Esempio Spesa alimentare: spese 56, 58, 54, 59, 62 → media 57,80 → sforo medio 7,80 ≈ "€ 8" → suggerito **€ 60**.

## R7 · Inizio del mese

Input: stipendio `S`. **Voci fisse** (`Settings.monthlyItems`, personalizzabili in Imposta): ognuna ha nome, importo proposto e tipo:
- **salvadanaio** (`pot`): i soldi vanno in una Pocket e compaiono in "Messi da parte" (Viaggi 50 €, Regali & Imprevisti 25 € di default);
- **uscita fissa** (`payment`): i soldi escono e non tornano in nessun salvadanaio (es. **Affitto**).

A inizio mese l'importo di ogni voce si può cambiare per quel mese (tocco sull'importo con la matita); l'importo usato diventa quello proposto il mese dopo. Le voci tolte (archiviate) non compaiono.

```
budgetDelMese = Σ tetti attuali delle buste
voci          = Σ importi delle voci fisse attive (salvadanai e uscite)
risparmi      = S − budgetDelMese − voci − bollette   // bollette = giroconto netto (R13)

totale inizio mese = budgetDelMese + voci + bollette     // mostrato in Imposta, sotto "Inizio del mese"
```
Checklist dei giroconti su Revolut (spuntabili, l'app non li esegue), in quest'ordine:
1. (se c'è) il giroconto di chiusura (R6);
2. → Budget del mese: € budgetDelMese;
3. una riga per voce fissa: "→ Viaggi: € V" per i salvadanai, "Paga Affitto: € A" per le uscite;
4. (se ci sono bollette attive e il giroconto è > 0) → Bollette: € Σ quote − quanto c'è già nella Pocket (R13);
5. → Risparmi: € risparmi (se negativo, riga arancione "Lo stipendio non copre le buste: − € X").

La schermata è un percorso a passi (Stipendio → Spese fisse → Pocket → Buste → Giroconti, vedi 04-schermate). Al passo Pocket l'utente ricopia il **saldo attuale** di ogni Pocket (prima dei giroconti): alla conferma i salvadanai prendono quei saldi e poi ricevono le quote; il giroconto → Spese fisse si calcola con il saldo ricopiato. Al passo Buste sceglie i tetti di questo mese (partono da quelli di Imposta e li sostituiscono): `restano per le buste = S − Spese fisse − voci`, `Risparmi = restano − Σ tetti`. Esempio: S 1.500, spese fisse 334,71, affitto 582, Viaggi 50, Regali 25 → **€ 508,29** per le buste.

Con tutto spuntato il pulsante diventa "Fatto: inizia il mese" → crea il `Period` con `startedAt = today()`, fotografa i tetti in `allocations` e gli importi delle voci in `quotas`, applica i riporti dell'opzione B o il `daAssegnare` dell'opzione C, aggiorna i salvadanai (ogni voce-salvadanaio + il suo importo, Bollette + quote, Risparmi + risparmi). Le uscite non toccano nessun salvadanaio.

Esempi (S = 1.500, buste 700):
- Viaggi 50, Regali 25 → Risparmi **725**.
- Più Affitto 400 (uscita) → Risparmi **325**; Viaggi + 50, Regali + 25, nessun salvadanaio per l'affitto.
- Viaggi cambiato a 80 solo per questo mese → Risparmi **695**; il mese dopo Viaggi propone 80.

## R8 · Abbonamenti (ricorrenze)

> **Da R16 (novembre 2026)** gli abbonamenti non si scalano più da una busta: si pagano dalla **Pocket Spese fisse** insieme alle bollette. Le regole qui sotto su date, generazione automatica e frequenze restano valide; quelle su busta, margine e "Avanzano € X" sono storiche (la demo ha ancora la busta Rate & Abbonamenti).

`Recurring { name, amount, dayOfMonth, frequency (1 · 2 · 3 · 6 · 12 mesi, default 1), anchorMonth, envelopeId (default Rate & Abbonamenti), card (default Extra), active }`.

- **Data dell'addebito nel periodo**: l'unica data nell'intervallo di calendario del periodo con quel giorno del mese (se il mese è più corto, l'ultimo giorno). Con startDay 27: i giorni 27–31 cadono nel primo mese del periodo, i giorni 1–26 nel secondo.
- **Generazione automatica**: all'avvio e quando cambia la data, per il periodo corrente, per ogni ricorrenza attiva con data addebito `<= today()` e senza movimento con la stessa coppia (`recurringId`, `periodId`) → crea una `expense` con `source: 'recurring'`. Deve essere **idempotente** (eseguirla due volte non duplica).
- In pausa (`active: false`) → non genera e non conta nel totale mensile.
- Modificare l'importo vale dai prossimi addebiti; eliminare una ricorrenza non cancella i movimenti già creati.

Esempio (oggi 19 nov, periodo Novembre):
| Voce | Giorno | Importo | Stato |
|---|---|---|---|
| Rata iPhone | 1 | 70,00 | scalato |
| Spotify | 5 | 8,50 | scalato |
| Disney+ | 12 | 6,00 | scalato |
| Prime | 15 | 5,00 | scalato |
| iCloud | 24 | 1,00 | tra 5 giorni |

Scalati 89,50 (= speso Rate & Abbonamenti in R3). Totale mensile attivi **90,50**; margine sulla busta 110 → "Avanzano € 19,50 al mese". Mettendo in pausa iCloud: totale 89,50, margine 20,50.

### Abbonamenti non mensili (bimestrali, trimestrali, semestrali, annuali)

- `frequency` = ogni quanti mesi; `anchorMonth` = mese di calendario (`YYYY-MM`) di un addebito, scelto come "Prossimo addebito". I mesi di addebito sono `anchorMonth + k·frequency` (k ≥ 0, solo in avanti: i mesi prima del "Prossimo addebito" sono addebiti già passati, che l'app non genera). Senza `anchorMonth` vale come mensile.
- **Data nel periodo**: la stessa regola di sopra, ma solo se il mese di calendario di quella data è un mese di addebito; altrimenti nel periodo non c'è addebito.
- Si scala dalla busta nel periodo in cui cade, oppure si accantona ogni mese nella Pocket Spese fisse: vedi **R15**. La generazione automatica e l'idempotenza non cambiano.
- **Totale mensile** (`monthlyTotal`) = solo i mensili attivi. In schermata la card scura mostra "Questo mese" = Σ addebiti attivi che cadono nel periodo e si scalano dalla busta (mensili + non mensili non accantonati) e il margine si calcola su quello; sotto, se ci sono abbonamenti accantonati, "+ € X/mese da parte".
- Fuori dal periodo: gruppo **Più avanti**, con la data del prossimo addebito e lo stato "tra N mesi" / "il mese prossimo".

Esempio (startDay 27, oggi 19 nov 2026, abbonamenti della demo più):
| Voce | Frequenza | Giorno | Prossimo | Importo |
|---|---|---|---|---|
| Dominio | ogni anno | 14 | marzo 2027 | 12,00 |
| Palestra | ogni 2 mesi | 27 | ottobre 2026 | 30,00 |

- Periodo Novembre (27 ott – 26 nov): Palestra il 27 ott (scalata), Dominio no → "Più avanti · 14 mar". Questo mese **120,50** → sfori la busta 110 di **10,50**. Media non mensili 1 + 15 = **16**.
- Periodo Dicembre (27 nov – 26 dic): Palestra no (novembre non è mese di addebito), prossimo 27 dic. Periodo Gennaio: Palestra il 27 dic.
- Periodo Marzo 2027 (27 feb – 26 mar): Dominio il 14 mar, una volta sola.

## R9 · Prestiti (FIFO)

- Un prestito ha persona, data, motivo, importo e `remaining` (all'inizio = importo).
- **Totale per persona** = Σ `remaining` dei suoi prestiti aperti. **Totale generale** = somma sulle persone.
- **Restituzione** di `X` da una persona (massimo = quanto deve; il pulsante "Tutto" mette quel massimo): si scorrono i suoi prestiti aperti **dal più vecchio** (data, poi `createdAt`); ogni prestito coperto interamente si chiude (`remaining 0`, `closedAt`), l'ultimo coperto in parte riduce il `remaining`.
- I prestiti chiusi **spariscono dalla lista** e finiscono nello storico. Una persona con totale 0 sparisce dall'elenco "Chi ti deve".
- L'ultima restituzione si può **annullare** (ripristina i `remaining` e i `closedAt` precedenti): salva le allocazioni (`[{loanId, amount}]`) sulla restituzione.

Esempio Mamma: 23 ott € 10 "Monete Homescapes", 26 ott € 10, 27 ott € 20 → deve **€ 40**.
Restituisce 25 → chiusi i primi due, il terzo resta **€ 15**; Mamma deve 15. Annulla → torna a 40.
Con anche Marco € 15 → totale generale 55; dopo la restituzione di 25 → 30.

### R9-bis · Debiti e saldo unico per persona

I prestiti vanno nei due sensi: `direction: 'lent'` (prestito: **ti deve**) o `'borrowed'` (debito: **devi tu**). Tutto quello che si deve con una persona passa da **Risparmi**: i prestiti escono da lì e i soldi restituiti rientrano lì; un debito porta in Risparmi i soldi che appartengono all'altra persona finché non la paghi.

- **Saldo con una persona** = Σ `remaining` dei prestiti aperti − Σ `remaining` dei debiti aperti. Positivo → "Elisa ti deve € X"; negativo → "Devi € X a Elisa"; zero → la persona sparisce da "Chi ti deve".
- **Compensazione automatica**: quando nasce un prestito o un debito verso una persona che ha voci aperte nel senso opposto, l'app li compensa subito, dal più vecchio (stesso ordine FIFO di R9): così per ogni persona resta aperto **un solo senso**. La compensazione non sposta soldi e non tocca i salvadanai; le allocazioni (`[{loanId, amount}]`) si salvano sulla voce nuova, così eliminarla ripristina tutto.
- **Regolare i conti**: se la persona ti deve, "Ti ha dato € X" chiude i prestiti FIFO (come R9) → Risparmi + X. Se devi tu, "Le hai dato € X" chiude i debiti FIFO → Risparmi − X. Massimo = saldo; l'ultima operazione si può annullare.
- **Totale "da riavere"** in Home = Σ saldi positivi; se c'è anche qualcosa da dare, sotto compare "Devi € Y".

Esempio Elisa (coinquilina), novembre:
1. 1 nov luce, la anticipi tu, metà di Elisa € 40 → prestito 40. Saldo **+40**.
2. 3 nov internet, metà € 14 → prestito 14. Saldo **+54**.
3. 10 nov gas, lo anticipa Elisa, tua metà € 30 → debito 30, compensato subito sul prestito più vecchio: luce resta **€ 10**, il debito si chiude. Saldo **+24** (internet 14 + luce 10).
4. Elisa ti dà € 24 → chiusi luce e internet, saldo **0**, Risparmi + 24.
Annullando il punto 4 il saldo torna +24; eliminando il gas (punto 3) la luce torna a 40 e il saldo a +54.

## R13 · Bollette (Pocket Spese fisse)

Una bolletta è `Bill { name, frequency (mesi: 1, 2, 3, 6, 12), estimate (importo previsto della bolletta intera), split: 'half' | 'mine', payer: 'me' | 'roommate', personId (la coinquilina), fund }`.

Le bollette **non passano dalle buste**: tutte, mensili comprese, sono soldi da mettere da parte. La busta Casa & Servizi resta per le altre spese di casa (detersivi, piccole cose).

- **Tua quota** di una bolletta di importo B: `mine` → B; `half` → `B − floor(B / 2)` (il centesimo dispari è tuo). Parte dell'altra persona = B − tua quota.
- **Quota mensile** di ogni bolletta: `ceil(tua quota prevista / frequenza)` (al centesimo). Per le mensili è tutta la tua quota prevista. Ogni mese si accantona nella Pocket **Bollette** di Revolut; il salvadanaio `Bollette` dell'app ne è lo specchio: in Home compare tra i **Messi da parte** (è una Pocket, non una busta): saldo della Pocket, con un tocco si aprono le bollette. Ogni bolletta ha il suo `fund` (quanto accantonato per lei).
- **Inizio del mese (R7)**: giroconto "→ Bollette" **al netto di quello che c'è già nella Pocket**. Per le bollette mensili la quota è `max(0, tua quota prevista − fund)` (se un mese una bolletta costa meno, l'avanzo resta nel fondo e il mese dopo se ne mette meno). Poi:
  ```
  quota    = Σ quote delle bollette attive
  credito  = max(0, saldo Pocket Spese fisse − Σ fund di tutte le bollette)   // soldi in Pocket che non sono di nessuna bolletta
  giroconto = max(0, quota − credito)
  ```
  Esempio: servono 180, nella Pocket ce ne sono 80 e nessun fondo → giroconto **€ 100**. I fondi delle periodiche (acqua, gas) restano nella Pocket ad accumularsi e non riducono il giroconto. Alla conferma: Bollette + giroconto, `fund` di ogni bolletta + la sua quota intera.
- **Prossima bolletta** (`nextDue`, solo periodiche, facoltativa): il periodo `'YYYY-MM'` in cui arriva la prossima. Se c'è, la quota non è più fissa ma serve ad arrivarci pronti:
  ```
  giroconti che restano = max(1, mesi da prossimo "Inizio del mese" a nextDue + 1)
  quota = ceil(max(0, tua quota prevista − fund) / giroconti che restano)
  ```
  Registrando la bolletta, `nextDue` = periodo del pagamento + frequenza (si torna alla quota normale); eliminando la registrazione torna indietro di un ciclo. Se la data è passata senza registrarla, tutto quello che manca va al prossimo giroconto. Senza data vale la quota fissa qui sopra.
  Esempio acqua € 300 tutta tua, `fund` 0, oggi novembre (prossimo giroconto = periodo Dicembre), arriva a febbraio: giroconti dicembre, gennaio, febbraio (il periodo Febbraio inizia il 27 gennaio) → **€ 100 al mese**. Dopo il pagamento la prossima è febbraio dell'anno dopo: 300 / 12 → **€ 25 al mese**. Divisa a metà: 150 / 3 → **€ 50**.

**Registrare una bolletta** (importo reale B, data, chi l'ha pagata — default quello della bolletta). La tua quota è sempre una spesa senza busta pagata dal fondo:

| Caso | Tua quota (q) | Parte dell'altra persona (o) |
|---|---|---|
| Paghi tu | spesa `q` dal fondo: `fund − q`, Bollette − q, "Sposta € q da Bollette alla carta" | prestito `o` a lei (R9-bis): "Sposta € o da Risparmi alla carta" |
| Paga lei | spesa `q` dal fondo + debito `q` verso di lei: `fund − q`, Bollette − q, Risparmi + q, "Sposta € q da Bollette a Risparmi" | — |

Le spese dal fondo sono movimenti `expense` senza busta (`envelopeId: null`, `billId` valorizzato): compaiono in Movimenti e nello "Speso", ma non cambiano i residui né "Puoi ancora spendere". Se dopo il pagamento `fund < 0`, la bolletta mostra in arancione "Mancano € X: si recuperano con le prossime quote". Se `fund > 0`, il resto resta accantonato per la volta dopo.

Esempio (coinquilina Elisa):

| Bolletta | Frequenza | Previsto | Divisione | Paga | Tua quota prevista | Quota mensile |
|---|---|---|---|---|---|---|
| Luce | 1 | € 80 | metà | tu | € 40 | — (busta Casa) |
| Internet | 1 | € 28 | metà | tu | € 14 | — (busta Casa) |
| Gas | 2 | € 60 | metà | Elisa | € 30 | **€ 15** |
| Acqua | 12 | € 120 | tua | tu | € 120 | **€ 10** |

- Quote mensili: luce 40, internet 14, gas 15, acqua 10 → giroconto mensile → Bollette **€ 79**.
- Inizio del mese con S = 1.500, buste 700, Viaggi 50, Regali 25, Bollette 79 → Risparmi **€ 646**. Abbassando Casa & Servizi a 66 (le bollette mensili non passano più da lì) → buste 646, Risparmi **€ 700**.
- Gas: dopo 2 mesi `fund` = 30. Arriva la bolletta da € 62, pagata da Elisa → tua quota **€ 31**, debito 31 verso Elisa, `fund` = **− 1** ("Mancano € 1"), Bollette − 31, Risparmi + 31.
- Acqua: dopo 12 mesi `fund` = 120. Bolletta da € 114 → `fund` = **€ 6**, resta per l'anno dopo.
- Luce da € 80,01 pagata da te con `fund` 40 → tua quota **€ 40,01** dal fondo (`fund` − 0,01: "Mancano € 0,01"), prestito **€ 40** a Elisa.
- Internet da € 28 pagata da Elisa → spesa 14 dal fondo, debito 14, "Sposta € 14 da Bollette a Risparmi".

## R15 · Accantonare o pagare tutto nel mese (bollette periodiche e abbonamenti non mensili)

Ogni bolletta periodica e ogni abbonamento non mensile ha l'interruttore **Accantona ogni mese**. Accenderlo apre un piccolo popup (*"Iniziamo ad accantonare per Prime Video?"*) con:
- **Inizio ad accantonare**: un mese dal prossimo "Inizio del mese" fino alla scadenza (`saveFrom`);
- **Già messo da parte**: soldi già pronti per quella voce (diventano il suo `fund`; l'app li conta nella Pocket Spese fisse, che sale di quanto il fondo aumenta);
- anteprima: **"€ Q al mese per N mesi, da ‹inizio› a ‹scadenza›"**;
- **Sì, iniziamo ad accantonare** (solo allora l'interruttore si accende) oppure **No, pago tutto a ‹mese›**.

Tutti i soldi accantonati stanno nella **Pocket Spese fisse** (bollette e abbonamenti insieme, un solo giroconto, R16).

```
giroconti che restano = max(1, mesi da "Inizio del mese" a scadenza + 1)
accantona:      quota = ceil(max(0, target − fund) / giroconti che restano)   (0 prima di saveFrom)
non accantona:  quota = 0, tranne nel periodo della scadenza (o dopo, se in ritardo): max(0, target − fund)
```
`target` = tua quota prevista (bollette) o importo (abbonamenti). La quota si ricalcola a ogni "Inizio del mese", così l'arrotondamento per eccesso si riassorbe e alla scadenza il fondo è esatto.

**Abbonamenti** (scadenza = periodo del primo addebito dal prossimo "Inizio del mese"):
- *accantonato* (dal periodo `saveFrom` in poi): la quota va nel giroconto → Bollette e nel `fund`; l'addebito del giorno è una spesa **senza busta** pagata dal fondo (`fund − importo`, Bollette − importo), come le bollette. Dopo l'addebito si riparte per il ciclo dopo (importo ÷ frequenza).
- *non accantonato*: nessuna quota fino al periodo dell'addebito; in quel periodo tutto l'importo (meno il fondo) entra nel giroconto → Spese fisse e l'addebito si paga dalla Pocket (R16).

**Bollette periodiche**: *accantonata* è il comportamento di R13 (default). *Non accantonata*: nessuna quota fino al mese in cui arriva, poi tutta la tua quota nel giroconto → Bollette di quel mese; serve sapere quando arriva.

Esempio: **Prime Video € 49,99 l'anno, addebito il 23 marzo** (startDay 27 → periodo Marzo).
- Scenario 1, accantono da settembre: giroconti set, ott, nov, dic, gen, feb, mar = **7** → popup "€ 7,15 al mese per 7 mesi". Quote mese per mese: 7,15 · 7,14 · 7,14 · 7,14 · 7,14 · 7,14 · 7,14 → fondo **49,99** al 23 marzo, pagato dalla Pocket Spese fisse (la busta non si muove). Da aprile: 49,99 / 12 → € 4,17 al mese. Con € 20 già da parte: 29,99 / 7 → € 4,29.
- Scenario 2, pago tutto alla scadenza: nessuna quota fino a febbraio; all'Inizio di marzo il giroconto → Spese fisse ha **€ 49,99** in più e il 23 marzo si paga dalla Pocket.
- Acqua € 120 tutta tua, arriva a febbraio, oggi novembre: accantonata → 40 al mese (dic, gen, feb); da gennaio → 0 a dicembre, poi 60; non accantonata → 0, 0, **120** nel giroconto di febbraio.

## R16 · Spese fisse (bollette e abbonamenti insieme)

Bollette e abbonamenti sono **un solo elenco**, "Spese fisse", con un tag:
- **Abbonamento** (anche rate): importo fisso, **si scala da solo** il giorno dell'addebito (R8);
- **Bolletta**: importo che cambia, **la registri tu** quando arriva, anche divisa con la coinquilina (R13).

Tutti si pagano dalla **Pocket Spese fisse** (l'ex Pocket Bollette, `pots.bills`). Nessuna spesa fissa passa da una busta: gli addebiti automatici sono `expense` **senza busta** (`envelopeId: null`) che tolgono l'importo dal `fund` dell'abbonamento e dalla Pocket.

**Inizio del mese**: un solo giroconto → Spese fisse = (Σ quote delle bollette + Σ quote degli abbonamenti) − credito della Pocket (soldi che non sono di nessuna voce, R13). Quota di un abbonamento:
- mensile: l'importo − il suo fondo (se un mese è avanzato qualcosa, se ne mette meno);
- non mensile: R15 (accantonato: quello che manca ÷ giroconti rimasti; non accantonato: tutto nel mese della scadenza).

Esempio (oggi novembre, prossimo giroconto dicembre): Spotify 8,50 + Disney+ 6 + Prime Video 49,90 annuale il 22 novembre 2027, accantonato con € 12 già da parte (37,90 / 12 = 3,16) + Luce 40 + Gas 15 → giroconto **€ 72,66**.

Con R16 la busta degli abbonamenti non serve più: all'aggiornamento (schema v6) la Pocket "Bollette" diventa "Spese fisse" e, se non c'è un mese aperto, la busta impegnata usata dagli abbonamenti si archivia (o si cancella se mai usata). A mese aperto resta e si toglie da Imposta.

## R14 · Promemoria backup

I dati vivono solo sul telefono. In Home compare "Fai il backup" se:
- l'ultimo backup esportato ha **più di 30 giorni**; oppure
- non è mai stato fatto un backup e il primo periodo è iniziato da **almeno 7 giorni**.

"Più tardi" lo nasconde per 7 giorni (`backupSnoozedUntil`); esportare un backup lo azzera.
Esempi (oggi 20 dic): ultimo backup 20 nov → no (30 giorni); 19 nov → sì (31). Mai fatto, primo periodo 14 dic → no; 13 dic → sì.

## R10 · Spesa media (Modifica buste)

Media della spesa netta (spese − rimborsi) della busta negli **ultimi 6 periodi chiusi** (meno se non ce ne sono), arrotondata all'euro. Testo "Spendi in media € X"; se X > tetto attuale → arancione "Spendi in media € X · più del tetto". Senza periodi chiusi la riga non compare.

Esempio: Spesa alimentare 56, 58, 54, 59, 62 → **€ 58** → più del tetto 50. Portando il tetto a 60 la riga torna grigia.

## R11 · Storico

Dal redesign v2 (novembre 2026) lo Storico è il "racconto del mese": scelta del mese (ultimi 6), card "Speso a novembre" con la **spesa cumulata giorno per giorno** (spese − rimborsi delle buste; prestiti, entrate e bollette pagate dalla Pocket esclusi), il mese prima tratteggiato quando ci sono i suoi movimenti, e tre numeri: il mese prima allo stesso giorno, speso al giorno (speso ÷ giorni passati) e media dei periodi chiusi (fino a 6). Esempio Novembre al 19 nov: giorno 24 di 31, € 448,50 → **€ 18,69 al giorno**. "Dove sono andati" elenca le buste dalla più spesa con resta, messi e quota sul totale (Vita € 131 = 29%). Sotto, gli ultimi 6 mesi a colonne. La tabella che segue resta la definizione dei numeri.

Per ogni periodo chiuso e busta: `messo = assegnato + riportato`, `speso = spese − rimborsi`, `avanzo = messo − speso`. Totale periodo confrontato con la somma dei tetti di quel periodo; barra arancione se speso > somma tetti. Il periodo corrente compare per ultimo, tratteggiato, con colonna "Resta" invece di "Avanzo".

Dati di esempio (spesa totale per periodo, tetti 700): Giu 652 · Lug **731** (sopra) · Ago 688 · Set 640 · Ott 604 · Nov (in corso) 448,50.

## R12 · Ordine e default nell'inserimento rapido

- Busta preselezionata = ultima usata.
- Griglia fissa di **6 caselle** (redesign v2): le prime 5 buste di quest'ordine più **"Altre"**, che apre l'elenco di tutte le buste. Con 5 buste o meno si vedono tutte. Una busta scelta da "Altre" (o l'ultima usata) che non è tra le prime 5 prende il posto della quinta. Nella demo "Altre" contiene Rate & Abbonamenti, che si scala da sola.
- Buste ordinate per numero di movimenti negli ultimi 60 giorni (a parità: ordine definito in Imposta). Le impegnate in fondo.
- Data = oggi (modificabile con il pulsante calendario).
- Validazione: importo > 0, per il prestito serve una persona.
