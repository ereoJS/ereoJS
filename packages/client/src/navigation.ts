/**
 * @ereo/client - Client-side Navigation
 *
 * SPA-style navigation with loader data fetching.
 */

import type { RouteParams } from '@ereo/core';
import {
  startViewTransition,
  areViewTransitionsEnabled,
  type ViewTransitionOptions,
} from './view-transition';

/**
 * Navigation state.
 */
export interface NavigationState {
  pathname: string;
  search: string;
  hash: string;
  state?: unknown;
}

/**
 * Navigation event.
 */
export interface NavigationEvent {
  type: 'push' | 'replace' | 'pop';
  from: NavigationState;
  to: NavigationState;
}

/**
 * Navigation listener.
 */
export type NavigationListener = (event: NavigationEvent) => void;

/**
 * Blocker function - returns true to block navigation.
 */
export type BlockerFunction = () => boolean;

/**
 * Pending navigation that was blocked.
 */
export interface PendingNavigation {
  to: string;
  options: { replace?: boolean; state?: unknown; viewTransition?: boolean | ViewTransitionOptions };
}

/**
 * Client router for SPA navigation.
 */
class ClientRouter {
  private listeners = new Set<NavigationListener>();
  private currentState: NavigationState;
  private blockers = new Set<BlockerFunction>();
  private blockerListeners = new Set<() => void>();
  pendingNavigation: PendingNavigation | null = null;

  constructor() {
    this.currentState = this.getStateFromLocation();
    this.setupPopState();
  }

  /**
   * Add a blocker function. Returns a cleanup function.
   */
  addBlocker(fn: BlockerFunction): () => void {
    this.blockers.add(fn);
    return () => this.blockers.delete(fn);
  }

  /**
   * Check if any blocker wants to block navigation.
   */
  isBlocked(): boolean {
    for (const fn of this.blockers) {
      if (fn()) return true;
    }
    return false;
  }

  /**
   * Subscribe to blocker state changes.
   */
  subscribeBlocker(listener: () => void): () => void {
    this.blockerListeners.add(listener);
    return () => this.blockerListeners.delete(listener);
  }

  /**
   * Notify blocker listeners.
   */
  private notifyBlockers(): void {
    for (const listener of this.blockerListeners) {
      listener();
    }
  }

  /**
   * Proceed with a pending blocked navigation.
   */
  proceedNavigation(): void {
    const pending = this.pendingNavigation;
    this.pendingNavigation = null;
    // Temporarily remove blockers
    const savedBlockers = new Set(this.blockers);
    this.blockers.clear();
    this.notifyBlockers();
    if (pending) {
      this.navigate(pending.to, pending.options).finally(() => {
        // Restore blockers after navigation completes (even on failure)
        for (const fn of savedBlockers) {
          this.blockers.add(fn);
        }
      });
    }
  }

  /**
   * Reset pending navigation (user chose to stay).
   */
  resetNavigation(): void {
    this.pendingNavigation = null;
    this.notifyBlockers();
  }

  /**
   * Get current state from window.location.
   */
  private getStateFromLocation(): NavigationState {
    if (typeof window === 'undefined') {
      return { pathname: '/', search: '', hash: '' };
    }

    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      state: window.history.state,
    };
  }

  /**
   * Setup popstate listener.
   */
  private setupPopState(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('popstate', (event) => {
      // Check blockers for back/forward navigation
      if (this.isBlocked()) {
        // Capture destination BEFORE restoring old state (pushState changes window.location)
        const destination = window.location.pathname + window.location.search + window.location.hash;
        // Undo the browser navigation
        const current = this.currentState;
        window.history.pushState(current.state, '', current.pathname + current.search + current.hash);
        this.pendingNavigation = {
          to: destination,
          options: {},
        };
        this.notifyBlockers();
        return;
      }

      const from = this.currentState;
      this.currentState = this.getStateFromLocation();

      this.notify({
        type: 'pop',
        from,
        to: this.currentState,
      });
    });
  }

  /**
   * Navigate to a new URL.
   */
  async navigate(
    to: string,
    options: { replace?: boolean; state?: unknown; viewTransition?: boolean | ViewTransitionOptions } = {}
  ): Promise<void> {
    if (typeof window === 'undefined') return;

    // Check blockers before proceeding
    if (this.isBlocked()) {
      this.pendingNavigation = { to, options };
      this.notifyBlockers();
      return;
    }

    const useTransition = options.viewTransition === true
      ? areViewTransitionsEnabled() || options.viewTransition
      : options.viewTransition
        ? true
        : areViewTransitionsEnabled();

    const transitionOptions = typeof options.viewTransition === 'object'
      ? options.viewTransition
      : undefined;

    const doNavigate = () => {
      const url = new URL(to, window.location.origin);
      const from = this.currentState;

      const newState: NavigationState = {
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        state: options.state,
      };

      // Update history
      if (options.replace) {
        window.history.replaceState(options.state, '', to);
      } else {
        window.history.pushState(options.state, '', to);
      }

      this.currentState = newState;

      // Notify listeners
      this.notify({
        type: options.replace ? 'replace' : 'push',
        from,
        to: newState,
      });
    };

    if (useTransition) {
      startViewTransition(doNavigate, transitionOptions);
    } else {
      doNavigate();
    }
  }

  /**
   * Go back in history.
   */
  back(): void {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }

  /**
   * Go forward in history.
   */
  forward(): void {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  }

  /**
   * Go to a specific history entry.
   */
  go(delta: number): void {
    if (typeof window !== 'undefined') {
      window.history.go(delta);
    }
  }

  /**
   * Subscribe to navigation events.
   */
  subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners.
   */
  private notify(event: NavigationEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Get current navigation state.
   */
  getState(): NavigationState {
    return this.currentState;
  }

  /**
   * Check if a URL is the current location.
   */
  isActive(path: string, exact = false): boolean {
    if (exact) {
      return this.currentState.pathname === path;
    }
    return this.currentState.pathname.startsWith(path);
  }
}

/**
 * Global client router instance.
 */
export const router = new ClientRouter();

/**
 * Navigate to a new URL.
 */
export function navigate(
  to: string,
  options?: { replace?: boolean; state?: unknown; viewTransition?: boolean | ViewTransitionOptions }
): Promise<void> {
  return router.navigate(to, options);
}

/**
 * Go back in history.
 */
export function goBack(): void {
  router.back();
}

/**
 * Go forward in history.
 */
export function goForward(): void {
  router.forward();
}

/**
 * Subscribe to navigation events.
 */
export function onNavigate(listener: NavigationListener): () => void {
  return router.subscribe(listener);
}

/**
 * Get current navigation state.
 */
export function getNavigationState(): NavigationState {
  return router.getState();
}

/**
 * Fetch loader data for a route.
 */
export async function fetchLoaderData<T = unknown>(
  pathname: string,
  params?: RouteParams
): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error('fetchLoaderData is only available in the browser');
  }
  const url = new URL(pathname, window.location.origin);

  // Add params as query string if provided
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch loader data: ${response.status}`);
  }

  const result = await response.json();
  return result.data as T;
}

/**
 * Submit an action.
 */
export async function submitAction<T = unknown>(
  pathname: string,
  formData: FormData,
  options: { method?: string } = {}
): Promise<T> {
  const response = await fetch(pathname, {
    method: options.method || 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Action failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Scroll restoration helper.
 */
let scrollRestorationInitialized = false;

export function setupScrollRestoration(): void {
  if (typeof window === 'undefined') return;
  // Prevent duplicate setup (e.g., double initClient calls)
  if (scrollRestorationInitialized) return;
  scrollRestorationInitialized = true;

  // Disable browser's default scroll restoration
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // Store scroll positions (capped to prevent memory leaks)
  const MAX_SCROLL_ENTRIES = 200;
  const scrollPositions = new Map<string, number>();

  // Save scroll position before navigation
  router.subscribe((event) => {
    scrollPositions.set(event.from.pathname, window.scrollY);

    // Evict oldest entries if over capacity
    if (scrollPositions.size > MAX_SCROLL_ENTRIES) {
      const firstKey = scrollPositions.keys().next().value;
      if (firstKey !== undefined) scrollPositions.delete(firstKey);
    }

    // Restore scroll position on back/forward
    if (event.type === 'pop') {
      const savedPosition = scrollPositions.get(event.to.pathname);
      if (savedPosition !== undefined) {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition);
        });
      }
    } else {
      // Scroll to top on push/replace
      window.scrollTo(0, 0);
    }
  });
}
