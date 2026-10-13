import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import SleekMasterpieceHero from '../components/SleekMasterpieceHero';
import CampHorizon from '../components/CampHorizon';
import CampsiteBento from '../components/CampsiteBento';
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

/* Campsite features shown on the first screen */
const HERO_FEATURES = [
  { Icon: Icon.Moon, label: 'Dark-sky sites' },
  { Icon: Icon.Droplet, label: 'Riverside pitches' },
  { Icon: Icon.Flame, label: 'Fire pits' },
  { Icon: Icon.Tree, label: 'Forest clearings' },
  { Icon: Icon.Tent, label: 'Tent & RV' },
];

export default function Landing() {
  return (
    <div className="bg-background text-fg selection:bg-secondary/30 font-sans">

      {/* ── AMBIENT ATMOSPHERE LAYER (starry sky + aurora) ── */}
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <AmbientAtmosphere />
      </div>

      {/* ═══════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════ */}
      <section className="relative h-screen flex flex-col justify-end overflow-hidden pb-[19vh] md:pb-[18vh]">
        {/* Camp horizon silhouette at the foot of the screen */}
        <div className="absolute inset-x-0 bottom-0 z-[5] h-[38%] pointer-events-none" aria-hidden="true">
          <CampHorizon />
        </div>

        {/* 3D globe — the centrepiece */}
        <div className="absolute inset-0 z-10">
          <SleekMasterpieceHero />
        </div>

        {/* Campsite features + CTA */}
        <div className="relative z-50 flex flex-col items-center gap-6 px-6">
          <ul className="flex flex-wrap items-center justify-center gap-2.5 max-w-3xl">
            {HERO_FEATURES.map((f) => (
              <li key={f.label}>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/55 backdrop-blur-sm px-4 py-2 text-xs font-medium text-fg-muted">
                  <f.Icon size={14} className="text-secondary" />
                  {f.label}
                </span>
              </li>
            ))}
          </ul>

          <Link
            to="/index"
            className="group relative cursor-pointer px-12 py-5 rounded-full font-bold text-xs uppercase tracking-[0.24em] text-on-primary bg-primary overflow-hidden transition-transform duration-200 hover:scale-[1.04] active:scale-95"
          >
            <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <span className="relative inline-flex items-center gap-2.5">
              Explore campsites
              <Icon.ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2 — GUIDED CAMPSITE BENTO (emerges on scroll)
          ═══════════════════════════════════════ */}
      <CampsiteBento />

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
