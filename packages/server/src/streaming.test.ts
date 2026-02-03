import { describe, expect, test, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  createShell,
  createResponse,
  createSuspenseStream,
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

// Mock callbacks for testing
let capturedOnError: ((error: unknown) => void) | null = null;
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
    // Capture callbacks
    if (options?.onError) {
      capturedOnError = options.onError;
    }

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

  describe('createSuspenseStream', () => {
    test('creates suspense stream helper', () => {
      const { stream, push, close } = createSuspenseStream();

      expect(stream).toBeInstanceOf(ReadableStream);
      expect(typeof push).toBe('function');
      expect(typeof close).toBe('function');
    });

    test('can push and read chunks', async () => {
      const { stream, push, close } = createSuspenseStream();

      // Push some data
      push('Hello');
      push(' World');
      close();

      // Read the stream
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
      }

      expect(result).toBe('Hello World');
    });

    test('encodes chunks as UTF-8', async () => {
      const { stream, push, close } = createSuspenseStream();

      push('Hello 世界');
      close();

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();

      expect(decoder.decode(value)).toBe('Hello 世界');
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
      mockPipeableContent = '<div>mock content</div>';
    });

    test('renderToStream returns correct structure with HTML body', async () => {
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
      expect(result.headers.get('Content-Length')).toBeDefined();
      expect(typeof result.body).toBe('string');
      expect(result.body).toContain('<!DOCTYPE html>');
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
      expect(typeof result.body).toBe('string');
    });

    test('renderToStream onError callback is called on render errors (line 144)', async () => {
      const React = await import('react');
      const element = React.createElement('div', null, 'Test');
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

      // Call renderToStream to set up the onError callback
      await renderToStream(element, {
        match: {
          route: { id: '/test', path: '/test', file: '/test.tsx' },
          params: {},
          pathname: '/test',
        },
        context: createMockContext() as any,
      });

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

      const fullContent = result.body as string;

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
      expect(fullContent).toContain('src="/app.js"');
      expect(fullContent).toContain('href="/style.css"');
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

      const fullContent = result.body as string;

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
      const fullContent = result.body as string;

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

      const fullContent = result.body as string;

      // Verify content was included
      expect(fullContent).toContain('chunk1');
      expect(fullContent).toContain('chunk2');
      expect(fullContent).toContain('<!DOCTYPE html>');
      expect(fullContent).toContain('</html>');
    });
  });
});
