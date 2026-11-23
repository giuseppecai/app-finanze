import { useCallback, useEffect, useState } from 'react';
import { it } from '../i18n/it';
import { IconCircleCheck } from './icons';

type Props = {
  text: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** millisecondi prima di sparire da solo */
  duration?: number;
};

/** Avviso in basso, viola notte, con "Annulla" (resta 6 secondi o fino alla prossima azione). */
export function Toast({ text, onUndo, onDismiss, duration = 6000 }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(t);
  }, [text, duration, onDismiss]);

  return (
    <div className="toast" role="status">
      <span className="toast__text"><IconCircleCheck className="toast__icon" />{text}</span>
      <button type="button" className="toast__action" onClick={onUndo}>{it.loans.undo}</button>
    </div>
  );
}

/*
 * Avviso dopo un salvataggio che chiude la schermata (Inserimento → schermata di prima).
 * La schermata che salva si chiude subito, quindi l'avviso vive in ToastHost (montato una volta
 * in App). Non è stato dell'app: è solo l'ultimo avviso, con l'azione per annullare.
 */
type Announcement = { id: number; text: string; undo: () => Promise<void> };
let listener: ((a: Announcement | null) => void) | null = null;
let counter = 0;

/** Mostra "Salvati € 12,40 in Vita · Annulla". Un avviso alla volta: il nuovo sostituisce il vecchio. */
export function announce(text: string, undo: () => Promise<void>): void {
  listener?.({ id: ++counter, text, undo });
}

export function ToastHost() {
  const [current, setCurrent] = useState<Announcement | null>(null);
  useEffect(() => {
    listener = setCurrent;
    return () => { listener = null; };
  }, []);
  const dismiss = useCallback(() => setCurrent(null), []);
  if (!current) return null;
  return (
    <Toast
      key={current.id}
      text={current.text}
      onDismiss={dismiss}
      onUndo={() => {
        const undo = current.undo;
        setCurrent(null);
        void undo().catch((e: unknown) => console.error(e));
      }}
    />
  );
}
