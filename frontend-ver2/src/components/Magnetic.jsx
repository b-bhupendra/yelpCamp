import React, { useRef, useState, useEffect } from 'react';

/**
 * MAGNETIC — subtle pointer-follow for premium feel.
 * Disabled for touch/fine-pointer-mismatch and reduced-motion users.
 */
export default function Magnetic({ children, strength = 0.5 }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(fine && !reduced);
  }, []);

  const handleMouseMove = (e) => {
    if (!enabled || !ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    setPosition({
      x: (clientX - (left + width / 2)) * strength,
      y: (clientY - (top + height / 2)) * strength,
    });
  };

  const handleMouseLeave = () => setPosition({ x: 0, y: 0 });

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="magnetic-wrap"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        transition: position.x === 0 && position.y === 0
          ? 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
          : 'none',
      }}
    >
      {children}
    </div>
  );
}
