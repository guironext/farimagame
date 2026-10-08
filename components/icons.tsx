// Petites icônes SVG (style trait, 24×24) utilisées par la navigation et les pages.
type P = { className?: string };
const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconHome = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
);
export const IconGamepad = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="2" y="6" width="20" height="12" rx="6" />
    <path d="M6 12h4M8 10v4" />
    <circle cx="15.5" cy="11" r="0.6" fill="currentColor" />
    <circle cx="18" cy="13" r="0.6" fill="currentColor" />
  </svg>
);
export const IconBall = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m12 7 4 3-1.5 4.5h-5L8 10z" />
    <path d="M12 7V2.5M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5" />
  </svg>
);
export const IconTicket = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M13 6v2M13 11v2M13 16v2" />
  </svg>
);
export const IconWallet = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" />
    <path d="M3 6v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3" />
  </svg>
);
export const IconUser = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IconChevronDown = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconChevronRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconX = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const IconTrash = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);
export const IconInfo = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 16v-4.5M12 8h.01" />
  </svg>
);
export const IconLogout = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />
  </svg>
);
export const IconChart = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);
export const IconCrown = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5z" />
  </svg>
);
export const IconShield = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z" />
  </svg>
);
