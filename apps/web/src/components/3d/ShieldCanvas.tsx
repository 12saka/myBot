'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Stars } from '@react-three/drei';
import { Mesh } from 'three';

function ShieldMesh() {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.4;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });
  return (
    <>
      <Sphere ref={ref} args={[2, 64, 64]}>
        <MeshDistortMaterial color="#10B981" distort={0.2} speed={1.5} roughness={0} metalness={1} transparent opacity={0.6} wireframe />
      </Sphere>
      <Sphere args={[1.5, 32, 32]}>
        <MeshDistortMaterial color="#06BBD4" distort={0.3} speed={2} roughness={0.1} metalness={0.9} transparent opacity={0.3} />
      </Sphere>
    </>
  );
}

export default function ShieldCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 60 }} style={{ background: 'transparent' }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#10B981" />
      <pointLight position={[-5, -5, 0]} intensity={1} color="#06BBD4" />
      <Stars radius={60} depth={30} count={2000} factor={3} saturation={0.2} fade speed={0.5} />
      <ShieldMesh />
    </Canvas>
  );
}
