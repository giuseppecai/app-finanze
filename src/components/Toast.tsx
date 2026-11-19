import { useEffect } from 'react';
import { it } from '../i18n/it';

type Props = {
  text: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** millisecondi prima di sparire da solo */
  duration?: number;
};

/** Avviso in basso, scuro, con "Annulla" (resta 8 secondi o fino alla prossima azione). */
export function Toast({ text, onUndo, onDismiss, duration = 8000 }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(t);
  }, [text, duration, onDismiss]);

  return (
    <div className="toast" role="status">
      <span className="toast__text">{text}</span>
      <button type="button" className="toast__action" onClick={onUndo}>{it.loans.undo}</button>
    </div>
  );
}
