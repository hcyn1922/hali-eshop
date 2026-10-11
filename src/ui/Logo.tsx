import React from 'react';
import { cn } from './cn';

/**
 * The official Hali e-shop logo, shown exactly as supplied: the original file,
 * its own colours and proportions. Only its height is set (width follows), and it
 * is never cropped, recoloured, filtered, rounded or stretched.
 */
export const LOGO_SRC = '/brand/hali-logo.png';
export const LOGO_ASPECT = 1024 / 608;

/** `className` replaces the default size (one height or one width; the other follows). */
export function Logo({ className = 'h-12 w-auto self-start' }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Hali e-shop"
      draggable={false}
      className={cn('block max-w-none shrink-0 select-none object-contain', className)}
    />
  );
}
