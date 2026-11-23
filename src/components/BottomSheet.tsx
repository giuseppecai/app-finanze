import { useEffect, useRef, type ReactNode } from 'react';
import { it } from '../i18n/it';
import { IconClose } from './icons';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  /** elemento a sinistra del titolo (es. il simbolo modificabile della busta) */
  lead?: ReactNode;
  /** pannello alto quasi tutto lo schermo, con il contenuto che scorre (selettore dei simboli) */
  tall?: boolean;
  children: ReactNode;
};

/**
 * Pannello dal basso su `<dialog>` modale: il browser gestisce focus, tasto Esc e velo.
 * Tocco sul velo o sulla X → chiude. Mentre è aperto la pagina sotto non scorre.
 */
export function BottomSheet({ open, onClose, title, subtitle, lead, tall = false, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('sheet-open');
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => document.documentElement.classList.remove('sheet-open');
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={tall ? 'sheet sheet--tall' : 'sheet'}
      aria-labelledby="sheet-title"
      onClose={(e) => {
        // In React l'evento "close" di un pannello dentro un altro risale anche al pannello esterno:
        // chiude solo quello che si è chiuso davvero.
        if (e.target !== e.currentTarget) return;
        if (!document.querySelector('dialog.sheet[open]')) document.documentElement.classList.remove('sheet-open');
        onClose();
      }}
      onClick={(e) => {
        // Il clic sul velo arriva al <dialog> stesso, non al suo contenuto.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet__body">
        <div className={lead ? 'sheet__head sheet__head--lead' : 'sheet__head'}>
          {lead}
          <div className="sheet__titles">
            <h2 id="sheet-title" className="sheet__title">{title}</h2>
            {subtitle ? <p className="sheet__subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-button" aria-label={it.nav.close} onClick={onClose}>
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
