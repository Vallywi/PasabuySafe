'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'default' | 'white';
}

export function Logo({ size = 'md', showText = true, variant = 'default' }: LogoProps) {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    sm: { img: 24, text: 'text-base' },
    md: { img: 32, text: 'text-lg' },
    lg: { img: 48, text: 'text-2xl' },
    xl: { img: 80, text: 'text-3xl' },
  };
  const dims = sizeMap[size];

  return (
    <div className="flex items-center gap-2">
      {!imgError ? (
        <Image
          src="/logo.png"
          alt="PasabuySafe"
          width={dims.img}
          height={dims.img}
          className="object-contain"
          onError={() => setImgError(true)}
          priority
        />
      ) : (
        // Fallback if logo.png is not yet placed
        <ShieldCheck
          className={size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : size === 'xl' ? 'w-16 h-16' : 'w-7 h-7'}
          strokeWidth={2.5}
          fill="currentColor"
          fillOpacity={0.15}
          color={variant === 'white' ? '#FFFFFF' : '#FACC15'}
        />
      )}
      {showText && (
        <span className={`font-bold ${dims.text} ${variant === 'white' ? 'text-white' : 'text-slate-900'}`}>
          Pasabuy<span className="text-yellow-500">Safe</span>
        </span>
      )}
    </div>
  );
}
