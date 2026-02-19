import { describe, expect, test, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  createShell,
  createResponse,
  renderToString,
  renderToStream,
} from './streaming';

// Helper to create a mock ReadableStream for testing
function createMockReadableStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(content);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    }
  });
}

// Helper to read a ReadableStream to string
async function readStreamToString(body: string | ReadableStream<Uint8Array>): Promise<string> {
  if (typeof body === 'string') return body;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

// Mock callbacks for testing
let capturedOnError: ((error: unknown) => void) | null = null;
let capturedBootstrapModules: string[] | undefined = undefined;
let mockPipeableContent = '<div>mock content</div>';

// Mock the react-dom/server module
mock.module('react-dom/server', () => ({
  renderToString: (element: any) => {
    // Simple mock that returns a basic HTML representation
    if (element?.type === 'div') {
      return `<div>${element.props?.children || ''}</div>`;
    }
    if (element?.type === 'span') {
      return `<span>${element.props?.children || ''}</span>`;
    }
    return '<div>mock content</div>';
  },
  renderToPipeableStream: (element: any, options?: any) => {
    // Capture callbacks and options
    if (options?.onError) {
      capturedOnError = options.onError;
    }
    capturedBootstrapModules = options?.bootstrapModules;

    const result = {
      pipe: (writable: any) => {
        writable.write(mockPipeableContent);
        writable.end();
      },
      abort: () => {},
    };

    // Trigger onShellReady in next tick so the Promise setup completes first
    if (options?.onShellReady) {
      setImmediate(() => options.onShellReady());
    }

    return result;
  },
}));

// Mock the stream module for PassThrough
mock.module('stream', () => {
  const { EventEmitter } = require('events');

  class MockPassThrough extends EventEmitter {
    chunks: Buffer[] = [];

    write(chunk: string | Buffer) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      this.chunks.push(buf);
      this.emit('data', buf);
      return true;
    }

    end() {
      // Use setImmediate to allow the pipe to complete before emitting end
      setImmediate(() => this.emit('end'));
    }

    destroy() {
      this.emit('close');
    }
  }

  return {
    PassThrough: MockPassThrough,
  };
});

describe('@ereo/server - Streaming', () => {
  describe('createShell', () => {
    test('creates basic HTML shell', () => {
      const { head, tail } = createShell({});

      expect(head).toContain('<!DOCTYPE html>');
      expect(head).toContain('<html');
      expect(head).toContain('<head>');
      expect(head).toContain('<body');
      expect(head).toContain('<div id="root">');
      expect(tail).toContain('</div>');
      expect(tail).toContain('</body>');
      expect(tail).toContain('</html>');
    });

    test('includes title when provided', () => {
      const { head } = createShell({
        shell: { title: 'Test Page' },
      });

      expect(head).toContain('<title>Test Page</title>');
    });

    test('includes meta tags', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { name: 'description', content: 'Test description' },
            { property: 'og:title', content: 'OG Title' },
          ],
        },
      });

      expect(head).toContain('name="description" content="Test description"');
      expect(head).toContain('property="og:title" content="OG Title"');
    });

    test('includes stylesheets', () => {
      const { head } = createShell({
        styles: ['/styles/main.css', '/styles/theme.css'],
      });

      expect(head).toContain('href="/styles/main.css"');
      expect(head).toContain('href="/styles/theme.css"');
    });

    test('includes scripts', () => {
      const { tail } = createShell({
        scripts: ['/js/main.js', '/js/app.js'],
      });

      expect(tail).toContain('src="/js/main.js"');
      expect(tail).toContain('src="/js/app.js"');
    });

    test('includes loader data script', () => {
      const { tail } = createShell({
        loaderData: { user: 'test', count: 42 },
      });

      expect(tail).toContain('window.__EREO_DATA__=');
      expect(tail).toContain('user');
    });

    test('includes loader data script for falsy values', () => {
      const falseTail = createShell({ loaderData: false }).tail;
      const zeroTail = createShell({ loaderData: 0 }).tail;
      const emptyTail = createShell({ loaderData: '' }).tail;

      expect(falseTail).toContain('window.__EREO_DATA__=false');
      expect(zeroTail).toContain('window.__EREO_DATA__=0');
      expect(emptyTail).toContain('window.__EREO_DATA__=""');
    });

    test('includes custom head content', () => {
      const { head } = createShell({
        shell: {
          head: '<link rel="preconnect" href="https://example.com">',
        },
      });

      expect(head).toContain('<link rel="preconnect" href="https://example.com">');
    });

    test('includes HTML attributes', () => {
      const { head } = createShell({
        shell: {
          htmlAttrs: { lang: 'en', dir: 'ltr' },
        },
      });

      expect(head).toContain('lang="en"');
      expect(head).toContain('dir="ltr"');
    });

    test('includes body attributes', () => {
      const { head } = createShell({
        shell: {
          bodyAttrs: { class: 'dark-mode', 'data-theme': 'dark' },
        },
      });

      expect(head).toContain('class="dark-mode"');
      expect(head).toContain('data-theme="dark"');
    });

    test('escapes dangerous characters in loader data', () => {
      const { tail } = createShell({
        loaderData: { html: '<script>alert("xss")</script>' },
      });

      // Should be escaped
      expect(tail).not.toContain('<script>alert');
      expect(tail).toContain('\\u003c');
    });
  });

  describe('createResponse', () => {
    test('creates response from string body', () => {
      const response = createResponse({
        body: '<html><body>Test</body></html>',
        headers: new Headers({ 'Content-Type': 'text/html' }),
        status: 200,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
    });

    test('creates response with custom status', () => {
      const response = createResponse({
        body: 'Not Found',
        headers: new Headers(),
        status: 404,
      });

      expect(response.status).toBe(404);
    });
  });

  describe('renderToString', () => {
    test('renders element to string with Content-Length header', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Test Content');

      const mockContext = {
        cache: { set: () => {}, get: () => undefined, getTags: () => [] },
        get: () => undefined,
        set: () => {},
        responseHeaders: new Headers(),
        url: new URL('http://localhost:3000/test'),
        env: {},
      };

      const result = await renderToString(element, {
        match: {
          route: { id: '/test', path: '/test', file: '/test.tsx' },
          params: {},
          pathname: '/test',
        },
        context: mockContext as any,
        shell: { title: 'String Render' },
      });

      expect(result.status).toBe(200);
      expect(result.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(result.headers.has('Content-Length')).toBe(true);
      expect(typeof result.body).toBe('string');
      expect(result.body).toContain('<!DOCTYPE html>');
      expect(result.body).toContain('<title>String Render</title>');
    });

    test('executes loader and includes data in response', async () => {
      const React = await import('react');
      const element = React.createElement('span', null, 'Content');

      const mockContext = {
        cache: { set: () => {}, get: () => undefined, getTags: () => [] },
        get: () => undefined,
        set: () => {},
        responseHeaders: new Headers(),
        url: new URL('http://localhost:3000/test'),
        env: {},
      };

      const result = await renderToString(element, {
        match: {
          route: {
            id: '/loader-test',
            path: '/loader-test',
            file: '/loader-test.tsx',
            module: {
              loader: async ({ params }: any) => ({ id: params.id, name: 'Test' }),
            },
          },
          params: { id: '456' },
          pathname: '/loader-test',
        },
        context: mockContext as any,
      });

      expect(result.body).toContain('window.__EREO_DATA__');
    });
  });

  describe('renderToStream', () => {
    const createMockContext = () => ({
      cache: { set: () => {}, get: () => undefined, getTags: () => [] },
      get: () => undefined,
      set: () => {},
      responseHeaders: new Headers(),
      url: new URL('http://localhost:3000/test'),
      env: {},
    });

    beforeEach(() => {
      // Reset mocks before each test
      capturedOnError = null;
      capturedBootstrapModules = undefined;
      mockPipeableContent = '<div>mock content</div>';
    });

    test('renderToStream returns correct structure with streaming body', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Test');

      const result = await renderToStream(element, {
        match: {
          route: { id: '/test', path: '/test', file: '/test.tsx' },
          params: {},
          pathname: '/test',
        },
        context: createMockContext() as any,
        shell: { title: 'Stream Test' },
      });

      expect(result.status).toBe(200);
      expect(result.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      // Streaming responses don't include Content-Length
      expect(result.headers.has('Content-Length')).toBe(false);
      expect(result.body).toBeInstanceOf(ReadableStream);
      const html = await readStreamToString(result.body);
      expect(html).toContain('<!DOCTYPE html>');
    });

    test('renderToStream executes loader when available (lines 133-137)', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Test');

      const loaderMock = mock(async ({ params, context }: any) => ({
        userId: params.id,
        data: 'loaded',
      }));

      const result = await renderToStream(element, {
        match: {
          route: {
            id: '/user/:id',
            path: '/user/:id',
            file: '/user.tsx',
            module: {
              loader: loaderMock,
            },
          },
          params: { id: '123' },
          pathname: '/user/123',
        },
        context: createMockContext() as any,
        shell: { title: 'User Page' },
      });

      // Verify loader was called
      expect(loaderMock).toHaveBeenCalled();
      expect(loaderMock).toHaveBeenCalledWith(expect.objectContaining({
        params: { id: '123' },
      }));

      // Verify result structure
      expect(result.status).toBe(200);
      expect(result.body).toBeInstanceOf(ReadableStream);
    });

    test('renderToStream onError callback is called on render errors', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Test');
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

      // Call renderToStream to set up the onError callback
      const result = await renderToStream(element, {
        match: {
          route: { id: '/test', path: '/test', file: '/test.tsx' },
          params: {},
          pathname: '/test',
        },
        context: createMockContext() as any,
      });

      // Consume the stream so it fully processes
      await readStreamToString(result.body);

      // The onError callback should have been captured
      expect(capturedOnError).toBeDefined();

      // Simulate an error being passed to onError
      const testError = new Error('Test render error');
      capturedOnError!(testError);

      // Verify console.error was called
      expect(consoleSpy).toHaveBeenCalledWith('Render error:', testError);

      consoleSpy.mockRestore();
    });

    test('renderToStream wraps content with head and tail', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Streamed Content');

      const result = await renderToStream(element, {
        match: {
          route: { id: '/test', path: '/test', file: '/test.tsx' },
          params: {},
          pathname: '/test',
        },
        context: createMockContext() as any,
        shell: { title: 'Transform Test' },
        scripts: ['/app.js'],
        styles: ['/style.css'],
      });

      const fullContent = await readStreamToString(result.body);

      // Verify head was prepended
      expect(fullContent).toContain('<!DOCTYPE html>');
      expect(fullContent).toContain('<title>Transform Test</title>');
      expect(fullContent).toContain('<div id="root">');

      // Verify content was included
      expect(fullContent).toContain('mock content');

      // Verify tail was appended
      expect(fullContent).toContain('</div>');
      expect(fullContent).toContain('</body>');
      expect(fullContent).toContain('</html>');
      // Scripts are NOT in the shell tail — React handles them via bootstrapModules
      expect(fullContent).not.toContain('src="/app.js"');
      expect(fullContent).toContain('href="/style.css"');
      // Verify bootstrapModules was passed to renderToPipeableStream
      expect(capturedBootstrapModules).toEqual(['/app.js']);
    });

    test('renderToStream includes loader data in shell', async () => {
      const React = await import('react');
      const element = React.createElement('span', null, 'With Loader');

      const result = await renderToStream(element, {
        match: {
          route: {
            id: '/data',
            path: '/data',
            file: '/data.tsx',
            module: {
              loader: async () => ({ message: 'Hello from loader' }),
            },
          },
          params: {},
          pathname: '/data',
        },
        context: createMockContext() as any,
      });

      const fullContent = await readStreamToString(result.body);

      // Verify loader data is included
      expect(fullContent).toContain('window.__EREO_DATA__');
    });

    test('renderToStream handles route without loader', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'No Loader');

      const result = await renderToStream(element, {
        match: {
          route: {
            id: '/no-loader',
            path: '/no-loader',
            file: '/no-loader.tsx',
            // No module.loader defined
          },
          params: {},
          pathname: '/no-loader',
        },
        context: createMockContext() as any,
      });

      expect(result.status).toBe(200);
      const fullContent = await readStreamToString(result.body);

      // Should not contain loader data script when no loader
      expect(fullContent).not.toContain('window.__EREO_DATA__');
    });

    test('renderToStream handles route with module but no loader', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Module No Loader');

      const result = await renderToStream(element, {
        match: {
          route: {
            id: '/module-no-loader',
            path: '/module-no-loader',
            file: '/module-no-loader.tsx',
            module: {
              // Module exists but no loader property
              default: () => null,
            },
          },
          params: {},
          pathname: '/module-no-loader',
        },
        context: createMockContext() as any,
      });

      expect(result.status).toBe(200);
    });

    test('renderToStream with custom pipeableContent', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Multi-chunk');

      // Set custom content for the pipeable mock
      mockPipeableContent = '<div>chunk1</div><div>chunk2</div>';

      const result = await renderToStream(element, {
        match: {
          route: { id: '/multi', path: '/multi', file: '/multi.tsx' },
          params: {},
          pathname: '/multi',
        },
        context: createMockContext() as any,
      });

      const fullContent = await readStreamToString(result.body);

      // Verify content was included
      expect(fullContent).toContain('chunk1');
      expect(fullContent).toContain('chunk2');
      expect(fullContent).toContain('<!DOCTYPE html>');
      expect(fullContent).toContain('</html>');
    });
  });

  // ============================================================================
  // Additional Tests: Shell creation with special characters (XSS prevention)
  // ============================================================================
  describe('createShell - XSS prevention and special characters', () => {
    test('escapes double quotes in meta name attributes', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { name: 'author" onload="alert(1)', content: 'Safe' },
          ],
        },
      });

      // Double quotes should be escaped to &quot;
      expect(head).not.toContain('onload="alert(1)');
      expect(head).toContain('&quot;');
    });

    test('escapes HTML entities in meta content', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { name: 'description', content: 'Text with <script>alert("xss")</script> injection' },
          ],
        },
      });

      // < should be escaped to &lt;
      expect(head).not.toContain('<script>alert');
      expect(head).toContain('&lt;');
    });

    test('escapes ampersands in meta content', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { name: 'description', content: 'Tom & Jerry & Friends' },
          ],
        },
      });

      expect(head).toContain('&amp;');
      // The raw & should be escaped
      expect(head).toContain('Tom &amp; Jerry &amp; Friends');
    });

    test('escapes special chars in OG property meta tags', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { property: 'og:description" onclick="alert(1)', content: 'Safe content' },
          ],
        },
      });

      expect(head).not.toContain('onclick="alert(1)');
      expect(head).toContain('&quot;');
    });

    test('escapes special characters in link descriptor attributes', () => {
      const { head } = createShell({
        shell: {
          links: [
            { rel: 'stylesheet', href: '/styles/main.css" onload="alert(1)' } as any,
          ],
        },
      });

      expect(head).not.toContain('onload="alert(1)');
      expect(head).toContain('&quot;');
    });

    test('handles empty meta content safely', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { name: 'robots', content: '' },
          ],
        },
      });

      expect(head).toContain('name="robots" content=""');
    });

    test('handles meta with only property (no name)', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { property: 'og:image', content: 'https://example.com/image.jpg' },
          ],
        },
      });

      expect(head).toContain('property="og:image"');
      expect(head).toContain('content="https://example.com/image.jpg"');
    });

    test('handles meta with neither name nor property', () => {
      const { head } = createShell({
        shell: {
          meta: [
            { content: 'orphaned content' } as any,
          ],
        },
      });

      // Should render with property="" since name is not provided
      expect(head).toContain('property=""');
      expect(head).toContain('content="orphaned content"');
    });
  });

  // ============================================================================
  // Additional Tests: Shell with link descriptors
  // ============================================================================
  describe('createShell - Link descriptors', () => {
    test('renders multiple link descriptors with all attributes', () => {
      const { head } = createShell({
        shell: {
          links: [
            { rel: 'stylesheet', href: '/styles/main.css' },
            { rel: 'preload', href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' } as any,
            { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' } as any,
          ],
        },
      });

      expect(head).toContain('rel="stylesheet"');
      expect(head).toContain('href="/styles/main.css"');
      expect(head).toContain('rel="preload"');
      expect(head).toContain('as="font"');
      expect(head).toContain('crossorigin="anonymous"');
      expect(head).toContain('rel="icon"');
      expect(head).toContain('href="/favicon.ico"');
    });

    test('filters out undefined link attributes', () => {
      const { head } = createShell({
        shell: {
          links: [
            { rel: 'stylesheet', href: '/main.css', as: undefined } as any,
          ],
        },
      });

      expect(head).toContain('rel="stylesheet"');
      expect(head).toContain('href="/main.css"');
      // as should not appear since it's undefined
      expect(head).not.toContain('as=');
    });
  });

  // ============================================================================
  // Additional Tests: createShell with combined options
  // ============================================================================
  describe('createShell - combined options', () => {
    test('shell with all options combined', () => {
      const { head, tail } = createShell({
        shell: {
          title: 'Full Test Page',
          htmlAttrs: { lang: 'ja', dir: 'ltr' },
          bodyAttrs: { class: 'dark theme-blue', 'data-page': 'home' },
          meta: [
            { name: 'description', content: 'A fully featured page' },
            { property: 'og:title', content: 'OG Full Test' },
          ],
          links: [
            { rel: 'stylesheet', href: '/styles.css' },
          ],
          head: '<script>console.log("custom head")</script>',
        },
        scripts: ['/app.js', '/vendor.js'],
        styles: ['/theme.css'],
        loaderData: { message: 'hello' },
      });

      // head checks
      expect(head).toContain('lang="ja"');
      expect(head).toContain('dir="ltr"');
      expect(head).toContain('class="dark theme-blue"');
      expect(head).toContain('data-page="home"');
      expect(head).toContain('<title>Full Test Page</title>');
      expect(head).toContain('name="description"');
      expect(head).toContain('property="og:title"');
      expect(head).toContain('href="/styles.css"');
      expect(head).toContain('href="/theme.css"');
      expect(head).toContain('console.log("custom head")');

      // tail checks
      expect(tail).toContain('src="/app.js"');
      expect(tail).toContain('src="/vendor.js"');
      expect(tail).toContain('window.__EREO_DATA__');
    });

    test('shell with no options produces valid HTML structure', () => {
      const { head, tail } = createShell({});

      expect(head).toContain('<!DOCTYPE html>');
      expect(head).toContain('<html');
      expect(head).toContain('<head>');
      expect(head).toContain('<meta charset="utf-8">');
      expect(head).toContain('<meta name="viewport"');
      expect(head).toContain('<body');
      expect(head).toContain('<div id="root">');

      expect(tail).toContain('</div>');
      expect(tail).toContain('</body>');
      expect(tail).toContain('</html>');
    });

    test('shell without loaderData omits data script', () => {
      const { tail } = createShell({
        scripts: ['/app.js'],
      });

      expect(tail).not.toContain('window.__EREO_DATA__');
      expect(tail).toContain('src="/app.js"');
    });
  });

  // ============================================================================
  // Additional Tests: createResponse with stream body
  // ============================================================================
  describe('createResponse - additional cases', () => {
    test('creates response from ReadableStream body', () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('<html>'));
          controller.enqueue(encoder.encode('<body>Test</body>'));
          controller.enqueue(encoder.encode('</html>'));
          controller.close();
        },
      });

      const response = createResponse({
        body: stream,
        headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
        status: 200,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      // Body should be a ReadableStream
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    test('creates response with 500 status', () => {
      const response = createResponse({
        body: 'Internal Server Error',
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        status: 500,
      });

      expect(response.status).toBe(500);
    });
  });
});
