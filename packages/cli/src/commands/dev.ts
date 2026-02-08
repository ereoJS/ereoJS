/**
 * @ereo/cli - Dev Command
 *
 * Start the development server with HMR.
 */

import { join } from 'node:path';
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
  router.on('reload', async () => {
    console.log('\x1b[33m⟳\x1b[0m Routes reloaded');
    await router.loadAllModules();
    hmr.reload();
  });

  router.on('change', (route) => {
    console.log(`\x1b[33m⟳\x1b[0m ${route.path} changed`);
    hmr.jsUpdate(route.file);
  });

  // Setup tracing if enabled
  let traceConfig: import('@ereo/server').ServerOptions['trace'] = undefined;
  if (options.trace) {
    try {
      const { createTracer, traceMiddleware, createCLIReporter, createViewerHandler, createTracesAPIHandler } = await import('@ereo/trace');
      const tracer = createTracer();
      const middleware = traceMiddleware(tracer);
      const viewerHandler = createViewerHandler(tracer);
      const tracesAPIHandler = createTracesAPIHandler(tracer);

      // Start CLI reporter
      createCLIReporter(tracer);

      traceConfig = { tracer, middleware, viewerHandler, tracesAPIHandler };
      console.log('  \x1b[35m⬡\x1b[0m Tracing enabled — view at /__ereo/traces\n');
    } catch {
      console.warn('  \x1b[33m⚠\x1b[0m @ereo/trace not installed, tracing disabled\n');
    }
  }

  // Create server with HMR
  const server = createServer({
    port,
    hostname,
    development: true,
    logging: !options.trace, // Disable default logger when tracing (trace middleware provides richer output)
    websocket: createHMRWebSocket(hmr),
    trace: traceConfig,
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

  // Add HMR middleware
  server.use(async (request: Request, context: AppContext, next: NextFunction) => {
    const url = new URL(request.url);

    // Inject HMR client
    if (url.pathname === '/__hmr-client.js') {
      return new Response(HMR_CLIENT_CODE, {
        headers: { 'Content-Type': 'text/javascript' },
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
    process.exit(0);
  });
}
