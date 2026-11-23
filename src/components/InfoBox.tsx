import type { ReactNode } from 'react';
import { IconAlert, IconInfo, IconLightbulb } from './icons';

type Props = { tone?: 'info' | 'warning' | 'tip'; children: ReactNode };

/** Riquadro informativo; "warning" (arancione chiaro) solo per gli sforamenti. */
export function InfoBox({ tone = 'info', children }: Props) {
  return (
    <div className={`info-box info-box--${tone}`} role={tone === 'warning' ? 'note' : undefined}>
      {tone === 'warning' ? <IconAlert className="info-box__icon" /> : tone === 'tip' ? <IconLightbulb className="info-box__icon" /> : <IconInfo className="info-box__icon" />}
      <div className="info-box__body">{children}</div>
    </div>
  );
}
