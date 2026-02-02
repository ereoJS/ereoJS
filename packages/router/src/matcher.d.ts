/**
 * @areo/router - URL Pattern Matching
 *
 * Matches URLs against route patterns and extracts parameters.
 * Supports dynamic segments, catch-all, and optional segments.
 */
import type { Route, RouteMatch } from '@areo/core';
import type { RouteSegment, MatchResult } from './types';
/**
 * Parse a path pattern into segments.
 */
export declare function parsePathSegments(path: string): RouteSegment[];
/**
 * Calculate route score for sorting.
 * Higher scores are matched first.
 */
export declare function calculateRouteScore(segments: RouteSegment[]): number;
/**
 * Convert route pattern to regex.
 */
export declare function patternToRegex(segments: RouteSegment[]): RegExp;
/**
 * Match a URL path against a single route.
 */
export declare function matchRoute(pathname: string, route: Route, segments: RouteSegment[]): RouteMatch | null;
/**
 * Route matcher class.
 * Pre-compiles routes for efficient matching.
 */
export declare class RouteMatcher {
    private routes;
    constructor(routes: Route[]);
    /**
     * Compile and sort routes.
     */
    private compileRoutes;
    /**
     * Flatten nested routes.
     */
    private flattenRoutes;
    /**
     * Match a URL pathname against compiled routes.
     */
    match(pathname: string): RouteMatch | null;
    /**
     * Get all routes.
     */
    getRoutes(): Route[];
    /**
     * Add a route dynamically.
     */
    addRoute(route: Route): void;
    /**
     * Remove a route by ID.
     */
    removeRoute(routeId: string): boolean;
}
/**
 * Create a route matcher from routes.
 */
export declare function createMatcher(routes: Route[]): RouteMatcher;
/**
 * Match with layout resolution.
 * Returns all matching layouts from root to the matched route.
 */
export declare function matchWithLayouts(pathname: string, routes: Route[]): MatchResult | null;
//# sourceMappingURL=matcher.d.ts.map