/**
 * @areo/router - Route Type Definitions
 *
 * Types for file-based routing system.
 */
import type { Route, RouteParams, RouteModule } from '@areo/core';
/**
 * File system route (before processing).
 */
export interface FileRoute {
    /** Relative file path from routes directory */
    relativePath: string;
    /** Absolute file path */
    absolutePath: string;
    /** File extension */
    extension: string;
}
/**
 * Parsed route segment.
 */
export interface RouteSegment {
    /** The raw segment value */
    raw: string;
    /** Type of segment */
    type: 'static' | 'dynamic' | 'catchAll' | 'optional';
    /** Parameter name (for dynamic/catchAll segments) */
    paramName?: string;
}
/**
 * Route node in the tree.
 */
export interface RouteNode {
    /** Route ID (unique identifier) */
    id: string;
    /** URL path pattern */
    path: string;
    /** Parsed path segments */
    segments: RouteSegment[];
    /** File path */
    file: string;
    /** Is this an index route? */
    index: boolean;
    /** Is this a layout? */
    layout: boolean;
    /** Child routes */
    children: RouteNode[];
    /** Parent route (for layout resolution) */
    parent?: RouteNode;
    /** Loaded module */
    module?: RouteModule;
    /** Score for sorting (more specific routes first) */
    score: number;
}
/**
 * Router options.
 */
export interface RouterOptions {
    /** Routes directory (default: 'app/routes') */
    routesDir?: string;
    /** Base path (default: '') */
    basePath?: string;
    /** File extensions to consider routes (default: ['.tsx', '.ts', '.jsx', '.js']) */
    extensions?: string[];
    /** Whether to watch for changes (dev mode) */
    watch?: boolean;
}
/**
 * Match result from URL pattern matching.
 */
export interface MatchResult {
    /** The matched route */
    route: Route;
    /** Extracted parameters */
    params: RouteParams;
    /** Matched pathname */
    pathname: string;
    /** Layouts to render (from root to leaf) */
    layouts: Route[];
}
/**
 * Route registry for type-safe routing.
 */
export interface RouteRegistry {
    /** All registered routes */
    routes: Map<string, Route>;
    /** Get route by path */
    get(path: string): Route | undefined;
    /** Check if route exists */
    has(path: string): boolean;
}
/**
 * File router events.
 */
export interface RouterEvents {
    /** Route added */
    add: (route: Route) => void;
    /** Route removed */
    remove: (routeId: string) => void;
    /** Route changed */
    change: (route: Route) => void;
    /** All routes reloaded */
    reload: (routes: Route[]) => void;
}
/**
 * Route sorting priority.
 * Higher values = higher priority (matched first).
 */
export declare const ROUTE_SCORE: {
    readonly STATIC: 100;
    readonly INDEX: 90;
    readonly DYNAMIC: 50;
    readonly OPTIONAL: 30;
    readonly CATCH_ALL: 10;
};
/**
 * Special file names.
 */
export declare const SPECIAL_FILES: {
    readonly LAYOUT: "_layout";
    readonly ERROR: "_error";
    readonly LOADING: "_loading";
    readonly NOT_FOUND: "_404";
};
/**
 * Route group pattern (parentheses).
 */
export declare const ROUTE_GROUP_PATTERN: RegExp;
/**
 * Dynamic segment pattern (brackets).
 */
export declare const DYNAMIC_SEGMENT_PATTERN: RegExp;
/**
 * Catch-all segment pattern (spread).
 */
export declare const CATCH_ALL_PATTERN: RegExp;
/**
 * Optional segment pattern (double brackets).
 */
export declare const OPTIONAL_PATTERN: RegExp;
//# sourceMappingURL=types.d.ts.map