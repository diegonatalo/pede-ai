import type { SVGProps } from "react";

/**
 * Ícones de traço (24 px, herdam a cor do texto). São decorativos: o texto do botão ou o
 * `aria-label` é que dá o nome, por isso todos saem com `aria-hidden`.
 */
const Icon = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
);

type Props = SVGProps<SVGSVGElement>;

export const UtensilsIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" />
    <path d="M17 21V3c-2.2 1.4-3.5 4-3.5 7.2V13H17" />
  </Icon>
);

export const ReceiptIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Icon>
);

export const WalletIcon = (props: Props) => (
  <Icon {...props}>
    <rect x="3" y="6" width="18" height="14" rx="3" />
    <path d="M3 10h18M16 15h1.5" />
    <path d="M6 6V5a2 2 0 0 1 2-2h9" />
  </Icon>
);

export const BellIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);

export const ClockIcon = (props: Props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const TablesIcon = (props: Props) => (
  <Icon {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Icon>
);

export const FlameIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2.5 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6z" />
  </Icon>
);

export const ListIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={2.6} />
  </Icon>
);

export const ChartIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3" height="6" rx="1" />
    <rect x="10.5" y="7" width="3" height="10" rx="1" />
    <rect x="15.5" y="4" width="3" height="13" rx="1" />
  </Icon>
);

export const UsersIcon = (props: Props) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
  </Icon>
);

export const SlidersIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Icon>
);

export const SearchIcon = (props: Props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);

export const CameraIcon = (props: Props) => (
  <Icon {...props}>
    <path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Icon>
);
