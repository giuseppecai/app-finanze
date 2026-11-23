import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../app/routes';
import { it } from '../i18n/it';
import { IconClose } from './icons';

/** Chiude una schermata a tutto schermo: indietro, o alla Home se è stata aperta direttamente. */
export function useCloseScreen(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key === 'default') navigate(routes.home, { replace: true });
    else navigate(-1);
  };
}

type Props = { center?: ReactNode; right?: ReactNode };

/** Barra in alto delle schermate a tutto schermo: chiudi a sinistra, contenuto al centro e a destra. */
export function TopBar({ center, right }: Props) {
  const close = useCloseScreen();
  return (
    <div className="topbar">
      <button type="button" className="icon-button" onClick={close} aria-label={it.nav.close}>
        <IconClose />
      </button>
      <div className="topbar__center">{center}</div>
      {right ? <div className="topbar__right">{right}</div> : null}
    </div>
  );
}
