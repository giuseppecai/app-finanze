import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { it } from '../i18n/it';

type Props = {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** azione distruttiva: pulsante rosso */
  danger?: boolean;
  /** contenuto extra tra domanda e pulsanti (es. dove spostare i soldi) */
  children?: ReactNode;
};

/**
 * Conferma dentro un pannello dal basso (al posto di window.confirm): il contenuto del pannello
 * diventa la domanda con due pulsanti. Il focus va su "Annulla", la scelta sicura.
 */
export function ConfirmPanel({ message, confirmLabel, onConfirm, onCancel, danger = true, children }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return (
    <div className="confirm-panel" role="alertdialog" aria-describedby="confirm-message">
      <p id="confirm-message" className="confirm-panel__message">{message}</p>
      {children}
      <button type="button" className={danger ? 'primary-button primary-button--danger' : 'primary-button'} onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button ref={cancelRef} type="button" className="sheet-actions__button" onClick={onCancel}>{it.settings.cancel}</button>
    </div>
  );
}

type Ask = { message: string; confirmLabel: string; title: string; resolve: (ok: boolean) => void };

/**
 * Per le schermate intere: `const [ask, sheet] = useConfirmSheet()`, poi
 * `if (!(await ask({ title, message, confirmLabel }))) return;` e `{sheet}` nel JSX.
 */
export function useConfirmSheet(): [(q: Omit<Ask, 'resolve'>) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Ask | null>(null);
  const ask = useCallback((q: Omit<Ask, 'resolve'>) => new Promise<boolean>((resolve) => setPending({ ...q, resolve })), []);
  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const sheet = (
    <BottomSheet open={pending !== null} onClose={() => answer(false)} title={pending?.title ?? ''}>
      {pending ? <ConfirmPanel message={pending.message} confirmLabel={pending.confirmLabel} onConfirm={() => answer(true)} onCancel={() => answer(false)} /> : null}
    </BottomSheet>
  );
  return [ask, sheet];
}
