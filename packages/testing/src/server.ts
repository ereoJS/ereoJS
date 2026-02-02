/**
 * @areo/testing - Test Server
 *
 * Create a test server for integration testing.
 */

import type { FrameworkConfig } from '@areo/core';

/**
 * Test server options.
 */
export interface TestServerOptions {
  /** Framework configuration */
  config?: FrameworkConfig;
  /** Port to run on (default: random available port) */
  port?: number;
  /** Routes directory */
  routesDir?: string;
}

/**
 * Test server interface.
 */
export interface TestServer {
  /** Server base URL */
  url: string;
  /** Port the server is running on */
  port: number;
  /** Make a request to the server */
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Make a GET request */
  get: (path: string, init?: Omit<RequestInit, 'method'>) => Promise<Response>;
  /** Make a POST request */
  post: (path: string, body?: unknown, init?: Omit<RequestInit, 'method' | 'body'>) => Promise<Response>;
  /** Make a PUT request */
  put: (path: string, body?: unknown, init?: Omit<RequestInit, 'method' | 'body'>) => Promise<Response>;
  /** Make a DELETE request */
  delete: (path: string, init?: Omit<RequestInit, 'method'>) => Promise<Response>;
  /** Make a PATCH request */
  patch: (path: string, body?: unknown, init?: Omit<RequestInit, 'method' | 'body'>) => Promise<Response>;
  /** Submit a form */
  submitForm: (path: string, formData: Record<string, string>, init?: Omit<RequestInit, 'method' | 'body'>) => Promise<Response>;
  /** Stop the server */
  stop: () => Promise<void>;
}

/**
 * Create a test server for integration testing.
 *
 * @example
 * import { createTestServer } from '@areo/testing';
 *
 * describe('API routes', () => {
 *   let server: TestServer;
 *
 *   beforeAll(async () => {
 *     server = await createTestServer({
 *       routesDir: './app/routes',
 *     });
 *   });
 *
 *   afterAll(async () => {
 *     await server.stop();
 *   });
 *
 *   test('GET /api/posts', async () => {
 *     const response = await server.get('/api/posts');
 *     expect(response.status).toBe(200);
 *
 *     const posts = await response.json();
 *     expect(posts).toHaveLength(3);
 *   });
 *
 *   test('POST /api/posts', async () => {
 *     const response = await server.post('/api/posts', {
 *       title: 'New Post',
 *       content: 'Content here',
 *     });
 *     expect(response.status).toBe(201);
 *   });
 * });
 */
export async function createTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const port = options.port || (await getAvailablePort());
  const url = `http://localhost:${port}`;

  // Import dynamically to avoid bundling issues
  const { createApp } = await import('@areo/core');
  const { initFileRouter } = await import('@areo/router');
  const { createServer } = await import('@areo/server');

  // Create app
  const app = createApp({
    config: {
      ...options.config,
      server: {
        port,
        hostname: 'localhost',
        development: true,
        ...options.config?.server,
      },
    },
  });

  // Initialize router
  const router = await initFileRouter({
    routesDir: options.routesDir || options.config?.routesDir || 'app/routes',
    watch: false,
  });

  await router.loadAllModules();

  // Create server
  const server = createServer({
    port,
    hostname: 'localhost',
    development: true,
    logging: false,
  });

  server.setApp(app);
  server.setRouter(router);

  // Start server
  await server.start();

  // Helper functions
  const makeFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const fullUrl = path.startsWith('http') ? path : `${url}${path}`;
    return fetch(fullUrl, init);
  };

  const makeBodyRequest = async (
    method: string,
    path: string,
    body?: unknown,
    init?: Omit<RequestInit, 'method' | 'body'>
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);

    let requestBody: BodyInit | undefined;

    if (body !== undefined) {
      if (body instanceof FormData) {
        requestBody = body;
      } else {
        requestBody = JSON.stringify(body);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
    }

    return makeFetch(path, {
      ...init,
      method,
      headers,
      body: requestBody,
    });
  };

  const testServer: TestServer = {
    url,
    port,
    fetch: makeFetch,

    get: (path, init) => makeFetch(path, { ...init, method: 'GET' }),

    post: (path, body, init) => makeBodyRequest('POST', path, body, init),

    put: (path, body, init) => makeBodyRequest('PUT', path, body, init),

    delete: (path, init) => makeFetch(path, { ...init, method: 'DELETE' }),

    patch: (path, body, init) => makeBodyRequest('PATCH', path, body, init),

    submitForm: async (path, formData, init) => {
      const fd = new FormData();
      for (const [key, value] of Object.entries(formData)) {
        fd.append(key, value);
      }

      return makeFetch(path, {
        ...init,
        method: 'POST',
        body: fd,
      });
    },

    stop: async () => {
      server.stop();
    },
  };

  return testServer;
}

/**
 * Get an available port.
 */
async function getAvailablePort(): Promise<number> {
  // Try to find an available port by attempting to listen
  const server = Bun.serve({
    port: 0, // Let the OS assign a port
    fetch() {
      return new Response('');
    },
  });

  const port = server.port ?? 0;
  server.stop();

  return port;
}

/**
 * Create a simple mock server for external API testing.
 *
 * @example
 * const mockApi = await createMockServer({
 *   routes: {
 *     'GET /users/1': { id: 1, name: 'Test User' },
 *     'POST /users': (req) => ({ id: 2, ...req.body }),
 *     'GET /users': [{ id: 1 }, { id: 2 }],
 *   },
 * });
 *
 * // In your test, use mockApi.url as the API base URL
 * process.env.API_URL = mockApi.url;
 *
 * // After test
 * await mockApi.stop();
 */
export async function createMockServer(options: {
  routes: Record<string, unknown | ((request: { body?: unknown; params?: Record<string, string> }) => unknown)>;
  port?: number;
}): Promise<{ url: string; port: number; stop: () => Promise<void> }> {
  const port = options.port || (await getAvailablePort());

  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      const method = request.method;
      const path = url.pathname;

      // Find matching route
      const routeKey = `${method} ${path}`;
      const handler = options.routes[routeKey];

      if (!handler) {
        return new Response('Not Found', { status: 404 });
      }

      // Get response
      let responseData: unknown;

      if (typeof handler === 'function') {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          body = undefined;
        }

        responseData = handler({ body, params: {} });
      } else {
        responseData = handler;
      }

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  return {
    url: `http://localhost:${port}`,
    port,
    stop: async () => {
      server.stop();
    },
  };
}
