/**
 * @ereo/cli - Dev Command
 *
 * Start the development server with HMR.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  createApp,
  type FrameworkConfig,
  setupEnv,
  type AppContext,
  type NextFunction,
} from '@ereo/core';
import { initFileRouter } from '@ereo/router';
import { createServer, type ServerOptions } from '@ereo/server';
import { loadConfig } from '../config';

/**
 * Dev command options.
 */
export interface DevOptions {
  port?: number;
  host?: string;
  open?: boolean;
  /** Enable request tracing with CLI reporter */
  trace?: boolean;
}

/**
 * Run the dev command.
 */
export async function dev(options: DevOptions = {}): Promise<void> {
  const root = process.cwd();

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mEreo\x1b[0m Dev Server\n');

  // Load config if exists (must happen before port/hostname resolution)
  const { config, configPath } = await loadConfig(root);

  // Resolve port/hostname: CLI option → config → default
  const port = options.port || config.server?.port || 3000;
  const hostname = options.host || config.server?.hostname || 'localhost';

  // Load and validate environment variables
  if (config.env) {
    console.log('  \x1b[2mLoading environment variables...\x1b[0m');
    const envResult = await setupEnv(root, config.env, 'development');
    if (!envResult.valid) {
      console.error('\n  \x1b[31m✖\x1b[0m Environment validation failed\n');
      process.exit(1);
    }
    console.log(`  \x1b[32m✓\x1b[0m Loaded ${Object.keys(envResult.env).length} environment variables\n`);
  }

  // Create app
  const app = createApp({
    config: {
      ...config,
      server: {
        ...config.server,
        port,
        hostname,
        development: true,
      },
    },
  });

  // Register Bun plugin to transform 'use client' files for SSR.
  // Wraps exported components with createIsland() so server rendering
  // produces <div data-island="..."> markers that the client can hydrate.
  // Note: Bun runtime plugins MUST return a value from onLoad when the filter matches.
  const { plugin } = await import('bun');
  const { createIsland } = await import('@ereo/client');
  const islandModuleCache = new Map<string, Record<string, unknown>>();
  const appDir = join(root, 'app');

  plugin({
    name: 'ereo:use-client',
    setup(build) {
      // Loader for raw (unwrapped) island files — uses .ereo-raw extension to avoid recursion
      build.onLoad({ filter: /\.ereo-raw$/ }, async (args) => {
        return { contents: await Bun.file(args.path).text(), loader: 'tsx' };
      });

      // Intercept tsx/jsx files — Bun requires onLoad to always return a value when filter matches.
      // Only tsx/jsx because 'use client' components are React files, and matching .js/.ts would
      // break CJS modules in node_modules (e.g., postcss).
      build.onLoad({ filter: /\.(tsx|jsx)$/ }, async (args) => {
        // Return cached island module if already processed
        if (islandModuleCache.has(args.path)) {
          return { exports: islandModuleCache.get(args.path)!, loader: 'object' };
        }

        const text = await Bun.file(args.path).text();
        const ext = args.path.endsWith('.tsx') ? 'tsx' : 'jsx';

        // Files outside app/ or without 'use client': pass through unchanged
        if (!args.path.startsWith(appDir) || !/^['"]use client['"]/m.test(text)) {
          return { contents: text, loader: ext };
        }

        // Extract named export names
        const namedExports: string[] = [];
        for (const match of text.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)) {
          namedExports.push(match[1]);
        }

        // Mark as processing (prevents recursion)
        islandModuleCache.set(args.path, {});

        // Write raw version (without 'use client') using .ereo-raw extension to bypass this filter
        const cleanCode = text.replace(/^['"]use client['"];?\s*\r?\n?/m, '');
        const tmpPath = args.path + '.ereo-raw';
        await Bun.write(tmpPath, cleanCode);
        const rawModule = await import(tmpPath);
        try { (await import('node:fs')).unlinkSync(tmpPath); } catch {}

        // Wrap each exported function component with createIsland()
        const wrappedExports: Record<string, unknown> = {};
        for (const name of namedExports) {
          if (typeof rawModule[name] === 'function') {
            wrappedExports[name] = createIsland(rawModule[name], name);
          } else {
            wrappedExports[name] = rawModule[name];
          }
        }
        // Preserve default export if present
        if (rawModule.default !== undefined) {
          if (typeof rawModule.default === 'function') {
            const defName = text.match(/export\s+default\s+(?:function|class)\s+(\w+)/)?.[1] || 'default';
            wrappedExports.default = createIsland(rawModule.default, defName);
          } else {
            wrappedExports.default = rawModule.default;
          }
        }

        islandModuleCache.set(args.path, wrappedExports);
        return { exports: wrappedExports, loader: 'object' };
      });
    },
  });

  // Initialize router
  const router = await initFileRouter({
    routesDir: config.routesDir || 'app/routes',
    watch: true,
  });

  // Load route modules
  await router.loadAllModules();

  // Lazy-load bundler (not needed by start command)
  const {
    createHMRServer,
    createHMRWatcher,
    createHMRWebSocket,
    HMR_CLIENT_CODE,
    ERROR_OVERLAY_SCRIPT,
  } = await import('@ereo/bundler');

  // Create HMR server
  const hmr = createHMRServer();
  const hmrWatcher = createHMRWatcher(hmr);

  // Watch for file changes
  hmrWatcher.watch(join(root, 'app'));

  // Watch config file for changes and restart
  if (configPath) {
    const { watch } = await import('node:fs');
    let configDebounce: ReturnType<typeof setTimeout> | null = null;
    watch(configPath, () => {
      if (configDebounce) clearTimeout(configDebounce);
      configDebounce = setTimeout(() => {
        console.log('\x1b[33m⟳\x1b[0m Config changed — restart the dev server to apply changes.');
      }, 200);
    });
  }

  // Handle route changes
  router.on('reload', () => {
    console.log('\x1b[33m⟳\x1b[0m Routes reloaded');
    // Clear island module cache to prevent stale middleware/components
    islandModuleCache.clear();
    // Clear Bun's module cache for app directory to ensure fresh loads
    for (const key of Object.keys((globalThis as any).__BUN_MODULE_CACHE__ || {})) {
      if (key.includes('/app/')) {
        delete (globalThis as any).__BUN_MODULE_CACHE__?.[key];
      }
    }
    hmr.reload();
  });

  router.on('change', (route) => {
    console.log(`\x1b[33m⟳\x1b[0m ${route.path} changed`);
    // Invalidate specific module from cache
    const absolutePath = join(root, route.file);
    islandModuleCache.delete(absolutePath);
    // Clear from Bun's module cache
    for (const key of Object.keys((globalThis as any).__BUN_MODULE_CACHE__ || {})) {
      if (key === absolutePath || key.endsWith(route.file)) {
        delete (globalThis as any).__BUN_MODULE_CACHE__?.[key];
      }
    }
    // Pass absolute path so ModuleAnalyzer can read the file
    hmr.jsUpdate(absolutePath);
  });

  // Setup tracing if enabled
  let traceConfig: import('@ereo/server').ServerOptions['trace'] = undefined;
  if (options.trace) {
    try {
      const {
        createTracer, traceMiddleware, createCLIReporter, createViewerHandler, createTracesAPIHandler,
        createTraceWebSocket, getActiveSpan, traceRouteMatch, traceLoader,
      } = await import('@ereo/trace');
      const tracer = createTracer();
      const middleware = traceMiddleware(tracer);
      const viewerHandler = createViewerHandler(tracer);
      const tracesAPIHandler = createTracesAPIHandler(tracer);
      const traceWs = createTraceWebSocket(tracer);

      // Start CLI reporter
      createCLIReporter(tracer);

      traceConfig = {
        tracer, middleware, viewerHandler, tracesAPIHandler,
        traceWebSocket: traceWs,
        instrumentors: { getActiveSpan, traceRouteMatch, traceLoader },
      };
      console.log('  \x1b[35m⬡\x1b[0m Tracing enabled — view at /__ereo/traces\n');
    } catch {
      console.warn('  \x1b[33m⚠\x1b[0m @ereo/trace not installed, tracing disabled\n');
    }
  }

  // Serve static files from public/ directory in dev mode
  const publicDir = join(root, 'public');
  const staticConfig = existsSync(publicDir)
    ? { root: publicDir, prefix: '/', maxAge: 0 }
    : undefined;

  // Create server with HMR
  const server = createServer({
    port,
    hostname,
    development: true,
    logging: !options.trace, // Disable default logger when tracing (trace middleware provides richer output)
    websocket: createHMRWebSocket(hmr),
    trace: traceConfig,
    static: staticConfig,
  });

  server.setApp(app);
  server.setRouter(router);

  // Initialize plugins and configure server
  const pluginRegistry = app.getPluginRegistry();
  await pluginRegistry.registerAll(config.plugins || []);

  // Create dev server interface for plugins
  const devServer = {
    ws: {
      send: (data: unknown) => {
        // Cast to HMR update type for compatibility
        if (data && typeof data === 'object') {
          hmr.send(data as any);
        }
      },
      on: (event: string, callback: (data: unknown) => void) => {
        // HMR WebSocket event handling
      },
    },
    restart: async () => {
      console.log('\x1b[33m⟳\x1b[0m Restarting server...');
      hmr.reload();
    },
    middlewares: [] as ((request: Request, context: AppContext, next: NextFunction) => Response | Promise<Response>)[],
    watcher: {
      add: (path: string) => hmrWatcher.watch(path),
      on: (event: string, callback: (file: string) => void) => {
        // File watcher event handling
      },
    },
  };

  // Configure plugins with dev server
  await pluginRegistry.configureServer(devServer);

  // Add plugin middlewares to server
  for (const middleware of devServer.middlewares) {
    server.use(middleware);
  }

  // Register plugin WebSocket handlers (e.g., RPC subscriptions)
  for (const plugin of pluginRegistry.getPlugins()) {
    const p = plugin as any;
    if (typeof p.getWebSocketConfig === 'function' && typeof p.endpoint === 'string') {
      server.addWebSocketUpgrade(
        p.endpoint,
        (srv: any, req: Request) => p.upgradeToWebSocket(srv, req, {}),
        p.getWebSocketConfig()
      );
    }
  }

  // Scan for island components ('use client' files) in the app directory.
  // Returns structured data with file paths and exported component names.
  interface IslandExport { path: string; name: string; isDefault?: boolean; }

  async function scanForIslands(projectRoot: string): Promise<IslandExport[]> {
    const appDir = join(projectRoot, 'app');
    const islands: IslandExport[] = [];

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDir(fullPath);
          } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              if (/^\s*['"]use client['"]/m.test(content)) {
                // Extract named exports
                for (const match of content.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)) {
                  islands.push({ path: fullPath, name: match[1] });
                }
                // Default export with name
                const defMatch = content.match(/export\s+default\s+(?:function|class)\s+(\w+)/);
                if (defMatch && !islands.some(i => i.path === fullPath && i.name === defMatch[1])) {
                  islands.push({ path: fullPath, name: defMatch[1], isDefault: true });
                }
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Directory might not exist
      }
    }

    await scanDir(appDir);
    return islands;
  }

  // Build client entry for dev mode
  // In production, `ereo build` creates this. In dev, we build on-demand.
  const clientBuildDir = await mkdtemp(join(tmpdir(), 'ereo-dev-client-'));
  const clientBundleCache = new Map<string, string>();

  async function buildDevClient(): Promise<void> {
    // Always scan for island components ('use client' files)
    const islands = await scanForIslands(root);

    // Generate island registration code for the client bundle
    let islandRegistrationCode = '';
    if (islands.length > 0) {
      const importLines: string[] = [];
      const registerLines: string[] = [];
      const seenPaths = new Set<string>();

      for (const island of islands) {
        const importAlias = `__Island_${island.name}`;
        if (!seenPaths.has(island.path + ':' + island.name)) {
          seenPaths.add(island.path + ':' + island.name);
          if (island.isDefault) {
            importLines.push(`import ${importAlias} from '${island.path}';`);
          } else {
            importLines.push(`import { ${island.name} as ${importAlias} } from '${island.path}';`);
          }
          registerLines.push(`registerIslandComponent('${island.name}', ${importAlias});`);
        }
      }

      islandRegistrationCode = [
        `import { registerIslandComponent } from '@ereo/client';`,
        ...importLines,
        ...registerLines,
      ].join('\n');
    }

    // Check for custom client entry
    const customEntry = join(root, 'app/entry.client.tsx');
    const customEntryAlt = join(root, 'app/entry.client.ts');
    const hasCustom = await Bun.file(customEntry).exists();
    const hasCustomAlt = await Bun.file(customEntryAlt).exists();

    let entrySource: string;

    if (hasCustom) {
      entrySource = await Bun.file(customEntry).text();
    } else if (hasCustomAlt) {
      entrySource = await Bun.file(customEntryAlt).text();
    } else {
      entrySource = `import { initClient } from '@ereo/client';\n\n// Initialize the EreoJS client runtime (hydrates islands, sets up navigation, prefetching)\ninitClient();`;
    }

    // Prepend island registration code so components are registered before initClient() hydrates
    if (islandRegistrationCode) {
      entrySource = islandRegistrationCode + '\n\n' + entrySource;
    }

    // Rewrite ~/ and @/ aliases to absolute paths before writing to cache
    // (the cache dir is outside app/, so aliases won't resolve otherwise)
    const appDir = join(root, 'app');
    entrySource = entrySource.replace(
      /from\s+['"]([~@]\/[^'"]+)['"]/g,
      (_match, importPath) => {
        const resolved = importPath.replace(/^[~@]\//, appDir + '/');
        return `from '${resolved}'`;
      }
    );
    // Also rewrite relative imports (./xxx) to be relative to app/ dir
    entrySource = entrySource.replace(
      /from\s+['"](\.\/.+?)['"]/g,
      (_match, importPath) => {
        const resolved = join(appDir, importPath);
        return `from '${resolved}'`;
      }
    );

    // Write combined entry to cache directory (in project root so Bun resolves node_modules)
    const entryPath = join(root, 'node_modules', '.cache', 'ereo', '_entry.client.tsx');
    await mkdir(join(root, 'node_modules', '.cache', 'ereo'), { recursive: true });
    await Bun.write(entryPath, entrySource);

    try {
      const result = await Bun.build({
        entrypoints: [entryPath],
        outdir: clientBuildDir,
        target: 'browser',
        minify: false,
        sourcemap: 'inline',
        naming: {
          entry: 'client.[ext]',
          chunk: 'chunks/[name]-[hash].[ext]',
        },
      });

      if (!result.success) {
        for (const log of result.logs) {
          console.error('  \x1b[31m✖\x1b[0m Client build error:', log.message);
        }
        return;
      }

      // Cache built outputs
      clientBundleCache.clear();
      for (const output of result.outputs) {
        const relativePath = output.path.replace(clientBuildDir, '').replace(/^\//, '');
        clientBundleCache.set(relativePath, await output.text());
      }
    } catch (error) {
      console.error('  \x1b[31m✖\x1b[0m Failed to build client entry:', error);
    }
  }

  await buildDevClient();

  // Rebuild client on route changes
  router.on('reload', () => {
    buildDevClient().catch((err) => {
      console.error('  \x1b[31m✖\x1b[0m Failed to rebuild client:', err);
    });
  });

  // Add HMR middleware
  server.use(async (request: Request, context: AppContext, next: NextFunction) => {
    const url = new URL(request.url);

    // Serve dev client bundle
    if (url.pathname === '/_ereo/client.js') {
      const code = clientBundleCache.get('client.js');
      if (code) {
        return new Response(code, {
          headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }

    // Serve client bundle chunks
    if (url.pathname.startsWith('/_ereo/chunks/')) {
      const chunkPath = url.pathname.replace('/_ereo/', '');
      const code = clientBundleCache.get(chunkPath);
      if (code) {
        return new Response(code, {
          headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
    }

    // Inject HMR client
    if (url.pathname === '/__hmr-client.js') {
      return new Response(HMR_CLIENT_CODE, {
        headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' },
      });
    }

    // Handle errors
    try {
      const response = await next();

      // Inject HMR script and error overlay into HTML responses
      if (response.headers.get('Content-Type')?.includes('text/html')) {
        let html = await response.text();

        // Inject scripts before </body>
        const scripts = `
          <script src="/__hmr-client.js"></script>
          ${ERROR_OVERLAY_SCRIPT}
        `;

        html = html.replace('</body>', `${scripts}</body>`);

        return new Response(html, {
          status: response.status,
          headers: response.headers,
        });
      }

      return response;
    } catch (error) {
      hmr.error(
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  });

  // Start server
  await server.start();

  console.log(`  \x1b[32m➜\x1b[0m  Local:   \x1b[36mhttp://${hostname}:${port}/\x1b[0m`);

  if (options.open) {
    const opener = process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';

    Bun.spawn([opener, `http://${hostname}:${port}`]);
  }

  console.log('\n  \x1b[2mpress h to show help\x1b[0m\n');

  // Handle keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async (data) => {
      const key = data.toString();

      switch (key) {
        case 'h':
          console.log('\n  Shortcuts:');
          console.log('    r - Reload routes');
          console.log('    c - Clear console');
          console.log('    q - Quit');
          console.log('');
          break;

        case 'r':
          console.log('\x1b[33m⟳\x1b[0m Reloading routes...');
          await router.discoverRoutes();
          await router.loadAllModules();
          hmr.reload();
          break;

        case 'c':
          console.clear();
          console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mEreo\x1b[0m Dev Server\n');
          console.log(`  \x1b[32m➜\x1b[0m  Local:   \x1b[36mhttp://${hostname}:${port}/\x1b[0m\n`);
          break;

        case 'q':
        case '\x03': // Ctrl+C
          console.log('\n  Shutting down...\n');
          server.stop();
          hmrWatcher.stop();
          rm(clientBuildDir, { recursive: true, force: true }).catch(() => {});
          process.exit(0);
          break;
      }
    });
  }

  // Handle process signals
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...\n');
    server.stop();
    hmrWatcher.stop();
    rm(clientBuildDir, { recursive: true, force: true }).catch(() => {});
    process.exit(0);
  });

  // Clean up temp directory on unexpected crashes to prevent /tmp accumulation
  process.on('uncaughtException', (error) => {
    console.error('\n  Uncaught exception:', error);
    rm(clientBuildDir, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  });
}
