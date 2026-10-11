import React from 'react';
import { cn } from './cn';

/**
 * The official Hali e-shop logo, shown exactly as supplied: the original file,
 * its own colours and proportions. Only its height is set (width follows), and it
 * is never cropped, recoloured, filtered, rounded or stretched.
 */
export const LOGO_SRC = '/brand/hali-logo.png';
export const LOGO_ASPECT = 1024 / 608;

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Hali e-shop"
      draggable={false}
      className={cn('block h-12 w-auto max-w-none shrink-0 self-start select-none object-contain', className)}
    />
  );
}
