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
function LiquidChromeGeometry({ mousePosition, isMobile, isTouch }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    // Gentle autonomous oscillation for touch screens
    if (isTouch) {
      meshRef.current.rotation.y = Math.sin(t * 0.45) * 0.22;
      meshRef.current.rotation.x = Math.cos(t * 0.35) * 0.14;
    }
    meshRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
  });

  const geoScale = isMobile ? 0.78 : 1.15;
  const geoY = isMobile ? 0.22 : 0.42;

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <motion3d.mesh
        ref={meshRef}
        position={[0, geoY, 0]}
        scale={[geoScale, geoScale, geoScale]}
        animate={
          isTouch
            ? undefined
            : {
                rotateX: mousePosition.y * 0.5,
                rotateY: mousePosition.x * 0.5,
              }
        }
        transition={{ type: 'spring', stiffness: 50, damping: 20, mass: 1.5 }}
        castShadow
      >
        <icosahedronGeometry args={[1, isMobile ? 32 : 64]} />
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
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, isTouch: false });

  useEffect(() => {
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqTouch = window.matchMedia('(hover: none), (pointer: coarse)');
    
    const updateDevice = () => {
      setReduced(mqReduced.matches);
      setDeviceInfo({
        isMobile: window.innerWidth < 640,
        isTouch: mqTouch.matches,
      });
    };

    updateDevice();
    window.addEventListener('resize', updateDevice);
    mqReduced.addEventListener('change', updateDevice);
    mqTouch.addEventListener('change', updateDevice);

    return () => {
      window.removeEventListener('resize', updateDevice);
      mqReduced.removeEventListener('change', updateDevice);
      mqTouch.removeEventListener('change', updateDevice);
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 70, damping: 20 });
  const yText = useTransform(smoothProgress, [0, 1], [0, 360]);
  const opacityText = useTransform(smoothProgress, [0, 0.45], [1, 0]);

  const handleMouseMove = (e) => {
    if (reduced || deviceInfo.isTouch) return;
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
      className="relative w-full min-h-[100dvh] h-[100dvh] md:h-[120vh] overflow-hidden"
    >
      {/* ── AURORA LIGHT SPILL & AMBIENT HEARTH GLOW (Allowing procedural aurora to shine) ── */}
      <div 
        className="pointer-events-none absolute inset-0 z-[4] overflow-hidden select-none"
        aria-hidden="true"
      >
        {/* Upper Aurora Ethereal Bloom (Soft, non-competing) */}
        <div 
          className="absolute top-[4%] sm:top-[6%] left-1/2 -translate-x-1/2 w-[92vw] sm:w-[80vw] max-w-[950px] h-[260px] sm:h-[380px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, rgba(56, 189, 248, 0.08) 40%, rgba(129, 140, 248, 0.04) 70%, transparent 80%)',
            filter: 'blur(70px)',
          }}
        />

        {/* Campfire warmth & ember hearth reflection from horizon */}
        <div 
          className="absolute bottom-[20%] sm:bottom-[22%] left-1/2 -translate-x-1/2 w-[85vw] sm:w-[65vw] max-w-[650px] h-[220px] sm:h-[280px] rounded-full pointer-events-none ch-glow"
          style={{
            background: 'radial-gradient(circle, rgba(234, 88, 12, 0.16) 0%, rgba(251, 146, 60, 0.06) 45%, transparent 72%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Soft twilight gradient framing */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/90" />
      </div>

      {/* LAYER 1: hardware-accelerated canvas */}
      <div className="absolute inset-0 z-10" aria-hidden="true">
        <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, deviceInfo.isMobile ? 5.8 : 6.5], fov: 45 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          dpr={deviceInfo.isMobile ? [1, 1.5] : [1, 2]}
          frameloop={reduced ? 'demand' : 'always'}
        >
          <ambientLight intensity={0.16} />
          {/* Aurora key (cyan & emerald) + warm campfire rim light */}
          <directionalLight position={[4, 5, 3]} intensity={0.65} color="#38bdf8" />
          <directionalLight position={[-4, 4, 2]} intensity={0.5} color="#10b981" />
          <directionalLight position={[-5, -2, -4]} intensity={0.55} color="#ea580c" />

          {/* Aurora + campfire image-based lighting environment */}
          <Environment resolution={deviceInfo.isMobile ? 128 : 256}>
            <Lightformer intensity={1.8} position={[0, 6, -9]} scale={[10, 10, 1]} color="#38bdf8" />
            <Lightformer intensity={1.4} position={[-5, 5, -5]} scale={[8, 8, 1]} color="#10b981" />
            <Lightformer intensity={1.2} position={[-6, 1, -2]} scale={[10, 10, 1]} color="#ea580c" />
            <Lightformer intensity={0.8} position={[6, 1, -2]} scale={[10, 10, 1]} color="#67e8f9" />
            <Lightformer intensity={0.6} position={[0, -5, 2]} scale={[10, 10, 1]} color="#0ea5e9" />
            <Lightformer intensity={0.25} position={[0, 2, 6]} scale={[8, 8, 1]} color="#ffffff" />
          </Environment>

          {/* Warm cross-light from the campfire below — cinematic blue/amber contrast */}
          <pointLight position={[0, -2.6, 2.6]} intensity={1.7} distance={11} decay={2} color="#ea580c" />

          <LiquidChromeGeometry
            mousePosition={reduced ? { x: 0, y: 0 } : mousePosition}
            isMobile={deviceInfo.isMobile}
            isTouch={deviceInfo.isTouch}
          />

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

      {/* Gentle ambient halo for 3D orb specular depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[15] h-[55vh] sm:h-[64vh] w-[55vh] sm:w-[64vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, rgba(14,165,233,0.04) 40%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* LAYER 2: typography */}
      <motion.div
        style={reduced ? undefined : { y: yText, opacity: opacityText }}
        className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-[10dvh] sm:pt-[12dvh] md:pt-[15vh] pointer-events-none px-4"
      >
        <span className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 mb-3 sm:mb-4 rounded-full border border-sky-400/20 bg-background/60 backdrop-blur-md text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] sm:tracking-[0.25em] text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
          Under the Stars & Aurora
        </span>
        <h1 className="text-[clamp(3rem,11.5vw,12rem)] font-display font-black tracking-[-0.03em] leading-[0.88] text-center text-fg [text-shadow:0_4px_60px_rgba(3,7,18,0.95)]">
          Yelp<br />Camp
        </h1>
      </motion.div>

      {/* Fade into the rest of the page */}
      <div className="absolute bottom-0 w-full h-[20vh] sm:h-[24vh] bg-gradient-to-t from-background via-background/60 to-transparent z-30 pointer-events-none" />
    </div>
  );
}
