import { ScreenHeader } from './ScreenHeader';
import { TopBar } from './TopBar';

type Props = { title: string; text: string; fullScreen?: boolean };

/** Pagina provvisoria: titolo e cosa arriverà. */
export function PlaceholderPage({ title, text, fullScreen = false }: Props) {
  return (
    <>
      {fullScreen ? <TopBar /> : null}
      <ScreenHeader title={title} />
      <p className="placeholder">{text}</p>
    </>
  );
}
