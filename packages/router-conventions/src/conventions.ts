/**
 * @areo/router-conventions - File naming convention parser
 *
 * Parses file names to determine route configuration:
 * - [slug].ssg.tsx -> SSG mode
 * - [slug].server.tsx -> Server-only, no hydration
 * - [slug].client.tsx -> CSR only
 * - [slug].api.tsx -> API endpoint
 * - _islands/*.tsx -> Auto-extracted islands
 */

import type { RenderMode, RouteConfig } from '@areo/core';

/** Convention suffixes and their render modes */
export const CONVENTION_SUFFIXES: Record<string, RenderMode | 'api'> = {
  '.ssg': 'ssg',
  '.server': 'ssr', // Server-only, no client JS
  '.client': 'csr',
  '.api': 'api',
  '.rsc': 'rsc',
};

/** Parsed convention info from a filename */
export interface ConventionInfo {
  /** Base route path (without convention suffix) */
  basePath: string;
  /** Detected render mode from convention */
  renderMode?: RenderMode;
  /** Whether this is an API route */
  isApi: boolean;
  /** Whether this is an island component */
  isIsland: boolean;
  /** Whether this is a layout file */
  isLayout: boolean;
  /** Original filename */
  filename: string;
  /** File extension */
  extension: string;
}

/**
 * Parse a filename to extract convention information.
 *
 * @example
 * parseConvention('blog/[slug].ssg.tsx')
 * // => { basePath: 'blog/[slug]', renderMode: 'ssg', isApi: false, ... }
 *
 * parseConvention('_islands/Counter.tsx')
 * // => { basePath: '_islands/Counter', isIsland: true, ... }
 */
export function parseConvention(filename: string): ConventionInfo {
  // Remove file extension
  const lastDot = filename.lastIndexOf('.');
  const extension = lastDot >= 0 ? filename.slice(lastDot) : '';
  const nameWithoutExt = lastDot >= 0 ? filename.slice(0, lastDot) : filename;

  // Check if it's an island component
  const isIsland = filename.includes('/_islands/') || filename.startsWith('_islands/');

  // Check if it's a layout
  const isLayout = nameWithoutExt.endsWith('/_layout') || nameWithoutExt === '_layout';

  // Check for convention suffixes
  let basePath = nameWithoutExt;
  let renderMode: RenderMode | undefined;
  let isApi = false;

  for (const [suffix, mode] of Object.entries(CONVENTION_SUFFIXES)) {
    if (nameWithoutExt.endsWith(suffix)) {
      basePath = nameWithoutExt.slice(0, -suffix.length);
      if (mode === 'api') {
        isApi = true;
      } else {
        renderMode = mode;
      }
      break;
    }
  }

  return {
    basePath,
    renderMode,
    isApi,
    isIsland,
    isLayout,
    filename,
    extension,
  };
}

/**
 * Generate route configuration from convention info.
 */
export function conventionToRouteConfig(info: ConventionInfo): Partial<RouteConfig> {
  const config: Partial<RouteConfig> = {};

  // Set render mode
  if (info.renderMode) {
    config.render = {
      mode: info.renderMode,
      streaming: { enabled: info.renderMode === 'ssr' },
    };

    // SSG specific defaults
    if (info.renderMode === 'ssg') {
      config.render.prerender = {
        enabled: true,
        fallback: 'blocking',
      };
    }

    // Server-only: disable islands
    if (info.renderMode === 'ssr' && info.filename.includes('.server.')) {
      config.islands = { disabled: true, defaultStrategy: 'none' };
    }
  }

  // API routes
  if (info.isApi) {
    config.render = { mode: 'json' };
  }

  // Island components
  if (info.isIsland) {
    config.islands = {
      defaultStrategy: 'load',
      ...config.islands,
    };
  }

  return config;
}

/**
 * Check if a filename matches a convention pattern.
 */
export function hasConvention(filename: string): boolean {
  const info = parseConvention(filename);
  return !!info.renderMode || info.isApi || info.isIsland;
}

/**
 * Get all supported convention patterns for documentation.
 */
export function getConventionPatterns(): string[] {
  return [
    '*.ssg.tsx - Static Site Generation (pre-rendered at build)',
    '*.server.tsx - Server-side only (no client JavaScript)',
    '*.client.tsx - Client-side rendering only',
    '*.api.tsx - API endpoint (JSON response)',
    '*.rsc.tsx - React Server Component',
    '_islands/*.tsx - Auto-extracted island components',
    '_layout.tsx - Nested layout wrapper',
  ];
}

/**
 * Strip convention suffix from route path for URL generation.
 *
 * @example
 * stripConvention('blog/[slug].ssg') // => 'blog/[slug]'
 */
export function stripConvention(routePath: string): string {
  for (const suffix of Object.keys(CONVENTION_SUFFIXES)) {
    if (routePath.endsWith(suffix)) {
      return routePath.slice(0, -suffix.length);
    }
  }
  return routePath;
}

/**
 * Apply convention-based configuration to a route.
 * This merges convention config with explicit config exports.
 */
export function applyConventionConfig(
  routePath: string,
  explicitConfig?: Partial<RouteConfig>
): Partial<RouteConfig> {
  const info = parseConvention(routePath);
  const conventionConfig = conventionToRouteConfig(info);

  // Explicit config takes precedence over conventions
  return {
    ...conventionConfig,
    ...explicitConfig,
    // Deep merge for nested objects
    render: explicitConfig?.render ?? conventionConfig.render,
    islands: explicitConfig?.islands ?? conventionConfig.islands,
    cache: explicitConfig?.cache ?? conventionConfig.cache,
  };
}
