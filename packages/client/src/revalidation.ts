/**
 * @ereo/client - Revalidation
 *
 * Controls which route loaders re-run after navigations and mutations.
 * Routes can export a `shouldRevalidate` function to opt out of
 * unnecessary data re-fetching, improving performance.
 */

import {
  useState,
  useCallback,
  useContext,
} from 'react';
import type {
  RouteModule,
  RouteParams,
  ShouldRevalidateArgs,
  ShouldRevalidateFunction,
} from '@ereo/core';
import { LoaderDataContext, type LoaderDataContextValue } from './hooks';
import { MatchesContext, type MatchesContextValue } from './matches';

/**
 * A matched route with its loaded module, used for revalidation decisions.
 */
export interface RevalidationRoute {
  /** Route identifier */
  id: string;
  /** Route path pattern */
  path: string;
  /** The loaded route module */
  module?: RouteModule;
  /** Current params for this route */
  params: RouteParams;
}

/**
 * Context for a revalidation check after a navigation or mutation.
 */
export interface RevalidationContext {
  /** The URL the user is navigating from */
  currentUrl: URL;
  /** The URL the user is navigating to */
  nextUrl: URL;
  /** If triggered by a form submission, the HTTP method */
  formMethod?: string;
  /** If triggered by a form submission, the action URL */
  formAction?: string;
  /** If triggered by a form submission, the form data */
  formData?: FormData;
  /** If triggered by a completed action, the action result */
  actionResult?: unknown;
}

/**
 * Determine which routes need their loaders re-run.
 *
 * For each active route, checks its `shouldRevalidate` export.
 * If the route doesn't export one, it defaults to revalidating.
 *
 * @param routes - The currently matched routes (including layouts)
 * @param nextParams - The params that will be active after navigation
 * @param context - Information about the navigation/mutation that triggered revalidation
 * @returns Array of route IDs that should have their loaders re-run
 */
export function getRoutesToRevalidate(
  routes: RevalidationRoute[],
  nextParams: RouteParams,
  context: RevalidationContext
): string[] {
  const routeIds: string[] = [];

  for (const route of routes) {
    const shouldRevalidateFn = route.module?.shouldRevalidate;

    if (!shouldRevalidateFn) {
      // No shouldRevalidate export — always revalidate (default behavior)
      if (route.module?.loader) {
        routeIds.push(route.id);
      }
      continue;
    }

    // Only consider routes that have a loader
    if (!route.module?.loader) {
      continue;
    }

    const args: ShouldRevalidateArgs = {
      currentUrl: context.currentUrl,
      nextUrl: context.nextUrl,
      currentParams: route.params,
      nextParams,
      formMethod: context.formMethod,
      formAction: context.formAction,
      formData: context.formData,
      actionResult: context.actionResult,
      defaultShouldRevalidate: true,
    };

    try {
      if (shouldRevalidateFn(args)) {
        routeIds.push(route.id);
      }
    } catch (error) {
      // If shouldRevalidate throws, default to revalidating for safety
      console.error(
        `shouldRevalidate threw for route "${route.id}", defaulting to revalidate:`,
        error
      );
      routeIds.push(route.id);
    }
  }

  return routeIds;
}

/**
 * Check if a single route should revalidate.
 *
 * Utility for checking individual routes outside of a batch.
 */
export function checkShouldRevalidate(
  shouldRevalidateFn: ShouldRevalidateFunction | undefined,
  args: ShouldRevalidateArgs
): boolean {
  if (!shouldRevalidateFn) {
    return args.defaultShouldRevalidate;
  }

  try {
    return shouldRevalidateFn(args);
  } catch {
    return args.defaultShouldRevalidate;
  }
}

/**
 * State returned by useRevalidator.
 */
export interface RevalidatorState {
  /** Current revalidation state */
  state: 'idle' | 'loading';
  /** Trigger a revalidation of the current route's data */
  revalidate: () => Promise<void>;
}

/**
 * Hook to manually revalidate the current route's loader data.
 * Fetches fresh data from the server and updates contexts.
 *
 * @returns RevalidatorState with state and revalidate function
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { state, revalidate } = useRevalidator();
 *   return (
 *     <button onClick={revalidate} disabled={state === 'loading'}>
 *       {state === 'loading' ? 'Refreshing...' : 'Refresh Data'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useRevalidator(): RevalidatorState {
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const loaderCtx = useContext(LoaderDataContext);
  const matchesCtx = useContext(MatchesContext);

  const revalidate = useCallback(async () => {
    // SSR-safe: no-op on server
    if (typeof window === 'undefined') return;

    setState('loading');
    try {
      const response = await fetch(window.location.href, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Revalidation failed: ${response.status}`);
      }

      const result = await response.json();

      // Update loader data context
      if (loaderCtx) {
        loaderCtx.setData(result.data);
      }

      // Update matches context if matches data is returned
      if (matchesCtx && result.matches) {
        matchesCtx.setMatches(result.matches);
      }
    } catch (error) {
      console.error('Revalidation error:', error);
    } finally {
      setState('idle');
    }
  }, [loaderCtx, matchesCtx]);

  return { state, revalidate };
}
