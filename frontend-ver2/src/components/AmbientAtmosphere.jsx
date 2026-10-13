import React, { useEffect, useRef } from 'react';

/**
 * AMBIENT ATMOSPHERE — the night sky.
 *
 * Layers:
 *   1. Nebula  — soft CSS colour clouds (sky-blue → cyan → orange ember)
 *   2. Stars   — three depth layers on a canvas, each twinkling and drifting
 *                with the pointer (parallax), so the field has real depth
 *   3. Hero stars — a few bright stars with a soft four-point sparkle
 *   4. Shooting stars — occasional meteors with a fading tail
 *   5. Aurora  — a slow ribbon drifting across the upper sky
 *   6. Vignette
 *
 * Pauses when the tab is hidden; renders a single calm frame (no parallax,
 * no meteors) under prefers-reduced-motion.
 */

// Deterministic pseudo-random so the sky is stable between renders.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const LAYERS = [
  { count: 150, minR: 0.4, maxR: 0.9, depth: 0.35, twinkle: 0.45, alpha: 0.55 },
  { count: 80, minR: 0.7, maxR: 1.4, depth: 0.7, twinkle: 0.7, alpha: 0.8 },
  { count: 34, minR: 1.1, maxR: 2.1, depth: 1.1, twinkle: 1.0, alpha: 1.0 },
];

export default function AmbientAtmosphere() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;
    let t = 0;

    // Pointer parallax target/current (normalised -1..1)
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };

    // Build the star field
    const rand = rng(20261013);
    const stars = [];
    LAYERS.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: rand(),
          y: rand() * 0.92,
          r: layer.minR + rand() * (layer.maxR - layer.minR),
          depth: layer.depth,
          twinkle: layer.twinkle,
          alpha: layer.alpha,
          phase: rand() * Math.PI * 2,
          speed: 0.4 + rand() * 1.6,
          warm: li === 2 && rand() > 0.82, // a few warm hero stars
        });
      }
    });

    // Foreground bokeh — a few large, soft, out-of-focus stars for camera depth
    const bokeh = Array.from({ length: 8 }, () => ({
      x: 0.06 + rand() * 0.88,
      y: 0.04 + rand() * 0.6,
      r: 12 + rand() * 26,
      depth: 1.6,
      phase: rand() * Math.PI * 2,
      speed: 0.25 + rand() * 0.4,
      warm: rand() > 0.7,
    }));

    // A handful of bright "hero" stars with a sparkle
    const heroStars = Array.from({ length: 7 }, () => ({
      x: 0.08 + rand() * 0.84,
      y: 0.06 + rand() * 0.5,
      s: 0.7 + rand() * 0.9,
      phase: rand() * Math.PI * 2,
      speed: 0.5 + rand() * 0.6,
    }));

    // Meteors
    let meteors = [];
    const spawnMeteor = () => {
      const fromLeft = rand() > 0.5;
      const speed = 5.5 + rand() * 4;
      meteors.push({
        x: (fromLeft ? -0.1 : 1.1) * W + (rand() * 0.3 - 0.15) * W,
        y: (0.02 + rand() * 0.34) * H,
        vx: (fromLeft ? 1 : -1) * speed,
        vy: speed * (0.42 + rand() * 0.25),
        len: 90 + rand() * 150,
        life: 1,
        decay: 0.005 + rand() * 0.004,
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const paintSky = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#04060f');
      sky.addColorStop(0.55, '#070d1b');
      sky.addColorStop(1, '#050a14');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
    };

    const drawStars = (animate) => {
      const px = animate ? mouse.x * 16 : 0;
      const py = animate ? mouse.y * 16 : 0;

      for (const s of stars) {
        const tw = animate
          ? 0.55 + 0.45 * Math.sin(t * s.speed + s.phase)
          : 0.8;
        const a = s.alpha * tw;
        const x = s.x * W + px * s.depth;
        const y = s.y * H + py * s.depth;

        if (s.r > 1.5) {
          // soft halo for the larger stars
          const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 4);
          g.addColorStop(0, `rgba(214,235,255,${a * 0.5})`);
          g.addColorStop(1, 'rgba(214,235,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = s.warm
          ? `rgba(255,226,190,${a})`
          : `rgba(219,234,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Foreground bokeh
      for (const b of bokeh) {
        const pulse = animate ? 0.55 + 0.45 * Math.sin(t * b.speed + b.phase) : 0.7;
        const x = b.x * W + px * b.depth;
        const y = b.y * H + py * b.depth;
        const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        g.addColorStop(0, b.warm ? `rgba(255,228,196,${0.10 * pulse})` : `rgba(200,228,255,${0.10 * pulse})`);
        g.addColorStop(0.6, b.warm ? `rgba(255,228,196,${0.04 * pulse})` : `rgba(200,228,255,${0.04 * pulse})`);
        g.addColorStop(1, 'rgba(200,228,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hero stars with a four-point sparkle
      for (const h of heroStars) {
        const pulse = animate ? 0.5 + 0.5 * Math.sin(t * h.speed + h.phase) : 0.75;
        const x = h.x * W + px * 1.2;
        const y = h.y * H + py * 1.2;
        const arm = (7 + 7 * pulse) * h.s;

        const glow = ctx.createRadialGradient(x, y, 0, x, y, arm * 2.4);
        glow.addColorStop(0, `rgba(226,240,255,${0.5 * pulse})`);
        glow.addColorStop(1, 'rgba(226,240,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, arm * 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(232,244,255,${0.55 * pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        ctx.stroke();

        ctx.fillStyle = `rgba(255,255,255,${0.85 * pulse})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 * h.s, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawMeteors = () => {
      for (const m of meteors) {
        const nx = m.x - m.vx * (m.len / 55);
        const ny = m.y - m.vy * (m.len / 55);

        // tail
        const grad = ctx.createLinearGradient(m.x, m.y, nx, ny);
        grad.addColorStop(0, `rgba(255,255,255,${0.95 * m.life})`);
        grad.addColorStop(0.3, `rgba(190,228,255,${0.6 * m.life})`);
        grad.addColorStop(1, 'rgba(190,228,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        // glowing head
        const head = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 16);
        head.addColorStop(0, `rgba(255,255,255,${0.95 * m.life})`);
        head.addColorStop(0.4, `rgba(200,232,255,${0.45 * m.life})`);
        head.addColorStop(1, 'rgba(200,232,255,0)');
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const stepMeteors = () => {
      for (const m of meteors) {
        m.x += m.vx;
        m.y += m.vy;
        m.life -= m.decay;
      }
      meteors = meteors.filter(
        (m) => m.life > 0 && m.x > -300 && m.x < W + 300 && m.y < H + 300
      );
      if (meteors.length < 3 && rand() < 0.02) spawnMeteor();
    };

    const frame = () => {
      if (!running) return;
      t += 0.016;
      // ease the parallax
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      paintSky();
      drawStars(true);
      stepMeteors();
      drawMeteors();

      raf = requestAnimationFrame(frame);
    };

    const onMove = (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const onVisibility = () => {
      if (document.hidden && running) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!document.hidden && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    if (reduced) {
      paintSky();
      drawStars(false);
    } else {
      window.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-background">
      {/* Nebula clouds */}
      <div
        className="nebula absolute inset-0"
        aria-hidden="true"
        style={{
          background: [
            'radial-gradient(58% 44% at 20% 24%, rgba(14,165,233,0.20), transparent 70%)',
            'radial-gradient(44% 36% at 80% 18%, rgba(103,232,249,0.13), transparent 70%)',
            'radial-gradient(52% 40% at 64% 60%, rgba(234,88,12,0.10), transparent 72%)',
            'radial-gradient(70% 52% at 46% 92%, rgba(14,165,233,0.10), transparent 76%)',
          ].join(','),
        }}
      />
      {/* Aurora ribbon */}
      <div
        className="nebula absolute left-[-10%] right-[-10%] top-[12%] h-[38%]"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(100deg, transparent 8%, rgba(56,189,248,0.14) 34%, rgba(103,232,249,0.10) 52%, rgba(234,88,12,0.08) 72%, transparent 92%)',
          filter: 'blur(46px)',
          animation: 'nebula-drift 26s ease-in-out infinite alternate',
        }}
      />
      {/* Stars + meteors */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full block" />
      {/* Vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.85)]" />
    </div>
  );
}
