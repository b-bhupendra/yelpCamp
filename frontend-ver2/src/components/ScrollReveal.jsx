import React, { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal — UI/UX Pro Max animated reveal wrapper.
 * Automatically respects prefers-reduced-motion, handles staggered delays,
 * and provides smooth kinetic reveals on scroll.
 */
export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  duration = 800,
  variant = 'fade-up', // 'fade-up' | 'fade-scale' | 'fade-in'
  threshold = 0.15,
  as: Component = 'div',
  ...props
}) {
  const ref = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    // Respect user's motion preferences
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsRevealed(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  const getVariantStyles = () => {
    if (isRevealed) {
      return {
        opacity: 1,
        transform: 'none',
        filter: 'blur(0px)',
      };
    }

    switch (variant) {
      case 'fade-scale':
        return {
          opacity: 0,
          transform: 'scale(0.94) translateY(28px)',
          filter: 'blur(6px)',
        };
      case 'fade-in':
        return {
          opacity: 0,
          transform: 'none',
          filter: 'blur(6px)',
        };
      case 'fade-up':
      default:
        return {
          opacity: 0,
          transform: 'translateY(36px)',
          filter: 'blur(8px)',
        };
    }
  };

  return (
    <Component
      ref={ref}
      className={`will-change-[transform,opacity,filter] ${className}`}
      style={{
        ...getVariantStyles(),
        transitionProperty: 'opacity, transform, filter',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delay}ms`,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
