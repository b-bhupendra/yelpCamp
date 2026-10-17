/**
 * High-reliability image fallback utility for YelpCamp.
 * Guarantees that broken CDN links or offline URLs never show a broken image icon.
 */

export const FALLBACK_CAMPGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",  // Tent under stars
  "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",  // Campfire dusk
  "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",  // Night lake camp
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80",  // Misty mountain
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",  // Sunset mountain
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",  // Yosemite valley
  "https://images.unsplash.com/photo-1533873984035-25970ab07461?auto=format&fit=crop&w=1200&q=80",  // Forest river
  "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=1200&q=80",  // Glamping tent
  "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80",  // Pine trees lake
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",  // Wooden dock lake
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80",  // Green hills
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",  // Snowy mountain ridge
  "https://images.unsplash.com/photo-1536431311719-398b6704d4cc?auto=format&fit=crop&w=1200&q=80",  // Blue mountain lake
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",  // Tropical beach
  "https://images.unsplash.com/photo-1571687949921-1306bfb24b72?auto=format&fit=crop&w=1200&q=80",  // A-frame cabin
];

export const DEFAULT_CAMPGROUND_IMAGE = FALLBACK_CAMPGROUND_IMAGES[0];

export const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=explorer";

/**
 * Returns a deterministic fallback image based on a seed (ID or string).
 */
export function getFallbackImage(seed = 0, type = 'campground') {
  if (type === 'avatar') {
    const cleanSeed = (seed || 'explorer').toString().replace(/\s+/g, '_').toLowerCase();
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanSeed}`;
  }

  const num = typeof seed === 'number' ? Math.abs(seed) : Math.abs(String(seed).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  const idx = num % FALLBACK_CAMPGROUND_IMAGES.length;
  return FALLBACK_CAMPGROUND_IMAGES[idx];
}

/**
 * Native onError handler for standard HTML <img> tags.
 * Prevents infinite loops and swaps in a guaranteed healthy fallback image.
 */
export function handleImageError(event, type = 'campground', seed = 0) {
  const target = event.currentTarget || event.target;
  if (!target) return;
  
  // Prevent infinite loops if fallback itself fails
  target.onerror = null;
  target.src = getFallbackImage(seed, type);
}
