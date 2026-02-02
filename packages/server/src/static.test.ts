import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { serveStatic, staticMiddleware, getMimeType } from './static';

const TEST_DIR = join(import.meta.dir, '__test_static__');

describe('@areo/server - Static', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(join(TEST_DIR, 'subdir'), { recursive: true });
    await writeFile(join(TEST_DIR, 'test.txt'), 'Hello World');
    await writeFile(join(TEST_DIR, 'test.json'), '{"key": "value"}');
    await writeFile(join(TEST_DIR, 'index.html'), '<html><body>Index</body></html>');
    await writeFile(join(TEST_DIR, 'subdir', 'nested.txt'), 'Nested content');
    await writeFile(join(TEST_DIR, 'script.abc12345.js'), 'console.log("fingerprinted")');
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('getMimeType', () => {
    test('returns correct MIME type for common extensions', () => {
      expect(getMimeType('file.html')).toBe('text/html; charset=utf-8');
      expect(getMimeType('file.css')).toBe('text/css; charset=utf-8');
      expect(getMimeType('file.js')).toBe('text/javascript; charset=utf-8');
      expect(getMimeType('file.json')).toBe('application/json');
      expect(getMimeType('file.png')).toBe('image/png');
      expect(getMimeType('file.jpg')).toBe('image/jpeg');
      expect(getMimeType('file.svg')).toBe('image/svg+xml');
      expect(getMimeType('file.woff2')).toBe('font/woff2');
      expect(getMimeType('file.pdf')).toBe('application/pdf');
      expect(getMimeType('file.wasm')).toBe('application/wasm');
    });

    test('returns octet-stream for unknown extensions', () => {
      expect(getMimeType('file.unknown')).toBe('application/octet-stream');
      expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    });

    test('handles uppercase extensions', () => {
      expect(getMimeType('file.HTML')).toBe('text/html; charset=utf-8');
      expect(getMimeType('file.PNG')).toBe('image/png');
    });
  });

  describe('serveStatic', () => {
    test('creates static file handler', () => {
      const handler = serveStatic({ root: TEST_DIR });
      expect(typeof handler).toBe('function');
    });

    test('serves existing files', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      const request = new Request('http://localhost:3000/test.txt');

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(await response!.text()).toBe('Hello World');
      expect(response!.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });

    test('returns null for non-existent files', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      const request = new Request('http://localhost:3000/missing.txt');

      const response = await handler(request);

      expect(response).toBeNull();
    });

    test('returns null for non-GET/HEAD methods', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      const request = new Request('http://localhost:3000/test.txt', { method: 'POST' });

      const response = await handler(request);

      expect(response).toBeNull();
    });

    test('handles HEAD requests', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      const request = new Request('http://localhost:3000/test.txt', { method: 'HEAD' });

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(await response!.text()).toBe('');
    });

    test('serves index.html for directories', async () => {
      const handler = serveStatic({ root: TEST_DIR, index: 'index.html' });
      const request = new Request('http://localhost:3000/');

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(await response!.text()).toContain('Index');
    });

    test('prevents directory traversal', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      // URL constructor normalizes ../, so we test with an encoded path
      const request = new Request('http://localhost:3000/subdir/../../../package.json');

      const response = await handler(request);

      // Either returns 403 or null depending on path normalization
      if (response !== null) {
        expect(response.status).toBe(403);
      }
    });

    test('respects URL prefix', async () => {
      const handler = serveStatic({ root: TEST_DIR, prefix: '/static' });

      // Without prefix - should return null
      const request1 = new Request('http://localhost:3000/test.txt');
      const response1 = await handler(request1);
      expect(response1).toBeNull();

      // With prefix - should serve file
      const request2 = new Request('http://localhost:3000/static/test.txt');
      const response2 = await handler(request2);
      expect(response2).not.toBeNull();
      expect(response2!.status).toBe(200);
    });

    test('sets ETag header', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      const request = new Request('http://localhost:3000/test.txt');

      const response = await handler(request);

      expect(response!.headers.get('ETag')).toBeDefined();
      expect(response!.headers.get('ETag')).toMatch(/^".+"$/);
    });

    test('sets Last-Modified header', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      const request = new Request('http://localhost:3000/test.txt');

      const response = await handler(request);

      expect(response!.headers.get('Last-Modified')).toBeDefined();
    });

    test('handles If-None-Match for conditional requests', async () => {
      const handler = serveStatic({ root: TEST_DIR });

      // First request to get ETag
      const request1 = new Request('http://localhost:3000/test.txt');
      const response1 = await handler(request1);
      const etag = response1!.headers.get('ETag');

      // Second request with ETag
      const request2 = new Request('http://localhost:3000/test.txt', {
        headers: { 'If-None-Match': etag! },
      });
      const response2 = await handler(request2);

      expect(response2!.status).toBe(304);
    });

    test('handles If-Modified-Since for conditional requests', async () => {
      const handler = serveStatic({ root: TEST_DIR });

      // First request to get Last-Modified
      const request1 = new Request('http://localhost:3000/test.txt');
      const response1 = await handler(request1);
      const lastModified = response1!.headers.get('Last-Modified');

      // Second request with future date
      const futureDate = new Date(Date.now() + 86400000).toUTCString();
      const request2 = new Request('http://localhost:3000/test.txt', {
        headers: { 'If-Modified-Since': futureDate },
      });
      const response2 = await handler(request2);

      expect(response2!.status).toBe(304);
    });

    test('sets immutable cache-control for fingerprinted files', async () => {
      const handler = serveStatic({ root: TEST_DIR, maxAge: 31536000, immutable: true });
      const request = new Request('http://localhost:3000/script.abc12345.js');

      const response = await handler(request);

      expect(response!.headers.get('Cache-Control')).toContain('immutable');
    });

    test('sets regular cache-control for non-fingerprinted files', async () => {
      const handler = serveStatic({ root: TEST_DIR, maxAge: 3600 });
      const request = new Request('http://localhost:3000/test.txt');

      const response = await handler(request);

      expect(response!.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response!.headers.get('Cache-Control')).not.toContain('immutable');
    });

    test('serves files from subdirectories', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      const request = new Request('http://localhost:3000/subdir/nested.txt');

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(await response!.text()).toBe('Nested content');
    });

    test('shows directory listing when enabled', async () => {
      const handler = serveStatic({ root: TEST_DIR, listing: true });
      // Make a request to subdir which has no index.html
      const request = new Request('http://localhost:3000/subdir/');

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      const html = await response!.text();
      expect(html).toContain('Index of');
      expect(html).toContain('nested.txt');
    });

    test('returns null for directory without index when listing disabled', async () => {
      const handler = serveStatic({ root: TEST_DIR, listing: false });
      const request = new Request('http://localhost:3000/subdir/');

      const response = await handler(request);

      expect(response).toBeNull();
    });

    test('serves fallback file when enabled and file not found', async () => {
      const handler = serveStatic({ root: TEST_DIR, fallback: 'index.html' });
      const request = new Request('http://localhost:3000/nonexistent-route');

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(await response!.text()).toContain('Index');
    });

    test('handles fallback with valid file', async () => {
      // Test that fallback works when properly configured
      const handler = serveStatic({ root: TEST_DIR, fallback: 'index.html' });
      const request = new Request('http://localhost:3000/some-spa-route');

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(response!.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    test('returns 403 for directory traversal with ..', async () => {
      const handler = serveStatic({ root: TEST_DIR });
      // Create request with double dots in path
      const request = new Request('http://localhost:3000/subdir/..%2F..%2Fpackage.json');

      const response = await handler(request);

      // Should either be 403 or null
      if (response !== null) {
        expect(response.status).toBe(403);
      }
    });

    test('if-modified-since returns 200 when modified after', async () => {
      const handler = serveStatic({ root: TEST_DIR });

      // Request with a past date
      const pastDate = new Date('2000-01-01').toUTCString();
      const request = new Request('http://localhost:3000/test.txt', {
        headers: { 'If-Modified-Since': pastDate },
      });

      const response = await handler(request);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
    });
  });

  describe('staticMiddleware', () => {
    test('creates middleware from static options', () => {
      const middleware = staticMiddleware({ root: TEST_DIR });
      expect(typeof middleware).toBe('function');
    });

    test('serves static files and falls through', async () => {
      const middleware = staticMiddleware({ root: TEST_DIR });

      // Existing file
      const request1 = new Request('http://localhost:3000/test.txt');
      const response1 = await middleware(request1, {}, async () => new Response('Fallback'));
      expect(await response1.text()).toBe('Hello World');

      // Non-existing file - should call next
      const request2 = new Request('http://localhost:3000/missing.txt');
      const response2 = await middleware(request2, {}, async () => new Response('Fallback'));
      expect(await response2.text()).toBe('Fallback');
    });
  });
});
