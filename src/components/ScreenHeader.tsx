type Props = { title: string; subtitle?: string };

export function ScreenHeader({ title, subtitle }: Props) {
  return (
    <header className="screen-header">
      <h1 className="screen-title">{title}</h1>
      {subtitle ? <p className="screen-subtitle">{subtitle}</p> : null}
    </header>
  );
}
