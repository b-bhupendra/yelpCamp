import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Float, MeshDistortMaterial, ContactShadows } from '@react-three/drei';
import { motion as motion3d } from 'framer-motion-3d';
import CanvasErrorBoundary from './CanvasErrorBoundary';

/**
 * THE HERO CENTERPIECE — liquid-chrome geometry lit by the aurora palette.
 * Reacts physically to the pointer for a weighty, premium feel.
 */
function LiquidChromeGeometry({ mousePosition }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <motion3d.mesh
        ref={meshRef}
        position={[0, 0.42, 0]}
        animate={{
          rotateX: mousePosition.y * 0.5,
          rotateY: mousePosition.x * 0.5,
        }}
        transition={{ type: 'spring', stiffness: 50, damping: 20, mass: 1.5 }}
        castShadow
      >
        <icosahedronGeometry args={[1.15, 64]} />
        <MeshDistortMaterial
          color="#0b2740"
          emissive="#0ea5e9"
          emissiveIntensity={0.28}
          roughness={0.38}
          metalness={0.5}
          distort={0.32}
          speed={1.5}
          clearcoat={0.5}
          clearcoatRoughness={0.35}
        />
      </motion3d.mesh>
    </Float>
  );
}

export default function SleekMasterpieceHero() {
  const containerRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 70, damping: 20 });
  const yText = useTransform(smoothProgress, [0, 1], [0, 400]);
  const opacityText = useTransform(smoothProgress, [0, 0.5], [1, 0]);

  const handleMouseMove = (e) => {
    if (reduced) return;
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth) * 2 - 1;
    const y = -(clientY / innerHeight) * 2 + 1;
    setMousePosition({ x, y });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-[120vh] overflow-hidden"
    >
      {/* ── ATMOSPHERIC CAMPSITE HINT LAYER (blurred, faded, ambient glow) ── */}
      <div 
        className="pointer-events-none absolute inset-0 z-[4] overflow-hidden select-none"
        aria-hidden="true"
      >
        {/* Softly blurred campsite backdrop with subtle parallax response */}
        <motion.div 
          style={reduced ? undefined : {
            y: useTransform(smoothProgress, [0, 1], [0, 140]),
            opacity: useTransform(smoothProgress, [0, 0.7], [0.85, 0.2]),
          }}
          className="absolute inset-0 w-full h-full"
        >
          <div
            className="absolute inset-0 w-full h-full bg-center bg-cover transition-transform duration-700 ease-out"
            style={{
              backgroundImage: 'url(/images/campsite-hero.jpg)',
              filter: 'blur(3px) brightness(0.62) saturate(1.28)',
              transform: reduced 
                ? 'scale(1.04)' 
                : `scale(1.08) translate3d(${mousePosition.x * -16}px, ${mousePosition.y * -16}px, 0)`,
              maskImage: 'radial-gradient(ellipse 95% 82% at 50% 52%, black 42%, rgba(0,0,0,0.6) 72%, transparent 98%)',
              WebkitMaskImage: 'radial-gradient(ellipse 95% 82% at 50% 52%, black 42%, rgba(0,0,0,0.6) 72%, transparent 98%)',
            }}
          />
        </motion.div>

        {/* Campfire warmth & ember hearth illumination */}
        <div 
          className="absolute bottom-[24%] left-1/2 -translate-x-1/2 w-[70vw] max-w-[750px] h-[360px] rounded-full pointer-events-none ch-glow"
          style={{
            background: 'radial-gradient(circle, rgba(234, 88, 12, 0.32) 0%, rgba(251, 146, 60, 0.14) 42%, transparent 72%)',
            filter: 'blur(55px)',
          }}
        />

        {/* Northern lights aurora haze overlay */}
        <div 
          className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[88vw] max-w-[1100px] h-[440px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(14, 165, 233, 0.10) 48%, transparent 75%)',
            filter: 'blur(75px)',
          }}
        />

        {/* Cinematic subtle vignette gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/85" />
      </div>

      {/* LAYER 1: hardware-accelerated canvas */}
      <div className="absolute inset-0 z-10" aria-hidden="true">
        <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 6.5], fov: 45 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          frameloop={reduced ? 'demand' : 'always'}
        >
          <ambientLight intensity={0.14} />
          {/* Aurora key + warm rim light */}
          <directionalLight position={[4, 5, 3]} intensity={0.6} color="#38bdf8" />
          <directionalLight position={[-5, -2, -4]} intensity={0.5} color="#ea580c" />

          {/* Self-contained image-based lighting — no remote HDRI fetch,
              so the hero renders offline and behind strict networks. */}
          <Environment resolution={256}>
            <Lightformer intensity={1.6} position={[0, 6, -9]} scale={[10, 10, 1]} color="#38bdf8" />
            <Lightformer intensity={1.2} position={[-6, 1, -2]} scale={[10, 10, 1]} color="#ea580c" />
            <Lightformer intensity={0.8} position={[6, 1, -2]} scale={[10, 10, 1]} color="#67e8f9" />
            <Lightformer intensity={0.5} position={[0, -5, 2]} scale={[10, 10, 1]} color="#0ea5e9" />
            <Lightformer intensity={0.22} position={[0, 2, 6]} scale={[8, 8, 1]} color="#ffffff" />
          </Environment>

          {/* Warm cross-light from the campfire below — cinematic blue/amber contrast */}
          <pointLight position={[0, -2.6, 2.6]} intensity={1.7} distance={11} decay={2} color="#ea580c" />

          <LiquidChromeGeometry mousePosition={reduced ? { x: 0, y: 0 } : mousePosition} />

          <ContactShadows
            position={[0, -2, 0]}
            opacity={0.35}
            scale={10}
            blur={2}
            far={4}
            color="#000000"
          />
        </Canvas>
        </CanvasErrorBoundary>
      </div>

      {/* Aurora light spill — ties the orb to the surrounding sky */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[15] h-[76vh] w-[76vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(56,189,248,0.20) 0%, rgba(14,165,233,0.10) 38%, rgba(234,88,12,0.10) 62%, transparent 72%)',
          filter: 'blur(50px)',
        }}
      />

      {/* LAYER 2: typography */}
      <motion.div
        style={reduced ? undefined : { y: yText, opacity: opacityText }}
        className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-[14vh] md:pt-[15vh] pointer-events-none px-4"
      >
        <span className="inline-flex items-center gap-2 px-3.5 py-1 mb-4 rounded-full border border-sky-400/20 bg-background/60 backdrop-blur-md text-[11px] font-bold uppercase tracking-[0.25em] text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
          Under the Stars & Aurora
        </span>
        <h1 className="text-[clamp(3.5rem,13vw,12rem)] font-display font-black tracking-[-0.03em] leading-[0.85] text-center text-fg [text-shadow:0_4px_60px_rgba(3,7,18,0.95)]">
          Yelp<br />Camp
        </h1>
      </motion.div>

      {/* Fade into the rest of the page */}
      <div className="absolute bottom-0 w-full h-[24vh] bg-gradient-to-t from-background via-background/60 to-transparent z-30 pointer-events-none" />
    </div>
  );
}
