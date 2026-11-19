import { PlaceholderPage } from '../../components/PlaceholderPage';
import { it } from '../../i18n/it';

export function EntryPage() {
  const t = it.screens.entry;
  return <PlaceholderPage title={t.title} text={t.placeholder} />;
}
