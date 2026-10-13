import React, { useEffect, useRef, useMemo } from 'react';

/**
 * AMBIENT ATMOSPHERE [INDUSTRY ARTFORM EDITION]
 * A high-performance background layer focusing only on sky, stars, and auroras.
 * Uses a single canvas with minimal overhead to ensure 60FPS across all devices.
 */
export default function AmbientAtmosphere() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let raf;
    let W, H;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Optimized Star Data
    const STAR_COUNT = 250;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.8,
      r: 0.5 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.1 + Math.random() * 0.3
    }));

    let t = 0;

    const draw = () => {
      t += 0.005;
      
      // 1. SKY GRADIENT (Static-ish)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#020008');
      skyGrad.addColorStop(0.5, '#040112');
      skyGrad.addColorStop(1, '#06030a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      const scale = Math.max(W/1920, 0.6);

      // 2. STARS (Twinkle)
      stars.forEach(s => {
        const opacity = 0.2 + 0.8 * Math.sin(t * s.speed + s.phase);
        ctx.fillStyle = `rgba(180, 190, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r * scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. AURORA BANDS (Ethereal)
      const auroraY = H * 0.3;
      const auroraGrad = ctx.createLinearGradient(0, auroraY - 200*scale, 0, auroraY + 400*scale);
      const intensity = 0.04 + 0.02 * Math.sin(t * 0.5);
      auroraGrad.addColorStop(0, 'rgba(100, 60, 255, 0)');
      auroraGrad.addColorStop(0.5, `rgba(70, 40, 180, ${intensity})`);
      auroraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auroraGrad;
      ctx.fillRect(0, auroraY - 200*scale, W, 600*scale);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#020008]">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
    </div>
  );
}
