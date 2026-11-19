import { TopBar } from './TopBar';

type Props = { title: string; subtitle: string };

/** Intestazione di Chiusura e Inizio: chiudi, titolo e intervallo del periodo. */
export function MonthHeader({ title, subtitle }: Props) {
  return (
    <>
      <TopBar />
      <header className="screen-header month-header">
        <h1 className="screen-title">{title}</h1>
        <p className="screen-subtitle">{subtitle}</p>
      </header>
    </>
  );
}
