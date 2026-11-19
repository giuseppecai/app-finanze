import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initDatabase, watchRecurringCharges } from './db/bootstrap';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/flows.css';
import './styles/sheet.css';
import './styles/recurring.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root mancante in index.html');
const root = createRoot(rootElement);

async function start() {
  try {
    await initDatabase();
    watchRecurringCharges();
    if (import.meta.env.DEV) {
      // Solo in sviluppo: accesso ai dati dalla console del browser per le verifiche.
      const [{ db }, { readAll }] = await Promise.all([import('./db/database'), import('./db/dataset')]);
      Object.assign(window, { finanze: { db, readAll: () => readAll(db) } });
    }
  } catch (error) {
    console.error(error);
    root.render(
      <p style={{ padding: 20 }}>
        Non riesco ad aprire i dati dell’app. Chiudi e riapri; se succede ancora, scrivilo a chi la sviluppa.
      </p>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
