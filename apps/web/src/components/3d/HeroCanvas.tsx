'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, Stars, OrbitControls, Torus } from '@react-three/drei';
import * as THREE from 'three';
import { Mesh, Points } from 'three';

function BrainSphere() {
  const outerRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (outerRef.current) {
      outerRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.3;
      outerRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    }
    if (innerRef.current) {
      innerRef.current.rotation.x = -state.clock.elapsedTime * 0.08;
      innerRef.current.rotation.z = state.clock.elapsedTime * 0.06;
    }
  });
  return (
    <Float speed={1.8} rotationIntensity={0.4} floatIntensity={1.2}>
      <Sphere ref={outerRef} args={[2.4, 128, 128]}>
        <MeshDistortMaterial
          color="#7C3AED" attach="material"
          distort={0.42} speed={2.2}
          roughness={0.05} metalness={0.9}
          transparent opacity={0.88}
        />
      </Sphere>
      <Sphere ref={innerRef} args={[1.7, 64, 64]}>
        <MeshDistortMaterial
          color="#06BBD4" attach="material"
          distort={0.35} speed={3}
          roughness={0} metalness={1}
          transparent opacity={0.35}
        />
      </Sphere>
      <Torus args={[3.0, 0.02, 8, 120]}>
        <meshStandardMaterial color="#10B981" transparent opacity={0.3} />
      </Torus>
      <Torus args={[3.6, 0.015, 8, 120]} rotation={[Math.PI / 3, 0, 0]}>
        <meshStandardMaterial color="#06BBD4" transparent opacity={0.2} />
      </Torus>
    </Float>
  );
}

function ParticleField() {
  const pointsRef = useRef<Points>(null);
  const count = 3000;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.018;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.009;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color="#7C3AED" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

export default function HeroCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 58 }} style={{ background: 'transparent' }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 10, 8]} intensity={2} color="#7C3AED" />
      <pointLight position={[-10, -8, -5]} intensity={1.2} color="#06BBD4" />
      <pointLight position={[4, 12, 4]} intensity={0.8} color="#10B981" />
      <Stars radius={90} depth={60} count={5000} factor={4} saturation={0.4} fade speed={0.8} />
      <BrainSphere />
      <ParticleField />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.4} />
    </Canvas>
  );
}
