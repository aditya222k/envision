"use client";

import { Billboard, OrbitControls } from "@react-three/drei";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ExternalPlanetModel, NASA_PLANETS, modelReach } from "./ExternalPlanetModel";
import {
  PLANETS,
  SCENE,
  SUN,
  cameraPositionFor,
  planetPosition,
  type Planet,
} from "@/lib/explorer/solarSystem";
import {
  makeGlowTexture,
  makePlanetTexture,
  makeRingTexture,
  seededRandom,
} from "./solarSystemTextures";

const HIGHLIGHT = "#f6c41c";
const ORBIT = "#b9cbbf";
// A press that moves further than this is a drag to rotate, not a pick.
const MAX_CLICK_DRIFT = 6;

type CameraControls = { target: THREE.Vector3; update: () => void };

export function ContextLossHandler({ onLost }: { onLost: () => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    function handle(event: Event) {
      event.preventDefault();
      onLost();
    }
    canvas.addEventListener("webglcontextlost", handle);
    // R3F releases its context on unmount. That is expected when switching
    // activities and must not mark the explorer as broken on the next visit.
    return () => canvas.removeEventListener("webglcontextlost", handle);
  }, [gl, onLost]);
  return null;
}

function Stars() {
  const geometry = useMemo(() => {
    const random = seededRandom("stars");
    const positions = new Float32Array(SCENE.stars * 3);
    for (let i = 0; i < SCENE.stars; i++) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const radius = 400 + random() * 300;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return result;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#dfe8f5" size={1.6} sizeAttenuation={false} />
    </points>
  );
}

function Sun({ useExternalModels, playing }: { useExternalModels: boolean; playing: boolean }) {
  const glow = useMemo(() => makeGlowTexture(SUN.glow), []);
  const surface = useRef<THREE.Group>(null);
  useEffect(() => () => glow.dispose(), [glow]);
  useFrame((_, delta) => {
    if (playing && surface.current) {
      surface.current.rotation.y += Math.min(delta, 0.1) * 0.08;
    }
  });
  const original = (
    <mesh>
      <sphereGeometry args={[SUN.radius, 48, 48]} />
      <meshBasicMaterial color={SUN.color} />
    </mesh>
  );

  return (
    <group>
      <group ref={surface}>
        {useExternalModels ? (
          <ExternalPlanetModel id="sun" radius={SUN.radius} fallback={original} />
        ) : original}
      </group>
      <sprite scale={[SUN.radius * 5, SUN.radius * 5, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

function Orbit({ radius, selected }: { radius: number; selected: boolean }) {
  const geometry = useMemo(() => {
    const points = Array.from({ length: 160 }, (_, i) => {
      const angle = (i / 160) * Math.PI * 2;
      return new THREE.Vector3(...planetPosition(radius, angle));
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial
        color={selected ? HIGHLIGHT : ORBIT}
        transparent
        opacity={selected ? 0.95 : 0.3}
      />
    </lineLoop>
  );
}

function SaturnRing({ ring }: { ring: NonNullable<Planet["scene"]["ring"]> }) {
  const { geometry, texture } = useMemo(() => {
    const ringGeometry = new THREE.RingGeometry(ring.inner, ring.outer, 96, 1);
    // Maps the texture outward from the planet, so its stripes become rings.
    const position = ringGeometry.attributes.position;
    const uv = ringGeometry.attributes.uv;
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      const across = (point.length() - ring.inner) / (ring.outer - ring.inner);
      uv.setXY(i, across, 0.5);
    }
    return { geometry: ringGeometry, texture: makeRingTexture(ring.color) };
  }, [ring]);

  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2}>
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function ProceduralPlanet({ planet }: { planet: Planet }) {
  const { scene } = planet;
  const texture = useMemo(
    () => makePlanetTexture(planet.id, scene.surface, scene.colors),
    [planet.id, scene.surface, scene.colors],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[scene.radius, 48, 32]} />
        <meshStandardMaterial map={texture} roughness={1} metalness={0} />
      </mesh>
      {scene.ring && <SaturnRing ring={scene.ring} />}
    </group>
  );
}

function PlanetBody({
  planet,
  playing,
  selected,
  useExternalModels,
  onSelect,
}: {
  planet: Planet;
  playing: boolean;
  selected: boolean;
  useExternalModels: boolean;
  onSelect: (id: string) => void;
}) {
  const { scene } = planet;
  const orbitRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const angle = useRef(scene.startAngle);
  const reach = useExternalModels
    ? modelReach(planet.id, scene.radius)
    : Math.max(scene.radius, scene.ring?.outer ?? 0);
  const hitRadius = Math.max(reach * 1.5, 1.6);

  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  useFrame((_, delta) => {
    if (!playing || !orbitRef.current || !spinRef.current) {
      return;
    }
    // Keeps a long pause, like a hidden tab, from jumping the planets.
    const step = Math.min(delta, 0.1);
    angle.current += (step * Math.PI * 2) / scene.orbitSeconds;
    orbitRef.current.position.set(
      ...planetPosition(scene.orbitRadius, angle.current),
    );
    spinRef.current.rotation.y += step * 0.8;
  });

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (event.delta <= MAX_CLICK_DRIFT) {
      onSelect(planet.id);
    }
  }

  const original = <ProceduralPlanet planet={planet} />;

  return (
    <group
      ref={orbitRef}
      name={`planet-${planet.id}`}
      position={planetPosition(scene.orbitRadius, scene.startAngle)}
    >
      <group rotation-z={THREE.MathUtils.degToRad(scene.tilt)}>
        <group ref={spinRef}>
          {useExternalModels && NASA_PLANETS.has(planet.id) ? (
            <ExternalPlanetModel
              id={planet.id}
              radius={scene.radius}
              fallback={original}
            />
          ) : original}
        </group>
      </group>

      {selected && (
        <Billboard>
          <mesh>
            <ringGeometry args={[reach * 1.2, reach * 1.24, 64]} />
            <meshBasicMaterial color={HIGHLIGHT} side={THREE.DoubleSide} />
          </mesh>
        </Billboard>
      )}

      {/* A larger, invisible target, so small planets are easy to tap. */}
      <mesh
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Places the camera for the current screen shape, at the start and on reset.
function InspectionLight({ enabled }: { enabled: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => {
    light.current?.position.copy(camera.position);
  });
  return <pointLight ref={light} intensity={enabled ? 3.5 : 0} decay={0} />;
}

function CameraRig({ resetSignal, focusedId, useExternalModels }: {
  resetSignal: number;
  focusedId: string | null;
  useExternalModels: boolean;
}) {
  const controls = useThree(
    (state) => state.controls,
  ) as unknown as CameraControls | null;
  const get = useThree((state) => state.get);
  const transition = useRef<{
    elapsed: number;
    from: THREE.Vector3;
    fromTarget: THREE.Vector3;
    to: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    if (!controls) {
      return;
    }
    const { camera, size, invalidate } = get();
    const planet = PLANETS.find((item) => item.id === focusedId);
    const target = new THREE.Vector3();
    let to = new THREE.Vector3(...cameraPositionFor(size.width / size.height));
    if (planet) {
      // Read the current world position, including its animated orbit.
      const object = get().scene.getObjectByName(`planet-${planet.id}`);
      object?.getWorldPosition(target);
      const reach = useExternalModels
        ? modelReach(planet.id, planet.scene.radius)
        : planet.scene.ring?.outer ?? planet.scene.radius;
      const fit = Math.max(1, size.height / size.width);
      to = target.clone().add(new THREE.Vector3(0, reach * 2 * fit, reach * 5 * fit));
    }
    transition.current = {
      elapsed: 0,
      from: camera.position.clone(),
      fromTarget: controls.target.clone(),
      to,
      target,
    };
    invalidate();
  }, [resetSignal, focusedId, useExternalModels, controls, get]);

  useFrame((_, delta) => {
    const move = transition.current;
    if (!move || !controls) return;
    move.elapsed += Math.min(delta, 0.1);
    const t = Math.min(move.elapsed / 0.8, 1);
    const eased = t * t * (3 - 2 * t);
    const { camera, invalidate } = get();
    camera.position.lerpVectors(move.from, move.to, eased);
    controls.target.lerpVectors(move.fromTarget, move.target, eased);
    controls.update();
    if (t === 1) transition.current = null;
    else invalidate();
  });

  return null;
}

export default function SolarSystemScene({
  playing,
  selectedId,
  resetSignal,
  onSelect,
  onContextLost,
  useExternalModels,
  focusedId,
}: {
  playing: boolean;
  selectedId: string | null;
  resetSignal: number;
  onSelect: (id: string) => void;
  onContextLost: () => void;
  useExternalModels: boolean;
  focusedId: string | null;
}) {
  return (
    <Canvas
      role="img"
      aria-label="A 3D model of the Sun and the eight planets on their orbits. Drag to rotate, scroll or pinch to zoom, and select a planet to read about it."
      camera={{
        fov: SCENE.fov,
        near: 0.1,
        far: 2000,
        position: cameraPositionFor(16 / 9),
      }}
      dpr={[1, 2]}
      frameloop={playing ? "always" : "demand"}
    >
      <ContextLossHandler onLost={onContextLost} />
      <color attach="background" args={[SCENE.background]} />
      <ambientLight intensity={useExternalModels ? 1.2 : 0.35} />
      <pointLight position={[0, 0, 0]} intensity={3.2} decay={0} />
      <InspectionLight enabled={Boolean(focusedId)} />
      <Stars />
      <group visible={!focusedId}>
        <Sun useExternalModels={useExternalModels} playing={playing} />
        {PLANETS.map((planet) => (
        <Orbit
          key={planet.id}
          radius={planet.scene.orbitRadius}
          selected={planet.id === selectedId}
        />
        ))}
      </group>
      {PLANETS.map((planet) => (
        <group key={planet.id} visible={!focusedId || focusedId === planet.id}>
          <PlanetBody
          planet={planet}
          playing={playing}
          selected={planet.id === selectedId}
          useExternalModels={useExternalModels}
          onSelect={onSelect}
          />
        </group>
      ))}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping={false}
        minDistance={focusedId ? 2 : SCENE.minDistance}
        maxDistance={SCENE.maxDistance}
      />
      <CameraRig resetSignal={resetSignal} focusedId={focusedId} useExternalModels={useExternalModels} />
    </Canvas>
  );
}
