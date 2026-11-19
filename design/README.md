# Mockup

Le 9 schermate disegnate sul canvas di design, come riferimento visivo e di struttura.

**Per vederle interattive** (tasti, filtri, pannelli funzionano in modalità Play):
https://claude.ai/artifact/Q2Lt5Lew2HrzLWQsUsLWAw

I file `.dc.html` in `mockups/` sono il sorgente di quelle schermate. **Non si aprono da soli nel browser**: usano un runtime del canvas (`support.js`) che qui non c'è. Leggili come riferimento di markup e stile:

- la struttura è HTML normale con stili inline (colori, dimensioni, spaziature sono quelli da usare);
- `{{nome}}` è un valore calcolato nello script in fondo al file (`renderVals()`), `<sc-for>` è una lista, `<sc-if>` una condizione;
- i dati negli script sono **dati di esempio**, non logica da copiare: la logica vera è in `docs/02-regole-e-calcoli.md`.

| File | Schermata |
|---|---|
| `Main.dc.html` | Home (con pannello Confronta) |
| `NuovaSpesa.dc.html` | Inserimento rapido (Spesa / Rimborso / Prestito) |
| `Movimenti.dc.html` | Movimenti |
| `Storico.dc.html` | Storico |
| `ChiusuraMese.dc.html` | Chiusura del mese |
| `InizioMese.dc.html` | Inizio del mese |
| `ModificaBuste.dc.html` | Imposta / Modifica buste |
| `Prestiti.dc.html` | Prestiti |
| `Abbonamenti.dc.html` | Abbonamenti |

Differenze note tra mockup e regole (vincono le regole):
- Il pannello Confronta del mockup non include la **riserva delle carte** (R5).
- In Imposta mancano la sezione **Dati** (riserva, saldi salvadanai, backup) e l'onboarding.
- La tab "Imposta" nei mockup apre direttamente Modifica buste: va bene così.
