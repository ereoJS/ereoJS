import { describe, expect, test, beforeEach } from 'bun:test';
import { createApp, defineConfig, OreoApp } from './app';
import type { FrameworkConfig, Plugin } from './types';

describe('@oreo/core - App', () => {
  describe('createApp', () => {
    test('creates an app with default config', () => {
      const app = createApp();

      expect(app).toBeInstanceOf(OreoApp);
      expect(app.config.server?.port).toBe(3000);
      expect(app.config.server?.hostname).toBe('localhost');
    });

    test('creates an app with custom config', () => {
      const app = createApp({
        config: {
          server: { port: 8080 },
        },
      });

      expect(app.config.server?.port).toBe(8080);
    });

    test('creates an app with routes', () => {
      const routes = [
        { id: 'home', path: '/', file: '/app/routes/index.tsx' },
      ];

      const app = createApp({ routes });
      expect(app.routes).toHaveLength(1);
      expect(app.routes[0].id).toBe('home');
    });
  });

  describe('defineConfig', () => {
    test('returns the config object', () => {
      const config: FrameworkConfig = {
        server: { port: 4000 },
        build: { target: 'bun' },
      };

      const result = defineConfig(config);
      expect(result).toEqual(config);
    });
  });

  describe('OreoApp', () => {
    let app: OreoApp;

    beforeEach(() => {
      app = createApp();
    });

    test('registers plugins with use()', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        setup: () => {},
      };

      app.use(plugin);
      expect(app.plugins).toHaveLength(1);
      expect(app.plugins[0].name).toBe('test-plugin');
    });

    test('handles requests', async () => {
      const request = new Request('http://localhost:3000/');
      const response = await app.handle(request);

      // Without routes configured, should return 500 (router not configured)
      expect(response.status).toBe(500);
    });

    test('returns 404 for unknown routes when router is set', async () => {
      app.setRouteMatcher(() => null);

      const request = new Request('http://localhost:3000/unknown');
      const response = await app.handle(request);

      expect(response.status).toBe(404);
    });
  });
});
