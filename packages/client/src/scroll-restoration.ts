/**
 * @ereo/client - ScrollRestoration Component
 *
 * React component for managing scroll restoration during SPA navigation.
 * Uses sessionStorage for persistence across page reloads and
 * integrates with React lifecycle for proper cleanup.
 */

import { useEffect, useRef, createElement } from 'react';
import { router } from './navigation';

/**
 * Props for the ScrollRestoration component.
 */
export interface ScrollRestorationProps {
  /**
   * Custom function to generate storage keys for scroll positions.
   * Receives the current pathname and returns a key string.
   * Defaults to using the pathname as the key.
   */
  getKey?: (pathname: string) => string;

  /**
   * CSP nonce for the inline script used during SSR hydration.
   */
  nonce?: string;

  /**
   * Storage mechanism. Defaults to 'sessionStorage'.
   * 'manual' disables automatic storage (use getKey for custom logic).
   */
  storageKey?: string;
}

// In-memory scroll position store (used as fallback when sessionStorage unavailable)
const memoryStore = new Map<string, { x: number; y: number }>();
const MAX_SCROLL_ENTRIES = 100;

/**
 * Get scroll position from storage.
 */
function getScrollPosition(
  key: string,
  storageKey: string
): { x: number; y: number } | undefined {
  if (typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`${storageKey}:${key}`);
      if (stored) return JSON.parse(stored);
    } catch {
      // sessionStorage unavailable, use memory store
    }
  }
  return memoryStore.get(key);
}

/**
 * Save scroll position to storage.
 */
function saveScrollPosition(
  key: string,
  position: { x: number; y: number },
  storageKey: string
): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(`${storageKey}:${key}`, JSON.stringify(position));
      return;
    } catch {
      // sessionStorage unavailable, use memory store
    }
  }
  memoryStore.set(key, position);

  // Evict oldest entry if over limit
  if (memoryStore.size > MAX_SCROLL_ENTRIES) {
    const oldest = memoryStore.keys().next().value;
    if (oldest !== undefined) memoryStore.delete(oldest);
  }
}

/**
 * Remove a scroll position from storage.
 */
function removeScrollPosition(key: string, storageKey: string): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(`${storageKey}:${key}`);
      return;
    } catch {
      // fallback
    }
  }
  memoryStore.delete(key);
}

/**
 * Clear all scroll positions from memory store (for testing).
 */
export function clearScrollPositions(): void {
  memoryStore.clear();
}

/**
 * ScrollRestoration component.
 *
 * Place this once in your app (typically in the root layout) to enable
 * automatic scroll position saving and restoration during SPA navigation.
 *
 * @example
 * ```tsx
 * import { ScrollRestoration } from '@ereo/client';
 *
 * function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <ScrollRestoration />
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Custom key function for hash-based routing
 * <ScrollRestoration
 *   getKey={(pathname) => pathname + window.location.hash}
 * />
 * ```
 */
export function ScrollRestoration({
  getKey,
  nonce,
  storageKey = 'ereo-scroll',
}: ScrollRestorationProps = {}): ReturnType<typeof createElement> | null {
  const isSetup = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSetup.current) return;
    isSetup.current = true;

    // Disable browser's default scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const keyFn = getKey ?? ((pathname: string) => pathname);

    // Subscribe to navigation events
    const unsubscribe = router.subscribe((event) => {
      // Save current scroll position before navigation
      const fromKey = keyFn(event.from.pathname);
      saveScrollPosition(fromKey, { x: window.scrollX, y: window.scrollY }, storageKey);

      if (event.type === 'pop') {
        // Restore scroll position on back/forward
        const toKey = keyFn(event.to.pathname);
        const saved = getScrollPosition(toKey, storageKey);
        if (saved) {
          requestAnimationFrame(() => {
            window.scrollTo(saved.x, saved.y);
          });
        }
      } else {
        // Scroll to top on push/replace, respecting hash
        if (event.to.hash) {
          // Scroll to hash target if present
          requestAnimationFrame(() => {
            const target = document.getElementById(event.to.hash.slice(1));
            if (target) {
              target.scrollIntoView();
            } else {
              window.scrollTo(0, 0);
            }
          });
        } else {
          window.scrollTo(0, 0);
        }
      }
    });

    // Save scroll position on beforeunload (page refresh)
    const handleBeforeUnload = () => {
      const currentKey = keyFn(window.location.pathname);
      saveScrollPosition(currentKey, { x: window.scrollX, y: window.scrollY }, storageKey);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Re-enable browser scroll restoration on cleanup
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto';
      }
      isSetup.current = false;
    };
  }, [getKey, storageKey]);

  // Render an inline script for SSR hydration to prevent scroll flash
  if (nonce !== undefined) {
    return createElement('script', {
      nonce,
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: {
        __html: `if("scrollRestoration" in history)history.scrollRestoration="manual";`,
      },
    });
  }

  return null;
}
