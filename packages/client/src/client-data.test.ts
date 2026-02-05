import { describe, expect, test } from 'bun:test';
import {
  executeClientLoader,
  executeClientAction,
  shouldHydrateClientLoader,
} from './client-data';
import type {
  ClientLoaderFunction,
  ClientActionFunction,
} from '@ereo/core';

// =================================================================
// executeClientLoader tests
// =================================================================

describe('@ereo/client - executeClientLoader', () => {
  test('executes clientLoader with params', async () => {
    const clientLoader: ClientLoaderFunction = async ({ params }) => {
      return { userId: params.id };
    };

    const result = await executeClientLoader(
      clientLoader,
      '/users/42',
      { id: '42' },
    );

    expect(result).toEqual({ userId: '42' });
  });

  test('clientLoader receives a Request object', async () => {
    let receivedRequest: Request | null = null;

    const clientLoader: ClientLoaderFunction = async ({ request }) => {
      receivedRequest = request;
      return {};
    };

    await executeClientLoader(clientLoader, '/test', {});

    expect(receivedRequest).not.toBeNull();
    expect(receivedRequest!).toBeInstanceOf(Request);
  });

  test('clientLoader receives serverLoader callback', async () => {
    let hasServerLoader = false;

    const clientLoader: ClientLoaderFunction = async ({ serverLoader }) => {
      hasServerLoader = typeof serverLoader === 'function';
      // Don't actually call serverLoader (would need a server)
      return { cached: true };
    };

    const result = await executeClientLoader(clientLoader, '/data', {});

    expect(hasServerLoader).toBe(true);
    expect(result).toEqual({ cached: true });
  });

  test('clientLoader can return synchronously', async () => {
    const clientLoader: ClientLoaderFunction = ({ params }) => {
      return { instant: true, id: params.id };
    };

    const result = await executeClientLoader(
      clientLoader,
      '/sync/1',
      { id: '1' },
    );

    expect(result).toEqual({ instant: true, id: '1' });
  });

  test('clientLoader can use custom request', async () => {
    let receivedUrl = '';

    const clientLoader: ClientLoaderFunction = async ({ request }) => {
      receivedUrl = request.url;
      return {};
    };

    const customRequest = new Request('https://example.com/custom');
    await executeClientLoader(clientLoader, '/custom', {}, customRequest);

    expect(receivedUrl).toBe('https://example.com/custom');
  });

  test('clientLoader can throw errors', async () => {
    const clientLoader: ClientLoaderFunction = async () => {
      throw new Error('Cache miss');
    };

    expect(
      executeClientLoader(clientLoader, '/fail', {})
    ).rejects.toThrow('Cache miss');
  });
});

// =================================================================
// executeClientAction tests
// =================================================================

describe('@ereo/client - executeClientAction', () => {
  test('executes clientAction with params', async () => {
    const clientAction: ClientActionFunction = async ({ params }) => {
      return { updated: true, id: params.id };
    };

    const request = new Request('http://localhost/users/1', {
      method: 'POST',
    });

    const result = await executeClientAction(
      clientAction,
      '/users/1',
      { id: '1' },
      request,
    );

    expect(result).toEqual({ updated: true, id: '1' });
  });

  test('clientAction receives the request', async () => {
    let receivedMethod = '';

    const clientAction: ClientActionFunction = async ({ request }) => {
      receivedMethod = request.method;
      return {};
    };

    const request = new Request('http://localhost/submit', {
      method: 'PUT',
    });

    await executeClientAction(clientAction, '/submit', {}, request);

    expect(receivedMethod).toBe('PUT');
  });

  test('clientAction receives serverAction callback', async () => {
    let hasServerAction = false;

    const clientAction: ClientActionFunction = async ({ serverAction }) => {
      hasServerAction = typeof serverAction === 'function';
      return { optimistic: true };
    };

    const request = new Request('http://localhost/action', {
      method: 'POST',
    });

    const result = await executeClientAction(clientAction, '/action', {}, request);

    expect(hasServerAction).toBe(true);
    expect(result).toEqual({ optimistic: true });
  });

  test('clientAction can throw errors', async () => {
    const clientAction: ClientActionFunction = async () => {
      throw new Error('Validation failed');
    };

    const request = new Request('http://localhost/fail', {
      method: 'POST',
    });

    expect(
      executeClientAction(clientAction, '/fail', {}, request)
    ).rejects.toThrow('Validation failed');
  });
});

// =================================================================
// shouldHydrateClientLoader tests
// =================================================================

describe('@ereo/client - shouldHydrateClientLoader', () => {
  test('returns false when no clientLoader', () => {
    expect(shouldHydrateClientLoader(undefined)).toBe(false);
  });

  test('returns false when hydrate not set', () => {
    const clientLoader: ClientLoaderFunction = async () => ({});
    expect(shouldHydrateClientLoader(clientLoader)).toBe(false);
  });

  test('returns false when hydrate is false', () => {
    const clientLoader: ClientLoaderFunction = async () => ({});
    clientLoader.hydrate = false;
    expect(shouldHydrateClientLoader(clientLoader)).toBe(false);
  });

  test('returns true when hydrate is true', () => {
    const clientLoader: ClientLoaderFunction = async () => ({});
    clientLoader.hydrate = true;
    expect(shouldHydrateClientLoader(clientLoader)).toBe(true);
  });
});

// =================================================================
// defineRoute integration tests
// =================================================================

describe('@ereo/data - defineRoute with clientLoader/clientAction/links', () => {
  test('builder supports clientLoader method', async () => {
    const { defineRoute } = await import('@ereo/data');

    const route = defineRoute('/users/[id]')
      .loader(async ({ params }) => ({ user: { id: params.id } }))
      .clientLoader(async ({ params, serverLoader }) => {
        const cached = null; // simulate cache miss
        if (cached) return cached;
        return serverLoader();
      })
      .build();

    expect(route.clientLoader).toBeDefined();
    expect(typeof route.clientLoader).toBe('function');
  });

  test('builder supports clientAction method', async () => {
    const { defineRoute } = await import('@ereo/data');

    const route = defineRoute('/users/[id]')
      .loader(async () => ({ users: [] }))
      .action(async () => ({ success: true }))
      .clientAction(async ({ serverAction }) => {
        // optimistic update
        return serverAction();
      })
      .build();

    expect(route.clientAction).toBeDefined();
    expect(typeof route.clientAction).toBe('function');
  });

  test('builder supports links method', async () => {
    const { defineRoute } = await import('@ereo/data');

    const route = defineRoute('/dashboard')
      .loader(async () => ({ stats: {} }))
      .links(() => [
        { rel: 'stylesheet', href: '/styles/dashboard.css' },
        { rel: 'preload', href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2' },
      ])
      .build();

    expect(route.links).toBeDefined();
    const links = route.links!();
    expect(links).toHaveLength(2);
    expect(links[0].rel).toBe('stylesheet');
    expect(links[0].href).toBe('/styles/dashboard.css');
    expect(links[1].as).toBe('font');
  });

  test('all three can be chained together', async () => {
    const { defineRoute } = await import('@ereo/data');

    const route = defineRoute('/products/[id]')
      .loader(async ({ params }) => ({ product: { id: params.id } }))
      .action(async () => ({ success: true }))
      .clientLoader(async ({ serverLoader }) => serverLoader())
      .clientAction(async ({ serverAction }) => serverAction())
      .links(() => [{ rel: 'stylesheet', href: '/product.css' }])
      .shouldRevalidate(() => true)
      .build();

    expect(route.loader).toBeDefined();
    expect(route.action).toBeDefined();
    expect(route.clientLoader).toBeDefined();
    expect(route.clientAction).toBeDefined();
    expect(route.links).toBeDefined();
    expect(route.shouldRevalidate).toBeDefined();
  });

  test('route without loader can have clientLoader', async () => {
    const { defineRoute } = await import('@ereo/data');

    const route = defineRoute('/offline')
      .clientLoader(async () => {
        return { offline: true, items: [] };
      })
      .build();

    expect(route.clientLoader).toBeDefined();
    expect(route.loader).toBeUndefined();
  });
});
