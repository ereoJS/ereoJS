/**
 * @ereo/router - URL Pattern Matching
 *
 * Matches URLs against route patterns and extracts parameters.
 * Supports dynamic segments, catch-all, and optional segments.
 */

import type { Route, RouteParams, RouteMatch } from '@ereo/core';
import type { RouteSegment, MatchResult } from './types';
import {
  DYNAMIC_SEGMENT_PATTERN,
  CATCH_ALL_PATTERN,
  OPTIONAL_PATTERN,
  ROUTE_SCORE,
} from './types';

/**
 * Parse a path pattern into segments.
 */
export function parsePathSegments(path: string): RouteSegment[] {
  const segments: RouteSegment[] = [];
  const parts = path.split('/').filter(Boolean);

  for (const part of parts) {
    // Check for catch-all [...param]
    const catchAllMatch = part.match(CATCH_ALL_PATTERN);
    if (catchAllMatch) {
      segments.push({
        raw: part,
        type: 'catchAll',
        paramName: catchAllMatch[1],
      });
      continue;
    }

    // Check for optional [[param]]
    const optionalMatch = part.match(OPTIONAL_PATTERN);
    if (optionalMatch) {
      segments.push({
        raw: part,
        type: 'optional',
        paramName: optionalMatch[1],
      });
      continue;
    }

    // Check for dynamic [param]
    const dynamicMatch = part.match(DYNAMIC_SEGMENT_PATTERN);
    if (dynamicMatch) {
      segments.push({
        raw: part,
        type: 'dynamic',
        paramName: dynamicMatch[1],
      });
      continue;
    }

    // Static segment
    segments.push({
      raw: part,
      type: 'static',
    });
  }

  return segments;
}

/**
 * Calculate route score for sorting.
 * Higher scores are matched first.
 */
export function calculateRouteScore(segments: RouteSegment[]): number {
  let score = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Earlier segments have more weight
    const positionMultiplier = 1000 / (i + 1);

    switch (segment.type) {
      case 'static':
        score += ROUTE_SCORE.STATIC * positionMultiplier;
        break;
      case 'dynamic':
        score += ROUTE_SCORE.DYNAMIC * positionMultiplier;
        break;
      case 'optional':
        score += ROUTE_SCORE.OPTIONAL * positionMultiplier;
        break;
      case 'catchAll':
        score += ROUTE_SCORE.CATCH_ALL * positionMultiplier;
        break;
    }
  }

  return score;
}

/**
 * Convert route pattern to regex.
 */
export function patternToRegex(segments: RouteSegment[]): RegExp {
  if (segments.length === 0) {
    return /^\/$/;
  }

  let pattern = '^';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    switch (segment.type) {
      case 'static':
        pattern += `\\/${escapeRegex(segment.raw)}`;
        break;
      case 'dynamic':
        pattern += '\\/([^/]+)';
        break;
      case 'optional':
        pattern += '(?:\\/([^/]+))?';
        break;
      case 'catchAll':
        pattern += '(?:\\/(.+))?';
        break;
    }
  }

  pattern += '\\/?$';
  return new RegExp(pattern);
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match a URL path against a single route.
 */
export function matchRoute(
  pathname: string,
  route: Route,
  segments: RouteSegment[]
): RouteMatch | null {
  const regex = patternToRegex(segments);
  const match = pathname.match(regex);

  if (!match) {
    return null;
  }

  // Extract parameters
  const params: RouteParams = {};
  let paramIndex = 1;

  for (const segment of segments) {
    if (segment.paramName) {
      const value = match[paramIndex];
      if (segment.type === 'catchAll' && value) {
        // Split catch-all into array
        params[segment.paramName] = value.split('/');
      } else if (value !== undefined) {
        params[segment.paramName] = value;
      }
      paramIndex++;
    }
  }

  return {
    route,
    params,
    pathname,
  };
}

/**
 * Route matcher class.
 * Pre-compiles routes for efficient matching.
 */
export class RouteMatcher {
  private routes: Array<{
    route: Route;
    segments: RouteSegment[];
    regex: RegExp;
    score: number;
  }> = [];

  constructor(routes: Route[]) {
    this.compileRoutes(routes);
  }

  /**
   * Compile and sort routes.
   */
  private compileRoutes(routes: Route[]): void {
    const flatRoutes = this.flattenRoutes(routes);

    this.routes = flatRoutes
      .map((route) => {
        const segments = parsePathSegments(route.path);
        return {
          route,
          segments,
          regex: patternToRegex(segments),
          score: calculateRouteScore(segments),
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Flatten nested routes.
   */
  private flattenRoutes(routes: Route[], parent?: Route): Route[] {
    const result: Route[] = [];

    for (const route of routes) {
      // Skip layout-only routes from direct matching
      if (!route.layout || route.index) {
        result.push(route);
      }

      if (route.children) {
        result.push(...this.flattenRoutes(route.children, route));
      }
    }

    return result;
  }

  /**
   * Match a URL pathname against compiled routes.
   */
  match(pathname: string): RouteMatch | null {
    // Normalize pathname: collapse double slashes, handle empty
    let normalizedPath = pathname === '' ? '/' : pathname;
    // Collapse consecutive slashes (e.g., //admin///users → /admin/users)
    normalizedPath = normalizedPath.replace(/\/{2,}/g, '/');
    // Decode URI components for matching (e.g., /users/hello%20world → /users/hello world)
    try {
      normalizedPath = decodeURIComponent(normalizedPath);
    } catch {
      // Malformed URI, use as-is
    }

    for (const { route, segments, regex } of this.routes) {
      const match = normalizedPath.match(regex);

      if (match) {
        const params: RouteParams = {};
        let paramIndex = 1;

        for (const segment of segments) {
          if (segment.paramName) {
            const value = match[paramIndex];
            if (segment.type === 'catchAll' && value) {
              params[segment.paramName] = value.split('/');
            } else if (value !== undefined) {
              params[segment.paramName] = value;
            }
            paramIndex++;
          }
        }

        return {
          route,
          params,
          pathname: normalizedPath,
        };
      }
    }

    return null;
  }

  /**
   * Get all routes.
   */
  getRoutes(): Route[] {
    return this.routes.map((r) => r.route);
  }

  /**
   * Add a route dynamically.
   */
  addRoute(route: Route): void {
    const segments = parsePathSegments(route.path);
    const entry = {
      route,
      segments,
      regex: patternToRegex(segments),
      score: calculateRouteScore(segments),
    };

    // Insert in sorted order
    const insertIndex = this.routes.findIndex((r) => r.score < entry.score);
    if (insertIndex === -1) {
      this.routes.push(entry);
    } else {
      this.routes.splice(insertIndex, 0, entry);
    }
  }

  /**
   * Remove a route by ID.
   */
  removeRoute(routeId: string): boolean {
    const index = this.routes.findIndex((r) => r.route.id === routeId);
    if (index !== -1) {
      this.routes.splice(index, 1);
      return true;
    }
    return false;
  }
}

/**
 * Create a route matcher from routes.
 */
export function createMatcher(routes: Route[]): RouteMatcher {
  return new RouteMatcher(routes);
}

/**
 * Match with layout resolution.
 * Returns all matching layouts from root to the matched route.
 */
export function matchWithLayouts(
  pathname: string,
  routes: Route[]
): MatchResult | null {
  const matcher = new RouteMatcher(routes);
  const match = matcher.match(pathname);

  if (!match) {
    return null;
  }

  // Find all layouts that apply to this route by checking path prefixes
  // Layouts apply if the matched route's path starts with the layout's path
  const layouts: Route[] = [];

  const collectLayouts = (routeList: Route[], currentPath: string): void => {
    for (const route of routeList) {
      if (route.layout) {
        // A layout at path "/" applies to all routes
        // A layout at path "/blog" applies to "/blog", "/blog/post", etc.
        const layoutPath = route.path === '/' ? '' : route.path;
        const matchPath = match.pathname === '/' ? '' : match.pathname;

        if (matchPath === layoutPath || matchPath.startsWith(layoutPath + '/') || layoutPath === '') {
          layouts.push(route);
        }
      }

      // Recurse into children
      if (route.children) {
        collectLayouts(route.children, currentPath + route.path);
      }
    }
  };

  collectLayouts(routes, '');

  // Sort layouts by path length (shortest first = outermost)
  layouts.sort((a, b) => a.path.length - b.path.length);

  return {
    ...match,
    layouts,
  };
}
