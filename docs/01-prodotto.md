# 01 · Il prodotto

## Il problema

Giuseppe usa **Revolut**. Prima teneva una Pocket per ogni categoria di spesa e, dopo ogni pagamento, spostava soldi a mano tra Pocket e carte per riportarle a 100 €. Risultato: decine di giroconti al mese, fatti "a occhio", e nessun resoconto di quanto aveva messo, speso e avanzato per ogni categoria.

## L'idea in una frase

**Revolut tiene i soldi, l'app tiene le categorie.** Le buste esistono solo nell'app; su Revolut i soldi si muovono una volta al mese, quando arriva lo stipendio.

## Come è organizzato Revolut (fuori dall'app, l'app lo assume)

| Su Revolut | Cosa contiene | Chi lo gestisce |
|---|---|---|
| Pocket **Budget del mese** (conto risparmio, rende interessi) | I soldi di tutte le buste del mese | L'app dice quanto metterci |
| Pocket **Risparmi** | Soldi da non toccare; da qui escono e rientrano i prestiti | L'app dice quanto metterci |
| Pocket **Viaggi** | Messo da parte per i viaggi, senza obiettivo | Quota scelta ogni mese |
| Pocket **Regali & Imprevisti** | 25 € fissi al mese | Quota fissa |
| Pocket **Spese fisse** | Le quote di **tutte** le bollette e di tutti gli abbonamenti (luce, internet, gas, acqua, Spotify, rata…): si pagano da qui | L'app dice quanto metterci (R13, R16) |
| Altre Pocket a scelta | Ogni Pocket può avere una quota mensile | Quota scelta ogni mese |
| Carta **Quotidiano** | ~100 € per le spese di tutti i giorni | Ricaricata da Budget del mese quando scende |
| Carta **Extra & Pagamenti** | ~100 €, ci sono collegati abbonamenti e rata iPhone | Ricaricata da Budget del mese quando scende |

L'utente **non vuole tenere tutta la liquidità sulle carte** (preferisce gli interessi del conto risparmio): per questo le carte restano a ~100 € e si ricaricano dal Budget del mese. **Le ricariche non vanno registrate nell'app**: spostano soldi tra Budget del mese e carte, il totale non cambia.

## Il mese va da stipendio a stipendio

Lo stipendio arriva il **27**. Un periodo va dal 27 al 26 del mese dopo e prende il nome del mese in cui finisce: "Novembre" = 27 ottobre – 26 novembre. Il nuovo periodo inizia **quando l'utente registra lo stipendio** (può arrivare un giorno prima se il 27 cade nel weekend).

## Le buste (valori iniziali)

| Busta | Tipo | Tetto mensile |
|---|---|---|
| Trasporti | da spendere | € 100 |
| Vita (uscite) | da spendere | € 200 |
| Spesa alimentare | da spendere | € 50 |
| Shopping | da spendere | € 120 |
| Casa & Servizi | da spendere | € 120 (spese di casa: detersivi, piccole cose; le bollette hanno la loro Pocket) |

Totale € 590 → è quanto va nel **Budget del mese** a inizio periodo.

- **Da spendere**: quelle su cui l'utente decide. Solo queste contano in "Puoi ancora spendere".
- Due soli concetti in Home: **Buste** (soldi del Budget del mese, con un tetto, che si consumano) e **Pocket** (soldi messi da parte su Revolut: Risparmi, Spese fisse, Viaggi, Regali…). Abbonamenti e rate non hanno più una busta: si pagano dalla Pocket Spese fisse (R16). I nomi sono nel glossario di `02-regole-e-calcoli.md` § Nomi.

I **buoni pasto** non passano da Revolut e **non si registrano**: la busta Spesa alimentare copre solo la parte che i buoni non coprono.

## Il ritmo d'uso (deve restare leggero)

| Quando | Cosa | Tempo |
|---|---|---|
| A ogni pagamento | Registra importo + busta (2 tap) | 5 secondi |
| Una volta a settimana | **Confronta** con Revolut: ricopia 3 saldi, l'app dice se torna | 30 secondi |
| Al 27 | **Chiudi il mese** (cosa fare con l'avanzo) e **inizia il nuovo** (checklist dei giroconti) | 2 minuti |

## Le funzioni, in breve

1. **Home**: quanto puoi ancora spendere, stato di ogni busta, salvadanai, prestiti da riavere, pulsante Confronta.
2. **Inserimento rapido**: Spesa / Rimborso / Prestito, tastierino, scelta busta (o persona), salva.
3. **Movimenti**: lista per giorno, filtro per busta, tocco per modificare.
4. **Storico**: grafico degli ultimi 6 periodi + tabella Messo/Speso/Avanzo per busta + segnalazione delle buste che sforano sempre.
5. **Chiusura del mese**: avanzi per busta e scelta di cosa farne.
6. **Inizio del mese**: inserisci lo stipendio → a passi: spese fisse, Pocket, prima i risparmi, buste, poi la checklist dei giroconti su Revolut (Budget del mese, Pocket come Viaggi e Regali, pagamenti come l'affitto, Spese fisse, Risparmi).
7. **Imposta**: tetti delle buste con −/+, spesa media, conti e Pocket, giorno di inizio mese, backup, Come funziona.
8. **Prestiti**: chi ti deve quanto, restituzioni con chiusura FIFO.
9. **Spese fisse**: bollette e abbonamenti in un solo elenco, quanto costano in un anno, controllo ogni 6 mesi.
10. **Capire dove vanno i soldi** (M10): tutto lo stipendio e % di risparmio nello Storico, ricerca nei movimenti, quanto puoi spendere oggi, spese d'impulso, un proposito al mese.

## Cosa l'app NON fa (di proposito)

- Non si collega a Revolut (non c'è un'API pubblica per conti personali; i servizi open banking gratuiti hanno chiuso le iscrizioni). Il controllo si fa con il **Confronta** manuale.
- Niente login, niente cloud, niente multi-utente nel MVP.
- Niente categorizzazione automatica, niente budget annuali, niente investimenti.
- Niente collegamento con Apple Pay o Comandi Rapidi (scelta dell’utente, novembre 2026): ogni spesa si registra a mano.
