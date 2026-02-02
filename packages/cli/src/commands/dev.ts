/**
 * @oreo/cli - Dev Command
 *
 * Start the development server with HMR.
 */

import { join } from 'node:path';
import {
  createApp,
  type FrameworkConfig,
  setupEnv,
  type EnvConfig,
} from '@oreo/core';
import { initFileRouter } from '@oreo/router';
import { createServer, type ServerOptions } from '@oreo/server';
import {
  createHMRServer,
  createHMRWatcher,
  createHMRWebSocket,
  HMR_CLIENT_CODE,
  ERROR_OVERLAY_SCRIPT,
} from '@oreo/bundler';

/**
 * Dev command options.
 */
export interface DevOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

/** Extended config with env schema */
interface OreoConfig extends FrameworkConfig {
  env?: EnvConfig;
}

/**
 * Run the dev command.
 */
export async function dev(options: DevOptions = {}): Promise<void> {
  const port = options.port || 3000;
  const hostname = options.host || 'localhost';
  const root = process.cwd();

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mOreo\x1b[0m Dev Server\n');

  // Load config if exists
  let config: OreoConfig = {};
  const configPath = join(root, 'oreo.config.ts');

  try {
    if (await Bun.file(configPath).exists()) {
      const configModule = await import(configPath);
      config = configModule.default || configModule;
    }
  } catch (error) {
    console.warn('Could not load config:', error);
  }

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
        port,
        hostname,
        development: true,
        ...config.server,
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

  // Create HMR server
  const hmr = createHMRServer();
  const hmrWatcher = createHMRWatcher(hmr);

  // Watch for file changes
  hmrWatcher.watch(join(root, 'app'));

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

  // Create server with HMR
  const server = createServer({
    port,
    hostname,
    development: true,
    logging: true,
    websocket: createHMRWebSocket(hmr),
  });

  server.setApp(app);
  server.setRouter(router);

  // Add HMR middleware
  server.use(async (request, context, next) => {
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
          console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mOreo\x1b[0m Dev Server\n');
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
