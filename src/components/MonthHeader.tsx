import { IconCalendar } from './icons';
import { PageHeader } from './PageHeader';
import { TopBar } from './TopBar';

type Props = { title: string; subtitle: string };

/** Intestazione di Chiusura e Inizio: chiudi, titolo e pillola con il periodo del mese. */
export function MonthHeader({ title, subtitle }: Props) {
  return (
    <>
      <TopBar />
      <PageHeader full title={title} chip={{ icon: <IconCalendar />, text: subtitle }} />
    </>
  );
}
