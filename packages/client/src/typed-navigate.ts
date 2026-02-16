/**
 * @ereo/client - Type-Safe Navigation Utilities
 *
 * Navigate and redirect functions with compile-time route validation.
 *
 * @example
 * ```typescript
 * // Client-side navigation
 * await typedNavigate('/users/[id]', { params: { id: '123' } });
 *
 * // Server-side redirect
 * return typedRedirect('/login', { search: { returnTo: '/dashboard' } });
 *
 * // With search and hash params (Ereo exclusive)
 * await typedNavigate('/posts/[slug]', {
 *   params: { slug: 'hello' },
 *   search: { page: 1 },
 *   hash: { section: 'comments' },
 * });
 * ```
 */

import { navigate as baseNavigate, router } from './navigation';
import type {
  TypedRoutes,
  RouteParamsFor,
  SearchParamsFor,
  HashParamsFor,
} from '@ereo/core';

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Check if params object is empty (no required params).
 */
type IsEmptyObject<T> = keyof T extends never ? true : false;

/**
 * Check if all properties in T are optional.
 */
type AllOptional<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? true : false;
}[keyof T] extends true
  ? true
  : false;

/**
 * Navigation options with conditional params requirement.
 */
export type TypedNavigateOptions<Path extends TypedRoutes> =
  (IsEmptyObject<RouteParamsFor<Path>> extends true
    ? { params?: never }
    : AllOptional<RouteParamsFor<Path>> extends true
      ? { params?: RouteParamsFor<Path> }
      : { params: RouteParamsFor<Path> }) & {
    /** Search params */
    search?: Partial<SearchParamsFor<Path>>;
    /** Hash params - unique to Ereo */
    hash?: Partial<HashParamsFor<Path>>;
    /** Replace history instead of push */
    replace?: boolean;
    /** State to pass to the location */
    state?: unknown;
    /** Scroll to top after navigation */
    scroll?: boolean;
  };

/**
 * Redirect options with conditional params requirement.
 */
export type TypedRedirectOptions<Path extends TypedRoutes> =
  (IsEmptyObject<RouteParamsFor<Path>> extends true
    ? { params?: never }
    : AllOptional<RouteParamsFor<Path>> extends true
      ? { params?: RouteParamsFor<Path> }
      : { params: RouteParamsFor<Path> }) & {
    /** Search params */
    search?: Partial<SearchParamsFor<Path>>;
    /** Hash params - unique to Ereo */
    hash?: Partial<HashParamsFor<Path>>;
    /** HTTP status code (default: 302) */
    status?: 301 | 302 | 303 | 307 | 308;
    /** Custom headers */
    headers?: HeadersInit;
  };

// ============================================================================
// URL Building
// ============================================================================

/**
 * Build a URL path from a pattern and params.
 */
function buildPathWithParams(
  pattern: string,
  params: Record<string, string | string[] | undefined> | undefined
): string {
  if (!params) return pattern;

  let result = pattern;

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    // Handle catch-all [...param]
    if (result.includes(`[...${key}]`)) {
      const arrayValue = Array.isArray(value) ? value : [value];
      result = result.replace(`[...${key}]`, arrayValue.join('/'));
      continue;
    }

    // Handle optional [[param]]
    if (result.includes(`[[${key}]]`)) {
      result = result.replace(`[[${key}]]`, Array.isArray(value) ? value[0] : value);
      continue;
    }

    // Handle dynamic [param]
    if (result.includes(`[${key}]`)) {
      result = result.replace(`[${key}]`, Array.isArray(value) ? value[0] : value);
    }
  }

  // Remove unfilled optional params
  result = result.replace(/\/?\[\[[^\]]+\]\]/g, '');

  return result;
}

/**
 * Build a query string from search params.
 */
function buildSearchString(search: Record<string, unknown> | undefined): string {
  if (!search) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        params.append(key, String(v));
      }
    } else {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Build a hash string from hash params.
 */
function buildHashString(hash: Record<string, unknown> | undefined): string {
  if (!hash) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(hash)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }

  const hashString = params.toString();
  return hashString ? `#${hashString}` : '';
}

/**
 * Build a complete URL from pattern, params, search, and hash.
 */
export function buildTypedUrl<Path extends TypedRoutes>(
  pattern: Path,
  options: {
    params?: RouteParamsFor<Path>;
    search?: Partial<SearchParamsFor<Path>>;
    hash?: Partial<HashParamsFor<Path>>;
  } = {}
): string {
  const { params, search, hash } = options;

  const path = buildPathWithParams(
    pattern,
    params as Record<string, string | string[] | undefined>
  );
  const searchString = buildSearchString(search as Record<string, unknown>);
  const hashString = buildHashString(hash as Record<string, unknown>);

  return `${path}${searchString}${hashString}`;
}

// ============================================================================
// Client-Side Navigation
// ============================================================================

/**
 * Type-safe client-side navigation.
 *
 * Validates that:
 * 1. The route path exists in your route definitions
 * 2. Required params are provided with correct types
 * 3. Search params match the route's search schema
 * 4. Hash params match the route's hash schema (Ereo exclusive)
 *
 * @example
 * ```typescript
 * // Navigate to a static route
 * await typedNavigate('/about');
 *
 * // Navigate with params
 * await typedNavigate('/users/[id]', { params: { id: '123' } });
 *
 * // Navigate with all options
 * await typedNavigate('/posts/[slug]', {
 *   params: { slug: 'hello-world' },
 *   search: { page: 1, sort: 'asc' },
 *   hash: { section: 'comments' },
 *   replace: true,
 *   state: { fromDashboard: true },
 * });
 *
 * // Error - missing required params
 * await typedNavigate('/users/[id]'); // TypeScript error!
 * ```
 */
export async function typedNavigate<Path extends TypedRoutes>(
  path: Path,
  options?: TypedNavigateOptions<Path>
): Promise<void> {
  const url = buildTypedUrl(path, {
    params: (options as { params?: RouteParamsFor<Path> })?.params,
    search: options?.search,
    hash: options?.hash,
  });

  await baseNavigate(url, {
    replace: options?.replace,
    state: options?.state,
  });

  // Handle scroll
  if (options?.scroll !== false && typeof window !== 'undefined') {
    window.scrollTo(0, 0);
  }
}

/**
 * Type-safe navigation function returned by useTypedNavigate.
 */
export interface TypedNavigateFunction {
  /**
   * Navigate to a typed route.
   */
  <Path extends TypedRoutes>(path: Path, options?: TypedNavigateOptions<Path>): Promise<void>;

  /**
   * Navigate by delta (back/forward).
   */
  (delta: number): void;
}

/**
 * Hook that returns a type-safe navigate function.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const navigate = useTypedNavigate();
 *
 *   const handleClick = () => {
 *     navigate('/users/[id]', { params: { id: '123' } });
 *   };
 *
 *   const handleBack = () => {
 *     navigate(-1);
 *   };
 *
 *   return <button onClick={handleClick}>Go to user</button>;
 * }
 * ```
 */
export function useTypedNavigate(): TypedNavigateFunction {
  const navigateFunction: TypedNavigateFunction = (<Path extends TypedRoutes>(
    pathOrDelta: Path | number,
    options?: TypedNavigateOptions<Path>
  ): Promise<void> | void => {
    if (typeof pathOrDelta === 'number') {
      router.go(pathOrDelta);
      return;
    }

    return typedNavigate(pathOrDelta, options);
  }) as TypedNavigateFunction;

  return navigateFunction;
}

// ============================================================================
// Server-Side Redirect
// ============================================================================

/**
 * Type-safe server-side redirect.
 *
 * Creates a Response with redirect status and Location header.
 * Use this in loaders and actions for server-side redirects.
 *
 * @example
 * ```typescript
 * // In a loader or action
 * export const loader = async ({ request, context }) => {
 *   const user = context.get<User>('user');
 *
 *   if (!user) {
 *     return typedRedirect('/login', {
 *       search: { returnTo: new URL(request.url).pathname },
 *     });
 *   }
 *
 *   return { user };
 * };
 *
 * // Redirect to a route with params
 * return typedRedirect('/users/[id]', {
 *   params: { id: user.id },
 *   status: 303,
 * });
 * ```
 */
export function typedRedirect<Path extends TypedRoutes>(
  path: Path,
  options?: TypedRedirectOptions<Path>
): Response {
  const url = buildTypedUrl(path, {
    params: (options as { params?: RouteParamsFor<Path> })?.params,
    search: options?.search,
    hash: options?.hash,
  });

  const status = options?.status ?? 303;

  return new Response(null, {
    status,
    headers: {
      Location: url,
      ...(options?.headers instanceof Headers
        ? Object.fromEntries(options.headers.entries())
        : options?.headers),
    },
  });
}

/**
 * Alias for typedRedirect for familiarity.
 */
export const redirect = typedRedirect;

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Parse search params from a URL using a route's schema.
 * Returns typed search params for the given route.
 *
 * @example
 * ```typescript
 * const url = new URL(request.url);
 * const searchParams = parseTypedSearchParams<'/posts'>(url);
 * // searchParams is typed as SearchParamsFor<'/posts'>
 * ```
 */
export function parseTypedSearchParams<Path extends TypedRoutes>(
  url: URL | string
): Partial<SearchParamsFor<Path>> {
  const urlObj = typeof url === 'string' ? new URL(url) : url;
  const result: Record<string, string | string[]> = {};

  urlObj.searchParams.forEach((value, key) => {
    if (result[key]) {
      const existing = result[key];
      result[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      result[key] = value;
    }
  });

  return result as Partial<SearchParamsFor<Path>>;
}

/**
 * Parse hash params from a URL using a route's schema.
 * Returns typed hash params for the given route.
 * This is UNIQUE to Ereo - TanStack has no hash param support.
 *
 * @example
 * ```typescript
 * const url = new URL(request.url);
 * const hashParams = parseTypedHashParams<'/posts/[slug]'>(url);
 * // hashParams is typed as HashParamsFor<'/posts/[slug]'>
 * ```
 */
export function parseTypedHashParams<Path extends TypedRoutes>(
  url: URL | string
): Partial<HashParamsFor<Path>> {
  const urlObj = typeof url === 'string' ? new URL(url) : url;

  if (!urlObj.hash) {
    return {} as Partial<HashParamsFor<Path>>;
  }

  const hashParams = new URLSearchParams(urlObj.hash.slice(1));
  const result: Record<string, string> = {};

  hashParams.forEach((value, key) => {
    result[key] = value;
  });

  return result as Partial<HashParamsFor<Path>>;
}

// ============================================================================
// History Utilities
// ============================================================================

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
 * Go to a specific history entry.
 */
export function go(delta: number): void {
  router.go(delta);
}

/**
 * Check if a path is the current location.
 */
export function isCurrentPath<Path extends TypedRoutes>(
  path: Path,
  options?: { params?: RouteParamsFor<Path>; exact?: boolean }
): boolean {
  if (typeof window === 'undefined') return false;

  const targetPath = buildPathWithParams(
    path,
    options?.params as Record<string, string | string[] | undefined>
  ).split('?')[0].split('#')[0];

  const currentPath = window.location.pathname;

  if (options?.exact) {
    return currentPath === targetPath;
  }

  return (
    currentPath.startsWith(targetPath) &&
    (targetPath === '/' ? currentPath === '/' : true)
  );
}

// ============================================================================
// Preload Utilities
// ============================================================================

/**
 * Preload a route's data before navigation.
 * Useful for preparing data in advance.
 *
 * @example
 * ```typescript
 * // Preload on hover
 * onMouseEnter={() => preloadRoute('/users/[id]', { params: { id: '123' } })}
 * ```
 */
export async function preloadRoute<Path extends TypedRoutes>(
  path: Path,
  options?: {
    params?: RouteParamsFor<Path>;
    search?: Partial<SearchParamsFor<Path>>;
  }
): Promise<void> {
  const url = buildTypedUrl(path, {
    params: options?.params,
    search: options?.search,
  });

  // Fetch the route data (JSON mode)
  try {
    await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Ereo-Preload': 'true',
      },
    });
  } catch {
    // Silently fail preloads
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type { TypedRoutes, RouteParamsFor, SearchParamsFor, HashParamsFor };
