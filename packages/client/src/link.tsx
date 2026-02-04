/**
 * @ereo/client - Link Component
 *
 * Link and NavLink components with prefetch support for client-side navigation.
 */

import * as React from 'react';
import { navigate, router, onNavigate, type NavigationState } from './navigation';
import { prefetch } from './prefetch';

/**
 * Prefetch strategy for links.
 */
export type PrefetchStrategy = 'none' | 'intent' | 'render' | 'viewport';

/**
 * Link component props.
 */
export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** URL to navigate to (alias: href) */
  to?: string;
  /** URL to navigate to (alias: to) - for Next.js-style API compatibility */
  href?: string;
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
 * Check if a URL is external (different origin).
 */
function isExternalUrl(url: string): boolean {
  if (typeof window === 'undefined') return false;

  // Single-slash relative URLs are internal (but not protocol-relative //)
  if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('.')) {
    return false;
  }

  // Protocol-relative or absolute URLs
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
  // Don't navigate if modifier keys are pressed
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  // Don't navigate if it's not a left click
  if (event.button !== 0) {
    return false;
  }

  // Don't navigate if default is prevented
  if (event.defaultPrevented) {
    return false;
  }

  return true;
}

/**
 * Link component for client-side navigation with prefetch support.
 *
 * Renders an anchor tag for accessibility and SEO while intercepting
 * clicks for client-side navigation.
 *
 * @example
 * ```tsx
 * <Link to="/about">About</Link>
 * <Link to="/dashboard" prefetch="render">Dashboard</Link>
 * <Link to="/external" reloadDocument>External</Link>
 * ```
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    to,
    href,
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
  },
  ref
) {
  const internalRef = React.useRef<HTMLAnchorElement>(null);
  const resolvedRef = (ref || internalRef) as React.RefObject<HTMLAnchorElement>;
  const hasPrefetched = React.useRef(false);

  // Support both 'to' and 'href' props - 'to' takes precedence
  const destination = to ?? href ?? '/';

  // Determine if URL is external
  const isExternal = isExternalUrl(destination);

  // Trigger prefetch
  const triggerPrefetch = React.useCallback(() => {
    if (hasPrefetched.current || isExternal || prefetchStrategy === 'none') {
      return;
    }
    hasPrefetched.current = true;
    prefetch(destination);
  }, [destination, isExternal, prefetchStrategy]);

  // Handle click for client-side navigation
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);

      // Skip client navigation for external URLs or reload requests
      if (isExternal || reloadDocument) {
        return;
      }

      // Check if we should perform client navigation
      if (!shouldNavigate(event)) {
        return;
      }

      // Check target attribute
      const target = event.currentTarget.getAttribute('target');
      if (target && target !== '_self') {
        return;
      }

      // Prevent default and navigate
      event.preventDefault();
      navigate(destination, { replace, state });

      // Handle scroll reset
      if (!preventScrollReset && typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
    },
    [onClick, destination, replace, state, isExternal, reloadDocument, preventScrollReset]
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
      href={destination}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
    >
      {children}
    </a>
  );
});

/**
 * Active state props for NavLink.
 */
export interface NavLinkActiveProps {
  isActive: boolean;
  isPending: boolean;
}

/**
 * NavLink component props.
 */
export interface NavLinkProps extends Omit<LinkProps, 'className' | 'style'> {
  /** Class name - can be a function that receives active state */
  className?: string | ((props: NavLinkActiveProps) => string);
  /** Style - can be a function that receives active state */
  style?: React.CSSProperties | ((props: NavLinkActiveProps) => React.CSSProperties);
  /** Match exact path only (default: false) */
  end?: boolean;
}

/**
 * NavLink component - Link with active state styling.
 *
 * Automatically applies active styles/classes when the current
 * location matches the link's destination.
 *
 * @example
 * ```tsx
 * <NavLink
 *   to="/dashboard"
 *   className={({ isActive }) => isActive ? 'active' : ''}
 * >
 *   Dashboard
 * </NavLink>
 *
 * <NavLink
 *   to="/settings"
 *   style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal' })}
 * >
 *   Settings
 * </NavLink>
 * ```
 */
export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { className, style, end = false, to, href, ...rest },
  ref
) {
  // Support both 'to' and 'href' props - 'to' takes precedence
  const destination = to ?? href ?? '/';

  const [navigationState, setNavigationState] = React.useState<NavigationState>(() => {
    if (typeof window !== 'undefined') {
      return router.getState();
    }
    return { pathname: '/', search: '', hash: '' };
  });

  // Subscribe to navigation changes
  React.useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      setNavigationState(event.to);
    });
    return unsubscribe;
  }, []);

  // Determine active state
  const isActive = React.useMemo(() => {
    const toPath = destination.split('?')[0].split('#')[0]; // Remove query and hash
    if (end) {
      return navigationState.pathname === toPath;
    }
    return navigationState.pathname.startsWith(toPath) &&
           (toPath === '/' ? navigationState.pathname === '/' : true);
  }, [destination, end, navigationState.pathname]);

  // For pending state, we would need a pending navigation context
  // For now, we'll just set it to false
  const isPending = false;

  const activeProps: NavLinkActiveProps = { isActive, isPending };

  // Resolve className
  const resolvedClassName = typeof className === 'function'
    ? className(activeProps)
    : className;

  // Resolve style
  const resolvedStyle = typeof style === 'function'
    ? style(activeProps)
    : style;

  return (
    <Link
      {...rest}
      ref={ref}
      to={destination}
      className={resolvedClassName}
      style={resolvedStyle}
      aria-current={isActive ? 'page' : undefined}
    />
  );
});

/**
 * Hook to get the active state for a given path.
 * Useful for building custom navigation components.
 */
export function useIsActive(path: string, end = false): boolean {
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

  const toPath = path.split('?')[0].split('#')[0];
  if (end) {
    return pathname === toPath;
  }
  return pathname.startsWith(toPath) &&
         (toPath === '/' ? pathname === '/' : true);
}
