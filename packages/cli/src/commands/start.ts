/**
 * @ereo/cli - Start Command
 *
 * Start the production server.
 */

import { join } from 'node:path';
import { createApp, type FrameworkConfig } from '@ereo/core';
import { initFileRouter } from '@ereo/router';
import { createServer } from '@ereo/server';
import { loadConfig } from '../config';

/**
 * Start command options.
 */
export interface StartOptions {
  port?: number;
  host?: string;
}

/**
 * Run the start command.
 */
export async function start(options: StartOptions = {}): Promise<void> {
  const root = process.cwd();
  const buildDir = join(root, '.ereo');

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mEreo\x1b[0m Production Server\n');

  // Check if build exists
  const manifestPath = join(buildDir, 'manifest.json');
  if (!(await Bun.file(manifestPath).exists())) {
    console.error('  \x1b[31m✗\x1b[0m No build found. Run `ereo build` first.\n');
    process.exit(1);
  }

  // Load manifest
  const manifest = await Bun.file(manifestPath).json();

  // Load config if exists
  const { config } = await loadConfig(root);

  const port = options.port || config.server?.port || 3000;
  const hostname = options.host || config.server?.hostname || '0.0.0.0';

  // Create app
  const app = createApp({
    config: {
      ...config,
      server: {
        port,
        hostname,
        development: false,
      },
    },
  });

  // Initialize router from built routes
  const router = await initFileRouter({
    routesDir: config.routesDir || 'app/routes',
    watch: false,
  });

  // Load route modules
  await router.loadAllModules();

  // Create server
  const server = createServer({
    port,
    hostname,
    development: false,
    logging: true,
    static: {
      root: join(buildDir, 'client'),
      prefix: '/_ereo',
      maxAge: 31536000,
      immutable: true,
    },
  });

  server.setApp(app);
  server.setRouter(router);

  // Serve compiled Tailwind CSS in production
  const cssPath = join(buildDir, 'assets/styles.css');
  if (await Bun.file(cssPath).exists()) {
    const cssContent = await Bun.file(cssPath).text();
    server.use('/__tailwind.css', async (_request, _context, _next) => {
      return new Response(cssContent, {
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    });
  }

  // Start server
  await server.start();

  console.log(`  \x1b[32m➜\x1b[0m  Server running at \x1b[36mhttp://${hostname}:${port}/\x1b[0m\n`);

  // Handle process signals
  process.on('SIGINT', () => {
    console.log('\n  Shutting down...\n');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n  Shutting down...\n');
    server.stop();
    process.exit(0);
  });
}
