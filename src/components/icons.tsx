// Icone Lucide (lucide-react, l'unica dipendenza UI ammessa), tratto 2 e currentColor come nel redesign.
// I nomi Icon* restano quelli di prima, così i componenti non cambiano.
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUp, ArrowUpRight, Calendar, ChartColumn, Check, ChevronDown, ChevronRight,
  CircleCheck, Coffee, CreditCard, Delete, Download, HandCoins, House, Info, Lightbulb, List, Minus, Pencil, PiggyBank,
  Plus, Receipt, Repeat, Settings, Share, ShoppingBag, ShoppingBasket, SlidersHorizontal, TrainFront, Trash2,
  TriangleAlert, Upload, Wallet, X, type LucideIcon, type LucideProps,
} from 'lucide-react';

type IconProps = Omit<LucideProps, 'ref'>;

function make(Icon: LucideIcon, defaults: { size?: number; strokeWidth?: number } = {}) {
  const Wrapped = ({ size = defaults.size ?? 22, strokeWidth = defaults.strokeWidth ?? 2, ...rest }: IconProps) => (
    <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />
  );
  return Wrapped;
}

export const IconEnvelopes = make(Wallet);
export const IconList = make(List);
export const IconPlus = make(Plus);
export const IconChart = make(ChartColumn);
export const IconSettings = make(Settings);
export const IconClose = make(X);
export const IconSliders = make(SlidersHorizontal);
export const IconCalendar = make(Calendar, { size: 20 });
export const IconChevronRight = make(ChevronRight, { size: 18 });
export const IconChevronDown = make(ChevronDown, { size: 18 });
export const IconBackspace = make(Delete, { size: 24 });
export const IconCheck = make(Check, { size: 18, strokeWidth: 3 });
export const IconMinus = make(Minus);
export const IconAlert = make(TriangleAlert, { size: 18 });
export const IconShare = make(Share, { size: 20 });
export const IconCompare = make(ArrowLeftRight, { size: 20 });
export const IconPencil = make(Pencil, { size: 15 });
export const IconArrowUp = make(ArrowUp, { size: 20 });
export const IconArrowRight = make(ArrowRight, { size: 18 });
export const IconArrowDownLeft = make(ArrowDownLeft, { size: 18 });
export const IconArrowUpRight = make(ArrowUpRight, { size: 16 });
export const IconPiggyBank = make(PiggyBank, { size: 20 });
export const IconCard = make(CreditCard, { size: 20 });
export const IconDownload = make(Download, { size: 20 });
export const IconUpload = make(Upload, { size: 20 });
export const IconInfo = make(Info, { size: 18 });
export const IconLightbulb = make(Lightbulb, { size: 18 });
export const IconCircleCheck = make(CircleCheck, { size: 18 });
export const IconTrash = make(Trash2, { size: 18 });
export const IconRepeat = make(Repeat, { size: 20 });
export const IconReceipt = make(Receipt, { size: 20 });
export const IconHandCoins = make(HandCoins, { size: 20 });

/** Icona di una busta (Movimenti): per nome breve, con un'icona generica per le buste nuove. */
const ENVELOPE_ICONS: Record<string, LucideIcon> = {
  trasporti: TrainFront, vita: Coffee, spesa: ShoppingBasket, shopping: ShoppingBag, casa: House, rate: Repeat,
};
export function EnvelopeIcon({ shortName, ...rest }: IconProps & { shortName: string }) {
  const Icon = ENVELOPE_ICONS[shortName.trim().toLowerCase()] ?? Wallet;
  return <Icon size={20} strokeWidth={2} aria-hidden="true" focusable="false" {...rest} />;
}
