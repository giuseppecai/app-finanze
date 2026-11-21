import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { it } from './i18n/it';
import { initDatabase, requestPersistentStorage, watchRecurringCharges } from './db/bootstrap';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/flows.css';
import './styles/sheet.css';
import './styles/recurring.css';
import './styles/loans.css';
import './styles/bills.css';
import './styles/history.css';
import './styles/settings.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento #root mancante in index.html');
const root = createRoot(rootElement);

async function start() {
  try {
    await initDatabase();
    watchRecurringCharges();
    void requestPersistentStorage();
    if (import.meta.env.DEV) {
      // Solo in sviluppo: accesso ai dati dalla console del browser per le verifiche.
      const [{ db }, { readAll }] = await Promise.all([import('./db/database'), import('./db/dataset')]);
      Object.assign(window, { finanze: { db, readAll: () => readAll(db) } });
    }
  } catch (error) {
    console.error(error);
    root.render(
      <main className="screen screen--full fatal">
        <h1 className="screen-title">{it.errors.dbTitle}</h1>
        <p className="screen-subtitle">{it.errors.dbText}</p>
        <button type="button" className="primary-button" onClick={() => location.reload()}>{it.errors.reload}</button>
      </main>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

void start();
