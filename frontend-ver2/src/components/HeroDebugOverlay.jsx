import React, { useState, useEffect } from 'react';

/**
 * DEV-ONLY HERO DEBUG OVERLAY
 * Activated when URL has `?debug` (e.g. https://meadowscamp.vercel.app/?debug)
 *
 * Displays:
 *  - 1px vertical center line
 *  - Horizontal guides every 10vh
 *  - Zone markers (Nav, Eyebrow, Wordmark/Orb, Tagline, Chips, CTAs, Horizon)
 */
export default function HeroDebugOverlay() {
  const [isDebug, setIsDebug] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIsDebug(params.has('debug'));
    }
  }, []);

  if (!isDebug) return null;

  const guides = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[99999] select-none font-mono text-[10px]"
      aria-hidden="true"
    >
      {/* 1px Vertical Center Axis */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-cyan-400/80 shadow-[0_0_8px_cyan]" />

      {/* Center Label */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-400/40">
        CENTER AXIS (X: 50%)
      </div>

      {/* 10vh Horizontal Guides */}
      {guides.map((vh) => (
        <div
          key={vh}
          className="absolute left-0 right-0 border-t border-cyan-500/25 flex items-center justify-between px-2"
          style={{ top: `${vh}vh` }}
        >
          <span className="bg-slate-950/90 text-cyan-400 px-1 rounded border border-cyan-500/30">
            {vh}vh
          </span>
          <span className="bg-slate-950/90 text-cyan-400 px-1 rounded border border-cyan-500/30">
            {vh}vh
          </span>
        </div>
      ))}

      {/* Target Zone Badges */}
      <div className="absolute right-3 top-[15vh] px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-400/30">
        Zone: Eyebrow (14-17vh)
      </div>
      <div className="absolute right-3 top-[34vh] px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-400/30">
        Zone: Wordmark & Orb Center (24-44vh)
      </div>
      <div className="absolute right-3 top-[60vh] px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-400/30">
        Zone: Tagline (57-66vh)
      </div>
      <div className="absolute right-3 top-[72vh] px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-400/30">
        Zone: Chips (70-74vh)
      </div>
      <div className="absolute right-3 top-[82vh] px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-400/30">
        Zone: CTAs (78-88vh)
      </div>
    </div>
  );
}
