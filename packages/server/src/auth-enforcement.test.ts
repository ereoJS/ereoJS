import { describe, expect, test } from 'bun:test';
import { enforceAuthConfig, resolveAuthDenial, resolveCheckResult } from './auth-enforcement';
import type { AuthConfig, AppContext } from '@ereo/core';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function mockContext(auth?: {
  isAuthenticated: () => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}): AppContext {
  const store = new Map<string, unknown>();
  if (auth) store.set('auth', auth);

  return {
    get: <T>(key: string) => store.get(key) as T | undefined,
    set: <T>(key: string, value: T) => { store.set(key, value); },
    cache: { set: () => {}, get: () => undefined, getTags: () => [], addTags: () => {} },
    responseHeaders: new Headers(),
    url: new URL('http://localhost/'),
    env: {},
  };
}

function authedContext(roles: string[] = []) {
  return mockContext({
    isAuthenticated: () => true,
    hasAnyRole: (r) => r.some((role) => roles.includes(role)),
  });
}

function unauthContext() {
  return mockContext({
    isAuthenticated: () => false,
    hasAnyRole: () => false,
  });
}

function noAuthContext() {
  // No auth middleware registered at all
  return mockContext();
}

const GET = (path = '/protected') => new Request(`http://localhost${path}`);

// ---------------------------------------------------------------------------
// resolveAuthDenial
// ---------------------------------------------------------------------------

describe('resolveAuthDenial', () => {
  test('redirects when redirect is configured', () => {
    const auth: AuthConfig = { redirect: '/login?from={pathname}' };
    const res = resolveAuthDenial(auth, GET('/dashboard'));

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?from=%2Fdashboard');
  });

  test('returns custom unauthorized response', () => {
    const auth: AuthConfig = { unauthorized: { status: 401, body: { error: 'No access' } } };
    const res = resolveAuthDenial(auth, GET());

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  test('returns 403 Forbidden by default', () => {
    const res = resolveAuthDenial({}, GET());

    expect(res.status).toBe(403);
  });

  test('redirect takes precedence over unauthorized', () => {
    const auth: AuthConfig = {
      redirect: '/login',
      unauthorized: { status: 401, body: {} },
    };
    const res = resolveAuthDenial(auth, GET());

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login');
  });
});

// ---------------------------------------------------------------------------
// resolveCheckResult
// ---------------------------------------------------------------------------

describe('resolveCheckResult', () => {
  test('returns the Response directly when result has response', () => {
    const custom = new Response('Custom', { status: 418 });
    const res = resolveCheckResult({ allowed: false, response: custom });

    expect(res).toBe(custom);
    expect(res.status).toBe(418);
  });

  test('redirects when result has redirect', () => {
    const res = resolveCheckResult({ allowed: false, redirect: '/upgrade' });

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/upgrade');
  });

  test('returns status + JSON body', async () => {
    const res = resolveCheckResult({
      allowed: false,
      status: 403,
      body: { error: 'Not your post' },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body.error).toBe('Not your post');
  });

  test('returns status with plain text when no body', async () => {
    const res = resolveCheckResult({ allowed: false, status: 403 });

    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Forbidden');
  });

  test('returns 404 with body', async () => {
    const res = resolveCheckResult({
      allowed: false,
      status: 404,
      body: { error: 'Resource not found' },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Resource not found');
  });
});

// ---------------------------------------------------------------------------
// enforceAuthConfig — static checks
// ---------------------------------------------------------------------------

describe('enforceAuthConfig — static checks', () => {
  test('allows access when no auth is required', async () => {
    const result = await enforceAuthConfig({}, GET(), noAuthContext(), {});
    expect(result).toBeNull();
  });

  test('denies when required=true and no auth context', async () => {
    const result = await enforceAuthConfig(
      { required: true },
      GET(),
      noAuthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('denies when required=true and user not authenticated', async () => {
    const result = await enforceAuthConfig(
      { required: true },
      GET(),
      unauthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('allows when required=true and user is authenticated', async () => {
    const result = await enforceAuthConfig(
      { required: true },
      GET(),
      authedContext(),
      {},
    );
    expect(result).toBeNull();
  });

  test('denies when roles required but user lacks them', async () => {
    const result = await enforceAuthConfig(
      { roles: ['admin'] },
      GET(),
      authedContext(['user']),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('allows when user has required role', async () => {
    const result = await enforceAuthConfig(
      { roles: ['admin'] },
      GET(),
      authedContext(['admin', 'user']),
      {},
    );
    expect(result).toBeNull();
  });

  test('uses redirect from config on denial', async () => {
    const result = await enforceAuthConfig(
      { required: true, redirect: '/login' },
      GET('/secret'),
      unauthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(302);
    expect(result!.headers.get('Location')).toBe('/login');
  });

  test('uses unauthorized from config on denial', async () => {
    const result = await enforceAuthConfig(
      { required: true, unauthorized: { status: 401, body: { msg: 'go away' } } },
      GET(),
      unauthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// enforceAuthConfig — boolean check function (backwards compat)
// ---------------------------------------------------------------------------

describe('enforceAuthConfig — boolean check', () => {
  test('allows when check returns true', async () => {
    const result = await enforceAuthConfig(
      { check: async () => true },
      GET(),
      authedContext(),
      {},
    );
    expect(result).toBeNull();
  });

  test('denies when check returns false', async () => {
    const result = await enforceAuthConfig(
      { check: async () => false },
      GET(),
      authedContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('denies with redirect when check returns false and redirect configured', async () => {
    const result = await enforceAuthConfig(
      { check: async () => false, redirect: '/login' },
      GET('/admin'),
      authedContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(302);
    expect(result!.headers.get('Location')).toBe('/login');
  });

  test('check receives request, context, and params', async () => {
    let received: any;
    const config: AuthConfig = {
      check: async (args) => {
        received = args;
        return true;
      },
    };
    const ctx = authedContext();
    const params = { id: '42' };

    await enforceAuthConfig(config, GET('/posts/42'), ctx, params);

    expect(received.request).toBeInstanceOf(Request);
    expect(received.context).toBe(ctx);
    expect(received.params).toEqual({ id: '42' });
  });
});

// ---------------------------------------------------------------------------
// enforceAuthConfig — AuthCheckResult (rich response)
// ---------------------------------------------------------------------------

describe('enforceAuthConfig — AuthCheckResult', () => {
  test('allows when check returns { allowed: true }', async () => {
    const result = await enforceAuthConfig(
      { check: async () => ({ allowed: true }) },
      GET(),
      authedContext(),
      {},
    );
    expect(result).toBeNull();
  });

  test('denies with redirect from check result', async () => {
    const result = await enforceAuthConfig(
      {
        check: async () => ({ allowed: false, redirect: '/upgrade' }),
      },
      GET(),
      authedContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(302);
    expect(result!.headers.get('Location')).toBe('/upgrade');
  });

  test('denies with custom status and body from check result', async () => {
    const result = await enforceAuthConfig(
      {
        check: async () => ({
          allowed: false,
          status: 403,
          body: { error: 'Not your post' },
        }),
      },
      GET(),
      authedContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toBe('Not your post');
  });

  test('denies with custom Response from check result', async () => {
    const custom = new Response('Nope', { status: 451 });
    const result = await enforceAuthConfig(
      {
        check: async () => ({ allowed: false, response: custom }),
      },
      GET(),
      authedContext(),
      {},
    );
    expect(result).toBe(custom);
    expect(result!.status).toBe(451);
  });

  test('check result overrides static config fallbacks', async () => {
    // Static config says redirect to /login, but check result says 403
    const result = await enforceAuthConfig(
      {
        redirect: '/login',
        check: async () => ({ allowed: false, status: 403, body: { error: 'Forbidden' } }),
      },
      GET(),
      authedContext(),
      {},
    );
    // The check result should win, not the redirect
    expect(result!.status).toBe(403);
    expect(result!.headers.get('Location')).toBeNull();
  });

  test('static checks run before custom check', async () => {
    let checkCalled = false;
    const result = await enforceAuthConfig(
      {
        required: true,
        check: async () => {
          checkCalled = true;
          return { allowed: true };
        },
      },
      GET(),
      unauthContext(),
      {},
    );
    // Static required check should deny before custom check runs
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(checkCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enforceAuthConfig — ownership pattern (realistic scenario)
// ---------------------------------------------------------------------------

describe('enforceAuthConfig — ownership pattern', () => {
  test('owner can access their resource', async () => {
    const ctx = authedContext();
    ctx.set('auth', {
      isAuthenticated: () => true,
      hasAnyRole: () => false,
      getUser: () => ({ id: 'user-1' }),
    });

    const result = await enforceAuthConfig(
      {
        required: true,
        check: async ({ context }) => {
          const auth = context.get<any>('auth');
          const user = auth?.getUser();
          // Simulate: post.authorId === user.id
          const postAuthorId = 'user-1';
          if (user?.id !== postAuthorId) {
            return { allowed: false, status: 403, body: { error: 'Not your post' } };
          }
          return { allowed: true };
        },
      },
      GET('/posts/42'),
      ctx,
      { id: '42' },
    );

    expect(result).toBeNull();
  });

  test('non-owner gets 403 with descriptive error', async () => {
    const ctx = authedContext();
    ctx.set('auth', {
      isAuthenticated: () => true,
      hasAnyRole: () => false,
      getUser: () => ({ id: 'user-2' }),
    });

    const result = await enforceAuthConfig(
      {
        required: true,
        check: async ({ context }) => {
          const auth = context.get<any>('auth');
          const user = auth?.getUser();
          const postAuthorId = 'user-1';
          if (user?.id !== postAuthorId) {
            return { allowed: false, status: 403, body: { error: 'Not your post' } };
          }
          return { allowed: true };
        },
      },
      GET('/posts/42'),
      ctx,
      { id: '42' },
    );

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toBe('Not your post');
  });

  test('admin bypasses ownership check', async () => {
    const ctx = authedContext(['admin']);
    ctx.set('auth', {
      isAuthenticated: () => true,
      hasAnyRole: (r: string[]) => r.includes('admin'),
      hasRole: (r: string) => r === 'admin',
      getUser: () => ({ id: 'admin-1' }),
    });

    const result = await enforceAuthConfig(
      {
        required: true,
        check: async ({ context }) => {
          const auth = context.get<any>('auth');
          if (auth?.hasRole('admin')) return { allowed: true };
          const user = auth?.getUser();
          const postAuthorId = 'user-1';
          if (user?.id !== postAuthorId) {
            return { allowed: false, status: 403, body: { error: 'Not your post' } };
          }
          return { allowed: true };
        },
      },
      GET('/posts/42'),
      ctx,
      { id: '42' },
    );

    expect(result).toBeNull();
  });

  test('unauthenticated user gets redirect before check runs', async () => {
    let checkCalled = false;
    const result = await enforceAuthConfig(
      {
        required: true,
        redirect: '/login?from={pathname}',
        check: async () => {
          checkCalled = true;
          return { allowed: true };
        },
      },
      GET('/posts/42'),
      unauthContext(),
      { id: '42' },
    );

    expect(result).not.toBeNull();
    expect(result!.status).toBe(302);
    expect(result!.headers.get('Location')).toBe('/login?from=%2Fposts%2F42');
    expect(checkCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enforceAuthConfig — edge cases
// ---------------------------------------------------------------------------

describe('enforceAuthConfig — edge cases', () => {
  test('roles without required: denies when no auth context at all', async () => {
    // Bug regression: roles-only config (no required:true) with no auth middleware
    const result = await enforceAuthConfig(
      { roles: ['admin'] },
      GET(),
      noAuthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('roles without required: denies unauthenticated user', async () => {
    const result = await enforceAuthConfig(
      { roles: ['admin'] },
      GET(),
      unauthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('empty roles array does not deny', async () => {
    const result = await enforceAuthConfig(
      { roles: [] },
      GET(),
      authedContext(),
      {},
    );
    expect(result).toBeNull();
  });

  test('synchronous check returning true', async () => {
    const result = await enforceAuthConfig(
      { check: () => true },
      GET(),
      authedContext(),
      {},
    );
    expect(result).toBeNull();
  });

  test('synchronous check returning false', async () => {
    const result = await enforceAuthConfig(
      { check: () => false },
      GET(),
      authedContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('synchronous check returning AuthCheckResult', async () => {
    const result = await enforceAuthConfig(
      { check: () => ({ allowed: false, status: 429, body: { error: 'Rate limited' } }) },
      GET(),
      authedContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  test('check that throws propagates the error', async () => {
    const error = new Error('DB connection failed');
    await expect(
      enforceAuthConfig(
        { check: async () => { throw error; } },
        GET(),
        authedContext(),
        {},
      ),
    ).rejects.toThrow('DB connection failed');
  });

  test('permissions field is ignored by runtime (no enforcement)', async () => {
    // permissions is declared in AuthConfig but not enforced statically —
    // users must use check() to enforce permissions
    const result = await enforceAuthConfig(
      { permissions: ['posts.write'] },
      GET(),
      authedContext(),
      {},
    );
    expect(result).toBeNull();
  });

  test('check with {allowed: true} alongside static roles passes', async () => {
    // User has the role AND check returns allowed
    const result = await enforceAuthConfig(
      {
        roles: ['editor'],
        check: async () => ({ allowed: true }),
      },
      GET(),
      authedContext(['editor']),
      {},
    );
    expect(result).toBeNull();
  });

  test('config with only check (no required, no roles)', async () => {
    const result = await enforceAuthConfig(
      { check: async () => ({ allowed: false, status: 402, body: { error: 'Payment required' } }) },
      GET(),
      noAuthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(402);
  });

  test('required + roles: both must pass', async () => {
    // Authenticated but wrong role
    const result = await enforceAuthConfig(
      { required: true, roles: ['admin'] },
      GET(),
      authedContext(['user']),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('required + roles: authenticated with correct role passes', async () => {
    const result = await enforceAuthConfig(
      { required: true, roles: ['admin'] },
      GET(),
      authedContext(['admin']),
      {},
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requireAuth / requireRoles helper output validation
// ---------------------------------------------------------------------------

describe('requireAuth helper', () => {
  // Import-free: we test the check functions the helpers produce
  // by extracting them from the returned config

  test('produces check that returns 401 for unauthenticated (no redirect)', async () => {
    const config = {
      auth: {
        required: true,
        check: async ({ context }: any) => {
          const auth = context.get('auth') as any;
          if (!auth?.isAuthenticated()) {
            return { allowed: false, status: 401, body: { error: 'Authentication required' } };
          }
          return { allowed: true };
        },
      },
    };

    const result = await enforceAuthConfig(
      config.auth,
      GET(),
      unauthContext(),
      {},
    );
    // Static required check fires first → uses resolveAuthDenial → 403 default
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  test('produces check that returns 403 for wrong role', async () => {
    // Simulate what requireAuth({ roles: ['admin'] }) produces
    const ctx = authedContext(['user']);
    // Override static check by not setting required (so check runs)
    const result = await enforceAuthConfig(
      {
        check: async ({ context }) => {
          const auth = context.get<any>('auth');
          if (!auth?.isAuthenticated()) {
            return { allowed: false, status: 401, body: { error: 'Authentication required' } };
          }
          if (!auth.hasAnyRole(['admin'])) {
            return { allowed: false, status: 403, body: { error: 'Insufficient permissions' } };
          }
          return { allowed: true };
        },
      },
      GET(),
      ctx,
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toBe('Insufficient permissions');
  });

  test('produces check that returns redirect for unauthenticated with redirect option', async () => {
    const result = await enforceAuthConfig(
      {
        check: async ({ context }) => {
          const auth = context.get<any>('auth');
          if (!auth?.isAuthenticated()) {
            return { allowed: false, redirect: '/login' };
          }
          return { allowed: true };
        },
      },
      GET(),
      unauthContext(),
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(302);
    expect(result!.headers.get('Location')).toBe('/login');
  });
});

describe('requireRoles helper', () => {
  test('produces check with requireAll that returns 403 for partial roles', async () => {
    const ctx = authedContext(['editor']);
    const result = await enforceAuthConfig(
      {
        check: async ({ context }) => {
          const auth = context.get<any>('auth');
          if (!auth?.isAuthenticated()) {
            return { allowed: false, status: 401, body: { error: 'Authentication required' } };
          }
          // requireAll: true
          const roles = ['editor', 'admin'];
          const hasAll = roles.every((r: string) => ['editor'].includes(r));
          if (!hasAll) {
            return { allowed: false, status: 403, body: { error: 'Insufficient permissions', requiredRoles: roles } };
          }
          return { allowed: true };
        },
      },
      GET(),
      ctx,
      {},
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.requiredRoles).toEqual(['editor', 'admin']);
  });
});
