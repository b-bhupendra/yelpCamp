import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, MeshDistortMaterial, ContactShadows } from '@react-three/drei';
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
        animate={{
          rotateX: mousePosition.y * 0.5,
          rotateY: mousePosition.x * 0.5,
        }}
        transition={{ type: 'spring', stiffness: 50, damping: 20, mass: 1.5 }}
        castShadow
      >
        <icosahedronGeometry args={[1.5, 64]} />
        <MeshDistortMaterial
          color="#dff1fb"
          roughness={0.12}
          metalness={0.9}
          distort={0.4}
          speed={1.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
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

  const scaleFg = useTransform(smoothProgress, [0, 1], [1, 1.15]);
  const yFg = useTransform(smoothProgress, [0, 1], [0, 140]);
  const opacityFg = useTransform(smoothProgress, [0, 0.8], [1, 0]);
  const yBg = useTransform(smoothProgress, [0, 1], [0, 70]);

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
      className="relative w-full h-[120vh] overflow-hidden bg-transparent"
    >
      {/* LAYER 0: ENCHANTED SKY & MOON BACKDROP */}
      <motion.div
        style={reduced ? undefined : { y: yBg }}
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none"
        aria-hidden="true"
      >
        <img
          src="/images/enchanted_bg.png"
          alt=""
          className="w-full h-full object-cover object-center opacity-40 mix-blend-screen filter brightness-90 saturate-125"
        />
        {/* Soft atmospheric gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </motion.div>

      {/* LAYER 1: hardware-accelerated canvas */}
      <div className="absolute inset-0 z-10" aria-hidden="true">
        <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          frameloop={reduced ? 'demand' : 'always'}
        >
          <ambientLight intensity={0.25} />
          {/* Aurora key + rim light */}
          <directionalLight position={[4, 5, 3]} intensity={1.1} color="#38bdf8" />
          <directionalLight position={[-5, -2, -4]} intensity={0.7} color="#ea580c" />
          <Environment preset="studio" />

          <LiquidChromeGeometry mousePosition={reduced ? { x: 0, y: 0 } : mousePosition} />

          <ContactShadows
            position={[0, -2, 0]}
            opacity={0.5}
            scale={10}
            blur={2}
            far={4}
            color="#000000"
          />
        </Canvas>
        </CanvasErrorBoundary>
      </div>

      {/* LAYER 2: typography */}
      <motion.div
        style={reduced ? undefined : { y: yText, opacity: opacityText }}
        className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-4"
      >
        <h1 className="text-[clamp(3.5rem,14vw,13rem)] font-display font-black tracking-[-0.03em] leading-[0.85] text-center text-fg">
          Yelp<br />Camp
        </h1>
      </motion.div>

      {/* LAYER 3: ENCHANTED FOREST SILHOUETTE FOREGROUND FRAME */}
      <motion.div
        style={reduced ? undefined : { y: yFg, scale: scaleFg, opacity: opacityFg }}
        className="absolute inset-0 z-25 pointer-events-none flex items-center justify-center overflow-hidden select-none"
        aria-hidden="true"
      >
        <motion.img
          src="/images/enchanted_fg.png"
          alt="Enchanted forest frame"
          animate={reduced ? undefined : {
            x: mousePosition.x * -16,
            y: mousePosition.y * -10,
          }}
          transition={{ type: 'spring', stiffness: 45, damping: 22, mass: 1 }}
          className="w-full h-full object-cover object-center opacity-90 filter drop-shadow-[0_0_40px_rgba(56,189,248,0.22)]"
        />
        {/* Soft edge vignette to blend seamlessly into background */}
        <div className="absolute inset-0 bg-radial from-transparent via-transparent to-background/50 pointer-events-none" />
      </motion.div>

      {/* Fade into the rest of the page */}
      <div className="absolute bottom-0 w-full h-[20vh] bg-gradient-to-t from-background to-transparent z-30" />
    </div>
  );
}
