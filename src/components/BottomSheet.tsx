import { useEffect, useRef, type ReactNode } from 'react';
import { it } from '../i18n/it';
import { IconClose } from './icons';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
};

/**
 * Pannello dal basso su `<dialog>` modale: il browser gestisce focus, tasto Esc e velo.
 * Tocco sul velo o sulla X → chiude. Mentre è aperto la pagina sotto non scorre.
 */
export function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
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
      className="sheet"
      aria-labelledby="sheet-title"
      onClose={() => {
        document.documentElement.classList.remove('sheet-open');
        onClose();
      }}
      onClick={(e) => {
        // Il clic sul velo arriva al <dialog> stesso, non al suo contenuto.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet__body">
        <div className="sheet__head">
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
