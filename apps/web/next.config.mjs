import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  
  // Configure Turbopack for next dev --turbopack
  turbopack: {
    resolveAlias: {
      'three': '../../node_modules/three',
      '@react-three/drei': '../../node_modules/@react-three/drei',
      '@react-three/fiber': './node_modules/@react-three/fiber',
    },
  },

  // Configure Webpack for next build
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'three': path.resolve(__dirname, '../../node_modules/three'),
      '@react-three/drei': path.resolve(__dirname, '../../node_modules/@react-three/drei'),
      '@react-three/fiber': path.resolve(__dirname, 'node_modules/@react-three/fiber'),
    };
    return config;
  },
};

export default nextConfig;
