import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { BunServer, createServer, serve } from './bun-server';

describe('@areo/server - BunServer', () => {
  let server: BunServer;

  afterEach(() => {
    if (server) {
      server.stop();
    }
  });

  describe('createServer', () => {
    test('creates a BunServer instance', () => {
      server = createServer();
      expect(server).toBeInstanceOf(BunServer);
    });

    test('uses default options', () => {
      server = createServer();
      const info = server.getInfo();

      expect(info.port).toBe(3000);
      expect(info.hostname).toBe('localhost');
      expect(info.development).toBe(true);
    });

    test('accepts custom options', () => {
      server = createServer({
        port: 8080,
        hostname: '0.0.0.0',
        development: false,
      });

      const info = server.getInfo();

      expect(info.port).toBe(8080);
      expect(info.hostname).toBe('0.0.0.0');
      expect(info.development).toBe(false);
    });
  });

  describe('BunServer', () => {
    beforeEach(() => {
      server = createServer({ port: 4567, logging: false });
    });

    test('has null server before start', () => {
      expect(server.getServer()).toBeNull();
    });

    test('adds middleware with use()', () => {
      server.use(async (req, ctx, next) => next());
      // No error thrown means success
    });

    test('getInfo returns server configuration', () => {
      const info = server.getInfo();

      expect(info).toHaveProperty('port');
      expect(info).toHaveProperty('hostname');
      expect(info).toHaveProperty('development');
    });

    test('start returns a server instance', async () => {
      const bunServer = await server.start();

      expect(bunServer).toBeDefined();
      expect(server.getServer()).not.toBeNull();
    });

    test('stop closes the server', async () => {
      await server.start();
      server.stop();

      expect(server.getServer()).toBeNull();
    });

    test('handles requests with custom handler', async () => {
      server = createServer({
        port: 4568,
        logging: false,
        handler: async (request) => {
          return new Response('Custom handler response');
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4568/');
      const text = await response.text();

      expect(text).toBe('Custom handler response');
    });

    test('returns 404 for unmatched routes when router is set', async () => {
      server = createServer({ port: 4569, logging: false });

      // Mock a router that always returns null
      server.setRouter({
        match: () => null,
        loadModule: async () => {},
      } as any);

      await server.start();

      const response = await fetch('http://localhost:4569/unknown');

      expect(response.status).toBe(404);
    });

    test('handles errors gracefully in development', async () => {
      server = createServer({
        port: 4570,
        logging: false,
        development: true,
        handler: async () => {
          throw new Error('Test error');
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4570/');

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Test error');
    });

    test('handles errors gracefully in production', async () => {
      server = createServer({
        port: 4571,
        logging: false,
        development: false,
        handler: async () => {
          throw new Error('Test error');
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4571/');

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Internal Server Error');
    });
  });

  describe('serve helper', () => {
    test('creates and starts a server', async () => {
      server = await serve({ port: 4572, logging: false });

      expect(server).toBeInstanceOf(BunServer);
      expect(server.getServer()).not.toBeNull();
    });
  });
});
