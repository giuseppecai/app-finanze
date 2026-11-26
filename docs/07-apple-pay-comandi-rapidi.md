# 07 · Apple Pay e Comandi Rapidi (milestone M9, sperimentale)

> **Non si fa** (novembre 2026): l’utente ha scelto di non collegare Apple Pay. Il documento resta come riferimento.

Obiettivo: dopo un pagamento con Apple Pay (carte Revolut nel Wallet), registrare la spesa con il minimo sforzo — idealmente solo scegliere la busta.

## Cosa offre iOS

- In **Comandi Rapidi → Automazione** esiste il trigger **Transazione** (Wallet): parte quando si paga con una carta scelta e fornisce **importo, esercente e nome della carta**. Si può impostare "Esegui immediatamente".
- Un'azione **Apri URL** da Comandi Rapidi apre di norma **Safari**, non la web app installata nella Home. Su iOS la web app installata ha uno **spazio dati separato** da Safari: un movimento salvato da Safari non si vedrebbe nell'app. ⚠️
- Da iOS 16.4 lo schema `webapp://` può aprire una web app installata da Comandi Rapidi, ma ci sono segnalazioni che **all'avvio a freddo il percorso e i parametri vengono ignorati** (si apre sempre la pagina iniziale). Quindi passare l'importo via URL non è affidabile.

**Prima di implementare qualunque opzione, verifica sul dispositivo dell'utente** (versione iOS attuale) come si comportano `webapp://` e i parametri, e riporta i risultati.

## Opzioni, dalla più semplice

### C · Solo scorciatoia (subito, zero rischio)
Tasto Azione dell'iPhone → comando che apre l'app (schermata Home dell'app). L'utente tocca ＋ e inserisce. Nessun codice speciale oltre a una rotta `/nuovo` come `start_url` alternativo, se funziona.

### A · Appunti (senza server)
1. L'automazione Transazione costruisce un testo JSON `{"importo":"4,80","esercente":"Bar Centrale","carta":"Revolut Quotidiano"}`, lo **copia negli appunti** e mostra una notifica "Apri Finanze per registrare".
2. All'apertura (o al ritorno in primo piano) l'app mostra in alto un pulsante **"Incolla pagamento Apple Pay"**; al tocco legge gli appunti con `navigator.clipboard.readText()` (iOS chiede ogni volta il permesso "Incolla"), valida il JSON e apre l'inserimento precompilato con l'etichetta "Da Apple Pay · Bar Centrale · Quotidiano".
- Pro: niente server. Contro: un tocco in più, appunti sovrascritti, un pagamento alla volta.

### B · Mini inbox (con un servizio minimo)
1. Un **Cloudflare Worker** con KV (piano gratuito) espone `POST /inbox` e `GET/DELETE /inbox`, protetti da un token segreto lungo.
2. L'automazione Transazione fa **"Ottieni contenuto dell'URL"** in POST con importo, esercente, carta, data.
3. All'apertura l'app scarica i pagamenti in attesa e mostra "**3 pagamenti da assegnare**": per ognuno si tocca solo la busta. Poi li cancella dal server.
- Pro: funziona anche senza aprire l'app, gestisce più pagamenti. Contro: un servizio da mantenere (minimo), token da custodire, i dati (solo importo/esercente) passano da un server.
- Il token va inserito una volta in Imposta e salvato in IndexedDB, mai nel codice.

## Raccomandazione

Parti da **C**, prova **A** sul dispositivo; passa a **B** solo se A risulta scomodo nell'uso reale. In ogni caso il codice dell'app tratta le sorgenti allo stesso modo: un "pagamento in arrivo" `{amount, merchant, card, date}` → inserimento precompilato con `source: 'inbox'`.

## Mappatura carta → campo `card`

Il nome carta arriva come lo mostra il Wallet. In Imposta l'utente associa ogni nome a `quotidiano` o `extra` alla prima occorrenza (l'app lo chiede e lo ricorda).
