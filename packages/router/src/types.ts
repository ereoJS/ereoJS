/**
 * @ereo/router - Route Type Definitions
 *
 * Types for file-based routing system.
 */

import type { Route, RouteParams, RouteModule } from '@ereo/core';

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
  /** Is this a middleware file? */
  middleware?: boolean;
  /** Middleware file path for this segment (if exists) */
  middlewareFile?: string;
  /** Loaded middleware module */
  middlewareModule?: { middleware?: MiddlewareFunction };
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
 * Middleware function type.
 */
export type MiddlewareFunction = (
  request: Request,
  next: () => Promise<Response>
) => Promise<Response> | Response;

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
  /** Middleware to execute (from root to leaf) */
  middlewares?: Array<{ file: string; module?: { middleware?: MiddlewareFunction } }>;
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
export const ROUTE_SCORE = {
  STATIC: 100,       // /about
  INDEX: 90,         // /blog/index
  DYNAMIC: 50,       // /blog/[slug]
  OPTIONAL: 30,      // /blog/[[optional]]
  CATCH_ALL: 10,     // /blog/[...all]
} as const;

/**
 * Special file names.
 */
export const SPECIAL_FILES = {
  LAYOUT: '_layout',
  ERROR: '_error',
  LOADING: '_loading',
  NOT_FOUND: '_404',
  MIDDLEWARE: '_middleware',
} as const;

/**
 * Route group pattern (parentheses).
 */
export const ROUTE_GROUP_PATTERN = /^\((.+)\)$/;

/**
 * Dynamic segment pattern (brackets).
 */
export const DYNAMIC_SEGMENT_PATTERN = /^\[(?!\.\.\.|\[)([^\]]+)\]$/;

/**
 * Catch-all segment pattern (spread).
 */
export const CATCH_ALL_PATTERN = /^\[\.\.\.([^\]]+)\]$/;

/**
 * Optional segment pattern (double brackets).
 */
export const OPTIONAL_PATTERN = /^\[\[([^\]]+)\]\]$/;
