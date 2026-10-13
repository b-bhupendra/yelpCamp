import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import SleekMasterpieceHero from '../components/SleekMasterpieceHero';
import CampHorizon from '../components/CampHorizon';
import CampsiteBento from '../components/CampsiteBento';
import ScrollReveal from '../components/ScrollReveal';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';

/* ───────────────────────────────────────────
   PARALLAX LAYER (decorative, disabled for reduced motion)
   ─────────────────────────────────────────── */
function ParallaxWrapper({ speed = 0.5, children, className = "" }) {
  const layerRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const onScroll = () => {
      if (!layerRef.current || requestRef.current) return;
      requestRef.current = requestAnimationFrame(() => {
        if (layerRef.current) {
          layerRef.current.style.transform = `translate3d(0, ${window.pageYOffset * speed}px, 0)`;
        }
        requestRef.current = null;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [speed]);

  return (
    <div
      ref={layerRef}
      className={`${className} will-change-transform gpu`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/* Campsite features shown on the first screen */
const HERO_FEATURES = [
  { Icon: Icon.Moon, label: 'Dark-sky sites' },
  { Icon: Icon.Droplet, label: 'Riverside pitches' },
  { Icon: Icon.Flame, label: 'Fire pits' },
  { Icon: Icon.Tree, label: 'Forest clearings' },
  { Icon: Icon.Tent, label: 'Tent & RV' },
];

/* Core Wilderness Pillars (UI/UX Pro Max Section) */
const WILDERNESS_PILLARS = [
  {
    icon: Icon.MapPin,
    title: 'Verified GPS & Topography',
    description: 'Every site is pinned with high-precision offline coordinates, elevation profiles, sun angles, and water availability.',
    badge: 'Offline GPX',
  },
  {
    icon: Icon.Flame,
    title: 'Live Ranger & Fire Telemetry',
    description: 'Direct data feeds for county burn bans, active fire restrictions, high-wind advisories, and wildlife notices.',
    badge: 'Real-time Feeds',
  },
  {
    icon: Icon.Moon,
    title: 'Bortle Dark-Sky Mapping',
    description: 'Find zero light-pollution sanctuaries verified with Bortle scale ratings and astronomical visibility metrics.',
    badge: 'Class 1-3 Skies',
  },
];

/* Community Explorer Metrics */
const COMMUNITY_METRICS = [
  { value: '1,420+', label: 'Curated Campsites', detail: 'Across North America & Europe' },
  { value: '48.5K', label: 'Nights Logged', detail: 'By verified backcountry campers' },
  { value: '99.6%', label: 'Topography Accuracy', detail: 'Field verified by local rangers' },
  { value: '4.95 / 5', label: 'Camper Rating', detail: 'From over 12,000 genuine reviews' },
];

export default function Landing() {
  return (
    <div className="bg-background text-fg selection:bg-secondary/30 font-sans min-h-screen">

      {/* ── AMBIENT ATMOSPHERE LAYER (starry sky + aurora) ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      {/* ═══════════════════════════════════════
          SECTION 1 — HERO WITH VISIBLE CAMPSITE HINT & BLUR
          ═══════════════════════════════════════ */}
      <section className="relative h-screen flex flex-col justify-end overflow-hidden pb-[18vh] md:pb-[16vh]">
        {/* Camp horizon silhouette at the foot of the screen */}
        <div className="absolute inset-x-0 bottom-0 z-[5] h-[38%] pointer-events-none" aria-hidden="true">
          <CampHorizon />
        </div>

        {/* 3D globe + atmospheric campsite backdrop */}
        <div className="absolute inset-0 z-10">
          <SleekMasterpieceHero />
        </div>

        {/* Campsite features + CTA — Revealed on load with staggered animation */}
        <div className="relative z-50 flex flex-col items-center gap-6 px-6">
          <ScrollReveal variant="fade-up" delay={200} duration={700}>
            <ul className="flex flex-wrap items-center justify-center gap-2.5 max-w-3xl">
              {HERO_FEATURES.map((f, idx) => (
                <li key={f.label}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/65 backdrop-blur-md px-4 py-2 text-xs font-medium text-fg-muted shadow-sm hover:border-secondary/40 hover:text-fg transition-colors duration-200">
                    <f.Icon size={14} className="text-secondary" />
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollReveal>

          <ScrollReveal variant="fade-scale" delay={350} duration={800}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                to="/index"
                className="group relative cursor-pointer px-12 py-5 rounded-full font-bold text-xs uppercase tracking-[0.24em] text-on-primary bg-primary overflow-hidden transition-all duration-300 hover:scale-[1.04] active:scale-95 shadow-[0_0_35px_rgba(14,165,233,0.35)] hover:shadow-[0_0_50px_rgba(14,165,233,0.55)]"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <span className="relative inline-flex items-center gap-2.5">
                  Explore campsites
                  <Icon.ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2 — GUIDED CAMPSITE BENTO (emerges on scroll)
          ═══════════════════════════════════════ */}
      <CampsiteBento />

      {/* ═══════════════════════════════════════
          SECTION 2.5 — WILDERNESS STANDARD PILLARS (SCROLL REVEAL)
          ═══════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-32">
        <ScrollReveal variant="fade-up" delay={50}>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 mb-4 rounded-full border border-sky-400/20 bg-surface/80 text-[11px] font-bold uppercase tracking-[0.25em] text-secondary">
              Engineered For The Elements
            </span>
            <h2 className="font-display text-3xl font-black leading-[1.05] tracking-tight text-fg md:text-5xl">
              Why campers trust <span className="aurora-text">YelpCamp.</span>
            </h2>
            <p className="mt-4 text-sm md:text-base text-fg-muted max-w-xl mx-auto">
              Built by avid backpackers and certified wilderness guides to replace outdated directories with real terrain telemetry.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {WILDERNESS_PILLARS.map((pillar, i) => (
            <ScrollReveal
              key={pillar.title}
              variant="fade-up"
              delay={i * 120}
              className="glass-titanium p-8 rounded-3xl relative group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary group-hover:scale-110 group-hover:bg-secondary/20 transition-all duration-300">
                    <pillar.icon size={22} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-border bg-background/50 text-fg-subtle">
                    {pillar.badge}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold tracking-tight text-fg mb-3 group-hover:text-secondary transition-colors duration-200">
                  {pillar.title}
                </h3>
                <p className="text-sm text-fg-muted leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-secondary">
                <span>View specification</span>
                <Icon.ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform duration-200" />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2.8 — COMMUNITY METRICS (SCROLL REVEAL)
          ═══════════════════════════════════════ */}
      <section className="relative z-10 border-y border-border/60 bg-surface/40 backdrop-blur-md py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {COMMUNITY_METRICS.map((metric, i) => (
            <ScrollReveal
              key={metric.label}
              variant="fade-scale"
              delay={i * 80}
              className="text-center flex flex-col items-center"
            >
              <div className="font-display text-3xl md:text-5xl font-black tracking-tight text-fg mb-1.5 aurora-text">
                {metric.value}
              </div>
              <div className="text-xs md:text-sm font-bold uppercase tracking-wider text-fg mb-1">
                {metric.label}
              </div>
              <div className="text-[11px] text-fg-subtle">
                {metric.detail}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 3 — STATEMENT (SCROLL REVEAL)
          ═══════════════════════════════════════ */}
      <section className="relative py-36 md:py-56 px-6 overflow-hidden z-10">
        <ParallaxWrapper speed={0.08} className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035]">
          <span className="text-[28vw] font-display font-black whitespace-nowrap select-none">EXPLORE</span>
        </ParallaxWrapper>

        {/* Ambient warm campfire glow in statement center */}
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(234, 88, 12, 0.12) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 75%)',
            filter: 'blur(70px)',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <ScrollReveal variant="fade-scale" duration={900}>
            <blockquote className="text-4xl md:text-7xl font-display font-black leading-[0.98] tracking-tight text-fg">
              THE <span className="aurora-text">OUTDOORS</span> <br /> STANDARD.
            </blockquote>
            <p className="mt-8 text-sm md:text-base font-medium text-fg-muted max-w-md mx-auto">
              Never gamble on pitch quality again. Authentic coordinates, unfiltered community reviews, and real wilderness clarity.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 4 — FINAL GATEWAY (SCROLL REVEAL)
          ═══════════════════════════════════════ */}
      <section className="relative py-24 md:py-36 px-6 z-10">
        <ScrollReveal variant="fade-scale" duration={850}>
          <div className="max-w-4xl mx-auto aurora-border rounded-3xl p-10 md:p-20 text-center relative overflow-hidden group shadow-[0_20px_80px_-20px_rgba(5,10,20,0.9)]">
            {/* Ambient interior light */}
            <div 
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[400px] h-[250px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%)',
                filter: 'blur(50px)',
              }}
              aria-hidden="true"
            />

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 mb-6 rounded-full border border-sky-400/20 bg-background/50 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
                Your Next Campsite Awaits
              </span>
              <h2 className="text-4xl md:text-7xl font-display font-black tracking-tight mb-8 leading-[0.96] text-fg">
                Start your <br /> <span className="aurora-text">next trip.</span>
              </h2>
              <p className="text-sm md:text-base text-fg-muted max-w-lg mx-auto mb-12">
                Join thousands of backpackers and explorers discovering secret riverside pitches and dark-sky clearings.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Magnetic strength={0.2}>
                  <Link
                    to="/register"
                    className="cursor-pointer inline-flex items-center gap-2.5 px-10 py-5 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-all duration-300 hover:scale-[1.04] active:scale-95 shadow-[0_0_30px_rgba(14,165,233,0.35)]"
                  >
                    Create account
                    <Icon.ArrowRight size={15} />
                  </Link>
                </Magnetic>
                <Magnetic strength={0.1}>
                  <Link
                    to="/index"
                    className="cursor-pointer inline-flex items-center gap-2.5 px-10 py-5 border border-border-strong hover:border-secondary text-fg rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-all duration-200 hover:bg-surface-2"
                  >
                    Browse gallery
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER (SCROLL REVEAL)
          ═══════════════════════════════════════ */}
      <footer className="relative py-16 text-center border-t border-border/60 z-10 bg-background/70 backdrop-blur-sm">
        <ScrollReveal variant="fade-in" delay={100}>
          <div className="flex items-center justify-center gap-2 mb-3 text-secondary">
            <Icon.Flame size={18} />
            <span className="font-display font-bold tracking-wider text-xs uppercase text-fg">YelpCamp Wilderness</span>
          </div>
          <p className="text-xs font-semibold tracking-[0.28em] text-fg-subtle uppercase">
            Crafted for people who sleep under the stars
          </p>
        </ScrollReveal>
      </footer>
    </div>
  );
}
