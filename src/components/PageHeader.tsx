import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** pillola lilla con l'informazione più utile della schermata (icona + testo) */
  chip?: { icon: ReactNode; text: string } | null;
  /** testo grigio accanto alla pillola (es. "27 ott – 26 nov") */
  muted?: ReactNode;
  /** elemento in fondo alla riga della pillola (es. il selettore del periodo in Movimenti) */
  extra?: ReactNode;
  /** schermata a tutto schermo (sotto la X): titolo un po' più piccolo */
  full?: boolean;
};

/** Intestazione uniforme di tutte le schede: titolo grande e, sotto, pillola + testo grigio. */
export function PageHeader({ title, chip, muted, extra, full = false }: Props) {
  return (
    <header className={full ? 'hdr hdr--full' : 'hdr'}>
      <h1 className="month">{title}</h1>
      {chip || muted || extra ? (
        <div className="month-meta">
          {chip ? <span className="pay-chip">{chip.icon}{chip.text}</span> : null}
          {muted ? <span className="month-meta__muted">{muted}</span> : null}
          {extra}
        </div>
      ) : null}
    </header>
  );
}
