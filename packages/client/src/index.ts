/**
 * @areo/client
 *
 * Client-side runtime for the Areo framework.
 * Includes islands architecture, navigation, and prefetching.
 */

// Import functions used internally
import { initializeIslands as _initializeIslands } from './islands';
import { setupScrollRestoration as _setupScrollRestoration } from './navigation';
import { setupAutoPrefetch as _setupAutoPrefetch } from './prefetch';

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
  _initializeIslands();

  // Setup scroll restoration
  _setupScrollRestoration();

  // Setup auto prefetch
  _setupAutoPrefetch({ strategy: 'hover' });
}
