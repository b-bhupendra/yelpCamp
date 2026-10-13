import React from 'react';

/**
 * ICON SET — single, consistent, token-friendly family.
 * All icons are stroke-based SVG (Lucide-style geometry), 1.75 stroke,
 * currentColor, so they inherit text colour and never depend on emoji fonts.
 *
 * Usage:  <Icon.Compass size={20} className="text-primary" />
 * Decorative icons beside visible text should carry aria-hidden (default true);
 * pass `title` to expose a meaningful icon to assistive tech.
 */
const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

function Svg({ size = 20, title, className = '', children, ...rest }) {
  return (
    <svg
      {...base(size)}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const Compass = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Svg>
);

export const Mountain = (p) => (
  <Svg {...p}>
    <path d="m3 20 6.5-11 4 6.5" />
    <path d="m12 20 5-8 4 8" />
    <path d="M3 20h18" />
  </Svg>
);

export const Tent = (p) => (
  <Svg {...p}>
    <path d="M3.5 20 12 4l8.5 16" />
    <path d="M12 4v16" />
    <path d="m8.5 20 3.5-6 3.5 6" />
  </Svg>
);

export const Gem = (p) => (
  <Svg {...p}>
    <path d="M6 3h12l3 6-9 12L3 9z" />
    <path d="M3 9h18" />
    <path d="M9 3 6 9l6 12 6-12-3-6" />
  </Svg>
);

export const Zap = (p) => (
  <Svg {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </Svg>
);

export const Users = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
    <path d="M18 14.6a5.5 5.5 0 0 1 2.5 4.6" />
  </Svg>
);

export const Quote = (p) => (
  <Svg {...p}>
    <path d="M8 6c-2.2 0-4 1.8-4 4v8h6v-6H6.5" />
    <path d="M18 6c-2.2 0-4 1.8-4 4v8h6v-6h-3.5" />
  </Svg>
);

export const ArrowUp = (p) => (
  <Svg {...p}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </Svg>
);

export const ArrowDown = (p) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Svg>
);

export const ArrowRight = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Svg>
);

export const Search = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);

export const Plus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MapPin = (p) => (
  <Svg {...p}>
    <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);

export const Star = (p) => (
  <Svg {...p}>
    <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8z" />
  </Svg>
);

export const LogOut = (p) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5" />
    <path d="M5 12h12" />
  </Svg>
);

export const Menu = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const Close = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const Image = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 5-5 4 4 3-3 4 4" />
  </Svg>
);

export const Check = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const Flame = (p) => (
  <Svg {...p}>
    <path d="M12 2.5c.5 2.8 2.3 4 3.5 5.6a6.2 6.2 0 0 1 1.2 3.7 6.7 6.7 0 0 1-13.4 0c0-1.6.6-3 1.6-4.2" />
    <path d="M12 21a3.4 3.4 0 0 0 3.4-3.4c0-1.9-1.4-3-3.4-5.1-2 2.1-3.4 3.2-3.4 5.1A3.4 3.4 0 0 0 12 21z" />
  </Svg>
);

export const Tree = (p) => (
  <Svg {...p}>
    <path d="M12 3l5 8h-3l3.5 6H6.5L10 11H7z" />
    <path d="M12 17v4" />
  </Svg>
);

export const Moon = (p) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Svg>
);

export const Droplet = (p) => (
  <Svg {...p}>
    <path d="M12 3s6 6.2 6 10.2a6 6 0 0 1-12 0C6 9.2 12 3 12 3z" />
  </Svg>
);

export const Icon = {
  Compass, Mountain, Tent, Gem, Zap, Users, Quote,
  ArrowUp, ArrowDown, ArrowRight, Search, Plus, MapPin, Star,
  LogOut, Menu, Close, Image, Check,
  Flame, Tree, Moon, Droplet,
};

export default Icon;
