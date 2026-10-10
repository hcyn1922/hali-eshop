import React, { useState } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../../types';
import { cn } from '../../ui';
import { primaryImage } from './meta';

/** Product photo with a quiet placeholder when there is none (or it fails to load). */
export function ProductThumb({ product, className }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = primaryImage(product);
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-subtle', className)}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <Package className="h-[28%] max-h-12 w-[28%] max-w-12 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
      )}
    </div>
  );
}
