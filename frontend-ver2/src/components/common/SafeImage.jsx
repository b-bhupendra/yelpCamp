import React, { useState } from 'react';
import { getFallbackImage } from '../../utils/imageFallback';

/**
 * SafeImage Component
 * Drop-in replacement for <img> that:
 * 1. Automatically catches load errors (404, CORS, broken CDN) and swaps in a high-res default campsite photo.
 * 2. Prevents broken-image icons from ever rendering in the UI.
 * 3. Shows a smooth loading skeleton state.
 */
export default function SafeImage({
  src,
  alt = 'YelpCamp Photo',
  className = '',
  seed = 0,
  type = 'campground',
  loading = 'lazy',
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const fallbackSrc = getFallbackImage(seed, type);
  const effectiveSrc = hasError || !src ? fallbackSrc : src;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading shimmer placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-slate-800/60 animate-pulse" />
      )}
      
      <img
        src={effectiveSrc}
        alt={alt}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (!hasError) {
            setHasError(true);
            setIsLoaded(true);
          }
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </div>
  );
}
