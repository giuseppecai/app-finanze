# App Finanze — pacchetto per Claude Code

Tutto il materiale per far costruire l'app a Claude Code.

## Cosa c'è

| File | A cosa serve |
|---|---|
| `PROMPT.md` | Il primo messaggio da incollare in Claude Code |
| `CLAUDE.md` | Istruzioni permanenti per Claude Code: stack, architettura, convenzioni (lo legge da solo a ogni sessione) |
| `docs/01-prodotto.md` | Cos'è l'app, il modello Revolut, il ritmo d'uso |
| `docs/02-regole-e-calcoli.md` | Tutte le regole di calcolo con esempi numerici (diventano i test) |
| `docs/03-modello-dati.md` | Entità, schema del database, dati iniziali, backup |
| `docs/04-schermate.md` | Le 9 schermate + navigazione + onboarding |
| `docs/05-design-system.md` | Colori, font, spaziature, componenti |
| `docs/06-piano-lavoro.md` | Milestone M0–M9 con criteri di accettazione |
| `docs/07-apple-pay-comandi-rapidi.md` | Integrazione con Apple Pay: limiti di iOS e opzioni |
| `design/mockups/` | Le 9 schermate del canvas, come riferimento visivo |

## Come si usa

1. Crea una cartella vuota `app-finanze` sul computer ed estraici dentro questo pacchetto (così `CLAUDE.md` è nella cartella principale).
2. Apri il terminale in quella cartella e avvia Claude Code (`claude`).
3. Incolla il testo di `PROMPT.md`.
4. Rispondi alle sue domande, poi procedi una milestone alla volta.

Ti servono: Node.js 20 o più recente, un account GitHub (per pubblicare su GitHub Pages) e l'iPhone per le prove.

## Da verificare tu, prima o durante M3

- I **giorni di addebito** degli abbonamenti (nei documenti sono di esempio: iPhone 1, Spotify 5, Disney+ 12, Prime 15, iCloud 24) e se c'è anche Netflix.
- Lo **stipendio di esempio** (1.500 €) è solo per i test: l'app te lo chiede ogni mese.
- I saldi attuali di Risparmi, Viaggi e Regali & Imprevisti (li inserisci nell'onboarding).

## Sviluppo

```
npm install
npm run dev        # http://localhost:5173/app-finanze/
npm run test
npm run build
npm run preview    # prova la build (con service worker) su http://localhost:4173/app-finanze/
```

Ogni push su `main` esegue test e build e pubblica su GitHub Pages (`.github/workflows/deploy.yml`):
https://giuseppecai.github.io/app-finanze/

Le icone PNG si rigenerano con `node scripts/make-icons.mjs`.
