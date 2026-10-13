import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icons';

/**
 * CAMPSITE BENTO — a guided grid of campsites that emerges as you scroll.
 *
 * Every card starts faded (dim, desaturated, blurred and nudged down) and
 * blooms into full colour as it enters the viewport, staggered so the grid
 * resolves progressively rather than all at once.
 *
 * The reveal is driven by one rAF-throttled scroll listener that measures each
 * card against the viewport — deterministic and reliable, and it never leaves
 * a card stranded in the faded state. Motion is opt-out: under
 * prefers-reduced-motion the cards simply appear.
 */

const CAMPSITES = [
  {
    name: 'Fern Hollow',
    location: 'Olympic Peninsula, WA',
    price: 42,
    tag: 'Riverside',
    img: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1000&q=80',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    name: 'Ridgeline Camp',
    location: 'Dolomites, Italy',
    price: 58,
    tag: 'Ridge views',
    img: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1000&q=80',
    span: 'md:col-span-2 md:row-span-1',
  },
  {
    name: 'Pinewatch',
    location: 'Black Forest, Germany',
    price: 35,
    tag: 'Forest',
    img: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    name: 'Ember Flats',
    location: 'Joshua Tree, CA',
    price: 29,
    tag: 'Desert sky',
    img: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    name: 'Lakeside Pitch',
    location: 'Banff, Canada',
    price: 64,
    tag: 'Lakeside',
    img: 'https://images.unsplash.com/photo-1454391304352-2bf4678b1a7a?auto=format&fit=crop&w=1000&q=80',
    span: 'md:col-span-2 md:row-span-1',
  },
  {
    name: 'Moss Bank',
    location: 'Snowdonia, Wales',
    price: 38,
    tag: 'Valley',
    img: 'https://images.unsplash.com/photo-1533873984035-25970ab07461?auto=format&fit=crop&w=1000&q=80',
    span: 'md:col-span-2 md:row-span-1',
  },
];

function CampsiteCard({ camp, delay, visible, cardRef }) {
  return (
    <Link
      ref={cardRef}
      to="/index"
      style={{ transitionDelay: `${delay}ms` }}
      className={`bento-emerge group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-border md:aspect-auto ${camp.span} ${
        visible ? 'is-visible' : ''
      }`}
    >
      {/* image + fallback wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink-800 to-ink-950">
        <img
          src={camp.img}
          alt={`${camp.name} campsite`}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.opacity = '0'; }}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />

      {/* tag */}
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary backdrop-blur-sm">
        <Icon.MapPin size={12} />
        {camp.tag}
      </span>

      {/* caption */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-bold tracking-tight text-fg md:text-xl">
            {camp.name}
          </h3>
          <p className="truncate text-xs text-fg-muted">{camp.location}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-black tracking-tight text-fg">${camp.price}</span>
          <span className="block text-xs text-fg-subtle">/night</span>
        </div>
      </div>
    </Link>
  );
}

export default function CampsiteBento() {
  const [visible, setVisible] = useState(() => CAMPSITES.map(() => false));
  const refs = useRef([]);

  const visibleRef = useRef(visible);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const all = CAMPSITES.map(() => true);
      visibleRef.current = all;
      setVisible(all);
      return;
    }

    // Poll geometry on the animation frame loop rather than relying on scroll
    // events (which the smooth-scroll library does not fire continuously), so
    // every card reliably emerges. Stops as soon as all cards are visible.
    let raf = 0;
    let frames = 0;
    const MAX_FRAMES = 3600; // ~60s safety cap

    const tick = () => {
      frames += 1;
      const vh = window.innerHeight;
      const cur = visibleRef.current.slice();
      let changed = false;

      refs.current.forEach((el, i) => {
        if (cur[i] || !el) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) {
          cur[i] = true;
          changed = true;
        }
      });

      if (changed) {
        visibleRef.current = cur;
        setVisible(cur);
      }
      if (!cur.every(Boolean) && frames < MAX_FRAMES) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
      {/* Heading */}
      <div className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-secondary">
            Curated campsites
          </p>
          <h2 className="font-display text-3xl font-black leading-[1.02] tracking-tight text-fg md:text-5xl">
            Places worth pitching <br />
            <span className="aurora-text">a tent.</span>
          </h2>
        </div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
          <Icon.ArrowDown size={15} className="animate-bounce" />
          Scroll to wander
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-5 md:auto-rows-[200px] md:grid-cols-4">
        {CAMPSITES.map((camp, i) => (
          <CampsiteCard
            key={camp.name}
            camp={camp}
            delay={i * 90}
            visible={visible[i]}
            cardRef={(el) => { refs.current[i] = el; }}
          />
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          to="/index"
          className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-border-strong px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] text-fg transition-colors duration-200 hover:border-secondary"
        >
          See all campsites
          <Icon.ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
