'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Stars, Float } from '@react-three/drei';
import { Mesh } from 'three';

function RocketMesh() {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.3;
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6) * 0.1;
    }
  });
  return (
    <Float speed={2} floatIntensity={1.5}>
      <Sphere ref={ref} args={[1.8, 64, 64]}>
        <MeshDistortMaterial color="#F59E08" distort={0.5} speed={3} roughness={0} metalness={0.8} transparent opacity={0.7} />
      </Sphere>
      <Sphere args={[2.4, 32, 32]}>
        <meshStandardMaterial color="#7C3AED" wireframe transparent opacity={0.15} />
      </Sphere>
    </Float>
  );
}

export default function RocketCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 60 }} style={{ background: 'transparent' }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 8, 5]} intensity={2} color="#F59E08" />
      <pointLight position={[-5, -3, 0]} intensity={0.8} color="#7C3AED" />
      <Stars radius={60} depth={30} count={2000} factor={3} saturation={0.3} fade speed={0.6} />
      <RocketMesh />
    </Canvas>
  );
}
