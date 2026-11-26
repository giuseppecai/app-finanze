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

  let main: string;
  let tone = '';
  if (a.nothing) {
    main = it.insights.todayNothing;
    tone = ' is-over';
  } else if (a.left < 0) {
    main = it.insights.todayOver(formatEuro(-a.left, { decimals: 'always' }));
    tone = ' is-over';
  } else if (a.spentToday > 0) {
    main = it.insights.todayProgress(formatEuro(a.spentToday, { decimals: 'always' }), formatEuro(a.quota, { decimals: 'always' }));
  } else {
    main = it.insights.todayQuota(formatEuro(a.quota, { decimals: 'always' }));
  }

  return (
    <section className="card pace-strip" aria-label={it.insights.paceLabel}>
      <p className={`pace-strip__today${tone}`}>
        {main}
        {!a.nothing ? <span className="pace-strip__days"> · {it.insights.todayDays(a.daysLeft)}</span> : null}
      </p>
      <p className="pace-strip__week">
        {it.insights.week(formatEuro(week.thisWeek))}
        <span className="pace-strip__muted"> · {it.insights.lastWeek(formatEuro(week.lastWeek))}</span>
      </p>
    </section>
  );
}
