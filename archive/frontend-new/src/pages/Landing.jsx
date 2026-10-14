import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import SleekMasterpieceHero from '../components/SleekMasterpieceHero';
import Magnetic from '../components/Magnetic';
import Icon from '../components/Icons';

/* ───────────────────────────────────────────
   KINETIC REVEAL HOOK
   ─────────────────────────────────────────── */
function useKineticReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, visible];
}

/* ───────────────────────────────────────────
   PARALLAX LAYER (decorative, disabled for reduced motion)
   ─────────────────────────────────────────── */
function ParallaxWrapper({ speed = 0.5, children, className = "" }) {
  const layerRef = useRef(null);
  const [ref, visible] = useKineticReveal(0.01);
  const requestRef = useRef();

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const onScroll = () => {
      if (!visible || !layerRef.current || requestRef.current) return;
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
  }, [speed, visible]);

  return (
    <div
      ref={(el) => { layerRef.current = el; ref.current = el; }}
      className={`${className} will-change-transform gpu`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/* ───────────────────────────────────────────
   BENTO CARD
   ─────────────────────────────────────────── */
function BentoCard({ children, className = "", delay = 0 }) {
  const [ref, visible] = useKineticReveal(0.2);
  return (
    <div
      ref={ref}
      className={`bento-card group p-8 md:p-10 flex flex-col justify-between legend-reveal ${visible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="bg-background text-fg selection:bg-secondary/30 font-sans">

      {/* ── AMBIENT ATMOSPHERE LAYER ── */}
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      {/* ═══════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════ */}
      <section className="relative h-screen flex items-end justify-center overflow-hidden pb-16 md:pb-20">
        <div className="absolute inset-0 z-10">
          <SleekMasterpieceHero />
        </div>

        <div className="relative z-50 flex justify-center">
          <Link
            to="/index"
            className="group relative cursor-pointer px-12 py-5 rounded-full font-bold text-xs uppercase tracking-[0.24em] text-fg border border-border-strong backdrop-blur-md overflow-hidden transition-colors duration-300 hover:border-secondary"
          >
            <span className="absolute inset-0 bg-primary -translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative inline-flex items-center gap-2.5 group-hover:text-on-primary transition-colors duration-300">
              Explore campsites
              <Icon.ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2 — BENTO SHOWCASE
          ═══════════════════════════════════════ */}
      <section className="relative py-28 md:py-40 px-6 max-w-7xl mx-auto z-10">
        <div className="text-center mb-20">
          <p className="text-xs font-bold tracking-[0.3em] text-secondary uppercase mb-6">Why YelpCamp</p>
          <h2 className="text-4xl md:text-7xl font-display font-black tracking-tight leading-[0.95] mb-8 text-fg">
            Find your next <br />
            <span className="aurora-text">wilderness escape.</span>
          </h2>
          <p className="text-lg md:text-xl text-fg-muted max-w-2xl mx-auto font-light leading-relaxed">
            A curated network of the world's most remarkable campsites — reviewed by real explorers, mapped to the last trail.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 md:auto-rows-[minmax(0,1fr)] md:h-[880px]">

          <BentoCard className="md:col-span-2 md:row-span-2 glass-titanium" delay={80}>
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=1200"
                className="w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-700"
                alt="A tent pitched on a forested ridge at dusk"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
            </div>
            <div className="relative z-10 mt-auto">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-secondary uppercase">
                <Icon.Compass size={15} /> Discover
              </span>
              <h3 className="text-3xl md:text-4xl font-display font-black mt-5 mb-4 tracking-tight text-fg">
                Precision <br /> exploration
              </h3>
              <p className="text-sm md:text-base text-fg-muted max-w-sm leading-relaxed font-light">
                Save wishlists and verified campsite intel in one calm, obsidian-clean dashboard.
              </p>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-2 md:row-span-1 glass-titanium-solid" delay={160}>
            <div className="flex flex-col sm:flex-row gap-8 sm:items-center h-full relative z-10">
              <div className="flex-1">
                <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-secondary uppercase">
                  <Icon.Users size={15} /> Together
                </span>
                <h3 className="text-2xl md:text-3xl font-display font-black mt-4 mb-3 tracking-tight text-fg">Plan as a crew</h3>
                <p className="text-sm text-fg-muted leading-relaxed font-light">
                  Sync routes, split gear lists and vet spots with your expedition team.
                </p>
              </div>
              <div className="w-16 h-16 shrink-0 rounded-full border border-border-strong flex items-center justify-center bg-white/[0.03] text-secondary group-hover:bg-primary group-hover:text-on-primary transition-colors duration-300">
                <Icon.Users size={26} />
              </div>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-1 md:row-span-1 glass-titanium-solid" delay={240}>
            <div className="text-3xl font-black mb-5 text-fg tracking-tight">1.2K+</div>
            <h3 className="text-lg font-display font-bold mb-2 tracking-tight text-fg">Verified sites</h3>
            <p className="text-sm text-fg-subtle leading-relaxed font-light">Vetted by top-tier global scouts.</p>
          </BentoCard>

          <BentoCard className="md:col-span-1 md:row-span-1 glass-titanium" delay={320}>
            <div className="text-3xl font-black mb-5 text-fg tracking-tight">52K</div>
            <h3 className="text-lg font-display font-bold mb-2 tracking-tight text-fg">Explorers</h3>
            <p className="text-sm text-fg-subtle leading-relaxed font-light">An exclusive network of adventurers.</p>
          </BentoCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 3 — STATEMENT
          ═══════════════════════════════════════ */}
      <section className="relative py-40 md:py-64 px-6 overflow-hidden z-10">
        <ParallaxWrapper speed={0.1} className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
          <span className="text-[28vw] font-display font-black whitespace-nowrap select-none">EXPLORE</span>
        </ParallaxWrapper>

        <div className="relative max-w-5xl mx-auto text-center">
          <blockquote className="text-4xl md:text-7xl font-display font-black leading-[0.95] tracking-tight text-fg">
            THE <span className="text-fg-subtle">OUTDOORS</span> <br /> STANDARD.
          </blockquote>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 4 — FINAL GATEWAY
          ═══════════════════════════════════════ */}
      <section className="relative py-28 md:py-40 px-6 z-10">
        <div className="max-w-4xl mx-auto aurora-border rounded-2xl p-12 md:p-20 text-center relative overflow-hidden group">
          <div className="relative z-10">
            <h2 className="text-4xl md:text-7xl font-display font-black tracking-tight mb-12 leading-[0.95] text-fg">
              Start your <br /> <span className="aurora-text">next trip.</span>
            </h2>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Magnetic strength={0.2}>
                <Link
                  to="/register"
                  className="cursor-pointer inline-flex items-center gap-2.5 px-10 py-5 bg-primary text-on-primary rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-transform duration-200 hover:scale-[1.04] active:scale-95"
                >
                  Create account
                </Link>
              </Magnetic>
              <Magnetic strength={0.1}>
                <Link
                  to="/index"
                  className="cursor-pointer inline-flex items-center gap-2.5 px-10 py-5 border border-border-strong hover:border-secondary text-fg rounded-full font-bold text-xs uppercase tracking-[0.2em] transition-colors duration-200"
                >
                  Browse gallery
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative py-16 text-center border-t border-border z-10">
        <p className="text-xs font-semibold tracking-[0.3em] text-fg-subtle uppercase">
          Crafted for people who sleep under the stars
        </p>
      </footer>
    </div>
  );
}
