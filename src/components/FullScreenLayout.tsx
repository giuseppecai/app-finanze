import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../app/routes';
import { it } from '../i18n/it';
import { IconClose } from './icons';

/** Schermate a tutto schermo (inserimento, chiusura, inizio, prestiti, abbonamenti). */
export function FullScreenLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const close = () => {
    // Aperta direttamente (nessuna cronologia nell'app): torna alla Home.
    if (location.key === 'default') navigate(routes.home, { replace: true });
    else navigate(-1);
  };

  return (
    <main className="screen screen--full">
      <div className="topbar">
        <button type="button" className="icon-button" onClick={close} aria-label={it.nav.close}>
          <IconClose />
        </button>
      </div>
      <Outlet />
    </main>
  );
}
