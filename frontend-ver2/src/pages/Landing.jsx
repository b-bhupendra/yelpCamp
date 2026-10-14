import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import SleekMasterpieceHero from '../components/SleekMasterpieceHero';
import CampHorizon from '../components/CampHorizon';
import CampsiteBento from '../components/CampsiteBento';
import CamperStories from '../components/CamperStories';
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

/* Campsite quick feature tags */
const HERO_FEATURES = [
  { Icon: Icon.Moon, label: 'Dark-Sky Class 1' },
  { Icon: Icon.Droplet, label: 'Riverside Pitches' },
  { Icon: Icon.Flame, label: 'Fire Pit Safe' },
  { Icon: Icon.Tree, label: 'Forest Clearings' },
  { Icon: Icon.Tent, label: 'Tent & RV Access' },
];

/* Core Wilderness Telemetry Pillars */
const WILDERNESS_PILLARS = [
  {
    icon: Icon.MapPin,
    title: 'Precision GPS & Topography',
    description: 'Every site is mapped with offline coordinates, elevation profiles, sun paths, tree canopy density, and nearest water sources.',
    badge: 'Offline GPX',
  },
  {
    icon: Icon.Flame,
    title: 'Live Ranger & Fire Telemetry',
    description: 'Direct integrations with park authorities provide active burn-ban alerts, wind forecasts, and seasonal wildlife notices.',
    badge: 'Real-Time Feeds',
  },
  {
    icon: Icon.Moon,
    title: 'Bortle Dark-Sky Mapping',
    description: 'Explore verified low-pollution night skies with Bortle scale indicators, meteor shower visibility, and Milky Way calendars.',
    badge: 'Class 1-3 Skies',
  },
];

/* Community Explorer Telemetry */
const COMMUNITY_METRICS = [
  { value: '1,420+', label: 'Curated Campsites', detail: 'North America & Europe' },
  { value: '48.5K', label: 'Nights Logged', detail: 'By verified hikers' },
  { value: '99.6%', label: 'Terrain Accuracy', detail: 'Ranger field-verified' },
  { value: '4.95 / 5', label: 'Camper Rating', detail: 'Over 12,000 reviews' },
];

export default function Landing() {
  return (
    <div className="bg-background text-fg selection:bg-secondary/30 font-sans min-h-screen">

      {/* ── PROCEDURAL AURORA BOREALIS & STARFIELD CANVAS LAYER ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      {/* ═══════════════════════════════════════
          SECTION 1 — HERO SECTION
          Aurora sky + 3D Liquid Chrome Centerpiece + Campsite Horizon
          ═══════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] h-[100dvh] md:h-screen flex flex-col justify-end overflow-hidden pb-[12vh] sm:pb-[16vh] md:pb-[16vh]">
        {/* Camp Horizon Silhouette with glowing tent and campfire */}
        <div className="absolute inset-x-0 bottom-0 z-[5] h-[36%] sm:h-[38%] pointer-events-none" aria-hidden="true">
          <CampHorizon />
        </div>

        {/* 3D Liquid-Chrome Centerpiece illuminated by the Aurora */}
        <div className="absolute inset-0 z-10">
          <SleekMasterpieceHero />
        </div>

        {/* Hero Quick Tags & Magnetic CTA Button */}
        <div className="relative z-50 flex flex-col items-center gap-4 sm:gap-6 px-4 sm:px-6">
          <ScrollReveal priority={true} variant="fade-up" delay={150} duration={700}>
            <ul className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 max-w-xs sm:max-w-xl md:max-w-3xl">
              {HERO_FEATURES.map((f) => (
                <li key={f.label}>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-sky-400/20 bg-background/70 backdrop-blur-md px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-fg-muted shadow-sm hover:border-secondary/40 hover:text-fg transition-colors duration-200">
                    <f.Icon size={13} className="text-secondary shrink-0" />
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollReveal>

          <ScrollReveal priority={true} variant="fade-scale" delay={280} duration={800}>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto px-2 sm:px-0">
              <Magnetic strength={0.25}>
                <Link
                  to="/index"
                  className="group relative cursor-pointer w-full sm:w-auto inline-flex items-center justify-center px-8 sm:px-12 py-3.5 sm:py-5 min-h-[48px] rounded-full font-bold text-xs uppercase tracking-[0.2em] sm:tracking-[0.24em] text-on-primary bg-primary overflow-hidden transition-all duration-300 hover:scale-[1.04] active:scale-95 shadow-[0_0_35px_rgba(14,165,233,0.35)] hover:shadow-[0_0_55px_rgba(14,165,233,0.6)]"
                >
                  <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <span className="relative inline-flex items-center gap-2.5">
                    Explore campsites
                    <Icon.ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Magnetic>

              <Magnetic strength={0.15}>
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-5 min-h-[48px] rounded-full border border-border-strong hover:border-secondary text-xs font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-fg transition-all duration-300 hover:bg-surface/60 backdrop-blur-md active:scale-95"
                >
                  Join Community
                </Link>
              </Magnetic>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2 — GUIDED CAMPSITE BENTO (WITH FILTERS)
          ═══════════════════════════════════════ */}
      <CampsiteBento />

      {/* ═══════════════════════════════════════
          SECTION 3 — WILDERNESS TELEMETRY PILLARS
          ═══════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 md:py-32">
        <ScrollReveal variant="fade-up" delay={50}>
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 mb-2.5 sm:mb-4 rounded-full border border-sky-400/20 bg-surface/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] sm:tracking-[0.25em] text-secondary">
              Engineered For The Elements
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-black leading-[1.05] tracking-tight text-fg md:text-5xl">
              Why campers trust <span className="aurora-text">YelpCamp.</span>
            </h2>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-fg-muted max-w-xl mx-auto">
              Built by avid backpackers and certified wilderness guides to replace outdated directories with real terrain telemetry.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {WILDERNESS_PILLARS.map((pillar, i) => (
            <ScrollReveal
              key={pillar.title}
              variant="fade-up"
              delay={i * 120}
              className="glass-titanium p-6 sm:p-8 rounded-2xl sm:rounded-3xl relative group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5 sm:mb-6">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary group-hover:scale-110 group-hover:bg-secondary/20 transition-all duration-300">
                    <pillar.icon size={20} />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 sm:px-3 py-1 rounded-full border border-border bg-background/50 text-fg-subtle">
                    {pillar.badge}
                  </span>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-fg mb-2 sm:mb-3 group-hover:text-secondary transition-colors duration-200">
                  {pillar.title}
                </h3>
                <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              <div className="mt-6 sm:mt-8 pt-4 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-secondary">
                <span>View telemetry spec</span>
                <Icon.ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform duration-200" />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 4 — COMMUNITY TELEMETRY COUNTER
          ═══════════════════════════════════════ */}
      <section className="relative z-10 border-y border-border/60 bg-surface/40 backdrop-blur-md py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
          {COMMUNITY_METRICS.map((metric, i) => (
            <ScrollReveal
              key={metric.label}
              variant="fade-scale"
              delay={i * 80}
              className="text-center flex flex-col items-center"
            >
              <div className="font-display text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-fg mb-1.5 aurora-text">
                {metric.value}
              </div>
              <div className="text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-fg mb-0.5 sm:mb-1">
                {metric.label}
              </div>
              <div className="text-[10px] sm:text-[11px] text-fg-subtle">
                {metric.detail}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 5 — CAMPER TESTIMONIALS
          ═══════════════════════════════════════ */}
      <CamperStories />

      {/* ═══════════════════════════════════════
          SECTION 6 — STATEMENT BANNER
          ═══════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 md:py-48 px-4 sm:px-6 overflow-hidden z-10">
        <ParallaxWrapper speed={0.08} className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035]">
          <span className="text-[22vw] md:text-[28vw] font-display font-black whitespace-nowrap select-none">EXPLORE</span>
        </ParallaxWrapper>

        {/* Ambient warm campfire reflection */}
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[520px] h-[220px] sm:h-[320px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(234, 88, 12, 0.14) 0%, rgba(56, 189, 248, 0.08) 50%, transparent 75%)',
            filter: 'blur(65px)',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <ScrollReveal variant="fade-scale" duration={900}>
            <blockquote className="text-3xl sm:text-4xl md:text-7xl font-display font-black leading-[1.02] sm:leading-[0.98] tracking-tight text-fg">
              THE <span className="aurora-text">OUTDOORS</span> <br /> STANDARD.
            </blockquote>
            <p className="mt-5 sm:mt-8 text-xs sm:text-sm md:text-base font-medium text-fg-muted max-w-md mx-auto">
              Never gamble on pitch quality again. Authentic coordinates, unfiltered community reviews, and real wilderness clarity.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 7 — FINAL GATEWAY CTA
          ═══════════════════════════════════════ */}
      <section className="relative py-16 sm:py-24 md:py-36 px-4 sm:px-6 z-10">
        <ScrollReveal variant="fade-scale" duration={850}>
          <div className="max-w-4xl mx-auto aurora-border rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-20 text-center relative overflow-hidden group shadow-[0_20px_80px_-20px_rgba(5,10,20,0.9)]">
            {/* Ambient interior light */}
            <div 
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[320px] sm:w-[420px] h-[220px] sm:h-[260px] rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, rgba(16, 185, 129, 0.15) 45%, transparent 72%)',
                filter: 'blur(55px)',
              }}
              aria-hidden="true"
            />

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 sm:mb-6 rounded-full border border-sky-400/20 bg-background/50 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
                Your Next Campsite Awaits
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-7xl font-display font-black tracking-tight mb-5 sm:mb-8 leading-[1.0] sm:leading-[0.96] text-fg">
                Start your <br /> <span className="aurora-text">next trip.</span>
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-fg-muted max-w-lg mx-auto mb-8 sm:mb-12">
                Join thousands of backpackers and explorers discovering secret riverside pitches and dark-sky clearings.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
                <Magnetic strength={0.2}>
                  <Link
                    to="/register"
                    className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 sm:px-10 py-4 sm:py-5 min-h-[48px] bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-all duration-300 hover:scale-[1.04] active:scale-95 shadow-[0_0_30px_rgba(14,165,233,0.35)]"
                  >
                    Create free account
                    <Icon.ArrowRight size={15} />
                  </Link>
                </Magnetic>
                <Magnetic strength={0.1}>
                  <Link
                    to="/index"
                    className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 sm:px-10 py-4 sm:py-5 min-h-[48px] border border-border-strong hover:border-secondary text-fg rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-all duration-200 hover:bg-surface-2 active:scale-95"
                  >
                    Browse all campsites
                  </Link>
                </Magnetic>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 8 — FOOTER
          ═══════════════════════════════════════ */}
      <footer className="relative py-12 sm:py-16 text-center border-t border-border/60 z-10 bg-background/80 backdrop-blur-md px-4 sm:px-6">
        <ScrollReveal variant="fade-in" delay={100}>
          <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3 text-secondary">
            <Icon.Flame size={18} />
            <span className="font-display font-bold tracking-wider text-xs uppercase text-fg">YelpCamp Wilderness</span>
          </div>
          <p className="text-[10px] sm:text-xs font-semibold tracking-[0.24em] sm:tracking-[0.28em] text-fg-subtle uppercase mb-4">
            Crafted for people who sleep under the stars
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-fg-muted">
            <Link to="/index" className="hover:text-fg transition-colors">Explore</Link>
            <Link to="/login" className="hover:text-fg transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-fg transition-colors">Register</Link>
            <span className="text-fg-subtle hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All Systems Operational
            </span>
          </div>
        </ScrollReveal>
      </footer>
    </div>
  );
}
