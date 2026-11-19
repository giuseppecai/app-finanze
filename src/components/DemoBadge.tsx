import { isDemo } from '../db/database';
import { it } from '../i18n/it';

/** Avviso fisso quando l'app gira con i dati di prova (`?demo=1`). */
export function DemoBadge() {
  if (!isDemo) return null;
  return <p className="demo-badge">{it.demo}</p>;
}
