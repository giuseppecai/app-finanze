// Icone SVG a tratto copiate dai mockup (design/mockups/Main.dc.html).
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, strokeWidth = 1.8, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconEnvelopes = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 9l9 5 9-5" /></Svg>
);

export const IconList = (p: IconProps) => (
  <Svg {...p}><path d="M5 7h14M5 12h14M5 17h9" /></Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg size={28} strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

export const IconChart = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg size={16} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg size={20} {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>
);

export const IconCalendar = (p: IconProps) => (
  <Svg size={18} {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16" /></Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg size={16} strokeWidth={2} {...p}><path d="M9 6l6 6-6 6" /></Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg size={16} strokeWidth={2} {...p}><path d="M6 9l6 6 6-6" /></Svg>
);

export const IconBackspace = (p: IconProps) => (
  <Svg size={22} {...p}><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" /><path d="M17 9l-5 6M12 9l5 6" /></Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg size={14} strokeWidth={3} {...p}><path d="M5 12l5 5 9-10" /></Svg>
);

export const IconMinus = (p: IconProps) => (
  <Svg size={18} strokeWidth={2.2} {...p}><path d="M5 12h14" /></Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg size={20} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></Svg>
);

export const IconShare = (p: IconProps) => (
  <Svg size={18} {...p}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></Svg>
);

export const IconCompare = (p: IconProps) => (
  <Svg size={16} strokeWidth={2} {...p}><path d="M7 4L3 8l4 4" /><path d="M3 8h13" /><path d="M17 20l4-4-4-4" /><path d="M21 16H8" /></Svg>
);
