/**
 * @ereo/client - useMatches Hook
 *
 * Provides access to all matched route segments and their data.
 * Enables breadcrumbs, analytics, route-based metadata, and more.
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  createElement,
  type ReactNode,
  type Context,
} from 'react';

import type { RouteParams, RouteHandle } from '@ereo/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Data for a single matched route in the route hierarchy.
 * Returned as part of the useMatches() array.
 */
export interface RouteMatchData {
  /** Route identifier (e.g., '/users/[id]' or 'root-layout') */
  id: string;
  /** Matched pathname for this route segment */
  pathname: string;
  /** Route params at this level */
  params: RouteParams;
  /** Loader data for this route (null if no loader) */
  data: unknown;
  /** Route handle metadata (from `export const handle = { ... }`) */
  handle: RouteHandle | undefined;
}

/**
 * Context value for the matches context.
 */
export interface MatchesContextValue {
  matches: RouteMatchData[];
  setMatches: (matches: RouteMatchData[]) => void;
}

/**
 * Props for MatchesProvider.
 */
export interface MatchesProviderProps {
  children: ReactNode;
  initialMatches?: RouteMatchData[];
}

// ============================================================================
// Context
// ============================================================================

/**
 * Context holding all matched routes for the current URL.
 */
export const MatchesContext: Context<MatchesContextValue | null> =
  createContext<MatchesContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

/**
 * Access all matched routes from root layout to current page.
 *
 * Returns an array of match objects, each containing the route's id,
 * pathname, params, loader data, and handle metadata.
 *
 * @returns Array of RouteMatchData, ordered from outermost layout to page
 * @throws Error if used outside of EreoProvider
 *
 * @example
 * ```tsx
 * // Build breadcrumbs from handle metadata
 * function Breadcrumbs() {
 *   const matches = useMatches();
 *
 *   const crumbs = matches
 *     .filter(m => m.handle?.breadcrumb)
 *     .map(m => ({
 *       label: m.handle!.breadcrumb as string,
 *       path: m.pathname,
 *     }));
 *
 *   return (
 *     <nav>
 *       {crumbs.map((c, i) => (
 *         <span key={i}>{i > 0 && ' > '}{c.label}</span>
 *       ))}
 *     </nav>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Analytics: track route data
 * function Analytics() {
 *   const matches = useMatches();
 *   const routeIds = matches.map(m => m.id);
 *   useEffect(() => {
 *     trackPageView(routeIds);
 *   }, [routeIds.join(',')]);
 *   return null;
 * }
 * ```
 */
export function useMatches(): RouteMatchData[] {
  const context = useContext(MatchesContext);

  if (context === null) {
    throw new Error(
      'useMatches must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
  }

  return context.matches;
}

// ============================================================================
// Provider
// ============================================================================

/**
 * Provider for route matches context.
 */
export function MatchesProvider({
  children,
  initialMatches = [],
}: MatchesProviderProps): ReactNode {
  const [matches, setMatches] = useState<RouteMatchData[]>(initialMatches);

  const value = useMemo<MatchesContextValue>(
    () => ({ matches, setMatches }),
    [matches]
  );

  return createElement(MatchesContext.Provider, { value }, children);
}
