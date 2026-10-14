import React, { useRef, useState, useEffect } from 'react';

/**
 * MAGNETIC — subtle pointer-follow for premium feel.
 * Disabled for touch/fine-pointer-mismatch and reduced-motion users.
 */
export default function Magnetic({ children, strength = 0.5 }) {
  const ref = useRef(null);
  const rectRef = useRef(null);
  const rafId = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(fine && !reduced);
  }, []);

  const handleMouseEnter = () => {
    if (!enabled || !ref.current) return;
    rectRef.current = ref.current.getBoundingClientRect();
    ref.current.style.transition = 'none';
  };

  const handleMouseMove = (e) => {
    if (!enabled || !ref.current) return;
    if (!rectRef.current) {
      rectRef.current = ref.current.getBoundingClientRect();
    }
    const { left, top, width, height } = rectRef.current;
    const x = (e.clientX - (left + width / 2)) * strength;
    const y = (e.clientY - (top + height / 2)) * strength;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    });
  };

  const handleMouseLeave = () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rectRef.current = null;
    if (ref.current) {
      ref.current.style.transition = 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
      ref.current.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="magnetic-wrap"
    >
      {children}
    </div>
  );
}
