"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { Planet } from "@/lib/explorer/solarSystem";
import { ContextLossHandler, ProceduralPlanet } from "./SolarSystemScene";

function RevealedPlanet({ planet, animate }: { planet: Planet; animate: boolean }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (animate && spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * 0.2;
  });
  return (
    <group scale={1.2 / planet.scene.radius} rotation-z={THREE.MathUtils.degToRad(planet.scene.tilt)}>
      <group ref={spin}><ProceduralPlanet planet={planet} /></group>
    </group>
  );
}

export default function QuizPlanetScene({ planet }: { planet: Planet }) {
  const [animate] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [lost, setLost] = useState(false);
  if (lost) return <p className="quiz-preview-fallback">3D preview unavailable. Keep playing with the clues and questions.</p>;
  return (
    <Canvas
      role="img"
      aria-label={`Revealed ${planet.name}, an interactive 3D planet. Drag to rotate.`}
      camera={{ position: [0, 1.1, planet.scene.ring ? 8.5 : 5.8], fov: 40 }}
      dpr={[1, 1.5]}
      frameloop={animate ? "always" : "demand"}
    >
      <ContextLossHandler onLost={() => setLost(true)} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 4, 5]} intensity={2.5} />
      <RevealedPlanet planet={planet} animate={animate} />
      <OrbitControls enablePan={false} minDistance={3} maxDistance={12} />
    </Canvas>
  );
}
