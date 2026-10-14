import React, { useEffect, useRef, useState } from 'react';

/**
 * CUSTOM CURSOR — UI/UX Pro Max Edition
 *
 * 100% decoupled from React render cycle:
 *   • Direct DOM mutations via refs for locked 120fps fluid glide.
 *   • Easing via linear interpolation (LERP factor 0.2).
 *   • Zero expensive filter: blur() — uses hardware-accelerated radial gradients.
 *   • Seamlessly reacts to interactive elements (a, button, input) without React re-renders.
 *   • Automatically sleeps when idle and hides when cursor leaves the window.
 *   • Native system cursor remains intact for absolute accessibility and responsiveness.
 */
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const glowRef = useRef(null);
  
  const target = useRef({ x: -200, y: -200 });
  const current = useRef({ x: -200, y: -200 });
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  const isHovered = useRef(false);
  const isDown = useRef(false);
  const isVisible = useRef(false);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;
    let isRunning = false;
    const LERP = 0.2;
    const SCALE_LERP = 0.25;

    const render = () => {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      const ds = targetScale.current - currentScale.current;

      // Sleep on idle when cursor has converged
      if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08 && Math.abs(ds) < 0.005) {
        current.current.x = target.current.x;
        current.current.y = target.current.y;
        currentScale.current = targetScale.current;
        const tx = target.current.x;
        const ty = target.current.y;
        const cs = targetScale.current;

        if (dotRef.current) {
          dotRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
        }
        if (ringRef.current) {
          ringRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%) scale(${cs})`;
        }
        if (glowRef.current) {
          glowRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
        }
        isRunning = false;
        return;
      }

      current.current.x += dx * LERP;
      current.current.y += dy * LERP;
      currentScale.current += ds * SCALE_LERP;

      const tx = target.current.x;
      const ty = target.current.y;
      const cx = current.current.x;
      const cy = current.current.y;
      const cs = currentScale.current;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${cs})`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      }

      rafId = requestAnimationFrame(render);
    };

    const wakeAnimation = () => {
      if (!isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(render);
      }
    };

    const updateScaleAndTheme = () => {
      if (isDown.current) {
        targetScale.current = 0.8;
      } else if (isHovered.current) {
        targetScale.current = 1.7;
      } else {
        targetScale.current = 1;
      }

      if (ringRef.current) {
        if (isHovered.current) {
          ringRef.current.style.borderColor = 'rgba(56, 189, 248, 0.95)';
          ringRef.current.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
          ringRef.current.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.4)';
        } else {
          ringRef.current.style.borderColor = 'rgba(234, 242, 251, 0.5)';
          ringRef.current.style.backgroundColor = 'transparent';
          ringRef.current.style.boxShadow = 'none';
        }
      }

      wakeAnimation();
    };

    const setVisibility = (visible) => {
      isVisible.current = visible;
      const opacityVal = visible ? '1' : '0';
      if (dotRef.current) dotRef.current.style.opacity = visible ? '0.9' : '0';
      if (ringRef.current) ringRef.current.style.opacity = opacityVal;
      if (glowRef.current) glowRef.current.style.opacity = visible ? '0.6' : '0';
    };

    const onMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;

      if (!isVisible.current) {
        current.current.x = e.clientX;
        current.current.y = e.clientY;
        setVisibility(true);
      }
      wakeAnimation();
    };

    const onOver = (e) => {
      const interactive = e.target instanceof Element && e.target.closest('a, button, [role="button"], input, textarea, select, label, .cursor-pointer');
      const shouldHover = Boolean(interactive);
      if (isHovered.current !== shouldHover) {
        isHovered.current = shouldHover;
        updateScaleAndTheme();
      }
    };

    const onDown = () => {
      isDown.current = true;
      updateScaleAndTheme();
    };

    const onUp = () => {
      isDown.current = false;
      updateScaleAndTheme();
    };

    const onLeave = () => {
      setVisibility(false);
    };

    const onEnter = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      current.current.x = e.clientX;
      current.current.y = e.clientY;
      setVisibility(true);
      wakeAnimation();
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    document.addEventListener('mouseleave', onLeave, { passive: true });
    document.addEventListener('mouseenter', onEnter, { passive: true });

    wakeAnimation();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* 1. Ethereal Aurora Ambient Glow (pure hardware-accelerated radial gradient without filter blur) */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9997] h-48 w-48 rounded-full will-change-transform transition-opacity duration-300"
        style={{
          opacity: 0,
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(14, 165, 233, 0.10) 35%, rgba(234, 88, 12, 0.03) 65%, transparent 75%)',
        }}
      />

      {/* 2. Fluid Trailing Ring with dynamic scale & spring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9998] h-7 w-7 rounded-full border border-sky-200/50 will-change-transform transition-[border-color,background-color,box-shadow] duration-200 ease-out"
        style={{
          opacity: 0,
        }}
      />

      {/* 3. High-precision luminous core dot that sticks directly to the cursor tip */}
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-1.5 w-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(56,189,248,0.9)] will-change-transform transition-opacity duration-200"
        style={{
          opacity: 0,
        }}
      />
    </>
  );
}
