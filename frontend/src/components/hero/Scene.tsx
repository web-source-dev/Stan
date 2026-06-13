'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber';
import {
  Float,
  RoundedBox,
  MeshTransmissionMaterial,
  Environment,
  Lightformer,
  Sparkles,
  AdaptiveDpr,
} from '@react-three/drei';
import * as THREE from 'three';

/* Brand palette mirrored from the Tailwind tokens so the 3D scene and the DOM
   share one language. */
const BRAND = '#5b54e8';
const BRAND_LIGHT = '#7c7dfb';
const BRAND_DEEP = '#3d31b0';

/* ------------------------------------------------------------------ */
/* Rig — eases the whole scene toward the pointer for a parallax tilt  */
/* ------------------------------------------------------------------ */

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    // Pointer is normalized [-1, 1]; map to a gentle rotation and damp toward it.
    const targetY = state.pointer.x * 0.35;
    const targetX = -state.pointer.y * 0.22;
    const k = 1 - Math.pow(0.0001, delta); // frame-rate independent damping
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetY, k);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetX, k);
  });

  return <group ref={group}>{children}</group>;
}

/* ------------------------------------------------------------------ */
/* Offer card — a thin frosted-violet panel standing in for a product */
/* ------------------------------------------------------------------ */

function OfferCard({
  position,
  rotation = [0, 0, 0],
  accent = BRAND,
  ...float
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  accent?: string;
  speed?: number;
  rotationIntensity?: number;
  floatIntensity?: number;
}) {
  return (
    <Float speed={float.speed ?? 1.4} rotationIntensity={float.rotationIntensity ?? 0.4} floatIntensity={float.floatIntensity ?? 0.8}>
      <group position={position} rotation={rotation}>
        {/* Card body */}
        <RoundedBox args={[1.5, 1, 0.08]} radius={0.12} smoothness={6} castShadow>
          <meshPhysicalMaterial
            color={'#ffffff'}
            transmission={0.7}
            thickness={0.6}
            roughness={0.18}
            ior={1.35}
            clearcoat={1}
            clearcoatRoughness={0.2}
            attenuationColor={BRAND_LIGHT}
            attenuationDistance={2}
          />
        </RoundedBox>
        {/* Accent "buy" bar — emissive so it glows against the glass */}
        <RoundedBox args={[1.05, 0.16, 0.04]} radius={0.07} smoothness={4} position={[0, -0.3, 0.07]}>
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} toneMapped={false} />
        </RoundedBox>
        {/* Thumbnail block */}
        <RoundedBox args={[1.15, 0.42, 0.03]} radius={0.06} smoothness={4} position={[0, 0.22, 0.06]}>
          <meshStandardMaterial color={BRAND_DEEP} emissive={BRAND} emissiveIntensity={0.25} roughness={0.4} />
        </RoundedBox>
      </group>
    </Float>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar — the glowing core the storefront orbits                     */
/* ------------------------------------------------------------------ */

function AvatarCore(props: ThreeElements['group']) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.4;
  });
  return (
    <group {...props}>
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.6}>
        {/* Core sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.62, 64, 64]} />
          <meshStandardMaterial
            color={BRAND}
            emissive={BRAND_LIGHT}
            emissiveIntensity={0.6}
            roughness={0.25}
            metalness={0.1}
          />
        </mesh>
        {/* Soft glow halo */}
        <mesh scale={1.35}>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshBasicMaterial color={BRAND_LIGHT} transparent opacity={0.12} toneMapped={false} />
        </mesh>
        {/* Orbiting accent ring */}
        <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[1.05, 0.02, 16, 96]} />
          <meshStandardMaterial color={BRAND_LIGHT} emissive={BRAND_LIGHT} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </Float>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

function SceneContents() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} castShadow />
      <pointLight position={[-4, -2, -3]} intensity={40} color={BRAND_LIGHT} />

      <Rig>
        <AvatarCore position={[-0.2, 0.9, 0]} />
        <OfferCard position={[0.9, 0.1, 0.4]} rotation={[0.1, -0.35, 0.04]} accent={BRAND} speed={1.2} />
        <OfferCard position={[-1.15, -0.7, 0.1]} rotation={[0.05, 0.4, -0.06]} accent={BRAND_LIGHT} speed={1.6} floatIntensity={1.1} />
        <OfferCard position={[0.35, -1.15, -0.4]} rotation={[-0.1, -0.15, 0.02]} accent={'#a3a8ff'} speed={1.0} rotationIntensity={0.25} />

        {/* Constellation of particles */}
        <Sparkles count={70} scale={[7, 6, 4]} size={2.5} speed={0.3} color={BRAND_LIGHT} opacity={0.7} />
      </Rig>

      {/* Inline lighting environment — Lightformers only, so no HDRI is fetched
          from the network (works fully offline). */}
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 3, 2]} scale={[6, 3, 1]} color="#ffffff" />
        <Lightformer intensity={1.4} position={[-3, 1, 1]} scale={[3, 3, 1]} color={BRAND_LIGHT} />
        <Lightformer intensity={1.2} position={[3, -1, 1]} scale={[3, 3, 1]} color={BRAND} />
      </Environment>

      <AdaptiveDpr pixelated />
    </>
  );
}

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 35 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
    </Canvas>
  );
}
