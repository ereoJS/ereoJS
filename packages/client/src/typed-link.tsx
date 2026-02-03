/**
 * @ereo/client - Type-Safe Link Component
 *
 * Link component that validates routes exist and requires correct params
 * per-route at compile time.
 *
 * @example
 * ```tsx
 * // Valid - route exists and params match
 * <TypedLink to="/users/[id]" params={{ id: "123" }}>User</TypedLink>
 *
 * // Error - missing required params
 * <TypedLink to="/users/[id]">User</TypedLink>
 *
 * // Error - route doesn't exist
 * <TypedLink to="/invalid">Invalid</TypedLink>
 *
 * // With search and hash params (Ereo exclusive)
 * <TypedLink
 *   to="/posts/[slug]"
 *   params={{ slug: "hello-world" }}
 *   search={{ page: 1 }}
 *   hash={{ section: "comments" }}
 * >
 *   Post
 * </TypedLink>
 * ```
 */

import * as React from 'react';
import { navigate, router, onNavigate, type NavigationState } from './navigation';
import { prefetch } from './prefetch';
import type {
  TypedRoutes,
  RouteParamsFor,
  SearchParamsFor,
  HashParamsFor,
  InferParams,
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
 * Make params prop required only if the route has required params.
 */
type ParamsProps<Path extends string, Params> =
  IsEmptyObject<Params> extends true
    ? { params?: never }
    : AllOptional<Params> extends true
      ? { params?: Params }
      : { params: Params };

/**
 * Make search prop optional, typed to route's search params.
 */
type SearchProps<Path extends TypedRoutes> = {
  search?: Partial<SearchParamsFor<Path>>;
};

/**
 * Make hash prop optional, typed to route's hash params.
 * This is UNIQUE to Ereo - TanStack has no hash param support.
 */
type HashProps<Path extends TypedRoutes> = {
  hash?: Partial<HashParamsFor<Path>>;
};

// ============================================================================
// Component Types
// ============================================================================

/**
 * Prefetch strategy for links.
 */
export type PrefetchStrategy = 'none' | 'intent' | 'render' | 'viewport';

/**
 * Base props for TypedLink.
 */
interface TypedLinkBaseProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Prefetch strategy (default: 'intent') */
  prefetch?: PrefetchStrategy;
  /** Replace history instead of push */
  replace?: boolean;
  /** Prevent scroll reset after navigation */
  preventScrollReset?: boolean;
  /** State to pass to the new location */
  state?: unknown;
  /** Reload the document instead of client navigation */
  reloadDocument?: boolean;
  /** Children elements */
  children?: React.ReactNode;
}

/**
 * Full props for TypedLink with conditional params requirement.
 */
export type TypedLinkProps<
  Path extends TypedRoutes = TypedRoutes
> = TypedLinkBaseProps & {
  /** Route path to navigate to */
  to: Path;
} & ParamsProps<Path extends string ? Path : never, RouteParamsFor<Path>> &
  SearchProps<Path> &
  HashProps<Path>;

// ============================================================================
// Path Building Utilities
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
export function buildUrl<Path extends TypedRoutes>(
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
// TypedLink Component
// ============================================================================

/**
 * Check if a URL is external (different origin).
 */
function isExternalUrl(url: string): boolean {
  if (typeof window === 'undefined') return false;

  if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('.')) {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Check if a click event should trigger client navigation.
 */
function shouldNavigate(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (event.button !== 0) {
    return false;
  }

  if (event.defaultPrevented) {
    return false;
  }

  return true;
}

/**
 * Type-safe Link component for client-side navigation.
 *
 * Validates that:
 * 1. The route path exists in your route definitions
 * 2. Required params are provided with correct types
 * 3. Search params match the route's search schema
 * 4. Hash params match the route's hash schema (Ereo exclusive)
 *
 * @example
 * ```tsx
 * // Basic usage
 * <TypedLink to="/about">About</TypedLink>
 *
 * // With params
 * <TypedLink to="/users/[id]" params={{ id: "123" }}>User Profile</TypedLink>
 *
 * // With search and hash params
 * <TypedLink
 *   to="/posts/[slug]"
 *   params={{ slug: "hello" }}
 *   search={{ page: 1, sort: 'asc' }}
 *   hash={{ section: 'comments' }}
 * >
 *   Post
 * </TypedLink>
 *
 * // Prefetch on viewport
 * <TypedLink to="/dashboard" prefetch="viewport">Dashboard</TypedLink>
 * ```
 */
export const TypedLink = React.forwardRef(function TypedLink<
  Path extends TypedRoutes
>(
  props: TypedLinkProps<Path>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const {
    to,
    params,
    search,
    hash,
    prefetch: prefetchStrategy = 'intent',
    replace = false,
    preventScrollReset = false,
    state,
    reloadDocument = false,
    onClick,
    onMouseEnter,
    onFocus,
    children,
    ...rest
  } = props as TypedLinkProps<Path> & {
    params?: Record<string, string | string[]>;
    search?: Record<string, unknown>;
    hash?: Record<string, unknown>;
  };

  const internalRef = React.useRef<HTMLAnchorElement>(null);
  const resolvedRef = (ref || internalRef) as React.RefObject<HTMLAnchorElement>;
  const hasPrefetched = React.useRef(false);

  // Build the full URL
  const href = React.useMemo(() => {
    return buildUrl(to, {
      params: params as RouteParamsFor<Path>,
      search: search as Partial<SearchParamsFor<Path>>,
      hash: hash as Partial<HashParamsFor<Path>>,
    });
  }, [to, params, search, hash]);

  const isExternal = isExternalUrl(href);

  // Trigger prefetch
  const triggerPrefetch = React.useCallback(() => {
    if (hasPrefetched.current || isExternal || prefetchStrategy === 'none') {
      return;
    }
    hasPrefetched.current = true;
    prefetch(href);
  }, [href, isExternal, prefetchStrategy]);

  // Handle click for client-side navigation
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);

      if (isExternal || reloadDocument) {
        return;
      }

      if (!shouldNavigate(event)) {
        return;
      }

      const target = event.currentTarget.getAttribute('target');
      if (target && target !== '_self') {
        return;
      }

      event.preventDefault();
      navigate(href, { replace, state });

      if (!preventScrollReset && typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
    },
    [onClick, href, replace, state, isExternal, reloadDocument, preventScrollReset]
  );

  // Handle hover for 'intent' prefetch
  const handleMouseEnter = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onMouseEnter?.(event);
      if (prefetchStrategy === 'intent') {
        triggerPrefetch();
      }
    },
    [onMouseEnter, prefetchStrategy, triggerPrefetch]
  );

  // Handle focus for 'intent' prefetch
  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLAnchorElement>) => {
      onFocus?.(event);
      if (prefetchStrategy === 'intent') {
        triggerPrefetch();
      }
    },
    [onFocus, prefetchStrategy, triggerPrefetch]
  );

  // Prefetch on render
  React.useEffect(() => {
    if (prefetchStrategy === 'render') {
      triggerPrefetch();
    }
  }, [prefetchStrategy, triggerPrefetch]);

  // Prefetch on viewport intersection
  React.useEffect(() => {
    if (prefetchStrategy !== 'viewport' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const element = resolvedRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            triggerPrefetch();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [prefetchStrategy, triggerPrefetch, resolvedRef]);

  return (
    <a
      {...rest}
      ref={resolvedRef}
      href={href}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
    >
      {children}
    </a>
  );
}) as <Path extends TypedRoutes>(
  props: TypedLinkProps<Path> & { ref?: React.ForwardedRef<HTMLAnchorElement> }
) => React.ReactElement | null;

// ============================================================================
// TypedNavLink Component
// ============================================================================

/**
 * Active state props for TypedNavLink.
 */
export interface NavLinkActiveProps {
  isActive: boolean;
  isPending: boolean;
}

/**
 * TypedNavLink props extending TypedLink with active state support.
 */
export type TypedNavLinkProps<Path extends TypedRoutes = TypedRoutes> = Omit<
  TypedLinkProps<Path>,
  'className' | 'style'
> & {
  /** Class name - can be a function that receives active state */
  className?: string | ((props: NavLinkActiveProps) => string);
  /** Style - can be a function that receives active state */
  style?: React.CSSProperties | ((props: NavLinkActiveProps) => React.CSSProperties);
  /** Match exact path only (default: false) */
  end?: boolean;
};

/**
 * Type-safe NavLink component with active state styling.
 *
 * @example
 * ```tsx
 * <TypedNavLink
 *   to="/dashboard"
 *   className={({ isActive }) => isActive ? 'active' : ''}
 * >
 *   Dashboard
 * </TypedNavLink>
 *
 * <TypedNavLink
 *   to="/users/[id]"
 *   params={{ id: "123" }}
 *   style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}
 * >
 *   User
 * </TypedNavLink>
 * ```
 */
export const TypedNavLink = React.forwardRef(function TypedNavLink<
  Path extends TypedRoutes
>(
  props: TypedNavLinkProps<Path>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const {
    className,
    style,
    end = false,
    to,
    params,
    search,
    hash,
    ...rest
  } = props as TypedNavLinkProps<Path> & {
    params?: Record<string, string | string[]>;
    search?: Record<string, unknown>;
    hash?: Record<string, unknown>;
  };

  const [navigationState, setNavigationState] = React.useState<NavigationState>(() => {
    if (typeof window !== 'undefined') {
      return router.getState();
    }
    return { pathname: '/', search: '', hash: '' };
  });

  React.useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      setNavigationState(event.to);
    });
    return unsubscribe;
  }, []);

  // Build the target path for comparison
  const targetPath = React.useMemo(() => {
    return buildPathWithParams(
      to,
      params as Record<string, string | string[] | undefined>
    ).split('?')[0].split('#')[0];
  }, [to, params]);

  // Determine active state
  const isActive = React.useMemo(() => {
    if (end) {
      return navigationState.pathname === targetPath;
    }
    return (
      navigationState.pathname.startsWith(targetPath) &&
      (targetPath === '/' ? navigationState.pathname === '/' : true)
    );
  }, [targetPath, end, navigationState.pathname]);

  const isPending = false; // Would need pending navigation context

  const activeProps: NavLinkActiveProps = { isActive, isPending };

  const resolvedClassName =
    typeof className === 'function' ? className(activeProps) : className;

  const resolvedStyle =
    typeof style === 'function' ? style(activeProps) : style;

  // Build href for the underlying anchor
  const href = React.useMemo(() => {
    return buildUrl(to, {
      params: params as RouteParamsFor<Path>,
      search: search as Partial<SearchParamsFor<Path>>,
      hash: hash as Partial<HashParamsFor<Path>>,
    });
  }, [to, params, search, hash]);

  // Render the anchor directly to avoid complex type inference issues
  return (
    <a
      {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      ref={ref}
      href={href}
      className={resolvedClassName}
      style={resolvedStyle}
      aria-current={isActive ? 'page' : undefined}
    />
  );
}) as <Path extends TypedRoutes>(
  props: TypedNavLinkProps<Path> & { ref?: React.ForwardedRef<HTMLAnchorElement> }
) => React.ReactElement | null;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to check if a route is currently active.
 *
 * @example
 * ```tsx
 * const isActive = useIsRouteActive('/users/[id]', { params: { id: '123' } });
 * ```
 */
export function useIsRouteActive<Path extends TypedRoutes>(
  path: Path,
  options: {
    params?: RouteParamsFor<Path>;
    end?: boolean;
  } = {}
): boolean {
  const { params, end = false } = options;

  const [pathname, setPathname] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  React.useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      setPathname(event.to.pathname);
    });
    return unsubscribe;
  }, []);

  const targetPath = buildPathWithParams(
    path,
    params as Record<string, string | string[] | undefined>
  ).split('?')[0].split('#')[0];

  if (end) {
    return pathname === targetPath;
  }

  return (
    pathname.startsWith(targetPath) &&
    (targetPath === '/' ? pathname === '/' : true)
  );
}
