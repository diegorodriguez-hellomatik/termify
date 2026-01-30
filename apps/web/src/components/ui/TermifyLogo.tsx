'use client';

import { cn } from '@/lib/utils';

interface TermifyLogoProps {
  className?: string;
  size?: number;
}

export function TermifyLogo({ className, size = 20 }: TermifyLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('flex-shrink-0', className)}
      style={{ ['--prompt-color' as string]: 'hsl(var(--background))' }}
    >
      {/* Circular background - uses currentColor from parent */}
      <circle cx="32" cy="32" r="32" fill="currentColor" />

      {/* Terminal prompt ">_" pixel art style */}
      {/* Uses background color for contrast */}
      <g fill="var(--prompt-color)">
        {/* The ">" chevron made of pixel blocks */}
        <rect x="14" y="16" width="4" height="4" />
        <rect x="18" y="20" width="4" height="4" />
        <rect x="22" y="24" width="4" height="4" />
        <rect x="26" y="28" width="4" height="4" />
        <rect x="26" y="32" width="4" height="4" />
        <rect x="22" y="36" width="4" height="4" />
        <rect x="18" y="40" width="4" height="4" />
        <rect x="14" y="44" width="4" height="4" />
        {/* The "_" underscore/cursor */}
        <rect x="34" y="44" width="16" height="4" />
      </g>
    </svg>
  );
}
