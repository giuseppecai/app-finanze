import { ScreenHeader } from './ScreenHeader';

type Props = { title: string; text: string };

/** Pagina provvisoria di M0: titolo e cosa arriverà. */
export function PlaceholderPage({ title, text }: Props) {
  return (
    <>
      <ScreenHeader title={title} />
      <p className="placeholder">{text}</p>
    </>
  );
}
