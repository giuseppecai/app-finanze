type Props = { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string };

/** Interruttore 52 × 32 (`role="switch"`), con etichetta e nota sotto. */
export function Switch({ label, checked, onChange, hint }: Props) {
  return (
    <div className="switch-field">
      <span className="switch-field__text">
        <span className="switch-field__label">{label}</span>
        {hint ? <span className="switch-field__hint">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="switch__knob" />
      </button>
    </div>
  );
}
