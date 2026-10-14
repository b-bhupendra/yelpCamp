import React, { useEffect, useRef } from 'react';

/**
 * AMBIENT ATMOSPHERE — PROCEDURAL AURORA BOREALIS & NIGHT SKY
 * UI/UX Pro Max Edition
 *
 * Layers:
 *   1. Atmospheric Volumetric Mesh — Soft ambient Aurora clouds (cyan, emerald, violet, amber)
 *   2. Procedural Aurora Curtains — Real-time dynamic ribbons with vertical ray striations,
 *      harmonic wave undulation, and natural geomagnetic shimmering
 *   3. Star Field — 3-depth parallax twinkling stars with warm hero stars and soft bokeh
 *   4. Shooting Stars — Occasional meteors with velocity-decayed tails
 *   5. Vignette & Depth Mask
 *
 * Automatically respects prefers-reduced-motion (calm static luminous sky)
 * and pauses canvas rendering when the browser tab is hidden.
 */

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const STAR_LAYERS = [
  { count: 140, minR: 0.4, maxR: 0.9, depth: 0.35, twinkle: 0.45, alpha: 0.55 },
  { count: 75, minR: 0.7, maxR: 1.4, depth: 0.7, twinkle: 0.7, alpha: 0.8 },
  { count: 32, minR: 1.1, maxR: 2.0, depth: 1.1, twinkle: 1.0, alpha: 1.0 },
];

export default function AmbientAtmosphere() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = window.innerWidth;
    let H = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let running = true;
    let t = 0;

    // Mouse parallax target & smoothed position
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };

    // Initialize stars
    const rand = rng(20261014);
    const stars = [];
    STAR_LAYERS.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: rand(),
          y: rand() * 0.95,
          r: layer.minR + rand() * (layer.maxR - layer.minR),
          depth: layer.depth,
          twinkle: layer.twinkle,
          alpha: layer.alpha,
          phase: rand() * Math.PI * 2,
          speed: 0.4 + rand() * 1.5,
          warm: li === 2 && rand() > 0.8,
        });
      }
    });

    // Foreground soft bokeh stars
    const bokeh = Array.from({ length: 8 }, () => ({
      x: 0.05 + rand() * 0.9,
      y: 0.05 + rand() * 0.65,
      r: 12 + rand() * 24,
      depth: 1.5,
      phase: rand() * Math.PI * 2,
      speed: 0.2 + rand() * 0.4,
      warm: rand() > 0.7,
    }));

    // Hero sparkle stars
    const heroStars = Array.from({ length: 7 }, () => ({
      x: 0.08 + rand() * 0.84,
      y: 0.06 + rand() * 0.5,
      s: 0.7 + rand() * 0.9,
      phase: rand() * Math.PI * 2,
      speed: 0.5 + rand() * 0.6,
    }));

    // Shooting stars
    let meteors = [];
    const spawnMeteor = () => {
      const fromLeft = rand() > 0.5;
      const speed = 5.5 + rand() * 4.5;
      meteors.push({
        x: (fromLeft ? -0.1 : 1.1) * W + (rand() * 0.3 - 0.15) * W,
        y: (0.02 + rand() * 0.35) * H,
        vx: (fromLeft ? 1 : -1) * speed,
        vy: speed * (0.4 + rand() * 0.28),
        len: 90 + rand() * 140,
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

    // Deep Arctic Night Sky Base
    const paintSky = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#030610');
      sky.addColorStop(0.45, '#050c1b');
      sky.addColorStop(0.75, '#050a14');
      sky.addColorStop(1, '#02050b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
    };

    /**
     * PROCEDURAL AURORA CURTAIN ENGINE
     * Renders multi-tiered undulating light ribbons with vertical ray striations.
     */
    const drawAuroraCurtains = (animate) => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const px = animate ? mouse.x * 24 : 0;
      const py = animate ? mouse.y * 12 : 0;

      // Aurora Ribbon Layers: { baseY, height, colors, speed, freq, rayFreq }
      const curtains = [
        {
          baseY: H * 0.18 + py * 0.6,
          height: Math.min(H * 0.38, 380),
          colors: [
            { pos: 0, col: 'rgba(56, 189, 248, 0)' },
            { pos: 0.2, col: 'rgba(16, 185, 129, 0.42)' },
            { pos: 0.5, col: 'rgba(56, 189, 248, 0.48)' },
            { pos: 0.8, col: 'rgba(129, 140, 248, 0.28)' },
            { pos: 1, col: 'rgba(129, 140, 248, 0)' },
          ],
          speed: 0.6,
          waveFreq: 0.0016,
          rayFreq: 0.045,
          rayIntensity: 0.4,
        },
        {
          baseY: H * 0.28 + py * 0.8,
          height: Math.min(H * 0.34, 320),
          colors: [
            { pos: 0, col: 'rgba(16, 185, 129, 0)' },
            { pos: 0.25, col: 'rgba(52, 211, 153, 0.45)' },
            { pos: 0.55, col: 'rgba(14, 165, 233, 0.50)' },
            { pos: 0.85, col: 'rgba(168, 85, 247, 0.22)' },
            { pos: 1, col: 'rgba(168, 85, 247, 0)' },
          ],
          speed: 0.85,
          waveFreq: 0.0022,
          rayFreq: 0.065,
          rayIntensity: 0.48,
        },
        {
          baseY: H * 0.38 + py,
          height: Math.min(H * 0.28, 260),
          colors: [
            { pos: 0, col: 'rgba(14, 165, 233, 0)' },
            { pos: 0.3, col: 'rgba(56, 189, 248, 0.35)' },
            { pos: 0.6, col: 'rgba(16, 185, 129, 0.32)' },
            { pos: 0.85, col: 'rgba(234, 88, 12, 0.18)' }, // subtle campfire ember harmonic
            { pos: 1, col: 'rgba(234, 88, 12, 0)' },
          ],
          speed: 1.1,
          waveFreq: 0.0028,
          rayFreq: 0.08,
          rayIntensity: 0.35,
        },
      ];

      const step = 8; // step width in pixels for ray rendering

      curtains.forEach((curtain) => {
        const time = animate ? t * curtain.speed : 1.5;

        for (let x = 0; x < W; x += step) {
          // Harmonic wave calculation
          const wave1 = Math.sin(x * curtain.waveFreq + time * 0.8 + px * 0.01) * 45;
          const wave2 = Math.cos(x * curtain.waveFreq * 1.8 - time * 0.5) * 22;
          const wave3 = Math.sin(x * curtain.waveFreq * 0.5 + time * 0.3) * 35;
          const waveY = curtain.baseY + wave1 + wave2 + wave3;

          // Vertical ray modulation (simulates geomagnetic striations)
          const rayNoise = Math.sin(x * curtain.rayFreq + time * 1.4) *
                           Math.cos(x * curtain.rayFreq * 0.6 - time * 0.9);
          const rayAlpha = Math.max(0.15, 0.65 + rayNoise * curtain.rayIntensity);
          const rayH = curtain.height * (0.8 + 0.3 * Math.sin(x * 0.01 + time));

          // Draw vertical striation gradient
          const grad = ctx.createLinearGradient(0, waveY - rayH * 0.5, 0, waveY + rayH * 0.5);
          curtain.colors.forEach((c) => {
            // Adjust alpha with ray intensity
            const match = c.col.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            if (match) {
              const [_, r, g, b, a] = match;
              const modulatedA = Math.min(1, parseFloat(a) * rayAlpha);
              grad.addColorStop(c.pos, `rgba(${r},${g},${b},${modulatedA})`);
            } else {
              grad.addColorStop(c.pos, c.col);
            }
          });

          ctx.fillStyle = grad;
          ctx.fillRect(x, waveY - rayH * 0.5, step + 1, rayH);
        }
      });

      ctx.restore();
    };

    // Draw twinkling starfield
    const drawStars = (animate) => {
      const px = animate ? mouse.x * 14 : 0;
      const py = animate ? mouse.y * 14 : 0;

      for (const s of stars) {
        const tw = animate ? 0.55 + 0.45 * Math.sin(t * s.speed + s.phase) : 0.8;
        const a = s.alpha * tw;
        const x = s.x * W + px * s.depth;
        const y = s.y * H + py * s.depth;

        if (s.r > 1.5) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 3.5);
          g.addColorStop(0, `rgba(214,235,255,${a * 0.5})`);
          g.addColorStop(1, 'rgba(214,235,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = s.warm
          ? `rgba(255,226,190,${a})`
          : `rgba(219,234,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Foreground bokeh stars
      for (const b of bokeh) {
        const pulse = animate ? 0.55 + 0.45 * Math.sin(t * b.speed + b.phase) : 0.7;
        const x = b.x * W + px * b.depth;
        const y = b.y * H + py * b.depth;
        const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        g.addColorStop(0, b.warm ? `rgba(255,228,196,${0.09 * pulse})` : `rgba(200,228,255,${0.09 * pulse})`);
        g.addColorStop(0.6, b.warm ? `rgba(255,228,196,${0.03 * pulse})` : `rgba(200,228,255,${0.03 * pulse})`);
        g.addColorStop(1, 'rgba(200,228,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hero stars with sparkles
      for (const h of heroStars) {
        const pulse = animate ? 0.5 + 0.5 * Math.sin(t * h.speed + h.phase) : 0.75;
        const x = h.x * W + px * 1.2;
        const y = h.y * H + py * 1.2;
        const arm = (7 + 6 * pulse) * h.s;
        ctx.strokeStyle = `rgba(255,255,255,${0.75 * pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - arm, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
        ctx.stroke();

        ctx.fillStyle = `rgba(255,255,255,${0.9 * pulse})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Meteors
    const stepMeteors = () => {
      if (rand() < 0.007 && meteors.length < 2) spawnMeteor();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life -= m.decay;
        if (m.life <= 0 || m.x < -100 || m.x > W + 100 || m.y > H + 100) {
          meteors.splice(i, 1);
        }
      }
    };

    const drawMeteors = () => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of meteors) {
        const tailX = m.x - (m.vx / 8) * m.len;
        const tailY = m.y - (m.vy / 8) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        g.addColorStop(0, `rgba(255,255,255,${m.life * 0.95})`);
        g.addColorStop(0.3, `rgba(56,189,248,${m.life * 0.7})`);
        g.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
      ctx.restore();
    };

    // Animation Frame Loop
    const frame = () => {
      if (!running) return;
      t += 0.016;

      // Smooth mouse parallax easing
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      paintSky();
      drawAuroraCurtains(true);
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
      drawAuroraCurtains(false);
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
      {/* Volumetric Aurora Ambient Gradient Clouds */}
      <div
        className="nebula absolute inset-0 opacity-80"
        aria-hidden="true"
        style={{
          background: [
            'radial-gradient(65% 50% at 25% 20%, rgba(16,185,129,0.18), transparent 72%)',
            'radial-gradient(55% 45% at 75% 24%, rgba(56,189,248,0.22), transparent 72%)',
            'radial-gradient(60% 48% at 50% 12%, rgba(129,140,248,0.16), transparent 75%)',
            'radial-gradient(45% 35% at 65% 65%, rgba(234,88,12,0.10), transparent 70%)',
          ].join(','),
        }}
      />

      {/* Real-time Procedural Aurora Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full block" />

      {/* Ambient Vignette & Depth Mask */}
      <div className="absolute inset-0 shadow-[inset_0_0_160px_rgba(2,5,11,0.85)] pointer-events-none" />
    </div>
  );
}
