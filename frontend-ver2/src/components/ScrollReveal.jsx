import React, { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal — UI/UX Pro Max animated reveal wrapper.
 * Automatically respects prefers-reduced-motion, handles staggered delays,
 * and provides smooth kinetic reveals on scroll both downward and upward.
 */
export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  duration = 750,
  variant = 'fade-up', // 'fade-up' | 'fade-scale' | 'fade-in'
  threshold = 0.12,
  once = false,        // Default false so blur works scrolling BOTH down and up
  priority = false,
  as: Component = 'div',
  ...props
}) {
  const ref = useRef(null);
  const [isRevealed, setIsRevealed] = useState(priority);
  const [scrollDir, setScrollDir] = useState('down');

  useEffect(() => {
    if (priority) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsRevealed(true);
      return;
    }

    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      setScrollDir(currentY >= lastY ? 'down' : 'up');
      lastY = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          if (once) observer.unobserve(entry.target);
        } else if (!once) {
          // Re-arm blur when element exits top or bottom of viewport
          setIsRevealed(false);
        }
      },
      { threshold, rootMargin: '-40px 0px -40px 0px' }
    );

    observer.observe(element);
    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [threshold, once, priority]);

  const getVariantStyles = () => {
    if (isRevealed) {
      return {
        opacity: 1,
        transform: 'translate3d(0, 0, 0) scale(1)',
        filter: 'blur(0px)',
      };
    }

    // Directional offset: if scrolling up, enter from above (-28px); if scrolling down, enter from below (+28px)
    const yOffset = scrollDir === 'down' ? '28px' : '-28px';

    switch (variant) {
      case 'fade-scale':
        return {
          opacity: 0.15,
          transform: `translate3d(0, ${yOffset}, 0) scale(0.95)`,
          filter: 'blur(10px)',
        };
      case 'fade-in':
        return {
          opacity: 0.15,
          transform: 'translate3d(0, 0, 0)',
          filter: 'blur(10px)',
        };
      case 'fade-up':
      default:
        return {
          opacity: 0.15,
          transform: `translate3d(0, ${yOffset}, 0)`,
          filter: 'blur(10px)',
        };
    }
  };

  return (
    <Component
      ref={ref}
      className={`will-change-[transform,opacity,filter] ${priority ? 'animate-hero-entrance' : ''} ${className}`}
      style={{
        ...getVariantStyles(),
        ...(priority
          ? { animationDelay: `${delay}ms` }
          : {
              transitionProperty: 'opacity, transform, filter',
              transitionDuration: `${duration}ms`,
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: isRevealed ? `${delay}ms` : '0ms',
            }),
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
