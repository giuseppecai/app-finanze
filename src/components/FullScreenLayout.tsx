import { Outlet } from 'react-router-dom';
import { DemoBadge } from './DemoBadge';

/** Schermate a tutto schermo (inserimento, chiusura, inizio, prestiti, abbonamenti). Ognuna ha la sua TopBar. */
export function FullScreenLayout() {
  return (
    <main className="screen screen--full">
      <DemoBadge />
      <Outlet />
    </main>
  );
}
