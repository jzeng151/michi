"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme, type Season } from "@/components/theme/ThemeProvider";

const PETAL_COLOR: Record<Season, string> = {
  spring: "#efb3c0",
  summer: "#9fd0aa",
  autumn: "#e8a56b",
  winter: "#f4f8fb",
};
const GROUND = { light: "#ece6da", dark: "#26222b" } as const;
const FOG = { light: "#f4efe7", dark: "#1d1a21" } as const;

function Torii() {
  return (
    <group>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 3, 20]} />
          <meshStandardMaterial color="#b8432a" roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 3.12, 0]}>
        <boxGeometry args={[4.4, 0.26, 0.4]} />
        <meshStandardMaterial color="#b8432a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 3.38, 0]}>
        <boxGeometry args={[4.8, 0.18, 0.52]} />
        <meshStandardMaterial color="#3a3330" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[3.9, 0.2, 0.3]} />
        <meshStandardMaterial color="#b8432a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.76, 0]}>
        <boxGeometry args={[0.22, 0.46, 0.26]} />
        <meshStandardMaterial color="#b8432a" roughness={0.55} />
      </mesh>
    </group>
  );
}

const PETAL_COUNT = 220;

/** Deterministic LCG so the petal field is stable across re-renders. */
function makeRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function Petals({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds, phases } = useMemo(() => {
    const rng = makeRng(20260701);
    const positions = new Float32Array(PETAL_COUNT * 3);
    const speeds = new Float32Array(PETAL_COUNT);
    const phases = new Float32Array(PETAL_COUNT);
    for (let i = 0; i < PETAL_COUNT; i++) {
      positions[i * 3] = (rng() - 0.5) * 16;
      positions[i * 3 + 1] = rng() * 9;
      positions[i * 3 + 2] = (rng() - 0.5) * 8;
      speeds[i] = 0.25 + rng() * 0.65;
      phases[i] = rng() * Math.PI * 2;
    }
    return { positions, speeds, phases };
  }, []);

  useFrame((state, delta) => {
    const points = ref.current;
    if (!points) return;
    const pos = points.geometry.attributes.position as THREE.BufferAttribute;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PETAL_COUNT; i++) {
      let y = pos.getY(i) - speeds[i] * delta;
      if (y < -0.2) y = 9;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.8 + phases[i]) * delta * 0.35);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.09}
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Gentle pointer parallax. */
function Rig() {
  useFrame(({ camera, pointer }) => {
    camera.position.x += (pointer.x * 0.7 - camera.position.x) * 0.04;
    camera.position.y += (1.6 + pointer.y * 0.3 - camera.position.y) * 0.04;
    camera.lookAt(0, 2.4, -3.5);
  });
  return null;
}

export default function Hero3D() {
  const { season, resolvedMode } = useTheme();

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.6, 8], fov: 42 }}
      style={{ pointerEvents: "none" }}
    >
      <fog attach="fog" args={[FOG[resolvedMode], 7, 18]} />
      <ambientLight intensity={resolvedMode === "dark" ? 0.55 : 0.95} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={resolvedMode === "dark" ? 0.7 : 1.1}
      />
      {/* Set back into the fog so the headline floats clear of it. */}
      <group position={[0, 0, -3.5]}>
        <Torii />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[15, 48]} />
        <meshStandardMaterial color={GROUND[resolvedMode]} />
      </mesh>
      <Petals color={PETAL_COLOR[season]} />
      <Rig />
    </Canvas>
  );
}
