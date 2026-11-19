import { PlaceholderPage } from '../../components/PlaceholderPage';
import { it } from '../../i18n/it';

export function ClosingPage() {
  const t = it.screens.closing;
  return <PlaceholderPage title={t.title} text={t.placeholder} />;
}
