type Props = { steps: readonly string[]; current: number; label: string };

/** Indicatore a passi (1 · Rivedi · 2 · Avanzi · 3 · Assegna). `current` parte da 0. */
export function StepIndicator({ steps, current, label }: Props) {
  return (
    <ol className="steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className={i <= current ? 'steps__item is-done' : 'steps__item'} aria-current={i === current ? 'step' : undefined}>
          <span className="steps__bar" aria-hidden="true" />
          <span className="steps__label">{i + 1} · {s}</span>
        </li>
      ))}
    </ol>
  );
}
