/**
 * @areo/bundler - Production Build
 *
 * Optimized production builds using Bun's bundler.
 */

import { join, relative } from 'node:path';
import { mkdir, rm, readdir, stat } from 'node:fs/promises';
import type { BuildConfig, FrameworkConfig } from '@areo/core';
import { FileRouter, initFileRouter } from '@areo/router';

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
}

/**
 * Build result.
 */
export interface BuildResult {
  success: boolean;
  outputs: Array<{
    path: string;
    size: number;
    type: 'js' | 'css' | 'asset';
  }>;
  duration: number;
  errors?: string[];
}

/**
 * Build the project for production.
 */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const startTime = performance.now();
  const root = options.root || process.cwd();
  const outDir = options.outDir || join(root, '.areo');

  console.log('Building for production...');

  try {
    // Clean output directory
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(join(outDir, 'server'), { recursive: true });
    await mkdir(join(outDir, 'client'), { recursive: true });

    // Discover routes
    const router = await initFileRouter({
      routesDir: join(root, 'app/routes'),
    });
    const routes = router.getRoutes();

    console.log(`Found ${countRoutes(routes)} routes`);

    // Build server bundle
    const serverResult = await buildServer({
      root,
      outDir: join(outDir, 'server'),
      routes,
      ...options,
    });

    // Build client bundle
    const clientResult = await buildClient({
      root,
      outDir: join(outDir, 'client'),
      routes,
      ...options,
    });

    // Generate manifest
    await generateManifest(outDir, routes, serverResult, clientResult);

    const duration = performance.now() - startTime;

    console.log(`Build completed in ${duration.toFixed(0)}ms`);

    return {
      success: true,
      outputs: [...serverResult.outputs, ...clientResult.outputs],
      duration,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error('Build failed:', error);

    return {
      success: false,
      outputs: [],
      duration,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Count routes recursively.
 */
function countRoutes(routes: any[]): number {
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
 * Build server bundle.
 */
async function buildServer(options: {
  root: string;
  outDir: string;
  routes: any[];
  minify?: boolean;
  sourcemap?: boolean;
}): Promise<{ outputs: BuildResult['outputs'] }> {
  const { root, outDir, routes, minify = true, sourcemap = true } = options;

  // Collect server entry points (routes with loaders/actions)
  const entrypoints: string[] = [];
  const collectEntrypoints = (routeList: any[]) => {
    for (const route of routeList) {
      entrypoints.push(route.file);
      if (route.children) {
        collectEntrypoints(route.children);
      }
    }
  };
  collectEntrypoints(routes);

  if (entrypoints.length === 0) {
    return { outputs: [] };
  }

  // Build with Bun
  const result = await Bun.build({
    entrypoints,
    outdir: outDir,
    target: 'bun',
    minify,
    sourcemap: sourcemap ? 'external' : 'none',
    splitting: true,
    external: ['react', 'react-dom'],
  });

  if (!result.success) {
    throw new Error(
      'Server build failed:\n' +
        result.logs.map((log) => log.message).join('\n')
    );
  }

  const outputs: BuildResult['outputs'] = [];

  for (const output of result.outputs) {
    const stat = await Bun.file(output.path).stat();
    outputs.push({
      path: relative(options.root, output.path),
      size: stat?.size || 0,
      type: output.path.endsWith('.css') ? 'css' : 'js',
    });
  }

  return { outputs };
}

/**
 * Build client bundle.
 */
async function buildClient(options: {
  root: string;
  outDir: string;
  routes: any[];
  minify?: boolean;
  sourcemap?: boolean;
}): Promise<{ outputs: BuildResult['outputs'] }> {
  const { root, outDir, routes, minify = true, sourcemap = true } = options;

  // Check for client entry point
  const clientEntry = join(root, 'app/entry.client.tsx');
  const hasClientEntry = await Bun.file(clientEntry).exists();

  if (!hasClientEntry) {
    // Create default client entry
    const defaultEntry = join(outDir, '_entry.client.tsx');
    await Bun.write(
      defaultEntry,
      `
import { initClient } from '@areo/client';

// Initialize client runtime
initClient();
    `.trim()
    );
  }

  const entrypoint = hasClientEntry ? clientEntry : join(outDir, '_entry.client.tsx');

  // Build with Bun
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: outDir,
    target: 'browser',
    minify,
    sourcemap: sourcemap ? 'external' : 'none',
    splitting: true,
    external: [],
  });

  if (!result.success) {
    throw new Error(
      'Client build failed:\n' +
        result.logs.map((log) => log.message).join('\n')
    );
  }

  const outputs: BuildResult['outputs'] = [];

  for (const output of result.outputs) {
    const stat = await Bun.file(output.path).stat();
    outputs.push({
      path: relative(options.root, output.path),
      size: stat?.size || 0,
      type: output.path.endsWith('.css') ? 'css' : 'js',
    });
  }

  return { outputs };
}

/**
 * Generate build manifest.
 */
async function generateManifest(
  outDir: string,
  routes: any[],
  serverResult: { outputs: BuildResult['outputs'] },
  clientResult: { outputs: BuildResult['outputs'] }
): Promise<void> {
  const manifest = {
    version: 1,
    buildTime: new Date().toISOString(),
    routes: routes.map((r) => ({
      id: r.id,
      path: r.path,
      index: r.index,
      layout: r.layout,
    })),
    server: {
      outputs: serverResult.outputs,
    },
    client: {
      outputs: clientResult.outputs,
    },
  };

  await Bun.write(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

/**
 * Get build output size.
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
      console.log(`  ${file.path} (${formatSize(file.size)})`);
    }

    if (files.length > 10) {
      console.log(`  ... and ${files.length - 10} more`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Total: ${result.outputs.length} files`);
  console.log(`Duration: ${result.duration.toFixed(0)}ms`);
}
