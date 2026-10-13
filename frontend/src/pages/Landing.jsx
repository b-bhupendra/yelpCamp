import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AmbientAtmosphere from '../components/AmbientAtmosphere';
import SleekMasterpieceHero from '../components/SleekMasterpieceHero';
import Magnetic from '../components/Magnetic';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';

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
   PARALLAX LAYER COMPONENT
   ─────────────────────────────────────────── */
function ParallaxWrapper({ speed = 0.5, children, className = "" }) {
  const layerRef = useRef(null);
  const [ref, visible] = useKineticReveal(0.01);
  const requestRef = useRef();

  useEffect(() => {
    const onScroll = () => {
      if (!visible || !layerRef.current) return;
      if (requestRef.current) return;
      
      requestRef.current = requestAnimationFrame(() => {
        const offset = window.pageYOffset * speed;
        if (layerRef.current) {
          layerRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
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
      ref={(el) => {
        layerRef.current = el;
        ref.current = el;
      }} 
      className={`${className} will-change-transform gpu`}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────────────────────
   BENTÔ CARD COMPONENT
   ─────────────────────────────────────────── */
function BentoCard({ children, className = "", delay = 0 }) {
  const [ref, visible] = useKineticReveal(0.2);
  return (
    <div
      ref={ref}
      className={`bento-card group p-10 flex flex-col justify-between legend-reveal ${visible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Landing() {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    setHeroVisible(true);
  }, []);

  return (
    <div className="bg-[#050505] text-white selection:bg-white/20 font-sans">
      
      {/* ── AMBIENT ATMOSPHERE LAYER ── */}
      <div className="fixed inset-0 z-0">
        <AmbientAtmosphere />
      </div>

      {/* ═══════════════════════════════════════
          SECTION 1 — INDUSTRY ARTFORM HERO
          ═══════════════════════════════════════ */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        
        {/* Hardware-Accelerated 3D Scene */}
        <div className="absolute inset-0 z-10">
          <SleekMasterpieceHero />
        </div>

        {/* Narrative Title (High Index) */}
        {/* 
          A single, brutally minimal CTA floating far below the Hero. 
        */}
        <div className="relative z-50 flex justify-center pb-20 mt-[-10vh]">
          <Link
            to="/index"
            className="group relative px-16 py-6 border border-white/10 text-white rounded-full font-black text-[10px] uppercase tracking-[0.4em] transition-all duration-500 hover:border-white/30 backdrop-blur-md overflow-hidden"
          >
            <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
            <span className="relative mix-blend-difference group-hover:text-black transition-colors duration-500 text-white">Explore Reality</span>
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2 — THE BENTÔ SHOWCASE
          ═══════════════════════════════════════ */}
      <section className="relative py-48 px-6 max-w-7xl mx-auto z-10">
        <div className="text-center mb-32">
          <p className="text-[9px] font-black tracking-[1em] text-white/30 uppercase mb-8">Architecture</p>
          <h2 className="text-5xl md:text-8xl font-display font-black tracking-tighter leading-[0.85] mb-10 text-white/90">
            Precision, <br />
            <span className="text-white">Redefined.</span>
          </h2>
          <p className="text-xl text-white/30 max-w-2xl mx-auto font-light leading-relaxed">
            Operating system for elite explorers tracking the world's most elusive sanctuaries. Precision, redefined.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-8 h-auto md:h-[1000px]">
          
          <BentoCard className="md:col-span-2 md:row-span-2 glass-titanium group" delay={100}>
             <div className="absolute inset-0 z-0">
               <img src="https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=1200" className="w-full h-full object-cover opacity-10 group-hover:scale-105 transition-transform duration-1000 grayscale select-none" alt="" />
               <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
             </div>
             <div className="relative z-10 mt-auto">
               <span className="text-[9px] font-black tracking-[0.8em] text-white/40 uppercase">A 01 — COMMAND</span>
               <h3 className="text-5xl font-display font-black mt-6 mb-6 tracking-tighter">Precision <br /> Tracking</h3>
               <p className="text-sm text-white/30 max-w-sm leading-relaxed font-light">
                 Coordinate wishlists and verified intelligence from a single obsidian dashboard.
               </p>
             </div>
          </BentoCard>

          <BentoCard className="md:col-span-2 md:row-span-1 glass-titanium-solid group overflow-hidden" delay={200}>
             <div className="flex gap-12 items-center h-full relative z-10">
                <div className="flex-1">
                  <span className="text-[9px] font-black tracking-[0.8em] text-white/40 uppercase">A 02 — SYNC</span>
                  <h3 className="text-4xl font-display font-black mt-4 mb-4 tracking-tighter">Squad Sync</h3>
                  <p className="text-sm text-white/20 leading-relaxed font-light">
                    Synchronize trails and vet locations with your expedition team.
                  </p>
                </div>
                <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center text-2xl bg-white/[0.02] text-white/60 group-hover:bg-white text-black transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] select-none cursor-default">
                  ❖
                </div>
             </div>
          </BentoCard>

          <BentoCard className="md:col-span-1 md:row-span-1 glass-titanium-solid" delay={300}>
             <div className="text-3xl font-black mb-6 text-white tracking-tighter">1.2K+</div>
             <h3 className="text-xl font-display font-bold mb-3 tracking-tight">Verified Sites</h3>
             <p className="text-xs text-white/20 leading-relaxed font-light">Vetted by top-tier global scouts.</p>
          </BentoCard>

          <BentoCard className="md:col-span-1 md:row-span-1 glass-titanium" delay={400}>
             <div className="text-3xl font-black mb-6 text-white tracking-tighter">52K</div>
             <h3 className="text-xl font-display font-bold mb-3 tracking-tight">Explorers</h3>
             <p className="text-xs text-white/20 leading-relaxed font-light">Exclusive network of architects.</p>
          </BentoCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 3 — THE STATEMENT
          ═══════════════════════════════════════ */}
      <section className="relative py-72 px-6 overflow-hidden z-10">
        <ParallaxWrapper speed={0.1} className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
           <span className="text-[30vw] font-display font-black whitespace-nowrap select-none">COMMAND</span>
        </ParallaxWrapper>

        <div className="relative max-w-5xl mx-auto text-center">
           <blockquote className="text-5xl md:text-8xl font-display font-black leading-[0.85] tracking-tighter text-white/90">
             THE <span className="text-white/40">INDUSTRY</span> <br /> STANDARD.
           </blockquote>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 4 — FINAL GATEWAY
          ═══════════════════════════════════════ */}
      <section className="relative py-60 px-6 z-10">
        <div className="max-w-4xl mx-auto glass-titanium rounded-[2rem] p-24 md:p-32 text-center relative overflow-hidden group">
           <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
           
           <div className="relative z-10">
             <h2 className="text-5xl md:text-8xl font-display font-black tracking-tighter mb-16 leading-[0.85]">
               Deploy <br /> <span className="text-white/40">Now.</span>
             </h2>
             
             <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
                <Magnetic strength={0.2}>
                  <Link
                    to="/register"
                    className="px-16 py-6 bg-white text-black rounded-full font-black text-[9px] uppercase tracking-[0.4em] transition-all duration-500 hover:bg-white/80"
                  >
                    Deploy Now
                  </Link>
                </Magnetic>
                <Magnetic strength={0.1}>
                  <Link
                    to="/index"
                    className="px-16 py-6 border border-white/10 hover:border-white/20 text-white rounded-full font-black text-[9px] uppercase tracking-[0.4em] transition-all duration-500"
                  >
                    View Gallery
                  </Link>
                </Magnetic>
             </div>
           </div>
        </div>
      </section>

      <footer className="relative py-20 text-center border-t border-white/[0.02] z-10">
        <p className="text-[9px] font-black tracking-[1em] text-white/10 uppercase">
          Legendary Craftsmanship
        </p>
      </footer>
    </div>
  );
}
