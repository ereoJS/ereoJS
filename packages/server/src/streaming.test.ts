import { describe, expect, test } from 'bun:test';
import {
  createShell,
  createResponse,
  createSuspenseStream,
  renderToString,
} from './streaming';

describe('@areo/server - Streaming', () => {
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

      expect(tail).toContain('window.__AREO_DATA__=');
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

      expect(result.body).toContain('window.__AREO_DATA__');
    });
  });
});
