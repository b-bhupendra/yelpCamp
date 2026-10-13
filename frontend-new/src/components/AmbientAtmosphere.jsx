import React, { useEffect, useRef } from 'react';

/**
 * AMBIENT ATMOSPHERE — a single-canvas sky/star/aurora layer.
 * Now uses the Aurora UI palette (sky blue → cyan → adventure orange) and
 * pauses when the tab is hidden or the user prefers reduced motion.
 */
export default function AmbientAtmosphere() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf;
    let W, H;
    let running = true;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const STAR_COUNT = 220;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.85,
      r: 0.5 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.1 + Math.random() * 0.3,
    }));

    let t = 0;

    const paint = () => {
      // 1. Sky gradient — deep ink into a faint aurora haze
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#04070f');
      skyGrad.addColorStop(0.55, '#070c18');
      skyGrad.addColorStop(1, '#050a14');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      const scale = Math.max(W / 1920, 0.6);

      // 2. Stars
      stars.forEach((s) => {
        const opacity = reduced ? 0.55 : 0.2 + 0.8 * Math.abs(Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(186, 214, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r * scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Aurora bands — sky blue + a warm orange ember low on the horizon
      const auroraY = H * 0.28;
      const band = ctx.createLinearGradient(0, auroraY - 220 * scale, 0, auroraY + 420 * scale);
      const intensity = reduced ? 0.05 : 0.04 + 0.02 * Math.sin(t * 0.5);
      band.addColorStop(0, 'rgba(56, 189, 248, 0)');
      band.addColorStop(0.45, `rgba(14, 165, 233, ${intensity})`);
      band.addColorStop(0.72, `rgba(103, 232, 249, ${intensity * 0.7})`);
      band.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, auroraY - 220 * scale, W, 640 * scale);

      const ember = ctx.createLinearGradient(0, H * 0.72, 0, H);
      ember.addColorStop(0, 'rgba(234, 88, 12, 0)');
      ember.addColorStop(1, `rgba(234, 88, 12, ${intensity * 0.6})`);
      ctx.fillStyle = ember;
      ctx.fillRect(0, H * 0.72, W, H * 0.28);
    };

    const draw = () => {
      if (!running) return;
      t += 0.005;
      paint();
      raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      const hidden = document.hidden;
      if (hidden && running) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!hidden && !running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (reduced) {
      paint(); // single static frame
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-background">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
    </div>
  );
}
