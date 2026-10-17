import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icons';
import ScrollReveal from './ScrollReveal';
import { handleImageError } from '../utils/imageFallback';

/**
 * CAMPSITE BENTO — Guided showcase of campsites with category filtering.
 * UI/UX Pro Max Edition
 *
 * Features:
 *   - Category quick-filter tabs (All, Riverside, Ridge & Alpine, Dark Sky, Forest)
 *   - Glassmorphic card design with subtle aurora borders
 *   - Star rating, night price, and terrain indicators
 *   - Staggered emergence as the user scrolls into view
 */

const CAMPSITES = [
  {
    id: 1,
    name: 'Fern Hollow Sanctuary',
    location: 'Olympic Peninsula, WA',
    category: 'Riverside',
    price: 42,
    rating: 4.94,
    reviews: 128,
    elevation: '420m',
    tag: 'Riverside Pitch',
    img: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1000&q=80',
    span: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
    featured: true,
  },
  {
    id: 2,
    name: 'Ridgeline Cloud Camp',
    location: 'Dolomites, Italy',
    category: 'Ridge & Alpine',
    price: 58,
    rating: 4.98,
    reviews: 94,
    elevation: '2,140m',
    tag: 'Ridge Panorama',
    img: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1000&q=80',
    span: 'sm:col-span-1 lg:col-span-2 lg:row-span-1',
  },
  {
    id: 3,
    name: 'Pinewatch Forest Camp',
    location: 'Black Forest, Germany',
    category: 'Forest',
    price: 35,
    rating: 4.88,
    reviews: 62,
    elevation: '850m',
    tag: 'Deep Woods',
    img: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
    span: 'sm:col-span-1 lg:col-span-1 lg:row-span-1',
  },
  {
    id: 4,
    name: 'Ember Flats Dark-Sky',
    location: 'Joshua Tree, CA',
    category: 'Dark Sky',
    price: 29,
    rating: 4.92,
    reviews: 146,
    elevation: '980m',
    tag: 'Bortle Class 1',
    img: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
    span: 'sm:col-span-1 lg:col-span-1 lg:row-span-1',
  },
  {
    id: 5,
    name: 'Lakeside Mirror Pitch',
    location: 'Banff National Park, Canada',
    category: 'Riverside',
    price: 64,
    rating: 4.97,
    reviews: 215,
    elevation: '1,380m',
    tag: 'Alpine Lake',
    img: 'https://images.unsplash.com/photo-1454391304352-2bf4678b1a7a?auto=format&fit=crop&w=1000&q=80',
    span: 'sm:col-span-1 lg:col-span-2 lg:row-span-1',
  },
  {
    id: 6,
    name: 'Moss Bank Glade',
    location: 'Snowdonia, Wales',
    category: 'Forest',
    price: 38,
    rating: 4.89,
    reviews: 77,
    elevation: '310m',
    tag: 'Valley Clearing',
    img: 'https://images.unsplash.com/photo-1533873984035-25970ab07461?auto=format&fit=crop&w=1000&q=80',
    span: 'sm:col-span-2 lg:col-span-2 lg:row-span-1',
  },
];

const CATEGORIES = ['All', 'Riverside', 'Ridge & Alpine', 'Dark Sky', 'Forest'];

function CampsiteCard({ camp, index, delay, visible, cardRef }) {
  return (
    <Link
      ref={cardRef}
      to="/campgrounds"
      data-bento-idx={index}
      style={{ transitionDelay: `${delay}ms` }}
      className={`bento-emerge group relative block aspect-[16/10] sm:aspect-auto overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-surface/60 backdrop-blur-md ${camp.span} ${
        visible ? 'is-visible' : ''
      } hover:border-secondary/50 hover:shadow-[0_15px_50px_-15px_rgba(14,165,233,0.35)] active:scale-[0.98] transition-all duration-300`}
    >
      {/* Background image & gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink-900 to-ink-950 overflow-hidden">
        <img
          src={camp.img}
          alt={`${camp.name} campsite`}
          loading="lazy"
          onError={(e) => handleImageError(e, 'campground', camp.id)}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-300" />

      {/* Top badges: Tag + Rating */}
      <div className="absolute left-3.5 right-3.5 top-3.5 sm:left-4 sm:right-4 sm:top-4 flex items-center justify-between gap-2 z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-background/70 px-3 py-1 sm:px-3.5 text-[10px] sm:text-[11px] font-semibold tracking-wide text-secondary backdrop-blur-md shadow-sm">
          <Icon.MapPin size={11} className="text-secondary shrink-0" />
          <span className="truncate">{camp.tag}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/70 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-fg backdrop-blur-md shrink-0">
          <Icon.Star size={11} className="text-amber-400 fill-amber-400" />
          {camp.rating}
        </span>
      </div>

      {/* Bottom info section */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5 md:p-6 z-10">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-fg-subtle mb-1">
            <span className="truncate">{camp.location}</span>
            <span>•</span>
            <span className="text-secondary shrink-0">{camp.elevation}</span>
          </div>
          <h3 className="truncate font-display text-base sm:text-lg md:text-xl font-bold tracking-tight text-fg group-hover:text-secondary transition-colors duration-200">
            {camp.name}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-base sm:text-lg font-black tracking-tight text-fg">
            ${camp.price}
          </div>
          <span className="block text-[10px] sm:text-[11px] font-medium text-fg-subtle">/ night</span>
        </div>
      </div>
    </Link>
  );
}

export default function CampsiteBento() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [visible, setVisible] = useState(() => CAMPSITES.map(() => false));
  const refs = useRef([]);
  const visibleRef = useRef(visible);

  const filteredCampsites = useMemo(() => {
    if (selectedCategory === 'All') return CAMPSITES;
    return CAMPSITES.filter((c) => c.category === selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(CAMPSITES.map(() => true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-bento-idx'));
            if (!isNaN(index)) {
              setVisible((prev) => {
                if (prev[index]) return prev;
                const next = [...prev];
                next[index] = true;
                return next;
              });
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    refs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [filteredCampsites]);

  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 md:pt-32 md:pb-36">
      {/* Header with Title & Quick Info */}
      <ScrollReveal variant="fade-up" delay={50}>
        <div className="mb-8 sm:mb-10 flex flex-col gap-4 sm:gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 mb-2.5 sm:mb-3 rounded-full border border-sky-400/20 bg-surface/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] sm:tracking-[0.25em] text-secondary">
              Handpicked Wild Stays
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-black leading-[1.05] sm:leading-[1.02] tracking-tight text-fg md:text-5xl">
              Places worth pitching <br />
              <span className="aurora-text">a backcountry tent.</span>
            </h2>
          </div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            <Icon.ArrowDown size={15} className="animate-bounce text-secondary" />
            Scroll to wander
          </p>
        </div>
      </ScrollReveal>

      {/* Category Filter Pills (Touch momentum scrollable) */}
      <ScrollReveal variant="fade-up" delay={100}>
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 sm:mb-8 no-scrollbar scroll-smooth overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`cursor-pointer px-4 sm:px-5 py-2.5 rounded-full text-xs font-bold tracking-wider transition-all duration-200 whitespace-nowrap min-h-[44px] active:scale-95 ${
                selectedCategory === cat
                  ? 'bg-secondary text-background shadow-[0_0_20px_rgba(56,189,248,0.4)]'
                  : 'border border-border/80 bg-surface/50 text-fg-muted hover:text-fg hover:border-border-strong'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* Responsive Bento Grid (1-col mobile, 2-col tablet, 4-col desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:auto-rows-[220px]">
        {filteredCampsites.map((camp, i) => (
          <CampsiteCard
            key={camp.name}
            camp={camp}
            index={i}
            delay={i * 80}
            visible={visible[i]}
            cardRef={(el) => { refs.current[i] = el; }}
          />
        ))}
      </div>

      {/* Bottom CTA */}
      <ScrollReveal variant="fade-scale" delay={150}>
        <div className="mt-10 sm:mt-14 flex justify-center">
          <Link
            to="/campgrounds"
            className="inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full border border-border-strong bg-surface/60 px-7 sm:px-9 py-3.5 sm:py-4 text-xs font-bold uppercase tracking-[0.2em] text-fg transition-all duration-300 hover:border-secondary hover:bg-surface-2 hover:shadow-[0_0_30px_rgba(56,189,248,0.25)] active:scale-95 min-h-[48px]"
          >
            Explore all {CAMPSITES.length}+ campsites
            <Icon.ArrowRight size={16} />
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
}
