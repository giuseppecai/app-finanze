type Option<T extends string> = { value: T; title: string; detail: string };

type Props<T extends string> = {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Opzioni a scelta singola con titolo e dettaglio (radio veri, accessibili). */
export function OptionList<T extends string>({ legend, options, value, onChange }: Props<T>) {
  return (
    <fieldset className="options">
      <legend className="section-title">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="option">
          <input type="radio" name={legend} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
          <span className="option__dot" aria-hidden="true" />
          <span className="option__text">
            <span className="option__title">{o.title}</span>
            <span className="option__detail">{o.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
