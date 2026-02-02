/**
 * @areo/cli - Start Command
 *
 * Start the production server.
 */

import { join } from 'node:path';
import { createApp, type FrameworkConfig } from '@areo/core';
import { initFileRouter } from '@areo/router';
import { createServer } from '@areo/server';

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
  const buildDir = join(root, '.areo');

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mAreo\x1b[0m Production Server\n');

  // Check if build exists
  const manifestPath = join(buildDir, 'manifest.json');
  if (!(await Bun.file(manifestPath).exists())) {
    console.error('  \x1b[31m✗\x1b[0m No build found. Run `areo build` first.\n');
    process.exit(1);
  }

  // Load manifest
  const manifest = await Bun.file(manifestPath).json();

  // Load config if exists
  let config: FrameworkConfig = {};
  const configPath = join(root, 'areo.config.ts');

  try {
    if (await Bun.file(configPath).exists()) {
      const configModule = await import(configPath);
      config = configModule.default || configModule;
    }
  } catch {
    // Config is optional
  }

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
      prefix: '/_areo',
      maxAge: 31536000,
      immutable: true,
    },
  });

  server.setApp(app);
  server.setRouter(router);

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
