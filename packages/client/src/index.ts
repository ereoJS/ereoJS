/**
 * @oreo/client
 *
 * Client-side runtime for the Oreo framework.
 * Includes islands architecture, navigation, and prefetching.
 */

// Hydration
export {
  parseHydrationDirective,
  createHydrationTrigger,
  stripHydrationProps,
  generateIslandId,
  resetIslandCounter,
  getIslandCount,
  shouldHydrate,
} from './hydration';

export type { HydrationProps } from './hydration';

// Islands
export {
  islandRegistry,
  hydrateIslands,
  registerIslandComponent,
  getIslandComponent,
  registerIslandComponents,
  createIsland,
  initializeIslands,
  cleanupIslands,
} from './islands';

export type { IslandRegistration } from './islands';

// Navigation
export {
  router,
  navigate,
  goBack,
  goForward,
  onNavigate,
  getNavigationState,
  fetchLoaderData,
  submitAction,
  setupScrollRestoration,
} from './navigation';

export type { NavigationState, NavigationEvent, NavigationListener } from './navigation';

// Prefetch
export {
  prefetch,
  getPrefetchedData,
  clearPrefetchCache,
  setupLinkPrefetch,
  setupAutoPrefetch,
  prefetchAll,
  isPrefetching,
  isPrefetched,
} from './prefetch';

export type { PrefetchOptions, LinkPrefetchProps } from './prefetch';

/**
 * Initialize the client runtime.
 * Call this in your entry point.
 */
export function initClient(): void {
  // Initialize islands
  initializeIslands();

  // Setup scroll restoration
  setupScrollRestoration();

  // Setup auto prefetch
  setupAutoPrefetch({ strategy: 'hover' });
}
