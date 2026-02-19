/**
 * @ereo/bundler - Production Build
 *
 * Optimized production builds using Bun's bundler.
 * Handles server/client bundles, islands, CSS, and code splitting.
 */

import { join, relative, dirname, basename, extname } from 'node:path';
import { mkdir, rm, readdir, stat, readFile, copyFile } from 'node:fs/promises';
import type { BuildConfig, FrameworkConfig, Route, Plugin } from '@ereo/core';
import { FileRouter, initFileRouter } from '@ereo/router';
import {
  extractIslands,
  generateIslandManifest,
  generateIslandEntry,
  hasIslands,
  type IslandMeta,
} from '../plugins/islands';

/**
 * Build options.
 */
export interface BuildOptions {
  /** Project root directory */
  root?: string;
  /** Output directory */
  outDir?: string;
  /** Enable minification */
  minify?: boolean;
  /** Generate sourcemaps */
  sourcemap?: boolean;
  /** Target runtime */
  target?: 'bun' | 'browser' | 'node';
  /** Entry points */
  entrypoints?: string[];
  /** External packages */
  external?: string[];
  /** Enable code splitting */
  splitting?: boolean;
  /** Plugins to use */
  plugins?: Plugin[];
  /** Public path for assets */
  publicPath?: string;
  /** Asset file extensions to copy */
  assetExtensions?: string[];
}

/**
 * Build output entry.
 */
export interface BuildOutput {
  path: string;
  size: number;
  type: 'js' | 'css' | 'asset' | 'map';
  hash?: string;
  isEntry?: boolean;
  exports?: string[];
}

/**
 * Build result.
 */
export interface BuildResult {
  success: boolean;
  outputs: BuildOutput[];
  duration: number;
  errors?: string[];
}

/**
 * Asset manifest entry.
 */
interface ManifestAsset {
  file: string;
  src?: string;
  isEntry?: boolean;
  css?: string[];
  imports?: string[];
  dynamicImports?: string[];
}

/**
 * Build manifest structure.
 */
interface BuildManifest {
  version: number;
  buildTime: string;
  buildId: string;
  routes: RouteManifestEntry[];
  server: {
    entry: string;
    modules: Record<string, string>;
  };
  client: {
    entry: string;
    islands: Record<string, IslandManifestEntry>;
    chunks: Record<string, string>;
  };
  assets: Record<string, ManifestAsset>;
  css: string[];
}

/**
 * Route manifest entry.
 */
interface RouteManifestEntry {
  id: string;
  path: string;
  file: string;
  index?: boolean;
  layout?: boolean;
  hasLoader?: boolean;
  hasAction?: boolean;
  hasMeta?: boolean;
  hasErrorBoundary?: boolean;
  parentId?: string;
}

/**
 * Island manifest entry.
 */
interface IslandManifestEntry {
  id: string;
  name: string;
  file: string;
  strategy: string;
  exports: string[];
}

/**
 * Default asset extensions to copy.
 */
const DEFAULT_ASSET_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.ogg', '.wav',
  '.json', '.xml', '.txt', '.pdf',
];

/**
 * Build the project for production.
 */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const startTime = performance.now();
  const root = options.root || process.cwd();
  const outDir = options.outDir || join(root, '.ereo');
  const minify = options.minify ?? true;
  const sourcemap = options.sourcemap ?? true;
  const splitting = options.splitting ?? true;
  const publicPath = options.publicPath || '/_ereo/';
  const assetExtensions = options.assetExtensions || DEFAULT_ASSET_EXTENSIONS;

  const buildId = generateBuildId();
  const allOutputs: BuildOutput[] = [];
  const errors: string[] = [];

  console.log('\x1b[36m⚡\x1b[0m Building for production...\n');

  try {
    // Clean and create output directory structure
    await cleanAndCreateDirs(outDir);

    // Run plugin setup hooks (initializes processors like PostCSS/Tailwind)
    if (options.plugins) {
      for (const plugin of options.plugins) {
        await plugin.setup?.({ root, config: {} as FrameworkConfig, mode: 'production' });
      }
    }

    // Run plugin buildStart hooks
    if (options.plugins) {
      for (const plugin of options.plugins) {
        await plugin.buildStart?.();
      }
    }

    // Discover routes
    const router = await initFileRouter({
      routesDir: join(root, 'app/routes'),
    });
    const routes = router.getRoutes();
    const routeCount = countRoutes(routes);

    console.log(`  \x1b[32m✓\x1b[0m Found ${routeCount} route(s)`);

    // Collect all islands from route files
    const islands = await extractAllIslands(root, routes);
    if (islands.length > 0) {
      console.log(`  \x1b[32m✓\x1b[0m Found ${islands.length} island(s)`);
    }

    // Collect CSS files
    const cssFiles = await collectCSSFiles(root);
    if (cssFiles.length > 0) {
      console.log(`  \x1b[32m✓\x1b[0m Found ${cssFiles.length} CSS file(s)`);
    }

    // Build server bundle
    console.log('\n  Building server bundle...');
    const serverResult = await buildServer({
      root,
      outDir: join(outDir, 'server'),
      routes,
      minify,
      sourcemap,
      splitting,
      external: options.external,
      plugins: options.plugins,
    });

    if (serverResult.errors.length > 0) {
      errors.push(...serverResult.errors);
    }
    allOutputs.push(...serverResult.outputs);
    console.log(`  \x1b[32m✓\x1b[0m Server bundle built (${serverResult.outputs.length} files)`);

    // Build client bundle
    console.log('\n  Building client bundle...');
    const clientResult = await buildClient({
      root,
      outDir: join(outDir, 'client'),
      routes,
      minify,
      sourcemap,
      splitting,
      plugins: options.plugins,
    });

    if (clientResult.errors.length > 0) {
      errors.push(...clientResult.errors);
    }
    allOutputs.push(...clientResult.outputs);
    console.log(`  \x1b[32m✓\x1b[0m Client bundle built (${clientResult.outputs.length} files)`);

    // Build island bundles
    if (islands.length > 0) {
      console.log('\n  Building island bundles...');
      const islandResult = await buildIslands({
        root,
        outDir: join(outDir, 'client/islands'),
        islands,
        minify,
        sourcemap,
        splitting,
      });

      if (islandResult.errors.length > 0) {
        errors.push(...islandResult.errors);
      }
      allOutputs.push(...islandResult.outputs);
      console.log(`  \x1b[32m✓\x1b[0m Island bundles built (${islandResult.outputs.length} files)`);
    }

    // Build CSS bundles
    if (cssFiles.length > 0) {
      console.log('\n  Building CSS bundle...');
      const cssResult = await buildCSS({
        root,
        outDir: join(outDir, 'assets'),
        cssFiles,
        minify,
        sourcemap,
        plugins: options.plugins,
      });

      if (cssResult.errors.length > 0) {
        errors.push(...cssResult.errors);
      }
      allOutputs.push(...cssResult.outputs);
      console.log(`  \x1b[32m✓\x1b[0m CSS bundle built (${cssResult.outputs.length} files)`);
    }

    // Copy static assets
    console.log('\n  Copying static assets...');
    const assetResult = await copyAssets({
      root,
      outDir: join(outDir, 'assets'),
      extensions: assetExtensions,
    });
    allOutputs.push(...assetResult.outputs);
    if (assetResult.outputs.length > 0) {
      console.log(`  \x1b[32m✓\x1b[0m Copied ${assetResult.outputs.length} static assets`);
    }

    // Generate build manifest
    console.log('\n  Generating manifest...');
    await generateManifest({
      outDir,
      buildId,
      routes,
      islands,
      serverResult,
      clientResult,
      cssFiles: allOutputs.filter(o => o.type === 'css').map(o => o.path),
    });
    console.log(`  \x1b[32m✓\x1b[0m Manifest generated`);

    // Run plugin buildEnd hooks
    if (options.plugins) {
      for (const plugin of options.plugins) {
        await plugin.buildEnd?.();
      }
    }

    const duration = performance.now() - startTime;
    const success = errors.length === 0;

    console.log(`\n\x1b[32m✓\x1b[0m Build ${success ? 'completed' : 'completed with warnings'} in ${duration.toFixed(0)}ms`);

    return {
      success,
      outputs: allOutputs,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n\x1b[31m✗\x1b[0m Build failed:', errorMessage);

    return {
      success: false,
      outputs: allOutputs,
      duration,
      errors: [errorMessage],
    };
  }
}

/**
 * Generate a unique build ID.
 */
function generateBuildId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Clean output directory and create structure.
 */
async function cleanAndCreateDirs(outDir: string): Promise<void> {
  await rm(outDir, { recursive: true, force: true });

  await mkdir(outDir, { recursive: true });
  await mkdir(join(outDir, 'server'), { recursive: true });
  await mkdir(join(outDir, 'server/routes'), { recursive: true });
  await mkdir(join(outDir, 'client'), { recursive: true });
  await mkdir(join(outDir, 'client/islands'), { recursive: true });
  await mkdir(join(outDir, 'client/chunks'), { recursive: true });
  await mkdir(join(outDir, 'assets'), { recursive: true });
}

/**
 * Count routes recursively.
 */
function countRoutes(routes: Route[]): number {
  let count = 0;
  for (const route of routes) {
    count++;
    if (route.children) {
      count += countRoutes(route.children);
    }
  }
  return count;
}

/**
 * Extract all islands from route files.
 */
async function extractAllIslands(root: string, routes: Route[]): Promise<IslandMeta[]> {
  const islands: IslandMeta[] = [];
  const processedFiles = new Set<string>();

  const processRoute = async (route: Route) => {
    if (processedFiles.has(route.file)) return;
    processedFiles.add(route.file);

    try {
      const content = await Bun.file(route.file).text();
      if (hasIslands(content)) {
        const fileIslands = extractIslands(content, route.file);
        islands.push(...fileIslands);
      }
    } catch (error) {
      // File might not exist or be readable
    }

    if (route.children) {
      for (const child of route.children) {
        await processRoute(child);
      }
    }
  };

  // Also scan components directory for islands
  const componentsDir = join(root, 'app/components');
  try {
    const componentFiles = await scanForFiles(componentsDir, ['.tsx', '.jsx']);
    for (const file of componentFiles) {
      if (processedFiles.has(file)) continue;
      processedFiles.add(file);

      try {
        const content = await Bun.file(file).text();
        if (hasIslands(content)) {
          const fileIslands = extractIslands(content, file);
          islands.push(...fileIslands);
        }
      } catch (error) {
        // Ignore read errors
      }
    }
  } catch (error) {
    // Components directory might not exist
  }

  for (const route of routes) {
    await processRoute(route);
  }

  return islands;
}

/**
 * Scan a directory for files with given extensions.
 */
async function scanForFiles(dir: string, extensions: string[]): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await scanForFiles(fullPath, extensions);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Directory might not exist
  }

  return files;
}

/**
 * Collect CSS files from the project.
 */
async function collectCSSFiles(root: string): Promise<string[]> {
  const cssFiles: string[] = [];
  const dirsToScan = [
    join(root, 'app'),
    join(root, 'styles'),
    join(root, 'src'),
  ];

  for (const dir of dirsToScan) {
    try {
      const files = await scanForFiles(dir, ['.css']);
      cssFiles.push(...files);
    } catch (error) {
      // Directory might not exist
    }
  }

  return cssFiles;
}

/**
 * Server build result.
 */
interface ServerBuildResult {
  outputs: BuildOutput[];
  errors: string[];
  entryFile: string;
  routeModules: Record<string, string>;
}

/**
 * Build server bundle.
 */
async function buildServer(options: {
  root: string;
  outDir: string;
  routes: Route[];
  minify?: boolean;
  sourcemap?: boolean;
  splitting?: boolean;
  external?: string[];
  plugins?: Plugin[];
}): Promise<ServerBuildResult> {
  const {
    root,
    outDir,
    routes,
    minify = true,
    sourcemap = true,
    splitting = true,
    external = [],
    plugins,
  } = options;

  const outputs: BuildOutput[] = [];
  const errors: string[] = [];
  const routeModules: Record<string, string> = {};

  // Collect server entry points (routes with loaders/actions)
  const entrypoints: string[] = [];
  const routesDir = join(outDir, 'routes');

  const collectEntrypoints = (routeList: Route[]) => {
    for (const route of routeList) {
      entrypoints.push(route.file);
      if (route.children) {
        collectEntrypoints(route.children);
      }
    }
  };
  collectEntrypoints(routes);

  if (entrypoints.length === 0) {
    return {
      outputs: [],
      errors: [],
      entryFile: '',
      routeModules: {},
    };
  }

  // Build route modules first to determine actual output paths
  // (Bun's [dir] naming behavior varies based on directory structure)
  const routeOutputMap: Map<string, string> = new Map(); // entrypoint -> output path relative to routesDir

  try {
    const result = await Bun.build({
      entrypoints,
      outdir: routesDir,
      target: 'bun',
      minify,
      sourcemap: sourcemap ? 'external' : 'none',
      splitting,
      external: ['react', 'react-dom', '@ereo/core', '@ereo/router', '@ereo/render', ...external],
      naming: {
        entry: '[dir]/[name].[ext]',
        chunk: '../chunks/[name]-[hash].[ext]',
        asset: '../assets/[name]-[hash].[ext]',
      },
    });

    if (!result.success) {
      for (const log of result.logs) {
        errors.push(log.message);
      }
    }

    for (const output of result.outputs) {
      const fileStat = await Bun.file(output.path).stat();
      const relativePath = relative(options.root, output.path);

      outputs.push({
        path: relativePath,
        size: fileStat?.size || 0,
        type: output.path.endsWith('.css') ? 'css' : output.path.endsWith('.map') ? 'map' : 'js',
        isEntry: output.kind === 'entry-point',
      });

      // Map route files to output files
      if (output.kind === 'entry-point') {
        // Match entrypoint to output based on relative path structure
        // Output path ends with the same relative structure as the entrypoint (with .js extension)
        const sourcePath = entrypoints.find(e => {
          const routeRelPath = relative(join(root, 'app/routes'), e)
            .replace(/\\/g, '/')
            .replace(/\.[^.]+$/, '.js');
          // Check if output path ends with this relative path
          return output.path.replace(/\\/g, '/').endsWith(routeRelPath);
        });
        if (sourcePath) {
          const routeId = relative(join(root, 'app/routes'), sourcePath)
            .replace(/\.[^.]+$/, '')
            .replace(/\\/g, '/');
          routeModules[routeId] = relativePath;
          // Store output path relative to routesDir for server entry imports
          const outputRelativeToRoutesDir = relative(routesDir, output.path).replace(/\\/g, '/');
          routeOutputMap.set(sourcePath, outputRelativeToRoutesDir);
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // Generate server entry point using actual output paths from build
  const serverEntry = generateServerEntry(routes, root, routeOutputMap);
  const serverEntryPath = join(outDir, '_entry.server.ts');
  await Bun.write(serverEntryPath, serverEntry);

  // Build the server entry
  try {
    const entryResult = await Bun.build({
      entrypoints: [serverEntryPath],
      outdir: outDir,
      target: 'bun',
      minify,
      sourcemap: sourcemap ? 'external' : 'none',
      splitting: false,
      external: ['react', 'react-dom', '@ereo/core', '@ereo/router', '@ereo/render', ...external],
      naming: {
        entry: 'index.[ext]',
      },
    });

    if (!entryResult.success) {
      for (const log of entryResult.logs) {
        errors.push(log.message);
      }
    }

    for (const output of entryResult.outputs) {
      const fileStat = await Bun.file(output.path).stat();
      outputs.push({
        path: relative(options.root, output.path),
        size: fileStat?.size || 0,
        type: output.path.endsWith('.map') ? 'map' : 'js',
        isEntry: true,
      });
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // Clean up temp entry file
  try {
    await rm(serverEntryPath);
  } catch (error) {
    // Ignore cleanup errors
  }

  return {
    outputs,
    errors,
    entryFile: relative(root, join(outDir, 'index.js')).replace(/\\/g, '/'),
    routeModules,
  };
}

/**
 * Generate server entry point code.
 * @param routes - The route definitions
 * @param root - Project root directory
 * @param routeOutputMap - Map of source file path to output path (relative to routes dir)
 */
function generateServerEntry(routes: Route[], root: string, routeOutputMap: Map<string, string>): string {
  const imports: string[] = [];
  const routeRegistrations: string[] = [];
  let routeCounter = 0;

  const processRoute = (route: Route) => {
    const varName = `route_${routeCounter++}`;
    // Use actual output path from the build result, or fall back to computed path
    const outputPath = routeOutputMap.get(route.file);
    const importPath = outputPath
      ? `./routes/${outputPath}`
      : `./routes/${relative(join(root, 'app/routes'), route.file).replace(/\\/g, '/').replace(/\.[^.]+$/, '.js')}`;
    imports.push(`import * as ${varName} from '${importPath}';`);

    routeRegistrations.push(`  {
    id: '${route.id}',
    path: '${route.path}',
    module: ${varName},
    index: ${route.index || false},
    layout: ${route.layout || false},
  }`);

    if (route.children) {
      route.children.forEach((child) => {
        processRoute(child);
      });
    }
  };

  routes.forEach((route) => processRoute(route));

  return `/**
 * Server Entry - Auto-generated by @ereo/bundler
 * Do not edit this file directly.
 */

${imports.join('\n')}

// Route registry
export const routes = [
${routeRegistrations.join(',\n')}
];

// Route lookup map for fast access
export const routeMap = new Map(routes.map(r => [r.path, r]));

// Find route by path
export function findRoute(path) {
  return routeMap.get(path);
}

// Get all route paths
export function getRoutePaths() {
  return routes.map(r => r.path);
}

// Default export for Bun.serve compatibility
export default {
  routes,
  routeMap,
  findRoute,
  getRoutePaths,
};
`;
}

/**
 * Client build result.
 */
interface ClientBuildResult {
  outputs: BuildOutput[];
  errors: string[];
  entryFile: string;
  chunks: Record<string, string>;
}

/**
 * Build client bundle.
 */
async function buildClient(options: {
  root: string;
  outDir: string;
  routes: Route[];
  minify?: boolean;
  sourcemap?: boolean;
  splitting?: boolean;
  plugins?: Plugin[];
}): Promise<ClientBuildResult> {
  const { root, outDir, routes, minify = true, sourcemap = true, splitting = true } = options;

  const outputs: BuildOutput[] = [];
  const errors: string[] = [];
  const chunks: Record<string, string> = {};

  // Check for client entry point
  const clientEntry = join(root, 'app/entry.client.tsx');
  const clientEntryAlt = join(root, 'app/entry.client.ts');
  const hasClientEntry = await Bun.file(clientEntry).exists();
  const hasClientEntryAlt = await Bun.file(clientEntryAlt).exists();

  let entrypoint: string;

  if (hasClientEntry) {
    entrypoint = clientEntry;
  } else if (hasClientEntryAlt) {
    entrypoint = clientEntryAlt;
  } else {
    // Create default client entry
    const defaultEntry = join(outDir, '_entry.client.tsx');
    await Bun.write(defaultEntry, generateDefaultClientEntry());
    entrypoint = defaultEntry;
  }

  try {
    const result = await Bun.build({
      entrypoints: [entrypoint],
      outdir: outDir,
      target: 'browser',
      minify,
      sourcemap: sourcemap ? 'external' : 'none',
      splitting,
      naming: {
        entry: 'client.[ext]',
        chunk: 'chunks/[name]-[hash].[ext]',
        asset: '../assets/[name]-[hash].[ext]',
      },
    });

    if (!result.success) {
      for (const log of result.logs) {
        errors.push(log.message);
      }
    }

    for (const output of result.outputs) {
      const fileStat = await Bun.file(output.path).stat();
      const relativePath = relative(options.root, output.path);

      outputs.push({
        path: relativePath,
        size: fileStat?.size || 0,
        type: output.path.endsWith('.css') ? 'css' : output.path.endsWith('.map') ? 'map' : 'js',
        isEntry: output.kind === 'entry-point',
      });

      // Track chunks
      if (output.kind === 'chunk') {
        const chunkName = basename(output.path, extname(output.path));
        chunks[chunkName] = relativePath;
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // Clean up generated entry if we created it
  if (!hasClientEntry && !hasClientEntryAlt) {
    try {
      await rm(join(outDir, '_entry.client.tsx'));
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  return {
    outputs,
    errors,
    entryFile: relative(root, join(outDir, 'client.js')).replace(/\\/g, '/'),
    chunks,
  };
}

/**
 * Generate default client entry code.
 */
function generateDefaultClientEntry(): string {
  return `/**
 * Client Entry - Auto-generated by @ereo/bundler
 * Do not edit this file directly.
 */

import { initClient } from '@ereo/client';

async function bootstrap() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  initClient();
}

// Auto-initialize
bootstrap().catch((error) => {
  console.error('[EreoJS] Failed to initialize default client entry:', error);
});

export { initClient };
`;
}

/**
 * Island build result.
 */
interface IslandBuildResult {
  outputs: BuildOutput[];
  errors: string[];
  islands: Record<string, string>;
}

/**
 * Build island bundles.
 */
async function buildIslands(options: {
  root: string;
  outDir: string;
  islands: IslandMeta[];
  minify?: boolean;
  sourcemap?: boolean;
  splitting?: boolean;
}): Promise<IslandBuildResult> {
  const { root, outDir, islands, minify = true, sourcemap = true, splitting = true } = options;

  const outputs: BuildOutput[] = [];
  const errors: string[] = [];
  const islandMap: Record<string, string> = {};

  if (islands.length === 0) {
    return { outputs, errors, islands: islandMap };
  }

  // Generate island entry file
  const islandEntry = generateIslandEntry(islands);
  const islandEntryPath = join(outDir, '_islands.entry.ts');
  await Bun.write(islandEntryPath, islandEntry);

  // Write island manifest
  const islandManifest = generateIslandManifest(islands);
  await Bun.write(join(outDir, 'manifest.json'), islandManifest);

  // Build each island as a separate entry point for maximum code splitting
  const islandEntrypoints = islands.map(island => island.file);

  try {
    const result = await Bun.build({
      entrypoints: islandEntrypoints,
      outdir: outDir,
      target: 'browser',
      minify,
      sourcemap: sourcemap ? 'external' : 'none',
      splitting,
      // Mark React as external since it will be shared with the main client bundle
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      naming: {
        entry: '[name]-[hash].[ext]',
        chunk: 'shared/[name]-[hash].[ext]',
        asset: '../assets/[name]-[hash].[ext]',
      },
    });

    if (!result.success) {
      for (const log of result.logs) {
        errors.push(log.message);
      }
    }

    for (const output of result.outputs) {
      const fileStat = await Bun.file(output.path).stat();
      const relativePath = relative(options.root, output.path);

      outputs.push({
        path: relativePath,
        size: fileStat?.size || 0,
        type: output.path.endsWith('.css') ? 'css' : output.path.endsWith('.map') ? 'map' : 'js',
        isEntry: output.kind === 'entry-point',
      });

      // Map islands to output files
      if (output.kind === 'entry-point') {
        const sourceIsland = islands.find(i =>
          output.path.includes(basename(i.file, extname(i.file)))
        );
        if (sourceIsland) {
          islandMap[sourceIsland.id] = relativePath;
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  // Clean up temp entry file
  try {
    await rm(islandEntryPath);
  } catch (error) {
    // Ignore cleanup errors
  }

  return {
    outputs,
    errors,
    islands: islandMap,
  };
}

/**
 * CSS build result.
 */
interface CSSBuildResult {
  outputs: BuildOutput[];
  errors: string[];
}

/**
 * Build CSS bundles.
 */
async function buildCSS(options: {
  root: string;
  outDir: string;
  cssFiles: string[];
  minify?: boolean;
  sourcemap?: boolean;
  plugins?: Plugin[];
}): Promise<CSSBuildResult> {
  const { root, outDir, cssFiles, minify = true, sourcemap = true, plugins } = options;

  const outputs: BuildOutput[] = [];
  const errors: string[] = [];

  if (cssFiles.length === 0) {
    return { outputs, errors };
  }

  // Concatenate all CSS files
  let combinedCSS = '';

  for (const cssFile of cssFiles) {
    try {
      let content = await Bun.file(cssFile).text();

      // Apply plugin transforms
      if (plugins) {
        for (const plugin of plugins) {
          if (plugin.transform) {
            const transformed = await plugin.transform(content, cssFile);
            if (transformed) {
              content = transformed;
            }
          }
        }
      }

      combinedCSS += `/* Source: ${relative(root, cssFile)} */\n${content}\n\n`;
    } catch (error) {
      errors.push(`Failed to read CSS file ${cssFile}: ${error}`);
    }
  }

  // Write the combined CSS
  const outputPath = join(outDir, 'styles.css');

  // Basic CSS minification if enabled
  if (minify) {
    combinedCSS = minifyCSS(combinedCSS);
  }

  await Bun.write(outputPath, combinedCSS);

  const fileStat = await Bun.file(outputPath).stat();
  outputs.push({
    path: relative(root, outputPath),
    size: fileStat?.size || 0,
    type: 'css',
    isEntry: true,
  });

  // Generate sourcemap if enabled
  if (sourcemap) {
    // For a real implementation, you'd generate proper sourcemaps
    // This is a simplified version
    const mapContent = JSON.stringify({
      version: 3,
      sources: cssFiles.map(f => relative(root, f)),
      names: [],
      mappings: '',
    });
    const mapPath = outputPath + '.map';
    await Bun.write(mapPath, mapContent);

    const mapStat = await Bun.file(mapPath).stat();
    outputs.push({
      path: relative(root, mapPath),
      size: mapStat?.size || 0,
      type: 'map',
    });
  }

  return { outputs, errors };
}

/**
 * Basic CSS minification.
 * String-aware: preserves content inside quotes and url() values.
 */
function minifyCSS(css: string): string {
  // First pass: extract strings and url() values to protect them from mangling
  const placeholders: string[] = [];
  const safeCss = css.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|url\(\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^)]*?)\s*\))/g,
    (match) => {
      placeholders.push(match);
      return `__EREO_PH${placeholders.length - 1}__`;
    }
  );

  // Minify with placeholders protecting string content
  const minified = safeCss
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove whitespace
    .replace(/\s+/g, ' ')
    // Remove whitespace around special characters
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    // Remove trailing semicolons before closing braces
    .replace(/;}/g, '}')
    // Trim
    .trim();

  // Restore protected strings
  return minified.replace(/__EREO_PH(\d+)__/g, (_, idx) => placeholders[Number(idx)]);
}

/**
 * Asset copy result.
 */
interface AssetCopyResult {
  outputs: BuildOutput[];
}

/**
 * Copy static assets.
 *
 * Note: The @ereo/plugin-images package hooks into this process through
 * the plugin buildStart/buildEnd lifecycle. When the image plugin is active:
 * - buildStart: Scans and optimizes images in public/app/assets/assets dirs
 * - buildEnd: Generates image manifest with variants and blur placeholders
 *
 * The image plugin generates optimized variants alongside the originals,
 * which are then picked up by the static file server's format negotiation.
 */
async function copyAssets(options: {
  root: string;
  outDir: string;
  extensions: string[];
}): Promise<AssetCopyResult> {
  const { root, outDir, extensions } = options;
  const outputs: BuildOutput[] = [];

  // Directories to scan for assets
  // Note: Image plugin also scans these directories
  const assetDirs = [
    join(root, 'public'),
    join(root, 'app/assets'),
    join(root, 'assets'),
  ];

  for (const dir of assetDirs) {
    try {
      const files = await scanForFiles(dir, extensions);

      for (const file of files) {
        const relativePath = relative(dir, file);
        const destPath = join(outDir, relativePath);

        // Ensure destination directory exists
        await mkdir(dirname(destPath), { recursive: true });

        // Copy file
        await copyFile(file, destPath);

        const fileStat = await stat(destPath);
        outputs.push({
          path: relative(options.root, destPath),
          size: fileStat.size,
          type: 'asset',
        });
      }
    } catch (error: any) {
      // ENOENT is expected when asset directory doesn't exist
      if (error?.code !== 'ENOENT') {
        console.warn(`  [Assets] Failed to process ${dir}: ${error?.message ?? error}`);
      }
    }
  }

  return { outputs };
}

/**
 * Generate build manifest.
 */
async function generateManifest(options: {
  outDir: string;
  buildId: string;
  routes: Route[];
  islands: IslandMeta[];
  serverResult: ServerBuildResult;
  clientResult: ClientBuildResult;
  cssFiles: string[];
}): Promise<void> {
  const { outDir, buildId, routes, islands, serverResult, clientResult, cssFiles } = options;

  // Convert routes to manifest entries
  const routeEntries: RouteManifestEntry[] = [];

  const processRoute = (route: Route, parentId?: string) => {
    routeEntries.push({
      id: route.id,
      path: route.path,
      file: route.file,
      index: route.index,
      layout: route.layout,
      hasLoader: !!route.module?.loader,
      hasAction: !!route.module?.action,
      hasMeta: !!route.module?.meta,
      hasErrorBoundary: !!route.module?.ErrorBoundary,
      parentId,
    });

    if (route.children) {
      route.children.forEach(child => processRoute(child, route.id));
    }
  };

  routes.forEach(route => processRoute(route));

  // Convert islands to manifest entries
  const islandEntries: Record<string, IslandManifestEntry> = {};
  for (const island of islands) {
    islandEntries[island.id] = {
      id: island.id,
      name: island.name,
      file: island.file,
      strategy: island.strategy,
      exports: island.exports,
    };
  }

  // Build assets map
  const assets: Record<string, ManifestAsset> = {};
  const allOutputs = [...serverResult.outputs, ...clientResult.outputs];

  for (const output of allOutputs) {
    if (output.isEntry) {
      assets[output.path] = {
        file: output.path,
        isEntry: true,
      };
    }
  }

  const manifest: BuildManifest = {
    version: 1,
    buildTime: new Date().toISOString(),
    buildId,
    routes: routeEntries,
    server: {
      entry: serverResult.entryFile,
      modules: serverResult.routeModules,
    },
    client: {
      entry: clientResult.entryFile,
      islands: islandEntries,
      chunks: clientResult.chunks,
    },
    assets,
    css: cssFiles,
  };

  await Bun.write(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

/**
 * Get build output size formatted.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Print build report.
 */
export function printBuildReport(result: BuildResult): void {
  console.log('\nBuild Report:');
  console.log('─'.repeat(60));

  const byType = {
    js: result.outputs.filter((o) => o.type === 'js'),
    css: result.outputs.filter((o) => o.type === 'css'),
    asset: result.outputs.filter((o) => o.type === 'asset'),
  };

  for (const [type, files] of Object.entries(byType)) {
    if (files.length === 0) continue;

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    console.log(`\n${type.toUpperCase()} (${files.length} files, ${formatSize(totalSize)}):`);

    for (const file of files.slice(0, 10)) {
      const entryMark = file.isEntry ? ' (entry)' : '';
      console.log(`  ${file.path} (${formatSize(file.size)})${entryMark}`);
    }

    if (files.length > 10) {
      console.log(`  ... and ${files.length - 10} more`);
    }
  }

  console.log('\n' + '─'.repeat(60));

  const totalSize = result.outputs.reduce((sum, o) => sum + o.size, 0);
  console.log(`Total: ${result.outputs.length} files (${formatSize(totalSize)})`);
  console.log(`Duration: ${result.duration.toFixed(0)}ms`);

  if (result.errors && result.errors.length > 0) {
    console.log(`\n\x1b[33mWarnings/Errors:\x1b[0m`);
    for (const error of result.errors.slice(0, 5)) {
      console.log(`  - ${error}`);
    }
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }
}

/**
 * Analyze bundle size and provide recommendations.
 */
export function analyzeBuild(result: BuildResult): {
  totalSize: number;
  jsSize: number;
  cssSize: number;
  assetSize: number;
  largestFiles: BuildOutput[];
  recommendations: string[];
} {
  const jsFiles = result.outputs.filter(o => o.type === 'js');
  const cssFiles = result.outputs.filter(o => o.type === 'css');
  const assetFiles = result.outputs.filter(o => o.type === 'asset');

  const totalSize = result.outputs.reduce((sum, o) => sum + o.size, 0);
  const jsSize = jsFiles.reduce((sum, o) => sum + o.size, 0);
  const cssSize = cssFiles.reduce((sum, o) => sum + o.size, 0);
  const assetSize = assetFiles.reduce((sum, o) => sum + o.size, 0);

  const largestFiles = [...result.outputs]
    .filter(o => o.type !== 'map')
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  const recommendations: string[] = [];

  // Check for large bundles
  if (jsSize > 500 * 1024) {
    recommendations.push('Consider code splitting to reduce initial bundle size');
  }

  // Check for large individual files
  const largeJsFiles = jsFiles.filter(f => f.size > 100 * 1024);
  if (largeJsFiles.length > 0) {
    recommendations.push(
      `${largeJsFiles.length} JS file(s) exceed 100KB - consider splitting`
    );
  }

  // Check for many chunks
  if (jsFiles.length > 50) {
    recommendations.push('Many small chunks detected - consider adjusting splitting strategy');
  }

  return {
    totalSize,
    jsSize,
    cssSize,
    assetSize,
    largestFiles,
    recommendations,
  };
}
