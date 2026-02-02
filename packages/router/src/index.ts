/**
 * @oreo/router
 *
 * File-based routing for the Oreo framework.
 * Supports dynamic routes, catch-all routes, layouts, and route groups.
 */

// File Router
export {
  FileRouter,
  createFileRouter,
  initFileRouter,
} from './file-router';

// Route Tree
export {
  RouteTree,
  buildRouteTree,
  createRouteTree,
  filePathToUrlPath,
} from './route-tree';

// URL Matcher
export {
  RouteMatcher,
  createMatcher,
  matchRoute,
  matchWithLayouts,
  parsePathSegments,
  calculateRouteScore,
  patternToRegex,
} from './matcher';

// Types
export type {
  FileRoute,
  RouteSegment,
  RouteNode,
  RouterOptions,
  MatchResult,
  RouteRegistry,
  RouterEvents,
} from './types';

// Constants
export {
  ROUTE_SCORE,
  SPECIAL_FILES,
  ROUTE_GROUP_PATTERN,
  DYNAMIC_SEGMENT_PATTERN,
  CATCH_ALL_PATTERN,
  OPTIONAL_PATTERN,
} from './types';
