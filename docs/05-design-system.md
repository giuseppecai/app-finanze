# 05 · Design system

Dal redesign di novembre 2026 (Claude Design) il riferimento è:
- **`src/styles/tokens.css`**: tutte le variabili, con accanto il significato di ogni colore;
- **`design/redesign-2026-11/`**: mockup HTML di tutte le schermate, `componenti.html` con gli stati e `NOTE.md` con le scelte e le interazioni.

Stile: **calmo, moderno, i numeri sono i protagonisti**. Niente gradienti, niente emoji.

## Il linguaggio dei colori

Il viola è la personalità dell'app, e ogni tonalità ha un compito:

| Token | Colore | Compito |
|---|---|---|
| `--accent` | `#6B3FA0` viola | azioni: ＋, pulsante primario, selezione, link, scheda attiva. Mai per un allarme |
| `--surface-ink` | `#241A33` viola notte | card principale, toast, filtro attivo, conferme distruttive |
| `--state-ok` | `#3B2363` viola profondo | barre delle buste in salute |
| `--save-*` | famiglia lilla | area Messi da parte |
| `--state-low` / `-text` | ambra | busta quasi finita (< 20%), "In media € X · sopra il tetto" |
| `--state-empty` | grigio | busta a zero: barra vuota, nome e importo spenti |
| `--state-over` / `-text` | arancione | **solo** sforato (residuo sotto zero): barra tutta arancione |
| `--committed` | grigio | barre delle impegnate |
| `--money-in` | verde | soldi in entrata (rimborsi, interessi, restituzioni), con il "+" |

- Le **barre mostrano quanto resta** e si svuotano spendendo (R3).
- Ogni stato è scritto anche a parole: il colore non porta mai l'informazione da solo.
- I consigli (Storico, Chiusura) sono riquadri **neutri con la lampadina**, non arancioni.
- Chip di stato: "fatto" verde tenue, "in arrivo / da fare" con contorno, "in pausa / a febbraio" grigio.
- Testo sempre ≥ 4,5:1.

## Tipografia

**Geist** (SIL OFL), un solo file variabile self-hosted (`src/styles/fonts/Geist-Variable.woff2`), `tabular-nums` ovunque. Scala in `tokens.css` (`--fs-hero` 44, `--fs-keypad` 56, `--fs-title` 28, `--fs-section` 19, `--fs-body` 16, `--fs-small` 13, `--fs-micro` 12).

Negli importi lo spazio dopo "€" e dopo il "−" è **non separabile** (`formatEuro`), e importi, chip e pillole non vanno mai a capo.

## Forme e misure

- Margini laterali 20 px, 28 px tra le aree della Home.
- Raggi: card principale 24, card 18, righe 14, tasti e pulsanti 16, pillole tonde, pannelli 28.
- Aree di tocco **≥ 44 pt** ovunque.
- Ombre solo su ＋, pannelli, toast e barra di salvataggio.
- Icone: **Lucide** (`lucide-react`) tramite `src/components/icons.tsx`, tratto 2, `currentColor`; un'icona per busta in Movimenti.

## Movimento

- Risposta al tocco entro 90 ms (`:active`: sfondo `--surface-press`, card `scale(.98)`, ＋ `scale(.92)`).
- Pannelli e schermate a tutto schermo salgono in 220 ms, le barre si accorciano in 250 ms.
- Tra le schede nessuna animazione.
- Con `prefers-reduced-motion` le durate vanno a 0.

## Regole d'uso

- Un solo modo per fare ogni cosa: le modifiche passano dalla scheda **Imposta** (anche nel Benvenuto si usano le stesse righe e lo stesso pannello).
- Dopo un salvataggio che chiude la schermata: toast "Salvati € 12,40 in Vita · Annulla" (6 secondi).
- Le conferme distruttive sono un pannello dal basso; il pulsante è viola notte e dice l'effetto ("Togli e sposta € 180 in Risparmi").
