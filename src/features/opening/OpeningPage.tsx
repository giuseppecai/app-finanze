import { PlaceholderPage } from '../../components/PlaceholderPage';
import { it } from '../../i18n/it';

export function OpeningPage() {
  const t = it.screens.opening;
  return <PlaceholderPage title={t.title} text={t.placeholder} />;
}
