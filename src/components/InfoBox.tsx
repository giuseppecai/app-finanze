import type { ReactNode } from 'react';
import { IconAlert } from './icons';

type Props = { tone?: 'info' | 'warning'; children: ReactNode };

/** Riquadro informativo; "warning" (arancione chiaro) solo per gli sforamenti. */
export function InfoBox({ tone = 'info', children }: Props) {
  return (
    <div className={`info-box info-box--${tone}`} role={tone === 'warning' ? 'note' : undefined}>
      {tone === 'warning' ? <IconAlert className="info-box__icon" /> : null}
      <div className="info-box__body">{children}</div>
    </div>
  );
}
