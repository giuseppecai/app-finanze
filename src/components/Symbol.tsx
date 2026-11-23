// Simboli delle buste e dei salvadanai: nome Lucide salvato nei dati -> componente. Le icone sono
// importate una per una (solo queste finiscono nel pacchetto dell'app).
import {
  Apple, Baby, Beer, Bike, BookOpen, Bus, Car, Cat, Coffee, CreditCard, Dog, Droplet, Dumbbell, Film, Flame, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, Heart, House, KeyRound, Lamp, Landmark, MapPin, Music, Palette, PartyPopper, PiggyBank, Pill, Pizza, Plane, Receipt, Repeat, Scissors, Shield, Shirt, ShoppingBag, ShoppingBasket, ShoppingCart, Smartphone, Sofa, Sparkles, Star, Stethoscope, Sun, Tag, Ticket, TrainFront, Tv, Umbrella, Utensils, Wallet, Wifi, Wine, Wrench, Zap,
  Download, LayoutGrid, Lightbulb,
  type LucideIcon, type LucideProps,
} from 'lucide-react';
import { FALLBACK_SYMBOL } from '../domain/symbols';

const ICONS: Record<string, LucideIcon> = {
  'house': House,
  'key-round': KeyRound,
  'sofa': Sofa,
  'lamp': Lamp,
  'wrench': Wrench,
  'zap': Zap,
  'flame': Flame,
  'droplet': Droplet,
  'wifi': Wifi,
  'smartphone': Smartphone,
  'receipt': Receipt,
  'tv': Tv,
  'shopping-basket': ShoppingBasket,
  'shopping-cart': ShoppingCart,
  'utensils': Utensils,
  'coffee': Coffee,
  'pizza': Pizza,
  'wine': Wine,
  'beer': Beer,
  'apple': Apple,
  'train-front': TrainFront,
  'bus': Bus,
  'car': Car,
  'fuel': Fuel,
  'bike': Bike,
  'plane': Plane,
  'map-pin': MapPin,
  'sun': Sun,
  'party-popper': PartyPopper,
  'ticket': Ticket,
  'film': Film,
  'music': Music,
  'gamepad-2': Gamepad2,
  'book-open': BookOpen,
  'dumbbell': Dumbbell,
  'palette': Palette,
  'heart': Heart,
  'sparkles': Sparkles,
  'scissors': Scissors,
  'shirt': Shirt,
  'shopping-bag': ShoppingBag,
  'pill': Pill,
  'stethoscope': Stethoscope,
  'baby': Baby,
  'dog': Dog,
  'cat': Cat,
  'graduation-cap': GraduationCap,
  'piggy-bank': PiggyBank,
  'wallet': Wallet,
  'credit-card': CreditCard,
  'landmark': Landmark,
  'gift': Gift,
  'hand-coins': HandCoins,
  'repeat': Repeat,
  'umbrella': Umbrella,
  'shield': Shield,
  'star': Star,
  'tag': Tag,
  // fuori dal catalogo, usati per righe di servizio
  'download': Download,
  'layout-grid': LayoutGrid,
  'lightbulb': Lightbulb,
};

type IconProps = Omit<LucideProps, 'ref'> & { id: string };

/** Icona di un simbolo (decorativa: il nome è sempre scritto accanto). */
export function SymbolIcon({ id, size = 19, strokeWidth = 2, ...rest }: IconProps) {
  const Icon = ICONS[id] ?? ICONS[FALLBACK_SYMBOL]!;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />;
}

export type TileTone = 'spend' | 'committed' | 'save-1' | 'save-2' | 'save-3' | 'neutral';

type TileProps = { symbol: string; tone?: TileTone; size?: 'sm' | 'md' | 'l'; className?: string };

/**
 * Simbolo dentro un quadrato arrotondato. Il colore dice l'AREA (da spendere, impegnate, messi da
 * parte), non lo stato: i colori d'area si usano solo in Home, nelle liste la tile è sempre lilla.
 */
export function Tile({ symbol, tone = 'spend', size = 'md', className = '' }: TileProps) {
  const iconSize = size === 'sm' ? 15 : size === 'l' ? 28 : 19;
  return (
    <span className={`tile tile--${size} tile--${tone} ${className}`.trim()} aria-hidden="true">
      <SymbolIcon id={symbol} size={iconSize} strokeWidth={size === 'l' ? 1.9 : 2} />
    </span>
  );
}
