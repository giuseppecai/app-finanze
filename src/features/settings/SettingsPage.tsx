import { PlaceholderPage } from '../../components/PlaceholderPage';
import { it } from '../../i18n/it';

export function SettingsPage() {
  const t = it.screens.settings;
  return <PlaceholderPage title={t.title} text={t.placeholder} />;
}
