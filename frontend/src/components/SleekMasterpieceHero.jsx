import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, MeshDistortMaterial, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { motion as motion3d } from 'framer-motion-3d';

/**
 * ─────────────────────────────────────────────────────────────────
 * THE SLEEK MASTERPIECE: LIQUID CHROME CENTERPIECE
 * 
 * An ultra-premium, abstract 3D geometry designed for high-end web experiences.
 * This component utilizes a deeply reflective physical material and reacts
 * physically to the user's mouse position using framer-motion-3d for 
 * an incredibly weighty, expensive feel.
 * 
 * @component
 * @prop {Object} mousePosition - Normalized x, y coordinates (-1 to 1)
 * ─────────────────────────────────────────────────────────────────
 */
function LiquidChromeGeometry({ mousePosition }) {
  const meshRef = useRef();

  /**
   * Internal Animation Loop (60FPS)
   * Handles the continuous idle rotation of the geometry independent
   * of the mouse interaction.
   */
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    // Subtle, continuous oceanic tilt
    meshRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      {/* 
        framer-motion-3d component.
        This seamlessly interpolates the raw mouse coordinates into 
        buttery-smooth, physics-based 3D rotations. 
      */}
      <motion3d.mesh 
        ref={meshRef}
        animate={{
          rotateX: mousePosition.y * 0.5,
          rotateY: mousePosition.x * 0.5,
        }}
        transition={{
          type: "spring",
          stiffness: 50,
          damping: 20,
          mass: 1.5
        }}
        castShadow
      >
        {/* Flawless high-poly base structure */}
        <icosahedronGeometry args={[1.5, 64]} />
        
        {/* 
          MeshDistortMaterial
          An extension of MeshPhysicalMaterial that bends the vertices over time.
          Configure roughness low and metalness high for "Liquid Metal / Chrome".
        */}
        <MeshDistortMaterial 
          color="#ffffff"
          roughness={0.1}
          metalness={0.9}
          distort={0.4} // Intensity of the liquid wobble
          speed={1.5}   // Speed of the wobble
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </motion3d.mesh>
    </Float>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────
 * SLEEK MASTERPIECE HERO COMPONENT
 * 
 * The main container for the top-tier 3D landing section. 
 * Orchestrates the massive negative space, pure typography, and 
 * the hardware-accelerated Canvas.
 * ─────────────────────────────────────────────────────────────────
 */
export default function SleekMasterpieceHero() {
  const containerRef = useRef(null);
  
  // State to track normalized mouse coordinates for the 3D physics
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  /**
   * Scroll Tracking setup.
   * Links the component's vertical scroll position to fluid 
   * parallax animations bridging the hero section and the body text.
   */
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Apply a spring to the scroll progress to remove jitter
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 70, damping: 20 });
  
  // Map smooth progress to massive Y translations
  const yText = useTransform(smoothProgress, [0, 1], [0, 400]);
  const opacityText = useTransform(smoothProgress, [0, 0.5], [1, 0]);

  /**
   * Normalizes mouse coordinates to a -1 to 1 scale 
   * with the origin (0,0) exactly at the center of the screen.
   */
  const handleMouseMove = (e) => {
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
      className="relative w-full h-[120vh] overflow-hidden bg-[#050505]" // Deep, perfect studio black
    >
      {/* 
        LAYER 1: THE STUDIO CANVAS
        Strictly hardware-accelerated. Renders the Liquid Chrome geometry
        beneath the typography.
      */}
      <div className="absolute inset-0 z-10">
        <Canvas 
          camera={{ position: [0, 0, 6], fov: 45 }} 
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} 
          dpr={[1, 2]} // High DPR allowed here due to extreme minimalism
        >
          {/* Subtle base lighting */}
          <ambientLight intensity={0.2} />
          
          {/* 
            Studio Environment
            The secret to high-end 3D. This provides image-based lighting (IBL)
            that gives the chrome its breathtaking realistic reflections.
          */}
          <Environment preset="studio" />
          
          {/* The physics-reactive geometry */}
          <LiquidChromeGeometry mousePosition={mousePosition} />

          {/* 
            Contact Shadows
            Grounds the floating geometry, adding intense realism to the
            otherwise abstract scene.
          */}
          <ContactShadows 
            position={[0, -2, 0]} 
            opacity={0.5} 
            scale={10} 
            blur={2} 
            far={4} 
            color="#000000"
          />
        </Canvas>
      </div>

      {/* 
        LAYER 2: FLAWLESS TYPOGRAPHY
        Rests perfectly center. Massive negative space. Completely pointer-events-none 
        so mouse movements cleanly pass through to the 3D canvas behind it.
      */}
      <motion.div 
        style={{ y: yText, opacity: opacityText }}
        className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
      >
        <p className="text-[9px] font-black uppercase tracking-[1em] text-white/40 mb-8 blur-[0.5px]">
          The Industry Standard
        </p>
        
        <h1 className="text-[clamp(4rem,15vw,15rem)] font-display font-black tracking-[-0.04em] leading-[0.8] text-center mix-blend-exclusion text-white">
          Yelp<br />Camp
        </h1>
      </motion.div>

      {/* Subtle bottom fade to blend smoothly into the rest of the dark site */}
      <div className="absolute bottom-0 w-full h-[20vh] bg-gradient-to-t from-[#050505] to-transparent z-30" />
    </div>
  );
}
