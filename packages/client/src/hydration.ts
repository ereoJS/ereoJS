/**
 * @oreo/client - Hydration Directives
 *
 * Selective hydration strategies inspired by Astro.
 * Only hydrate what needs interactivity.
 */

import type { ComponentType, ReactElement } from 'react';
import type { HydrationStrategy } from '@oreo/core';

/**
 * Hydration directive props.
 */
export interface HydrationProps {
  /** Hydrate immediately on page load */
  'client:load'?: boolean;
  /** Hydrate when browser is idle */
  'client:idle'?: boolean;
  /** Hydrate when element is visible */
  'client:visible'?: boolean;
  /** Hydrate when media query matches */
  'client:media'?: string;
  /** Only render on client (no SSR) */
  'client:only'?: boolean;
}

/**
 * Island component wrapper.
 */
export interface IslandComponent<P = {}> {
  /** The React component */
  Component: ComponentType<P>;
  /** Component props */
  props: P;
  /** Hydration strategy */
  strategy: HydrationStrategy;
  /** Media query (for client:media) */
  media?: string;
  /** Unique island ID */
  id: string;
}

/**
 * Parse hydration directive from props.
 */
export function parseHydrationDirective(props: HydrationProps): {
  strategy: HydrationStrategy;
  media?: string;
} {
  if (props['client:load']) {
    return { strategy: 'load' };
  }
  if (props['client:idle']) {
    return { strategy: 'idle' };
  }
  if (props['client:visible']) {
    return { strategy: 'visible' };
  }
  if (props['client:media']) {
    return { strategy: 'media', media: props['client:media'] };
  }
  if (props['client:only']) {
    return { strategy: 'load' }; // client:only also loads immediately
  }
  return { strategy: 'none' };
}

/**
 * Check if a component should be hydrated based on strategy.
 */
export function shouldHydrate(
  strategy: HydrationStrategy,
  media?: string
): boolean | (() => boolean) {
  switch (strategy) {
    case 'load':
      return true;

    case 'idle':
      // Will be resolved by idle callback
      return false;

    case 'visible':
      // Will be resolved by intersection observer
      return false;

    case 'media':
      if (!media) return false;
      return () => window.matchMedia(media).matches;

    case 'none':
    default:
      return false;
  }
}

/**
 * Create a deferred hydration trigger.
 */
export function createHydrationTrigger(
  strategy: HydrationStrategy,
  element: Element,
  onHydrate: () => void,
  media?: string
): () => void {
  let cleanup: (() => void) | null = null;

  switch (strategy) {
    case 'load':
      // Hydrate immediately
      onHydrate();
      break;

    case 'idle':
      // Use requestIdleCallback or setTimeout fallback
      if ('requestIdleCallback' in window) {
        const id = requestIdleCallback(onHydrate);
        cleanup = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(onHydrate, 200);
        cleanup = () => clearTimeout(id);
      }
      break;

    case 'visible':
      // Use Intersection Observer
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              observer.disconnect();
              onHydrate();
              break;
            }
          }
        },
        { rootMargin: '200px' }
      );
      observer.observe(element);
      cleanup = () => observer.disconnect();
      break;

    case 'media':
      if (!media) break;
      const mql = window.matchMedia(media);

      const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        if (e.matches) {
          mql.removeEventListener('change', handler as any);
          onHydrate();
        }
      };

      if (mql.matches) {
        onHydrate();
      } else {
        mql.addEventListener('change', handler as any);
        cleanup = () => mql.removeEventListener('change', handler as any);
      }
      break;

    case 'none':
    default:
      // Don't hydrate
      break;
  }

  return () => {
    if (cleanup) cleanup();
  };
}

/**
 * Strip hydration props from component props.
 */
export function stripHydrationProps<P extends HydrationProps>(
  props: P
): Omit<P, keyof HydrationProps> {
  const {
    'client:load': _load,
    'client:idle': _idle,
    'client:visible': _visible,
    'client:media': _media,
    'client:only': _only,
    ...rest
  } = props;
  return rest as Omit<P, keyof HydrationProps>;
}

/**
 * Generate a unique island ID.
 */
let islandCounter = 0;

export function generateIslandId(): string {
  return `island-${++islandCounter}`;
}

/**
 * Reset island counter (for testing).
 */
export function resetIslandCounter(): void {
  islandCounter = 0;
}

/**
 * Get the current island count.
 */
export function getIslandCount(): number {
  return islandCounter;
}
