// Simboli delle buste, dei salvadanai e delle voci fisse (redesign v2, simboli.json di Claude Design).
// Nei dati si salva solo il nome dell'icona Lucide (es. "coffee"), mai l'SVG. Logica pura, niente React.

export interface SymbolDef { id: string; label: string; keywords: readonly string[] }
export interface SymbolGroup { name: string; symbols: readonly SymbolDef[] }

export const FALLBACK_SYMBOL = 'tag';

/** Catalogo selezionabile, nell'ordine del pannello "Scegli il simbolo". */
export const SYMBOL_GROUPS: readonly SymbolGroup[] = [
  { name: "Casa", symbols: [
    { id: 'house', label: "Casa", keywords: ["casa", "servizi"] },
    { id: 'key-round', label: "Affitto", keywords: ["affitto", "mutuo"] },
    { id: 'sofa', label: "Arredamento", keywords: ["arredo", "mobili", "ikea"] },
    { id: 'lamp', label: "Luce", keywords: ["luce", "lampad"] },
    { id: 'wrench', label: "Riparazioni", keywords: ["ripara", "manutenz", "idraul"] },
    { id: 'zap', label: "Elettricità", keywords: ["elettric", "enel"] },
    { id: 'flame', label: "Gas", keywords: ["gas", "riscald"] },
    { id: 'droplet', label: "Acqua", keywords: ["acqua"] },
    { id: 'wifi', label: "Internet", keywords: ["internet", "wifi", "fibra"] },
    { id: 'smartphone', label: "Telefono", keywords: ["telefon", "cellular", "ricarica"] },
    { id: 'receipt', label: "Bollette", keywords: ["bollett", "utenz"] },
    { id: 'tv', label: "TV", keywords: ["tv", "streaming"] },
  ] },
  { name: "Cibo", symbols: [
    { id: 'shopping-basket', label: "Spesa", keywords: ["spesa", "alimentar"] },
    { id: 'shopping-cart', label: "Supermercato", keywords: ["supermerc"] },
    { id: 'utensils', label: "Ristorante", keywords: ["ristorant", "cena", "pranzo", "mangiare"] },
    { id: 'coffee', label: "Caffè", keywords: ["caffe", "colazion", "vita"] },
    { id: 'pizza', label: "Pizza", keywords: ["pizza", "delivery", "glovo", "deliveroo"] },
    { id: 'wine', label: "Vino", keywords: ["vino", "aperitiv"] },
    { id: 'beer', label: "Birra", keywords: ["birra", "pub"] },
    { id: 'apple', label: "Frutta", keywords: ["frutta", "verdura", "mercato"] },
  ] },
  { name: "Spostamenti", symbols: [
    { id: 'train-front', label: "Treno", keywords: ["treno", "trasport", "trenitalia", "italo"] },
    { id: 'bus', label: "Autobus", keywords: ["bus", "atac", "metro"] },
    { id: 'car', label: "Auto", keywords: ["auto", "macchina"] },
    { id: 'fuel', label: "Benzina", keywords: ["benzin", "carburant", "diesel"] },
    { id: 'bike', label: "Bici", keywords: ["bici", "monopattin"] },
    { id: 'plane', label: "Aereo", keywords: ["viagg", "volo", "aereo"] },
    { id: 'map-pin', label: "Luoghi", keywords: ["gite", "luoghi"] },
    { id: 'sun', label: "Vacanze", keywords: ["vacanz", "mare", "estate"] },
  ] },
  { name: "Tempo libero", symbols: [
    { id: 'party-popper', label: "Uscite", keywords: ["uscite", "feste", "svago"] },
    { id: 'ticket', label: "Biglietti", keywords: ["bigliett", "concert", "event"] },
    { id: 'film', label: "Cinema", keywords: ["cinema", "film"] },
    { id: 'music', label: "Musica", keywords: ["musica", "spotify"] },
    { id: 'gamepad-2', label: "Giochi", keywords: ["gioch", "videogioc", "switch", "steam"] },
    { id: 'book-open', label: "Libri", keywords: ["libri", "lettura"] },
    { id: 'dumbbell', label: "Palestra", keywords: ["palestra", "sport", "fitness"] },
    { id: 'palette', label: "Hobby", keywords: ["hobby", "arte"] },
  ] },
  { name: "Persone e cura", symbols: [
    { id: 'heart', label: "Persone care", keywords: ["amor", "partner", "coppia"] },
    { id: 'sparkles', label: "Cura di sé", keywords: ["skincare", "bellezza", "cura"] },
    { id: 'scissors', label: "Parrucchiere", keywords: ["parrucch", "barbier", "capelli"] },
    { id: 'shirt', label: "Vestiti", keywords: ["vestit", "abbiglia"] },
    { id: 'shopping-bag', label: "Shopping", keywords: ["shopping", "acquisti", "zalando", "shein"] },
    { id: 'pill', label: "Farmaci", keywords: ["farmac", "medicin"] },
    { id: 'stethoscope', label: "Medico", keywords: ["medic", "salute", "visite", "dentist"] },
    { id: 'baby', label: "Bambini", keywords: ["bambin", "figli"] },
    { id: 'dog', label: "Cane", keywords: ["cane"] },
    { id: 'cat', label: "Gatto", keywords: ["gatt", "animal"] },
    { id: 'graduation-cap', label: "Studio", keywords: ["studio", "corso", "universit", "scuola"] },
  ] },
  { name: "Soldi", symbols: [
    { id: 'piggy-bank', label: "Risparmi", keywords: ["risparm", "salvadanai"] },
    { id: 'wallet', label: "Budget", keywords: ["budget", "portafogl"] },
    { id: 'credit-card', label: "Carte", keywords: ["carta", "carte"] },
    { id: 'landmark', label: "Banca", keywords: ["banca", "tasse", "f24"] },
    { id: 'gift', label: "Regali", keywords: ["regal", "compleann", "natale"] },
    { id: 'hand-coins', label: "Prestiti", keywords: ["prestit", "debit"] },
    { id: 'repeat', label: "Abbonamenti", keywords: ["abbonam", "rate", "rata"] },
    { id: 'umbrella', label: "Imprevisti", keywords: ["imprevist", "emergenz"] },
    { id: 'shield', label: "Assicurazioni", keywords: ["assicuraz"] },
    { id: 'star', label: "Desideri", keywords: ["desider", "sogn"] },
  ] },
];

/** Simboli predefiniti per nome (migrazione dei dati esistenti e dati iniziali). */
export const DEFAULT_SYMBOLS: Readonly<Record<string, string>> = {
  "Trasporti": 'train-front',
  "Vita": 'coffee',
  "Spesa alimentare": 'shopping-basket',
  "Shopping": 'shopping-bag',
  "Casa & Servizi": 'house',
  "Rate & Abbonamenti": 'repeat',
  "Bollette": 'receipt',
  "Risparmi": 'piggy-bank',
  "Viaggi": 'plane',
  "Regali & Imprevisti": 'gift',
  "Riserva delle carte": 'credit-card',
  "Budget del mese": 'wallet',
  "Affitto": 'key-round',
  "Prestiti": 'hand-coins',
};

const ALL = SYMBOL_GROUPS.flatMap((g) => g.symbols);
const BY_ID = new Map(ALL.map((s) => [s.id, s]));

export function isKnownSymbol(id: string | null | undefined): id is string {
  return !!id && (BY_ID.has(id) || id === FALLBACK_SYMBOL);
}

/** Etichetta italiana di un simbolo ("Caffè"), per l'accessibilità e "prima era Caffè". */
export function symbolLabel(id: string): string {
  return BY_ID.get(id)?.label ?? 'Simbolo';
}

/** Il simbolo da mostrare: quello salvato se è nel catalogo, altrimenti il predefinito per nome, altrimenti "tag". */
export function symbolFor(item: { name: string; icon?: string | null }): string {
  if (isKnownSymbol(item.icon)) return item.icon;
  return DEFAULT_SYMBOLS[item.name.trim()] ?? FALLBACK_SYMBOL;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Simbolo suggerito dal nome di una busta nuova: nome senza accenti e in minuscolo, diviso in parole;
 * vince il primo simbolo del catalogo che ha una keyword con cui una parola del nome INIZIA.
 * "Palestra" → dumbbell; nessuna corrispondenza → tag.
 */
export function suggestSymbol(name: string): string {
  const words = normalize(name).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return FALLBACK_SYMBOL;
  for (const s of ALL) {
    if (s.keywords.some((k) => words.some((w) => w.startsWith(normalize(k))))) return s.id;
  }
  return FALLBACK_SYMBOL;
}

/** Copia con il simbolo predefinito per nome, se manca (dati iniziali e demo). */
export function withDefaultSymbol<T extends { name: string; icon?: string }>(x: T): T {
  return x.icon ? x : { ...x, icon: symbolFor(x) };
}
