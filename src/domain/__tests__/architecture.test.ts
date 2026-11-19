import { describe, expect, it } from 'vitest';

// Sorgenti di src/domain/*.ts come testo (glob di Vite: niente dipendenze da Node).
const sources = import.meta.glob<string>('../*.ts', { query: '?raw', import: 'default', eager: true });
const files = Object.entries(sources);

describe('architettura', () => {
  it('trova i file di dominio', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files)('%s non importa React né Dexie', (_file, source) => {
    expect(source).not.toMatch(/from ['"](react|react-dom|dexie|dexie-react-hooks)['"/]/);
  });
});
