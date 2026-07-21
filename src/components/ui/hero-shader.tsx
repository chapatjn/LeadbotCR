'use client';

import type { ReactNode } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

interface ShaderBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function ShaderBackground({ children, className = '' }: ShaderBackgroundProps) {
  return (
    <div
      className={`relative isolate min-h-[660px] w-full overflow-hidden bg-[#07070a] ${className}`}
    >
      <MeshGradient
        className="absolute inset-0 h-full w-full"
        colors={['#050505', '#5b21b6', '#e9d5ff', '#172554', '#7c3aed']}
        speed={0.22}
        distortion={1.1}
        swirl={0.45}
        grainMixer={0.12}
        grainOverlay={0.08}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/75" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,transparent_0,rgba(0,0,0,.45)_70%)]" />
      {children}
    </div>
  );
}
