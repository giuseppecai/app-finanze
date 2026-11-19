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
| Casa & Servizi | impegnata | 120 | 63 | **57** |
| Rate & Abbonamenti | impegnata | 110 | 89,50 | **20,50** |

- **Puoi ancora spendere** = Σ residui delle buste *da spendere* + `daAssegnare` = 38 + 69 − 8 + 75 + 0 = **€ 174**. I residui negativi riducono il totale.
- **Impegnate · rimasti** = 57 + 20,50 = **€ 77,50**.
- Totale buste = **€ 251,50**.

Colore della barra (larghezza = speso / tetto, massimo 100%):
- residuo < 0 → arancione `--danger`, testo importo arancione, etichetta "oltre il tetto";
- residuo / tetto < 20% → ambra `--warning`;
- busta impegnata → grigio `--neutral-bar`;
- altrimenti → `--accent`.

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

L'utente ricopia tre saldi: Pocket **Budget del mese**, carta **Quotidiano**, carta **Extra**.

```
reale    = budgetDelMese + quotidiano + extra
atteso   = Σ residui di TUTTE le buste + daAssegnare + riservaCarte
diff     = reale − atteso
```

`riservaCarte` (in `Settings`) è la parte dei soldi sulle carte che non appartiene a nessuna busta (i ~100 € di "fondo" per carta). Si **calibra al primo confronto** dopo il primo "Inizio del mese": `riservaCarte = reale − (Σ residui + daAssegnare)`, con il messaggio "Primo confronto: ho registrato € X come riserva delle carte". Si può correggere in "Imposta".

Esiti:
- `diff == 0` → "Tutto in ordine", salva il confronto (data) → in Home "Ultimo confronto: 3 giorni fa".
- `diff < 0` → "Manca una spesa da € |diff|" → pulsante **Aggiungi la spesa** (apre l'inserimento con l'importo precompilato) oppure **Ignora per ora** (salva il confronto con esito `ignored`).
- `diff > 0` → "€ diff in più su Revolut" (interessi o rimborso) → **Registra come entrata** (crea `income`) oppure **È un rimborso** (apre l'inserimento in modalità Rimborso con l'importo).

Esempio: riservaCarte = 200,00; residui = 251,50; daAssegnare = 0 → atteso 451,50.
Saldi inseriti 339,10 + 62,00 + 38,00 = 439,10 → diff = **− 12,40** → "Manca una spesa da € 12,40".
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

Input: stipendio `S`. Quota Viaggi `V` (default dall'ultima usata, 50 €), Regali & Imprevisti `R = 25 €` (fissa, da Settings).

```
budgetDelMese = Σ tetti attuali delle buste
risparmi      = S − budgetDelMese − V − R
```
Checklist di 4 giroconti su Revolut (spuntabili, l'app non li esegue):
1. → Budget del mese: € budgetDelMese
2. → Viaggi: € V
3. → Regali & Imprevisti: € R
4. → Risparmi: € risparmi (se negativo, riga arancione "Lo stipendio non copre le buste: − € X")

Con tutte e 4 spuntate il pulsante diventa "Fatto: inizia il mese" → crea il `Period` con `startedAt = today()`, fotografa i tetti in `allocations`, applica i riporti dell'opzione B o il `daAssegnare` dell'opzione C, aggiorna i salvadanai (Viaggi + V, Regali + R, Risparmi + risparmi).

Esempio (stipendio di esempio): S = 1.500 → Budget 700, Viaggi 50, Regali 25, Risparmi **725**.

Con bollette periodiche (R13) si aggiunge un quinto giroconto "→ Bollette: € Σ quote mensili", sottratto da Risparmi (esempio: Bollette 25 → Risparmi **700**). Se c'è un giroconto di chiusura (R6), compare in testa alla checklist.

## R8 · Abbonamenti (ricorrenze)

`Recurring { name, amount, dayOfMonth, envelopeId (default Rate & Abbonamenti), card (default Extra), active }`.

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

## R13 · Bollette (Casa & Servizi)

Una bolletta è `Bill { name, frequency (mesi: 1, 2, 3, 6, 12), estimate (importo previsto della bolletta intera), split: 'half' | 'mine', payer: 'me' | 'roommate', personId (la coinquilina), fund }`.

- **Tua quota** di una bolletta di importo B: `mine` → B; `half` → `B − floor(B / 2)` (il centesimo dispari è tuo). Parte dell'altra persona = B − tua quota.
- **Bollette mensili** (frequenza 1): la tua quota si paga dalla busta **Casa & Servizi**, come una spesa. In Casa & Servizi la riga "Le bollette mensili valgono € X della busta" mostra la somma delle tue quote previste.
- **Bollette periodiche** (frequenza > 1): ogni mese si accantona `quota mensile = ceil(tua quota prevista / frequenza)` (al centesimo) nella Pocket **Bollette** di Revolut. Il salvadanaio `Bollette` dell'app ne è lo specchio; ogni bolletta ha il suo `fund` (quanto accantonato per lei). Non toccano le buste.
- **Inizio del mese (R7)**: si aggiunge il giroconto "→ Bollette: € Σ quote mensili" e `risparmi = S − budgetDelMese − V − R − bollette`. Alla conferma: Bollette + Σ quote, `fund` di ogni bolletta periodica + la sua quota.

**Registrare una bolletta** (importo reale B, data, chi l'ha pagata — default quello della bolletta):

| Caso | Tua quota (q) | Parte dell'altra persona (o) |
|---|---|---|
| Mensile, paghi tu | spesa `q` in Casa & Servizi | prestito `o` a lei (R9-bis): "Sposta € o da Risparmi alla carta" |
| Mensile, paga lei | spesa `q` in Casa & Servizi + debito `q` verso di lei: "Sposta € q da Budget del mese a Risparmi" | — |
| Periodica, paghi tu | spesa `q` dal fondo (nessuna busta): `fund − q`, Bollette − q, "Sposta € q da Bollette alla carta" | prestito `o` a lei, come sopra |
| Periodica, paga lei | spesa `q` dal fondo + debito `q`: `fund − q`, Bollette − q, Risparmi + q, "Sposta € q da Bollette a Risparmi" | — |

Le spese dal fondo sono movimenti `expense` senza busta (`envelopeId: null`, `billId` valorizzato): compaiono in Movimenti e nello "Speso", ma non cambiano i residui né "Puoi ancora spendere". Se dopo il pagamento `fund < 0`, la bolletta mostra in arancione "Mancano € X: si recuperano con le prossime quote". Se `fund > 0`, il resto resta accantonato per la volta dopo.

Esempio (coinquilina Elisa):

| Bolletta | Frequenza | Previsto | Divisione | Paga | Tua quota prevista | Quota mensile |
|---|---|---|---|---|---|---|
| Luce | 1 | € 80 | metà | tu | € 40 | — (busta Casa) |
| Internet | 1 | € 28 | metà | tu | € 14 | — (busta Casa) |
| Gas | 2 | € 60 | metà | Elisa | € 30 | **€ 15** |
| Acqua | 12 | € 120 | tua | tu | € 120 | **€ 10** |

- Bollette mensili nella busta Casa: 40 + 14 = **€ 54**. Giroconto mensile → Bollette: 15 + 10 = **€ 25**.
- Inizio del mese con S = 1.500, buste 700, Viaggi 50, Regali 25, Bollette 25 → Risparmi **€ 700**.
- Gas: dopo 2 mesi `fund` = 30. Arriva la bolletta da € 62, pagata da Elisa → tua quota **€ 31**, debito 31 verso Elisa, `fund` = **− 1** ("Mancano € 1"), Bollette − 31, Risparmi + 31.
- Acqua: dopo 12 mesi `fund` = 120. Bolletta da € 114 → `fund` = **€ 6**, resta per l'anno dopo.
- Luce da € 80,01 pagata da te → tua quota **€ 40,01** in Casa & Servizi, prestito **€ 40** a Elisa.

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

Per ogni periodo chiuso e busta: `messo = assegnato + riportato`, `speso = spese − rimborsi`, `avanzo = messo − speso`. Totale periodo confrontato con la somma dei tetti di quel periodo; barra arancione se speso > somma tetti. Il periodo corrente compare per ultimo, tratteggiato, con colonna "Resta" invece di "Avanzo".

Dati di esempio (spesa totale per periodo, tetti 700): Giu 652 · Lug **731** (sopra) · Ago 688 · Set 640 · Ott 604 · Nov (in corso) 448,50.

## R12 · Ordine e default nell'inserimento rapido

- Busta preselezionata = ultima usata.
- Buste ordinate per numero di movimenti negli ultimi 60 giorni (a parità: ordine definito in Imposta). Le impegnate in fondo.
- Data = oggi (modificabile con il pulsante calendario).
- Validazione: importo > 0, per il prestito serve una persona.
