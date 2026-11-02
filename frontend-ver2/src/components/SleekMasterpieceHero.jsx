import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Float, MeshDistortMaterial, ContactShadows } from '@react-three/drei';
import CanvasErrorBoundary from './CanvasErrorBoundary';

/**
 * THE 3D CELESTIAL ORB GEOMETRY
 * True sphere with subdivisions 64, subtle organic distortion (0.14),
 * and damped pointer interaction in the WebGL loop.
 */
function ConcentricOrbGeometry({ isMobile, isTouch }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    if (isTouch) {
      meshRef.current.rotation.y = Math.sin(t * 0.4) * 0.15;
      meshRef.current.rotation.x = Math.cos(t * 0.3) * 0.1;
    } else {
      const targetY = state.pointer.x * 0.35;
      const targetX = -state.pointer.y * 0.35;
      meshRef.current.rotation.y += (targetY - meshRef.current.rotation.y) * 0.05;
      meshRef.current.rotation.x += (targetX - meshRef.current.rotation.x) * 0.05;
    }
    meshRef.current.rotation.z = Math.sin(t * 0.4) * 0.08;
  });

  const geoScale = isMobile ? 1.45 : 1.7;

  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.35}>
      <mesh
        ref={meshRef}
        position={[0, 0, 0]}
        scale={[geoScale, geoScale, geoScale]}
      >
        {/* Sphere with 64 subdivisions */}
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color="#0b2740"
          emissive="#0ea5e9"
          emissiveIntensity={0.15}
          roughness={0.36}
          metalness={0.45}
          distort={0.14}
          speed={0.8}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
        />
      </mesh>
    </Float>
  );
}

/**
 * SLEEK MASTERPIECE HERO STACK
 * Encapsulates the Eyebrow pill, Wordmark with concentric 3D Orb, and Tagline.
 * All layers share ONE motion.div for unified scroll parallax, with the 3D orb
 * receiving a 0.6x secondary depth offset.
 */
export default function SleekMasterpieceHero() {
  const [reduced, setReduced] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({ isMobile: false, isTouch: false });
  const [canvasReady, setCanvasReady] = useState(false);

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

  const { scrollY } = useScroll();
  const smoothScroll = useSpring(scrollY, { stiffness: 80, damping: 24 });

  // Hero stack parallax
  const yStack = useTransform(smoothScroll, [0, 600], [0, 200]);
  const opacityStack = useTransform(smoothScroll, [0, 380], [1, 0]);

  // Orb canvas slower secondary offset for 0.6x relative depth (200 - 80 = 120px = 0.6x)
  const yOrbSecondary = useTransform(smoothScroll, [0, 600], [0, -80]);

  return (
    <motion.div
      style={reduced ? undefined : { y: yStack, opacity: opacityStack }}
      className="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-5xl mx-auto"
    >
      {/* ── EYEBROW PILL (12px, 600, tracking 0.22em, 24px above wordmark) ── */}
      <div className="mb-6 flex justify-center z-20">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-sky-400/25 bg-background/80 backdrop-blur-md text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.18)]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Under the Stars &amp; Aurora
        </span>
      </div>

      {/* ── WORDMARK GROUP CONCENTRIC WITH 3D ORB ── */}
      {/* Container height min(36vh, 28vw) guarantees the orb bottom aligns with group boundary */}
      <div className="relative flex items-center justify-center min-h-[min(36vh,28vw)] w-full">
        {/* 3D Orb Canvas: absolute child of wordmark group, strictly concentric */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(46vh,34vw)] min-w-[280px] sm:min-w-[340px] aspect-square overflow-visible pointer-events-auto z-0 transition-opacity duration-1000 ease-out"
          style={{
            ...(reduced ? {} : { y: yOrbSecondary }),
            opacity: canvasReady ? 1 : 0,
          }}
          aria-hidden="true"
        >
          <CanvasErrorBoundary>
            <Canvas
              onCreated={() => setCanvasReady(true)}
              camera={{ position: [0, 0, 5.2], fov: 45 }}
              gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
              dpr={deviceInfo.isMobile ? [1, 1.25] : [1, 1.5]}
              frameloop={reduced ? 'demand' : 'always'}
            >
              <ambientLight intensity={0.18} />
              {/* Aurora cyan & emerald key lights + warm campfire rim light */}
              <directionalLight position={[4, 5, 3]} intensity={0.7} color="#38bdf8" />
              <directionalLight position={[-4, 4, 2]} intensity={0.5} color="#10b981" />
              <directionalLight position={[-5, -2, -4]} intensity={0.55} color="#ea580c" />

              <Environment resolution={deviceInfo.isMobile ? 128 : 256}>
                <Lightformer intensity={1.8} position={[0, 6, -9]} scale={[10, 10, 1]} color="#38bdf8" />
                <Lightformer intensity={1.4} position={[-5, 5, -5]} scale={[8, 8, 1]} color="#10b981" />
                <Lightformer intensity={1.2} position={[-6, 1, -2]} scale={[10, 10, 1]} color="#ea580c" />
                <Lightformer intensity={0.8} position={[6, 1, -2]} scale={[10, 10, 1]} color="#67e8f9" />
                <Lightformer intensity={0.6} position={[0, -5, 2]} scale={[10, 10, 1]} color="#0ea5e9" />
                <Lightformer intensity={0.25} position={[0, 2, 6]} scale={[8, 8, 1]} color="#ffffff" />
              </Environment>

              <pointLight position={[0, -2.5, 2.5]} intensity={1.5} distance={10} decay={2} color="#ea580c" />

              <ConcentricOrbGeometry
                isMobile={deviceInfo.isMobile}
                isTouch={deviceInfo.isTouch}
              />

              <ContactShadows
                position={[0, -2, 0]}
                opacity={0.3}
                scale={9}
                blur={2}
                far={4}
                color="#000000"
              />
            </Canvas>
          </CanvasErrorBoundary>
        </motion.div>

        {/* Multi-spectrum Aurora Gradient Aura behind Meadows */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] max-w-[680px] h-[120px] sm:h-[160px] rounded-full opacity-60 mix-blend-screen blur-[50px]"
          style={{
            background: 'linear-gradient(90deg, rgba(56,189,248,0.35) 0%, rgba(14,165,233,0.25) 35%, rgba(251,191,36,0.3) 75%, rgba(234,88,12,0.2) 100%)',
          }}
          aria-hidden="true"
        />

        {/* Wordmark: Outfit 900, clamp(4rem, 10vw, 9.5rem), tracking -0.015em, line-height 1 */}
        <h1
          className="relative z-10 font-display font-black text-[clamp(4rem,10vw,9.5rem)] tracking-[-0.015em] leading-none text-center select-none"
          style={{
            background: 'linear-gradient(100deg, #ffffff 0%, #dff3ff 45%, #ffe9a8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 6px 40px rgba(3,7,18,0.7))',
          }}
        >
          Meadows
        </h1>
      </div>

      {/* ── TAGLINE (24px below wordmark group, fully OUTSIDE the orb) ── */}
      <p
        className="mt-6 text-[clamp(1.0625rem,1.3vw,1.3125rem)] font-normal text-fg/85 max-w-[34ch] text-center [text-wrap:balance] leading-[1.5] [text-shadow:0_2px_12px_rgba(3,7,18,0.9)] px-4 z-20"
      >
        Discover extraordinary campsites, secret clearings, and dark{'\u2011'}sky sanctuaries.
      </p>
    </motion.div>
  );
}
