import React, { useEffect, useRef, useState } from 'react';

/**
 * CUSTOM CURSOR — additive accent, never a replacement.
 *
 * The system cursor stays visible (we never set `cursor: none`), so the
 * pointer is always usable even if this component fails or is disabled.
 * This layer adds a soft aurora glow + ring that reacts to interactive
 * elements. It is:
 *   • only mounted for fine pointers (hover:hover + pointer:fine),
 *   • disabled under prefers-reduced-motion,
 *   • pointer-events:none and aria-hidden so it never blocks or confuses.
 */
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false); // hovering an interactive element
  const [down, setDown] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        setPosition({ x: e.clientX, y: e.clientY });
        raf.current = 0;
      });
    };
    const onOver = (e) => {
      const el = e.target instanceof Element ? e.target.closest('a, button, [role="button"], input, textarea, select, label') : null;
      setActive(Boolean(el));
    };
    const onDown = () => setDown(true);
    const onUp = () => setDown(false);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Aurora glow trail */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9998] h-56 w-56 rounded-full opacity-25 blur-[80px] transition-opacity duration-300"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
          background: 'radial-gradient(circle, rgba(56,189,248,0.45) 0%, rgba(234,88,12,0.12) 45%, transparent 70%)',
        }}
      />
      {/* Ring */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999] flex items-center justify-center rounded-full border transition-[width,height,opacity,border-color] duration-200 ease-out"
        style={{
          width: active ? 44 : 22,
          height: active ? 44 : 22,
          borderColor: active ? 'rgba(56,189,248,0.9)' : 'rgba(234,242,251,0.55)',
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(${down ? 0.8 : 1})`,
          backgroundColor: active ? 'rgba(56,189,248,0.08)' : 'transparent',
        }}
      />
    </>
  );
}
