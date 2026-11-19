type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  large?: boolean;
  invalid?: boolean;
};

/** Campo importo in euro (tastiera numerica di iOS con la virgola). Il valore resta testo: lo legge parseEuro. */
export function AmountField({ id, label, value, onChange, placeholder, large = false, invalid = false }: Props) {
  return (
    <div className={large ? 'amount-field amount-field--large' : 'amount-field'}>
      <label htmlFor={id} className="amount-field__label">{label}</label>
      <div className={invalid ? 'amount-field__box is-invalid' : 'amount-field__box'}>
        <span className="amount-field__currency" aria-hidden="true">€</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        />
      </div>
    </div>
  );
}
