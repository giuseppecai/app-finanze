import type { ReactNode } from 'react';

type Props = {
  /** riquadro a sinistra: in alto il numero grande (giorno) o il mese, sotto una riga piccola */
  boxTop: ReactNode;
  boxBottom?: string | null;
  title: string;
  detail: ReactNode;
  /** seconda riga di dettaglio (facoltativa) */
  detail2?: ReactNode;
  amount: ReactNode;
  chip?: ReactNode;
  /** in pausa: nome grigio, importo barrato */
  paused?: boolean;
  ariaLabel?: string;
  onClick: () => void;
};

/** Riga di Abbonamenti e Bollette: riquadro data, nome e dettaglio, importo e stato a destra. */
export function ScheduleRow({ boxTop, boxBottom, title, detail, detail2, amount, chip, paused, ariaLabel, onClick }: Props) {
  const textTop = typeof boxTop === 'string' && !/^\d+$/.test(boxTop);
  return (
    <button type="button" className="recurring-row" aria-label={ariaLabel} onClick={onClick}>
      <span className="date-box" aria-hidden="true">
        <span className={textTop ? 'date-box__day date-box__day--text' : 'date-box__day'}>{boxTop}</span>
        {boxBottom ? <span className="date-box__month">{boxBottom}</span> : null}
      </span>
      <span className="movement__text">
        <span className={paused ? 'movement__title is-muted' : 'movement__title'}>{title}</span>
        <span className="movement__detail">{detail}</span>
        {detail2 ? <span className="movement__detail">{detail2}</span> : null}
      </span>
      <span className="recurring-row__right">
        <span className={paused ? 'movement__amount is-paused' : 'movement__amount'}>{amount}</span>
        {chip}
      </span>
    </button>
  );
}
