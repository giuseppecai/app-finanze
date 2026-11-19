# 05 · Design system

Stile: **calmo, essenziale, un solo colore d'accento**. L'accento è **viola** (`#6B3FA0`): i mockup usano ancora il verde `#0E6B5C`, vincono i token qui sotto. Niente gradienti, niente emoji, niente bordi colorati laterali. I numeri sono i protagonisti. Riferimento visivo: i mockup in `design/mockups/`.

## Colori (`src/styles/tokens.css`)

```css
:root {
  --bg:            #F4F3EF;  /* sfondo app */
  --surface:       #FFFFFF;  /* card, righe */
  --surface-dark:  #1A1A18;  /* card principale (hero), toast */
  --surface-sunk:  #E9E7E1;  /* segmented control, riquadri informativi */
  --surface-muted: #EFEDE8;  /* separatori pieni, avatar neutri */

  --text:          #1A1A18;
  --text-muted:    #5F5E58;  /* ≥ 4.5:1 su --bg e --surface */
  --text-on-dark:  #FFFFFF;
  --text-on-dark-muted: #D4D2CB;
  --link-on-dark:  #CDB8EC;

  --line:          #E4E2DC;  /* bordi di input e pulsanti secondari */
  --line-soft:     #EFEDE8;  /* separatori tra righe */
  --track:         #ECEAE4;  /* binario delle barre */

  --accent:        #6B3FA0;  /* azione principale, stato ok */
  --accent-strong: #522C80;  /* hover/pressed, testo su accent-soft */
  --accent-soft:   #ECE4F6;  /* selezione, esito ok */
  --accent-2:      #A98BD0;  /* seconda tonalità (salvadanai) */
  --accent-3:      #D9CCEB;  /* terza tonalità (salvadanai), barre non selezionate */

  --danger:        #B4410E;  /* sforamento: testo e barre */
  --danger-strong: #6B2707;  /* testo su danger-soft */
  --danger-soft:   #FBE7DC;  /* riquadri di avviso */
  --danger-light:  #F2C2A8;  /* barre sopra budget non selezionate */

  --warning:       #A86A00;  /* busta quasi finita, prestito parziale */
  --warning-soft:  #FDF0D5;  /* chip "tra N giorni" */
  --warning-text:  #7A4D00;

  --neutral-bar:   #8E8C85;  /* barre delle buste impegnate, linee tratteggiate */
}
```

Regole:
- L'arancione (`--danger`) significa **solo** "sforato". Non usarlo per altro.
- Gli stati che devono distinguersi differiscono anche in luminosità, non solo in tinta.
- Testo sempre ≥ 4.5:1 (anche le etichette a 11–12 px).

## Tipografia

- **Inter** (400, 500, 600) per tutto il testo.
- **Space Grotesk** (500, 600) per gli importi grandi e i titoli di schermata.
- `font-variant-numeric: tabular-nums` su tutto il contenitore dell'app.
- Font self-hosted (file `woff2` nel progetto), non da Google Fonts a runtime: l'app deve funzionare offline.

| Uso | Font | Dimensione / peso |
|---|---|---|
| Importo hero (Home) | Space Grotesk | 40 / 600, letter-spacing −0.02em |
| Importo tastierino | Space Grotesk | 56 / 600 |
| Titolo schermata | Space Grotesk | 22–24 / 600 |
| Importi in card | Space Grotesk | 18–20 / 600 |
| Testo riga | Inter | 15 / 500 |
| Importo riga | Inter | 15 / 600 |
| Etichette, sottotitoli | Inter | 12–13 / 400–500, `--text-muted` |
| Tab bar | Inter | 11 / 500 (attiva 600) |

## Spaziature e forme

- Margini laterali schermata: **20 px**. Spazio tra sezioni: 12–14 px. Tra righe-card: 6 px.
- Raggi: card principali 20 px, card 14–16 px, righe/pulsanti 12 px, pillole 22 px (altezza/2).
- Aree di tocco **≥ 44 px** ovunque (stepper, chip, filtri, link di riga).
- Ombre solo su: pulsante ＋ della tab bar, bottom sheet, toast.

## Componenti

| Componente | Descrizione |
|---|---|
| `EnvelopeRow` | card bianca, nome + residuo + "di € tetto", barra 6 px su `--track`; colore barra secondo R3 |
| `HeroCard` | sfondo `--surface-dark`, etichetta, importo grande, azione a pillola a destra, riga di stato |
| `SegmentedControl` | contenitore `--surface-sunk`, opzione attiva bianca con ombra leggera, `role="radiogroup"` |
| `Keypad` | griglia 3×4 di pulsanti bianchi, raggio 12 |
| `EnvelopePicker` | griglia 3 colonne; selezionata: `--accent-soft` + bordo 2 px `--accent` |
| `FilterChips` | pillole scorrevoli orizzontali, attiva nera `--surface-dark` con testo bianco |
| `Stepper` | − valore + con pulsanti 44×44 |
| `BottomSheet` | velo `rgba(26,26,24,.45)`, foglio bianco raggio 24 in alto, chiusura con X 44 px |
| `Toast` | in basso, scuro, testo + azione "Annulla" in `--link-on-dark` |
| `StatusChip` | pillola 11 px: ok (`--accent-soft`), in arrivo (`--warning-soft`), pausa (`--surface-muted`) |
| `Switch` | 52×32, attivo `--accent` |
| `InfoBox` | `--surface-sunk`, testo 12–13 px; avviso: `--danger-soft` + icona |
| `TabBar` | 5 colonne, ＋ centrale 60 px rialzato di 26 px |

Icone: SVG inline a tratto (stroke 1.8–2.2, `currentColor`), stile Feather/Lucide. Puoi usare `lucide-react` se preferisci, oppure le icone copiate dai mockup.

## Movimento

Minimo: apertura/chiusura bottom sheet (200 ms), rotazione freccia nelle card espandibili (150 ms). Rispetta `prefers-reduced-motion`.
