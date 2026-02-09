/**
 * @ereo/auth - Auth tests
 */

import { describe, it, expect, beforeEach, mock as bunMock, spyOn } from 'bun:test';
import { createAuthPlugin, requireAuth, optionalAuth, requireRoles, getAuth, getSession, getUser } from './auth';
import type { AuthContext, Session, User } from './auth';
import { credentials, mock } from './providers/index';
import type { AppContext } from '@ereo/core';

// Helper to create a signed JWT for testing
async function createTestJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();

  // Create header
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerBase64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadBase64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));

  // Create signature
  const signingInput = `${headerBase64}.${payloadBase64}`;
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput)
  );
  const signatureBase64 = base64UrlEncode(new Uint8Array(signature));

  return `${signingInput}.${signatureBase64}`;
}

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('createAuthPlugin', () => {
  it('should create auth plugin', () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [],
    });

    expect(plugin.name).toBe('@ereo/auth');
    expect(typeof plugin.setup).toBe('function');
  });

  it('should create plugin with providers', () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [
        mock({
          user: {
            id: 'test-123',
            email: 'test@example.com',
          },
        }),
      ],
    });

    expect(plugin.name).toBe('@ereo/auth');
  });

  it('should accept custom session duration', () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      sessionDuration: 3600,
    });

    expect(plugin.name).toBe('@ereo/auth');
  });

  it('should accept session config', () => {
    const plugin = createAuthPlugin({
      session: {
        secret: 'test-secret',
        strategy: 'jwt',
        maxAge: 3600,
      },
    });

    expect(plugin.name).toBe('@ereo/auth');
  });

  it('should accept custom cookie config', () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      cookie: {
        name: 'custom.session',
        secure: true,
        sameSite: 'strict',
        domain: 'example.com',
        path: '/',
      },
    });

    expect(plugin.name).toBe('@ereo/auth');
  });

  it('should throw error if no secret provided', () => {
    expect(() => {
      createAuthPlugin({} as any);
    }).toThrow('[auth] Session secret is required');
  });
});

describe('createAuthPlugin - setup', () => {
  it('should call setup and log provider count', async () => {
    const consoleSpy = spyOn(console, 'log');

    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock(), mock()],
    });

    await plugin.setup?.({} as any);

    expect(consoleSpy).toHaveBeenCalledWith('[auth] Initialized with 2 providers');
    consoleSpy.mockRestore();
  });

  it('should log 0 providers when none configured', async () => {
    const consoleSpy = spyOn(console, 'log');

    const plugin = createAuthPlugin({
      secret: 'test-secret',
    });

    await plugin.setup?.({} as any);

    expect(consoleSpy).toHaveBeenCalledWith('[auth] Initialized with 0 providers');
    consoleSpy.mockRestore();
  });
});

describe('createAuthPlugin - configureServer middleware', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let mockCtx: { set: (key: string, value: any) => void; get: (key: string) => any };
  let authContext: AuthContext | null;
  const testSecret = 'test-secret-key-12345';

  beforeEach(() => {
    middlewares = [];
    authContext = null;
    mockCtx = {
      set: (key: string, value: any) => {
        if (key === 'auth') {
          authContext = value;
        }
      },
      get: (key: string) => {
        if (key === 'auth') {
          return authContext;
        }
        return undefined;
      },
    };
  });

  it('should add middleware to server', () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = {
      middlewares: middlewares,
    };

    plugin.configureServer?.(mockServer as any);

    expect(middlewares.length).toBe(1);
  });

  it('should set auth context with null session for request without auth', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    const nextCalled = { value: false };
    const next = () => {
      nextCalled.value = true;
      return Promise.resolve(new Response('OK'));
    };

    await middlewares[0](request, mockCtx, next);

    expect(authContext).not.toBeNull();
    expect(authContext?.session).toBeNull();
    expect(authContext?.isAuthenticated()).toBe(false);
    expect(nextCalled.value).toBe(true);
  });

  it('should extract session from JWT cookie', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      iat: now,
      exp: now + 3600,
    };
    const jwt = await createTestJWT(payload, testSecret);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `ereo.session=${jwt}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session).not.toBeNull();
    expect(authContext?.session?.userId).toBe('user-123');
    expect(authContext?.isAuthenticated()).toBe(true);
  });

  it('should extract session from custom cookie name', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
      cookie: { name: 'my.session' },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'user-456',
      iat: now,
      exp: now + 3600,
    };
    const jwt = await createTestJWT(payload, testSecret);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `my.session=${jwt}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session?.userId).toBe('user-456');
  });

  it('should return null for invalid JWT', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: 'ereo.session=invalid-jwt-token',
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session).toBeNull();
  });

  it('should return null for expired JWT', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'user-123',
      iat: now - 7200,
      exp: now - 3600, // Expired 1 hour ago
    };
    const jwt = await createTestJWT(payload, testSecret);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `ereo.session=${jwt}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session).toBeNull();
  });

  it('should validate session with callback', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
      callbacks: {
        onSessionValidate: async (session) => session.userId === 'valid-user',
      },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'valid-user',
      email: 'test@example.com',
      iat: now,
      exp: now + 3600,
    };
    const jwt = await createTestJWT(payload, testSecret);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `ereo.session=${jwt}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session?.userId).toBe('valid-user');
  });

  it('should reject invalid session with callback', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
      callbacks: {
        onSessionValidate: async (session) => session.userId === 'valid-user',
      },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'invalid-user',
      email: 'test@example.com',
      iat: now,
      exp: now + 3600,
    };
    const jwt = await createTestJWT(payload, testSecret);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `ereo.session=${jwt}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session).toBeNull();
  });

  it('should extract session from Bearer token', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'jwt-user-123',
      email: 'jwt@example.com',
      iat: now,
      exp: now + 3600,
    };
    const jwt = await createTestJWT(payload, testSecret);

    const request = new Request('http://localhost/test', {
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session?.userId).toBe('jwt-user-123');
  });

  it('should return null for invalid Bearer token', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test', {
      headers: {
        authorization: 'Bearer invalid.token.here',
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session).toBeNull();
  });

  it('should ignore non-Bearer authorization header', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test', {
      headers: {
        authorization: 'Basic dXNlcjpwYXNz',
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.session).toBeNull();
  });
});

describe('createAuthPlugin - signIn', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;
  const testSecret = 'test-secret-key-12345';

  beforeEach(() => {
    middlewares = [];
    authContext = null;
    mockCtx = {
      set: (key: string, value: any) => {
        if (key === 'auth') authContext = value;
      },
      get: (key: string) => (key === 'auth' ? authContext : undefined),
    };
  });

  it('should sign in with valid provider and credentials', async () => {
    const mockProvider = credentials({
      authorize: async (creds) => {
        if (creds.email === 'test@example.com') {
          return { id: 'user-123', email: 'test@example.com' };
        }
        return null;
      },
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    const session = await authContext!.signIn('credentials', { email: 'test@example.com' });

    expect(session.userId).toBe('user-123');
    expect(authContext?.session?.userId).toBe('user-123');
    expect(authContext?.isAuthenticated()).toBe(true);
  });

  it('should throw error for unknown provider', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await expect(authContext!.signIn('unknown', {})).rejects.toThrow(
      'Auth provider not found: unknown'
    );
  });

  it('should throw error when authorization fails', async () => {
    const mockProvider = credentials({
      authorize: async () => null,
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await expect(
      authContext!.signIn('credentials', { email: 'wrong@example.com' })
    ).rejects.toThrow('Authentication failed');
  });

  it('should call onSessionCreated callback', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
    });

    const onSessionCreated = bunMock(async (session: Session) => ({
      ...session,
      roles: ['admin'],
    }));

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
      callbacks: { onSessionCreated },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    const session = await authContext!.signIn('credentials', { email: 'test@example.com' });

    expect(onSessionCreated).toHaveBeenCalled();
    expect(session.roles).toEqual(['admin']);
  });

  it('should call onSignIn callback', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
    });

    const onSignIn = bunMock(async (user: User) => {});

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
      callbacks: { onSignIn },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', { email: 'test@example.com' });

    expect(onSignIn).toHaveBeenCalled();
  });

  it('should set cookie header after sign in', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    const response = await middlewares[0](request, mockCtx, async () => {
      // Sign in during request handling
      await authContext!.signIn('credentials', { email: 'test@example.com' });
      return new Response('OK');
    });

    // Cookie should be set
    expect(response.headers.get('Set-Cookie')).toContain('ereo.session=');
  });
});

describe('createAuthPlugin - signOut', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;
  const testSecret = 'test-secret-key-12345';

  beforeEach(() => {
    middlewares = [];
    authContext = null;
    mockCtx = {
      set: (key: string, value: any) => {
        if (key === 'auth') authContext = value;
      },
      get: (key: string) => (key === 'auth' ? authContext : undefined),
    };
  });

  it('should sign out and clear session', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    // Sign in first
    await authContext!.signIn('credentials', { email: 'test@example.com' });
    expect(authContext?.isAuthenticated()).toBe(true);

    // Sign out
    await authContext!.signOut();

    expect(authContext?.session).toBeNull();
    expect(authContext?.isAuthenticated()).toBe(false);
  });

  it('should call onSignOut callback', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
    });

    const onSignOut = bunMock(async () => {});

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
      callbacks: { onSignOut },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    // Sign in first
    await authContext!.signIn('credentials', { email: 'test@example.com' });

    // Sign out
    await authContext!.signOut();

    expect(onSignOut).toHaveBeenCalled();
  });

  it('should not call onSignOut callback when no session', async () => {
    const onSignOut = bunMock(async () => {});

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
      callbacks: { onSignOut },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));
    await authContext!.signOut();

    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('should set clear cookie header after sign out', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    const response = await middlewares[0](request, mockCtx, async () => {
      // Sign in first
      await authContext!.signIn('credentials', { email: 'test@example.com' });
      // Then sign out
      await authContext!.signOut();
      return new Response('OK');
    });

    // Cookie should be cleared (Max-Age=0)
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});

describe('createAuthPlugin - hasRole and hasAnyRole', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;
  const testSecret = 'test-secret-key-12345';

  beforeEach(() => {
    middlewares = [];
    authContext = null;
    mockCtx = {
      set: (key: string, value: any) => {
        if (key === 'auth') authContext = value;
      },
      get: (key: string) => (key === 'auth' ? authContext : undefined),
    };
  });

  it('should check hasRole correctly', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', roles: ['admin', 'user'] }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', {});

    expect(authContext?.hasRole('admin')).toBe(true);
    expect(authContext?.hasRole('user')).toBe(true);
    expect(authContext?.hasRole('superadmin')).toBe(false);
  });

  it('should return false for hasRole when no session', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.hasRole('admin')).toBe(false);
  });

  it('should return false for hasRole when session has no roles', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123' }), // no roles
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', {});

    expect(authContext?.hasRole('admin')).toBe(false);
  });

  it('should check hasAnyRole correctly', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', roles: ['editor'] }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', {});

    expect(authContext?.hasAnyRole(['admin', 'editor'])).toBe(true);
    expect(authContext?.hasAnyRole(['admin', 'superadmin'])).toBe(false);
  });

  it('should check hasAllRoles correctly', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', roles: ['admin', 'editor'] }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', {});

    expect(authContext?.hasAllRoles(['admin', 'editor'])).toBe(true);
    expect(authContext?.hasAllRoles(['admin', 'superadmin'])).toBe(false);
  });

  it('should return false for hasAnyRole when no matching roles', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', roles: ['user'] }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', {});

    expect(authContext?.hasAnyRole(['admin', 'superadmin'])).toBe(false);
  });
});

describe('createAuthPlugin - getUser and getToken', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;
  const testSecret = 'test-secret-key-12345';

  beforeEach(() => {
    middlewares = [];
    authContext = null;
    mockCtx = {
      set: (key: string, value: any) => {
        if (key === 'auth') authContext = value;
      },
      get: (key: string) => (key === 'auth' ? authContext : undefined),
    };
  });

  it('should return user when authenticated', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com', name: 'Test User' }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', {});

    const user = authContext?.getUser();
    expect(user?.id).toBe('user-123');
    expect(user?.email).toBe('test@example.com');
    expect(user?.name).toBe('Test User');
  });

  it('should return null for getUser when not authenticated', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    expect(authContext?.getUser()).toBeNull();
  });

  it('should return token when authenticated', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
    });

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    await authContext!.signIn('credentials', {});

    const token = await authContext?.getToken();
    expect(token).not.toBeNull();
    expect(token?.split('.').length).toBe(3); // JWT has 3 parts
  });

  it('should return null for getToken when not authenticated', async () => {
    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));

    const token = await authContext?.getToken();
    expect(token).toBeNull();
  });
});

describe('requireAuth', () => {
  it('should create auth config requiring authentication', () => {
    const config = requireAuth();

    expect(config.auth?.required).toBe(true);
  });

  it('should support redirect option', () => {
    const config = requireAuth({ redirect: '/login' });

    expect(config.auth?.required).toBe(true);
    expect(config.auth?.redirect).toBe('/login');
  });

  it('should support role requirements', () => {
    const config = requireAuth({ roles: ['admin', 'moderator'] });

    expect(config.auth?.required).toBe(true);
    expect(config.auth?.roles).toEqual(['admin', 'moderator']);
  });

  describe('check function', () => {
    it('should return false when not authenticated', async () => {
      const config = requireAuth();
      const mockAuth: AuthContext = {
        session: null,
        signIn: async () => ({ userId: '123' }),
        signOut: async () => {},
        isAuthenticated: () => false,
        hasRole: () => false,
        hasAnyRole: () => false,
        hasAllRoles: () => false,
        getUser: () => null,
        getToken: async () => null,
        refreshSession: async () => null,
        getCookieHeader: () => null,
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result.allowed).toBe(false);
    });

    it('should return true when authenticated without role requirements', async () => {
      const config = requireAuth();
      const mockAuth: AuthContext = {
        session: { userId: 'user-123' },
        signIn: async () => ({ userId: '123' }),
        signOut: async () => {},
        isAuthenticated: () => true,
        hasRole: () => false,
        hasAnyRole: () => false,
        hasAllRoles: () => false,
        getUser: () => ({ id: 'user-123' }),
        getToken: async () => 'token',
        refreshSession: async () => ({ userId: 'user-123' }),
        getCookieHeader: () => null,
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result.allowed).toBe(true);
    });

    it('should return false when authenticated but missing required roles', async () => {
      const config = requireAuth({ roles: ['admin'] });
      const mockAuth: AuthContext = {
        session: { userId: 'user-123', roles: ['user'] },
        signIn: async () => ({ userId: '123' }),
        signOut: async () => {},
        isAuthenticated: () => true,
        hasRole: (role) => role === 'user',
        hasAnyRole: (roles) => roles.includes('user'),
        hasAllRoles: (roles) => roles.every(r => r === 'user'),
        getUser: () => ({ id: 'user-123', roles: ['user'] }),
        getToken: async () => 'token',
        refreshSession: async () => ({ userId: 'user-123', roles: ['user'] }),
        getCookieHeader: () => null,
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result.allowed).toBe(false);
    });

    it('should return true when authenticated with required roles', async () => {
      const config = requireAuth({ roles: ['admin', 'moderator'] });
      const mockAuth: AuthContext = {
        session: { userId: 'user-123', roles: ['admin'] },
        signIn: async () => ({ userId: '123' }),
        signOut: async () => {},
        isAuthenticated: () => true,
        hasRole: (role) => role === 'admin',
        hasAnyRole: (roles) => roles.includes('admin'),
        hasAllRoles: (roles) => roles.every(r => r === 'admin'),
        getUser: () => ({ id: 'user-123', roles: ['admin'] }),
        getToken: async () => 'token',
        refreshSession: async () => ({ userId: 'user-123', roles: ['admin'] }),
        getCookieHeader: () => null,
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result.allowed).toBe(true);
    });

    it('should return false when auth context is undefined', async () => {
      const config = requireAuth();

      const mockContext = {
        get: () => undefined,
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result.allowed).toBe(false);
    });
  });
});

describe('requireRoles', () => {
  it('should create auth config with role requirements', () => {
    const config = requireRoles(['admin', 'editor']);

    expect(config.auth?.required).toBe(true);
    expect(config.auth?.roles).toEqual(['admin', 'editor']);
  });

  it('should support redirect option', () => {
    const config = requireRoles(['admin'], { redirect: '/forbidden' });

    expect(config.auth?.redirect).toBe('/forbidden');
  });

  it('should support requireAll option', async () => {
    const config = requireRoles(['admin', 'editor'], { requireAll: true });

    const mockAuth: AuthContext = {
      session: { userId: 'user-123', roles: ['admin', 'editor'] },
      signIn: async () => ({ userId: '123' }),
      signOut: async () => {},
      isAuthenticated: () => true,
      hasRole: (role) => ['admin', 'editor'].includes(role),
      hasAnyRole: (roles) => roles.some(r => ['admin', 'editor'].includes(r)),
      hasAllRoles: (roles) => roles.every(r => ['admin', 'editor'].includes(r)),
      getUser: () => ({ id: 'user-123', roles: ['admin', 'editor'] }),
      getToken: async () => 'token',
      refreshSession: async () => ({ userId: 'user-123', roles: ['admin', 'editor'] }),
      getCookieHeader: () => null,
    };

    const mockContext = {
      get: (key: string) => (key === 'auth' ? mockAuth : undefined),
    } as AppContext;

    const result = await config.auth?.check?.({ context: mockContext } as any);
    expect(result.allowed).toBe(true);
  });
});

describe('optionalAuth', () => {
  it('should create auth config with optional authentication', () => {
    const config = optionalAuth();

    expect(config.auth?.required).toBe(false);
  });
});

describe('getAuth', () => {
  it('should retrieve auth from context', () => {
    const mockAuth: AuthContext = {
      session: null,
      signIn: async () => ({ userId: '123' }),
      signOut: async () => {},
      isAuthenticated: () => false,
      hasRole: () => false,
      hasAnyRole: () => false,
      hasAllRoles: () => false,
      getUser: () => null,
      getToken: async () => null,
      refreshSession: async () => null,
      getCookieHeader: () => null,
    };

    const context = {
      get: (key: string) => (key === 'auth' ? mockAuth : undefined),
    } as AppContext;

    const auth = getAuth(context);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('should throw error when auth context not found', () => {
    const context = {
      get: () => undefined,
    } as AppContext;

    expect(() => getAuth(context)).toThrow('Auth context not found');
  });

});

describe('getSession', () => {
  it('should return session when authenticated', () => {
    const mockSession: Session = { userId: 'user-123', email: 'test@example.com' };
    const mockAuth: AuthContext = {
      session: mockSession,
      signIn: async () => mockSession,
      signOut: async () => {},
      isAuthenticated: () => true,
      hasRole: () => false,
      hasAnyRole: () => false,
      hasAllRoles: () => false,
      getUser: () => ({ id: 'user-123' }),
      getToken: async () => 'token',
      refreshSession: async () => mockSession,
      getCookieHeader: () => null,
    };

    const context = {
      get: (key: string) => (key === 'auth' ? mockAuth : undefined),
    } as AppContext;

    const session = getSession(context);
    expect(session?.userId).toBe('user-123');
  });

  it('should return null when not authenticated', () => {
    const context = {
      get: () => undefined,
    } as AppContext;

    expect(getSession(context)).toBeNull();
  });
});

describe('getUser', () => {
  it('should return user when authenticated', () => {
    const mockUser: User = { id: 'user-123', email: 'test@example.com' };
    const mockAuth: AuthContext = {
      session: { userId: 'user-123' },
      signIn: async () => ({ userId: '123' }),
      signOut: async () => {},
      isAuthenticated: () => true,
      hasRole: () => false,
      hasAnyRole: () => false,
      hasAllRoles: () => false,
      getUser: () => mockUser,
      getToken: async () => 'token',
      refreshSession: async () => ({ userId: 'user-123' }),
      getCookieHeader: () => null,
    };

    const context = {
      get: (key: string) => (key === 'auth' ? mockAuth : undefined),
    } as AppContext;

    const user = getUser(context);
    expect(user?.id).toBe('user-123');
  });

  it('should return null when not authenticated', () => {
    const context = {
      get: () => undefined,
    } as AppContext;

    expect(getUser(context)).toBeNull();
  });
});

describe('credentials provider', () => {
  it('should create credentials provider', () => {
    const provider = credentials({
      authorize: async () => ({
        id: '123',
        email: 'user@example.com',
      }),
    });

    expect(provider.id).toBe('credentials');
    expect(provider.type).toBe('credentials');
    expect(typeof provider.authorize).toBe('function');
  });

  it('should use custom name', () => {
    const provider = credentials({
      name: 'Custom Login',
      authorize: async () => ({ id: '123' }),
    });

    expect(provider.name).toBe('Custom Login');
  });

  it('should use custom id', () => {
    const provider = credentials({
      id: 'custom-credentials',
      authorize: async () => ({ id: '123' }),
    });

    expect(provider.id).toBe('custom-credentials');
  });

  it('should use default name when not provided', () => {
    const provider = credentials({
      authorize: async () => ({ id: '123' }),
    });

    expect(provider.name).toBe('Credentials');
  });

  it('should authorize with valid credentials', async () => {
    const provider = credentials({
      authorize: async (creds) => {
        if (creds.email === 'test@example.com' && creds.password === 'password') {
          return {
            id: '123',
            email: 'test@example.com',
          };
        }
        return null;
      },
    });

    const user = await provider.authorize({
      email: 'test@example.com',
      password: 'password',
    });

    expect(user).not.toBeNull();
    expect(user?.id).toBe('123');
  });
});

describe('mock provider', () => {
  it('should create mock provider', () => {
    const provider = mock();

    expect(provider.id).toBe('mock');
    expect(provider.name).toBe('Mock');
    expect(provider.type).toBe('credentials');
  });

  it('should return default mock user', async () => {
    const provider = mock();
    const user = await provider.authorize({});

    expect(user).not.toBeNull();
    expect(user?.id).toBe('mock-user-123');
    expect(user?.email).toBe('mock@example.com');
  });

  it('should return custom user', async () => {
    const provider = mock({
      user: {
        id: 'custom-123',
        email: 'custom@example.com',
        name: 'Custom User',
      },
    });

    const user = await provider.authorize({});

    expect(user?.id).toBe('custom-123');
    expect(user?.email).toBe('custom@example.com');
  });

  it('should apply delay when configured', async () => {
    const provider = mock({
      delay: 50,
    });

    const start = Date.now();
    await provider.authorize({});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
  });
});

describe('JWT signing and verification', () => {
  const testSecret = 'test-secret-key-12345';

  it('should create valid JWTs that can be verified', async () => {
    const middlewares: any[] = [];
    let authContext: AuthContext | null = null;
    const mockCtx = {
      set: (key: string, value: any) => {
        if (key === 'auth') authContext = value;
      },
      get: (key: string) => (key === 'auth' ? authContext : undefined),
    };

    const plugin = createAuthPlugin({
      secret: testSecret,
      providers: [credentials({
        authorize: async () => ({ id: 'user-123', email: 'test@example.com' }),
      })],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    // Sign in
    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve(new Response('OK')));
    await authContext!.signIn('credentials', {});

    // Get token
    const token = await authContext!.getToken();
    expect(token).not.toBeNull();

    // Verify token can be used
    const newMiddlewares: any[] = [];
    let newAuthContext: AuthContext | null = null;
    const newMockCtx = {
      set: (key: string, value: any) => {
        if (key === 'auth') newAuthContext = value;
      },
      get: (key: string) => (key === 'auth' ? newAuthContext : undefined),
    };

    const plugin2 = createAuthPlugin({
      secret: testSecret,
      providers: [],
    });

    plugin2.configureServer?.({ middlewares: newMiddlewares } as any);

    const request2 = new Request('http://localhost/test', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    await newMiddlewares[0](request2, newMockCtx, () => Promise.resolve(new Response('OK')));

    expect(newAuthContext?.session?.userId).toBe('user-123');
    expect(newAuthContext?.session?.email).toBe('test@example.com');
  });
});
