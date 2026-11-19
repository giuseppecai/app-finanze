import { PlaceholderPage } from '../../components/PlaceholderPage';
import { it } from '../../i18n/it';

export function LoansPage() {
  const t = it.screens.loans;
  return <PlaceholderPage title={t.title} text={t.placeholder} />;
}
