import { useSettings } from '../../app/data';
import { IconDownload } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { TopBar } from '../../components/TopBar';
import { it } from '../../i18n/it';
import { BackupGroup } from './DataSection';

/** "Backup e dati" (da Imposta): esporta e importa, a tutto schermo. Imposta resta più corta. */
export function BackupPage() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <div className="flow">
      <TopBar />
      <PageHeader full title={it.settings.backupRow} chip={{ icon: <IconDownload />, text: it.settings.onlyHere }} />
      <BackupGroup settings={settings} />
    </div>
  );
}
