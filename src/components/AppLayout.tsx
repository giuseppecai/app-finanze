import { Outlet } from 'react-router-dom';
import { DemoBadge } from './DemoBadge';
import { TabBar } from './TabBar';

/** Schermate principali: contenuto + tab bar in basso. */
export function AppLayout() {
  return (
    <>
      <main className="screen screen--tabbed">
        <DemoBadge />
        <Outlet />
      </main>
      <TabBar />
    </>
  );
}
