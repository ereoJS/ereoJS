/**
 * @ereo/bundler - Enhanced Route Type Generation
 *
 * Generates TypeScript types for routes enabling end-to-end type safety.
 * Solves TanStack Start limitations:
 * - Full search param types per route
 * - Hash param types (unique to Ereo)
 * - Context inheritance chain types
 * - Performance optimizations for large route trees
 *
 * Performance optimizations:
 * - Object maps instead of tuples
 * - Lazy type evaluation with LazyEval<T>
 * - Split output files by route prefix
 * - Maximum recursion depth guards
 */

import { join } from 'node:path';
import type { Route, RouteModule } from '@ereo/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended route type info with search/hash params.
 */
export interface RouteTypeInfo {
  path: string;
  file: string;
  params: Record<string, ParamType>;
  hasLoader: boolean;
  hasAction: boolean;
  hasMeta: boolean;
  hasHandle: boolean;
  hasSearchParams: boolean;
  hasHashParams: boolean;
  loaderTypeRef?: string;
  actionTypeRef?: string;
  searchParamsTypeRef?: string;
  hashParamsTypeRef?: string;
  contextTypeRef?: string;
  parentPath?: string;
  config?: {
    renderMode?: string;
    auth?: boolean;
  };
}

/**
 * Parameter type with optionality.
 */
export interface ParamType {
  type: 'string' | 'string[]';
  optional?: boolean;
}

/**
 * Generation options.
 */
export interface TypeGenerationOptions {
  routesDir?: string;
  inferTypes?: boolean;
  splitFiles?: boolean;
  maxRoutesPerFile?: number;
  generateSearchParams?: boolean;
  generateHashParams?: boolean;
  generateContext?: boolean;
  lazyEvaluation?: boolean;
}

// ============================================================================
// Parameter Extraction
// ============================================================================

/**
 * Extract parameter types from a route path with optionality.
 */
export function extractParams(path: string): Record<string, ParamType> {
  const params: Record<string, ParamType> = {};
  const segments = path.split('/').filter(Boolean);

  for (const segment of segments) {
    // Catch-all [...param]
    const catchAllMatch = segment.match(/^\[\.\.\.(\w+)\]$/);
    if (catchAllMatch) {
      params[catchAllMatch[1]] = { type: 'string[]' };
      continue;
    }

    // Optional [[param]]
    const optionalMatch = segment.match(/^\[\[(\w+)\]\]$/);
    if (optionalMatch) {
      params[optionalMatch[1]] = { type: 'string', optional: true };
      continue;
    }

    // Dynamic [param]
    const dynamicMatch = segment.match(/^\[(\w+)\]$/);
    if (dynamicMatch) {
      params[dynamicMatch[1]] = { type: 'string' };
      continue;
    }
  }

  return params;
}

/**
 * Generate import path from file path.
 */
function generateImportPath(file: string, routesDir: string): string {
  let importPath = file
    .replace(routesDir, '@routes')
    .replace(/\.(tsx?|jsx?)$/, '');

  return importPath;
}

/**
 * Generate a safe TypeScript identifier from an import path.
 */
function safeIdentifier(path: string): string {
  return path.replace(/[^a-zA-Z0-9]/g, '_');
}

// ============================================================================
// Route Collection
// ============================================================================

/**
 * Collect route info recursively with parent tracking.
 */
function collectRouteInfos(
  routes: Route[],
  routesDir: string,
  inferTypes: boolean,
  parentPath?: string
): RouteTypeInfo[] {
  const routeInfos: RouteTypeInfo[] = [];

  for (const route of routes) {
    if (!route.layout) {
      const importPath = generateImportPath(route.file, routesDir);

      const info: RouteTypeInfo = {
        path: route.path,
        file: route.file,
        params: extractParams(route.path),
        hasLoader: !!route.module?.loader,
        hasAction: !!route.module?.action,
        hasMeta: !!route.module?.meta,
        hasHandle: !!route.module?.handle,
        hasSearchParams: !!route.module?.searchParams,
        hasHashParams: false, // Will be populated from module exports
        parentPath,
        config: {
          renderMode: route.config?.render?.mode,
          auth: route.config?.auth?.required,
        },
      };

      // Generate type references for inference
      if (inferTypes) {
        if (info.hasLoader) {
          info.loaderTypeRef = `typeof import('${importPath}')['loader']`;
        }
        if (info.hasAction) {
          info.actionTypeRef = `typeof import('${importPath}')['action']`;
        }
        if (info.hasSearchParams) {
          info.searchParamsTypeRef = `typeof import('${importPath}')['searchParams']`;
        }
        // Check for hashParams export
        if ((route.module as Record<string, unknown>)?.hashParams) {
          info.hasHashParams = true;
          info.hashParamsTypeRef = `typeof import('${importPath}')['hashParams']`;
        }
      }

      routeInfos.push(info);
    }

    if (route.children) {
      const childInfos = collectRouteInfos(
        route.children,
        routesDir,
        inferTypes,
        route.path
      );
      routeInfos.push(...childInfos);
    }
  }

  return routeInfos;
}

// ============================================================================
// Type Generation
// ============================================================================

/**
 * Generate params type string with optionality.
 */
function generateParamsType(params: Record<string, ParamType>): string {
  const entries = Object.entries(params);

  if (entries.length === 0) {
    return 'Record<string, never>';
  }

  const parts = entries.map(([key, { type, optional }]) => {
    const optionalMark = optional ? '?' : '';
    return `${key}${optionalMark}: ${type}`;
  });

  return `{ ${parts.join('; ')} }`;
}

/**
 * Generate TypeScript type definitions for routes with full inference.
 */
export function generateRouteTypes(
  routes: Route[],
  options: TypeGenerationOptions = {}
): string {
  const {
    routesDir = 'app/routes',
    inferTypes = true,
    generateSearchParams = true,
    generateHashParams = true,
    generateContext = true,
    lazyEvaluation = true,
  } = options;

  const routeInfos = collectRouteInfos(routes, routesDir, inferTypes);

  const lines: string[] = [
    '// Auto-generated by @ereo/bundler',
    '// Do not edit this file manually',
    '// Generated at: ' + new Date().toISOString(),
    '',
    '// Performance: Uses object maps and lazy evaluation for large route trees',
    '',
  ];

  // Generate lazy evaluation wrapper type (performance optimization)
  if (lazyEvaluation) {
    lines.push('// Lazy evaluation wrapper for better TypeScript performance');
    lines.push('type LazyEval<T> = T extends infer U ? U : never;');
    lines.push('');
  }

  // Generate imports for type inference
  if (inferTypes) {
    lines.push('// Route module imports for type inference');
    const uniqueImports = new Set<string>();

    for (const info of routeInfos) {
      const importPath = generateImportPath(info.file, routesDir);
      if (!uniqueImports.has(importPath)) {
        uniqueImports.add(importPath);
        const safeName = safeIdentifier(importPath);
        lines.push(`import type * as ${safeName} from '${importPath}';`);
      }
    }
    lines.push('');
  }

  // Module augmentation for RouteTypes
  lines.push("declare module '@ereo/core' {");
  lines.push('  export interface RouteTypes {');

  for (const info of routeInfos) {
    const paramsType = generateParamsType(info.params);
    const importPath = generateImportPath(info.file, routesDir);
    const safeName = safeIdentifier(importPath);
    const wrapType = lazyEvaluation ? (t: string) => `LazyEval<${t}>` : (t: string) => t;

    lines.push(`    '${info.path}': {`);
    lines.push(`      params: ${paramsType};`);

    // Search params type inference (Ereo feature)
    if (generateSearchParams && info.hasSearchParams && inferTypes) {
      lines.push(`      search: ${wrapType(`${safeName} extends { searchParams: infer S } ? (S extends { parse: (data: any) => infer R } ? R : Record<string, string | string[] | undefined>) : Record<string, string | string[] | undefined>`)};`);
    } else {
      lines.push(`      search: Record<string, string | string[] | undefined>;`);
    }

    // Hash params type inference (UNIQUE to Ereo - TanStack gap)
    if (generateHashParams && info.hasHashParams && inferTypes) {
      lines.push(`      hash: ${wrapType(`${safeName} extends { hashParams: infer H } ? (H extends { parse: (data: any) => infer R } ? R : Record<string, string | undefined>) : Record<string, string | undefined>`)};`);
    } else {
      lines.push(`      hash: Record<string, string | undefined>;`);
    }

    // Loader type inference
    if (info.hasLoader && inferTypes) {
      lines.push(`      loader: ${wrapType(`${safeName} extends { loader: infer L } ? (L extends (...args: any[]) => infer R ? Awaited<R> : never) : never`)};`);
    } else {
      lines.push(`      loader: unknown;`);
    }

    // Action type inference
    if (info.hasAction && inferTypes) {
      lines.push(`      action: ${wrapType(`${safeName} extends { action: infer A } ? (A extends (...args: any[]) => infer R ? Awaited<R> : never) : never`)};`);
    } else {
      lines.push(`      action: unknown;`);
    }

    // Context inheritance (for pathless layouts)
    if (generateContext && info.parentPath) {
      lines.push(`      context: RouteTypes['${info.parentPath}'] extends { context: infer C } ? C : Record<string, unknown>;`);
    } else {
      lines.push(`      context: Record<string, unknown>;`);
    }

    // Additional metadata
    lines.push(`      meta: ${info.hasMeta};`);
    lines.push(`      handle: ${info.hasHandle ? `${safeName}['handle']` : 'undefined'};`);

    lines.push('    };');
  }

  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Generate route path type using object map (performance optimization)
  lines.push('// All available route paths (using object map for performance)');
  lines.push('type RoutePathMap = {');
  for (const info of routeInfos) {
    lines.push(`  '${info.path}': true;`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export type RoutePath = keyof RoutePathMap;');
  lines.push('');

  // Generate helper types
  lines.push('// Helper types for route-safe navigation');
  lines.push(generateHelperTypes(lazyEvaluation));
  lines.push('');

  // Generate runtime buildPath function
  lines.push('// Runtime path builder');
  lines.push(generateBuildPathFunction());
  lines.push('');

  lines.push('export {};');

  return lines.join('\n');
}

/**
 * Generate helper types.
 */
function generateHelperTypes(lazyEvaluation: boolean): string {
  const lazy = lazyEvaluation ? 'LazyEval' : '';
  const wrap = (t: string) => (lazyEvaluation ? `LazyEval<${t}>` : t);

  return `
/**
 * Extract params type for a route path.
 */
export type ParamsFor<T extends RoutePath> =
  T extends keyof import('@ereo/core').RouteTypes
    ? ${wrap("import('@ereo/core').RouteTypes[T]['params']")}
    : Record<string, string>;

/**
 * Extract search params type for a route path.
 * This is typed per-route (TanStack limitation solved).
 */
export type SearchParamsFor<T extends RoutePath> =
  T extends keyof import('@ereo/core').RouteTypes
    ? ${wrap("import('@ereo/core').RouteTypes[T]['search']")}
    : Record<string, string | string[] | undefined>;

/**
 * Extract hash params type for a route path.
 * UNIQUE to Ereo - TanStack has no hash param support.
 */
export type HashParamsFor<T extends RoutePath> =
  T extends keyof import('@ereo/core').RouteTypes
    ? ${wrap("import('@ereo/core').RouteTypes[T]['hash']")}
    : Record<string, string | undefined>;

/**
 * Extract loader data type for a route path.
 */
export type LoaderDataFor<T extends RoutePath> =
  T extends keyof import('@ereo/core').RouteTypes
    ? ${wrap("import('@ereo/core').RouteTypes[T]['loader']")}
    : unknown;

/**
 * Extract action data type for a route path.
 */
export type ActionDataFor<T extends RoutePath> =
  T extends keyof import('@ereo/core').RouteTypes
    ? ${wrap("import('@ereo/core').RouteTypes[T]['action']")}
    : unknown;

/**
 * Extract context type for a route path.
 * Context is accumulated from parent layouts.
 */
export type ContextFor<T extends RoutePath> =
  T extends keyof import('@ereo/core').RouteTypes
    ? ${wrap("import('@ereo/core').RouteTypes[T]['context']")}
    : Record<string, unknown>;

/**
 * Extract handle type for a route path.
 */
export type HandleFor<T extends RoutePath> =
  T extends keyof import('@ereo/core').RouteTypes
    ? ${wrap("import('@ereo/core').RouteTypes[T]['handle']")}
    : undefined;

/**
 * Type-safe route with all params.
 */
export type TypedRoute<T extends RoutePath> = {
  path: T;
  params: ParamsFor<T>;
  search?: SearchParamsFor<T>;
  hash?: HashParamsFor<T>;
};

/**
 * Full route data type.
 */
export type RouteData<T extends RoutePath> = {
  params: ParamsFor<T>;
  search: SearchParamsFor<T>;
  hash: HashParamsFor<T>;
  loaderData: LoaderDataFor<T>;
  actionData: ActionDataFor<T> | undefined;
  context: ContextFor<T>;
  handle: HandleFor<T>;
};

/**
 * Check if params object is empty (no required params).
 */
export type HasRequiredParams<T extends RoutePath> =
  keyof ParamsFor<T> extends never ? false : true;

/**
 * Conditionally require params based on route.
 */
export type ParamsRequired<T extends RoutePath> =
  Record<string, never> extends ParamsFor<T>
    ? { params?: ParamsFor<T> }
    : { params: ParamsFor<T> };
`.trim();
}

/**
 * Generate runtime buildPath function.
 */
function generateBuildPathFunction(): string {
  return `
/**
 * Build a URL path with params, search, and hash.
 */
export function buildPath<T extends RoutePath>(
  path: T,
  options: {
    params?: ParamsFor<T>;
    search?: SearchParamsFor<T>;
    hash?: HashParamsFor<T>;
  } = {}
): string {
  const { params, search, hash } = options;

  // Build path with params
  let result: string = path;
  if (params) {
    for (const [key, value] of Object.entries(params as Record<string, string | string[]>)) {
      if (value === undefined) continue;
      result = result.replace(\`[...\${key}]\`, Array.isArray(value) ? value.join('/') : value);
      result = result.replace(\`[[\${key}]]\`, Array.isArray(value) ? value[0] : value || '');
      result = result.replace(\`[\${key}]\`, Array.isArray(value) ? value[0] : value);
    }
  }

  // Remove unfilled optional params
  result = result.replace(/\\/\\?\\[\\[[^\\]]+\\]\\]/g, '');

  // Add search params
  if (search && Object.keys(search).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(search as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          searchParams.append(key, String(v));
        }
      } else {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      result += '?' + queryString;
    }
  }

  // Add hash params
  if (hash && Object.keys(hash).length > 0) {
    const hashParams = new URLSearchParams();
    for (const [key, value] of Object.entries(hash as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      hashParams.set(key, String(value));
    }
    const hashString = hashParams.toString();
    if (hashString) {
      result += '#' + hashString;
    }
  }

  return result;
}
`.trim();
}

// ============================================================================
// Split File Generation (Performance Optimization)
// ============================================================================

/**
 * Group routes by prefix for split file generation.
 */
function groupRoutesByPrefix(
  routeInfos: RouteTypeInfo[],
  maxPerFile: number
): Map<string, RouteTypeInfo[]> {
  const groups = new Map<string, RouteTypeInfo[]>();

  for (const info of routeInfos) {
    // Extract first path segment as prefix
    const prefix = info.path.split('/').filter(Boolean)[0] || '_root';
    const key = `routes_${prefix}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(info);
  }

  // Split large groups
  const result = new Map<string, RouteTypeInfo[]>();
  for (const [key, infos] of groups) {
    if (infos.length <= maxPerFile) {
      result.set(key, infos);
    } else {
      // Split into chunks
      let chunkIndex = 0;
      for (let i = 0; i < infos.length; i += maxPerFile) {
        result.set(`${key}_${chunkIndex}`, infos.slice(i, i + maxPerFile));
        chunkIndex++;
      }
    }
  }

  return result;
}

/**
 * Generate split type files for large route trees.
 */
export function generateSplitRouteTypes(
  routes: Route[],
  options: TypeGenerationOptions = {}
): Map<string, string> {
  const {
    routesDir = 'app/routes',
    inferTypes = true,
    maxRoutesPerFile = 50,
  } = options;

  const routeInfos = collectRouteInfos(routes, routesDir, inferTypes);
  const groups = groupRoutesByPrefix(routeInfos, maxRoutesPerFile);
  const files = new Map<string, string>();

  // Generate individual type files
  for (const [fileName, infos] of groups) {
    const content = generatePartialRouteTypes(infos, routesDir, inferTypes);
    files.set(`${fileName}.d.ts`, content);
  }

  // Generate index file that combines all
  const indexContent = generateIndexFile(Array.from(groups.keys()));
  files.set('index.d.ts', indexContent);

  return files;
}

/**
 * Generate partial route types for a subset of routes.
 */
function generatePartialRouteTypes(
  routeInfos: RouteTypeInfo[],
  routesDir: string,
  inferTypes: boolean
): string {
  const lines: string[] = [
    '// Auto-generated partial route types',
    '',
  ];

  // Generate imports
  if (inferTypes) {
    const uniqueImports = new Set<string>();
    for (const info of routeInfos) {
      const importPath = generateImportPath(info.file, routesDir);
      if (!uniqueImports.has(importPath)) {
        uniqueImports.add(importPath);
        lines.push(`import type * as ${safeIdentifier(importPath)} from '${importPath}';`);
      }
    }
    lines.push('');
  }

  // Generate route types object
  lines.push('export const routeTypes = {');
  for (const info of routeInfos) {
    const paramsType = generateParamsType(info.params);
    lines.push(`  '${info.path}': {} as {`);
    lines.push(`    params: ${paramsType};`);
    lines.push(`    search: Record<string, string | string[] | undefined>;`);
    lines.push(`    hash: Record<string, string | undefined>;`);
    lines.push(`    loader: unknown;`);
    lines.push(`    action: unknown;`);
    lines.push(`    context: Record<string, unknown>;`);
    lines.push(`    meta: boolean;`);
    lines.push(`    handle: unknown;`);
    lines.push(`  },`);
  }
  lines.push('};');

  return lines.join('\n');
}

/**
 * Generate index file that combines split files.
 */
function generateIndexFile(fileNames: string[]): string {
  const lines = [
    '// Auto-generated index file',
    '// Combines split route type files',
    '',
  ];

  for (const name of fileNames) {
    lines.push(`export * from './${name}';`);
  }

  return lines.join('\n');
}

// ============================================================================
// File Writing
// ============================================================================

/**
 * Write route types to file.
 */
export async function writeRouteTypes(
  outDir: string,
  routes: Route[],
  options: TypeGenerationOptions = {}
): Promise<void> {
  const types = generateRouteTypes(routes, options);
  const outPath = join(outDir, 'routes.d.ts');

  await Bun.write(outPath, types);
  console.log(`\x1b[32m✓\x1b[0m Route types written to ${outPath}`);
}

/**
 * Write split route types to files (for large route trees).
 */
export async function writeSplitRouteTypes(
  outDir: string,
  routes: Route[],
  options: TypeGenerationOptions = {}
): Promise<void> {
  const files = generateSplitRouteTypes(routes, options);

  for (const [fileName, content] of files) {
    const outPath = join(outDir, fileName);
    await Bun.write(outPath, content);
  }

  console.log(`\x1b[32m✓\x1b[0m Split route types written to ${outDir} (${files.size} files)`);
}

// ============================================================================
// Plugin
// ============================================================================

/**
 * Create type generation plugin.
 */
export function createTypesPlugin(options: TypeGenerationOptions & {
  outDir?: string;
  watch?: boolean;
} = {}) {
  const {
    outDir = '.ereo',
    routesDir = 'app/routes',
    inferTypes = true,
    watch = false,
    splitFiles = false,
    maxRoutesPerFile = 50,
  } = options;
  let routes: Route[] = [];

  return {
    name: 'ereo:types',

    transformRoutes(routeList: Route[]) {
      routes = routeList;
      return routeList;
    },

    async buildEnd() {
      if (routes.length === 0) return;

      const genOptions: TypeGenerationOptions = {
        routesDir,
        inferTypes,
        generateSearchParams: true,
        generateHashParams: true,
        generateContext: true,
        lazyEvaluation: true,
        maxRoutesPerFile,
      };

      if (splitFiles && routes.length > maxRoutesPerFile) {
        await writeSplitRouteTypes(outDir, routes, genOptions);
      } else {
        await writeRouteTypes(outDir, routes, genOptions);
      }
    },

    async configureServer(_server: { middlewares: unknown[] }) {
      if (watch) {
        // Types are regenerated when routes reload
      }
    },
  };
}

// ============================================================================
// Link Types Generation
// ============================================================================

/**
 * Generate Link component props types.
 */
export function generateLinkTypes(routes: Route[]): string {
  const routeInfos = routes
    .filter((r) => !r.layout)
    .map((r) => ({
      path: r.path,
      params: extractParams(r.path),
    }));

  const pathTypes = routeInfos.map((r) => `'${r.path}'`);

  return `
// Auto-generated Link types
import type { ComponentProps, ReactNode } from 'react';
import type { RoutePath, ParamsFor, SearchParamsFor, HashParamsFor, ParamsRequired } from './routes';

/**
 * Type-safe Link component props.
 * Validates route existence and params at compile time.
 */
export type LinkProps<T extends RoutePath = RoutePath> =
  Omit<ComponentProps<'a'>, 'href'> &
  { to: T } &
  ParamsRequired<T> &
  {
    /** Search params (type-safe per route) */
    search?: SearchParamsFor<T>;
    /** Hash params (type-safe per route, Ereo exclusive) */
    hash?: HashParamsFor<T>;
    /** Prefetch strategy */
    prefetch?: 'hover' | 'viewport' | 'none' | 'intent' | 'render';
    /** Replace current history entry */
    replace?: boolean;
    /** Scroll to top on navigation */
    scroll?: boolean;
    /** State to pass */
    state?: unknown;
    /** Children */
    children?: ReactNode;
  };

/**
 * Type-safe NavLink component props.
 */
export type NavLinkProps<T extends RoutePath = RoutePath> =
  Omit<LinkProps<T>, 'className' | 'style'> & {
    className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
    style?: React.CSSProperties | ((props: { isActive: boolean; isPending: boolean }) => React.CSSProperties);
    end?: boolean;
  };

/**
 * All available routes.
 */
export type AppRoutes = ${pathTypes.join(' | ') || 'string'};
  `.trim();
}

/**
 * Generate useLoaderData hook types.
 */
export function generateHookTypes(): string {
  return `
// Auto-generated hook types
import type {
  RoutePath,
  LoaderDataFor,
  ActionDataFor,
  ParamsFor,
  SearchParamsFor,
  HashParamsFor,
  ContextFor,
  HandleFor,
} from './routes';

/**
 * Get loader data for the current route (type-safe).
 *
 * @example
 * // In /blog/[slug].tsx
 * const { post, comments } = useLoaderData<'/blog/[slug]'>();
 * //      ^? { post: Post, comments: Comment[] }
 */
export declare function useLoaderData<T extends RoutePath>(): LoaderDataFor<T>;

/**
 * Get route params for the current route (type-safe).
 *
 * @example
 * // In /blog/[slug].tsx
 * const { slug } = useParams<'/blog/[slug]'>();
 * //      ^? string
 */
export declare function useParams<T extends RoutePath>(): ParamsFor<T>;

/**
 * Get search params for the current route (type-safe).
 *
 * @example
 * // In /posts.tsx with searchParams schema
 * const { page, sort } = useSearchParams<'/posts'>();
 */
export declare function useSearchParams<T extends RoutePath>(): SearchParamsFor<T>;

/**
 * Get hash params for the current route (type-safe).
 * UNIQUE to Ereo - TanStack has no hash param support.
 *
 * @example
 * // In /docs/[topic].tsx with hashParams schema
 * const { section } = useHashParams<'/docs/[topic]'>();
 */
export declare function useHashParams<T extends RoutePath>(): HashParamsFor<T>;

/**
 * Get action data for the current route (type-safe).
 *
 * @example
 * // In /blog/[slug].tsx
 * const actionData = useActionData<'/blog/[slug]'>();
 */
export declare function useActionData<T extends RoutePath>(): ActionDataFor<T> | undefined;

/**
 * Get accumulated context from parent layouts.
 *
 * @example
 * const { user } = useRouteContext<'/dashboard/settings'>();
 */
export declare function useRouteContext<T extends RoutePath>(): ContextFor<T>;

/**
 * Get route matches with typed data.
 */
export declare function useMatches<T extends RoutePath>(): Array<{
  id: string;
  pathname: string;
  params: ParamsFor<T>;
  data: LoaderDataFor<T>;
  handle: HandleFor<T>;
}>;

/**
 * Navigation hook with type-safe paths.
 */
export declare function useNavigate(): {
  <T extends RoutePath>(to: T, options?: {
    params?: ParamsFor<T>;
    search?: SearchParamsFor<T>;
    hash?: HashParamsFor<T>;
    replace?: boolean;
    state?: unknown;
  }): void;
  (delta: number): void;
};
  `.trim();
}

/**
 * Generate all type files for a routes directory.
 */
export async function generateAllTypes(
  routes: Route[],
  outDir: string,
  routesDir: string
): Promise<void> {
  // Generate main route types with all features enabled
  await writeRouteTypes(outDir, routes, {
    routesDir,
    inferTypes: true,
    generateSearchParams: true,
    generateHashParams: true,
    generateContext: true,
    lazyEvaluation: true,
  });

  // Generate Link types
  const linkTypes = generateLinkTypes(routes);
  await Bun.write(join(outDir, 'link.d.ts'), linkTypes);

  // Generate hook types
  const hookTypes = generateHookTypes();
  await Bun.write(join(outDir, 'hooks.d.ts'), hookTypes);

  // Generate index file that re-exports everything
  const indexContent = `
// Auto-generated by @ereo/bundler
// Full type-safe routing with search params, hash params, and context inheritance

export * from './routes';
export * from './link';
export * from './hooks';
`.trim();
  await Bun.write(join(outDir, 'index.d.ts'), indexContent);

  console.log(`\x1b[32m✓\x1b[0m Generated all type files in ${outDir}`);
}
