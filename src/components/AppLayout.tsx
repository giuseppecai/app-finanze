import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';

/** Schermate principali: contenuto + tab bar in basso. */
export function AppLayout() {
  return (
    <>
      <main className="screen screen--tabbed">
        <Outlet />
      </main>
      <TabBar />
    </>
  );
}
