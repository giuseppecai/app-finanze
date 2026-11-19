import { PlaceholderPage } from '../../components/PlaceholderPage';
import { it } from '../../i18n/it';

export function HomePage() {
  const t = it.screens.home;
  return <PlaceholderPage title={t.title} text={t.placeholder} />;
}
