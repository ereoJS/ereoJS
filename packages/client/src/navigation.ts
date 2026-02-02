/**
 * @areo/client - Client-side Navigation
 *
 * SPA-style navigation with loader data fetching.
 */

import type { RouteParams } from '@areo/core';

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
 * Client router for SPA navigation.
 */
class ClientRouter {
  private listeners = new Set<NavigationListener>();
  private currentState: NavigationState;

  constructor() {
    this.currentState = this.getStateFromLocation();
    this.setupPopState();
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
    options: { replace?: boolean; state?: unknown } = {}
  ): Promise<void> {
    if (typeof window === 'undefined') return;

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
  options?: { replace?: boolean; state?: unknown }
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
export function setupScrollRestoration(): void {
  if (typeof window === 'undefined') return;

  // Disable browser's default scroll restoration
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // Store scroll positions
  const scrollPositions = new Map<string, number>();

  // Save scroll position before navigation
  router.subscribe((event) => {
    scrollPositions.set(event.from.pathname, window.scrollY);

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
