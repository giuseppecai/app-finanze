import { formatEuro } from '../domain/money';
import { UNASSIGNED, type DestinationOption, type FundsDestination } from '../domain/settings';
import type { Cents } from '../domain/types';
import { it } from '../i18n/it';
import { OptionList } from './OptionList';

type Props = {
  /** quanto si sposta (per il titolo) */
  amount: Cents;
  options: readonly DestinationOption[];
  /** saldo attuale di ogni salvadanaio, per il dettaglio */
  balances: Readonly<Record<string, Cents>>;
  value: FundsDestination;
  onChange: (value: FundsDestination) => void;
};

/** "Dove vanno i € X rimasti?": Risparmi già scelto, gli altri salvadanai, o il Budget del mese. */
export function DestinationPicker({ amount, options, balances, value, onChange }: Props) {
  return (
    <OptionList
      legend={it.funds.question(formatEuro(amount))}
      options={options.map((o) => ({
        value: o.value,
        title: o.name,
        detail: o.value === UNASSIGNED ? it.funds.unassignedDetail : it.funds.potDetail(formatEuro(balances[o.value] ?? 0)),
      }))}
      value={value}
      onChange={onChange}
    />
  );
}
