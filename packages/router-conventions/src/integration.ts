/**
 * @ereo/router-conventions - Integration with file router
 *
 * Integrates convention-based routing with the file router system.
 */

import type { Route } from '@ereo/core';
import { parseConvention, applyConventionConfig } from './conventions';

/**
 * Options for integrating conventions with the router.
 */
export interface ConventionIntegrationOptions {
  /** Enable convention parsing (default: true) */
  enabled?: boolean;
  /** Custom convention suffixes to add */
  customSuffixes?: Record<string, string>;
  /** Directories to scan for islands */
  islandDirs?: string[];
}

/**
 * Integrate conventions with discovered routes.
 * This transforms route configs based on filename conventions.
 */
export function integrateConventions(
  routes: Route[],
  options: ConventionIntegrationOptions = {}
): Route[] {
  const { enabled = true } = options;

  if (!enabled) {
    return routes;
  }

  return routes.map((route) => {
    const conventionConfig = applyConventionConfig(route.file, route.config);

    return {
      ...route,
      config: {
        ...route.config,
        ...conventionConfig,
      },
    };
  });
}

/**
 * Generate route ID from convention info.
 * Strips convention suffixes for cleaner route IDs.
 */
export function generateRouteId(filePath: string): string {
  const info = parseConvention(filePath);
  return info.basePath;
}

/**
 * Check if a route should be treated as an API route.
 */
export function isApiRoute(filePath: string): boolean {
  const info = parseConvention(filePath);
  return info.isApi;
}

/**
 * Check if a route should be treated as an island component.
 */
export function isIslandComponent(filePath: string): boolean {
  const info = parseConvention(filePath);
  return info.isIsland;
}

/**
 * Get the effective render mode for a route file.
 */
export function getEffectiveRenderMode(
  filePath: string,
  explicitMode?: string
): string {
  if (explicitMode) {
    return explicitMode;
  }

  const info = parseConvention(filePath);
  if (info.renderMode) {
    return info.renderMode;
  }
  if (info.isApi) {
    return 'json';
  }
  return 'ssr'; // Default
}
