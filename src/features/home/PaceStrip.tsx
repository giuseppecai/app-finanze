import { useTransactionsSince } from '../../app/data';
import { addDays } from '../../domain/dates';
import type { EnvelopeBalance } from '../../domain/envelopes';
import { mondayOf, spentBetween, todayAllowance, weekSpending } from '../../domain/insights';
import { formatEuro } from '../../domain/money';
import type { Period, Transaction } from '../../domain/types';
import { it } from '../../i18n/it';

type Props = {
  period: Period;
  /** movimenti del periodo corrente */
  txs: Transaction[];
  balances: EnvelopeBalance[];
  spendable: number;
  today: string;
};

/**
 * R20 · Il ritmo, sotto la card principale: quanto puoi spendere oggi (la quota non cambia spendendo
 * durante il giorno) e la spesa di questa settimana confrontata con la scorsa allo stesso giorno.
 */
export function PaceStrip({ period, txs, balances, spendable, today }: Props) {
  // La settimana scorsa può stare nel periodo prima: servono i movimenti per data, non per periodo.
  const recent = useTransactionsSince(addDays(mondayOf(today), -7));
  if (!recent) return null;

  const spendableIds = new Set(balances.filter((b) => b.envelope.kind === 'spendable').map((b) => b.envelope.id));
  const spentToday = spentBetween(txs, today, today, spendableIds);
  const a = todayAllowance({ spendable, spentToday, today, calendarEnd: period.calendarEnd });
  const week = weekSpending(recent, today);

  // Riquadro "Oggi": il numero è quanto resta oggi; sotto, su quanto e per quanti giorni.
  const over = a.nothing || a.left < 0;
  const todayValue = a.nothing ? formatEuro(0) : formatEuro(Math.abs(a.left), { decimals: 'always' });
  const todayLabel = a.nothing ? it.insights.todayLabel : a.left < 0 ? it.insights.todayOverLabel : it.insights.todayLabel;
  const todayNote = a.nothing
    ? it.insights.todayNothingShort
    : a.spentToday > 0
      ? it.insights.todaySpentOf(formatEuro(a.spentToday), formatEuro(a.quota))
      : it.insights.todayDays(a.daysLeft);
  const diff = week.thisWeek - week.lastWeek;

  return (
    <section className="pace-strip" aria-label={it.insights.paceLabel}>
      <div className={over ? 'pace-tile is-over' : 'pace-tile'}>
        <span className="pace-tile__k">{todayLabel}</span>
        <span className="pace-tile__v">{todayValue}</span>
        <span className="pace-tile__n">{todayNote}</span>
      </div>
      <div className="pace-tile">
        <span className="pace-tile__k">{it.insights.weekLabel}</span>
        <span className="pace-tile__v">{formatEuro(week.thisWeek)}</span>
        <span className={diff > 0 ? 'pace-tile__n is-more' : 'pace-tile__n'}>{it.insights.lastWeek(formatEuro(week.lastWeek))}</span>
      </div>
    </section>
  );
}
