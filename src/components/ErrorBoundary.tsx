import { Component, type ErrorInfo, type ReactNode } from 'react';
import { it } from '../i18n/it';

type State = { failed: boolean };

/** Se una schermata va in errore mostra un messaggio con "Ricarica" invece di una pagina bianca. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen screen--full fatal">
        <h1 className="screen-title">{it.errors.title}</h1>
        <p className="screen-subtitle">{it.errors.text}</p>
        <button type="button" className="primary-button" onClick={() => location.reload()}>{it.errors.reload}</button>
      </main>
    );
  }
}
