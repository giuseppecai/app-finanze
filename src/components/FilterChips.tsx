type Chip = { value: string; label: string };

type Props = {
  label: string;
  chips: readonly Chip[];
  value: string;
  onChange: (value: string) => void;
};

/** Pillole scorrevoli orizzontali; l'attiva è scura. */
export function FilterChips({ label, chips, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="chips">
      {chips.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={c.value === value}
          className="chips__chip"
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
