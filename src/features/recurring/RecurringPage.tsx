import { PlaceholderPage } from '../../components/PlaceholderPage';
import { it } from '../../i18n/it';

export function RecurringPage() {
  const t = it.screens.recurring;
  return <PlaceholderPage title={t.title} text={t.placeholder} />;
}
