/**
 * @areo/auth - Auth tests
 */

import { describe, it, expect, beforeEach, mock as bunMock, spyOn } from 'bun:test';
import { createAuthPlugin, requireAuth, optionalAuth, useAuth } from './auth';
import type { AuthContext } from './auth';
import { credentials, mock } from './providers/index';
import type { AppContext } from '@areo/core';

describe('createAuthPlugin', () => {
  it('should create auth plugin', () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [],
    });

    expect(plugin.name).toBe('@areo/auth');
    expect(typeof plugin.setup).toBe('function');
  });

  it('should create plugin with providers', () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [
        mock({
          session: {
            userId: 'test-123',
            email: 'test@example.com',
          },
        }),
      ],
    });

    expect(plugin.name).toBe('@areo/auth');
  });

  it('should accept custom session duration', () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      sessionDuration: 3600,
    });

    expect(plugin.name).toBe('@areo/auth');
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

    expect(plugin.name).toBe('@areo/auth');
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
      secret: 'test-secret',
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
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    const nextCalled = { value: false };
    const next = () => {
      nextCalled.value = true;
      return Promise.resolve();
    };

    await middlewares[0](request, mockCtx, next);

    expect(authContext).not.toBeNull();
    expect(authContext?.session).toBeNull();
    expect(authContext?.isAuthenticated()).toBe(false);
    expect(nextCalled.value).toBe(true);
  });

  it('should extract session from cookie', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123', email: 'test@example.com' };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `areo.session=${encodedSession}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session).not.toBeNull();
    expect(authContext?.session?.userId).toBe('user-123');
    expect(authContext?.isAuthenticated()).toBe(true);
  });

  it('should extract session from custom cookie name', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
      cookie: { name: 'my.session' },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-456' };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `my.session=${encodedSession}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session?.userId).toBe('user-456');
  });

  it('should return null for invalid cookie session', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: 'areo.session=invalid-base64!!!',
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session).toBeNull();
  });

  it('should return null for expired session', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const expiredDate = new Date(Date.now() - 10000); // 10 seconds ago
    const session = { userId: 'user-123', expiresAt: expiredDate.toISOString() };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `areo.session=${encodedSession}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session).toBeNull();
  });

  it('should validate session with callback', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
      callbacks: {
        onSessionValidate: async (session) => session.userId === 'valid-user',
      },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'valid-user', email: 'test@example.com' };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `areo.session=${encodedSession}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session?.userId).toBe('valid-user');
  });

  it('should reject invalid session with callback', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
      callbacks: {
        onSessionValidate: async (session) => session.userId === 'valid-user',
      },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'invalid-user', email: 'test@example.com' };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `areo.session=${encodedSession}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session).toBeNull();
  });

  it('should extract session from Bearer token', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const payload = { userId: 'jwt-user-123', email: 'jwt@example.com' };
    // Create a simple mock JWT (header.payload.signature)
    const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(payload))}.signature`;

    const request = new Request('http://localhost/test', {
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session?.userId).toBe('jwt-user-123');
  });

  it('should return null for invalid JWT token', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test', {
      headers: {
        authorization: 'Bearer invalid.token.here',
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session).toBeNull();
  });

  it('should ignore non-Bearer authorization header', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test', {
      headers: {
        authorization: 'Basic dXNlcjpwYXNz',
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session).toBeNull();
  });
});

describe('createAuthPlugin - signIn', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;

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
          return { userId: 'user-123', email: 'test@example.com' };
        }
        return null;
      },
    });

    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve());

    const session = await authContext!.signIn('credentials', { email: 'test@example.com' });

    expect(session.userId).toBe('user-123');
    expect(authContext?.session?.userId).toBe('user-123');
    expect(authContext?.isAuthenticated()).toBe(true);
  });

  it('should throw error for unknown provider', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve());

    await expect(authContext!.signIn('unknown', {})).rejects.toThrow(
      'Auth provider not found: unknown'
    );
  });

  it('should throw error when authorization fails', async () => {
    const mockProvider = credentials({
      authorize: async () => null,
    });

    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mockProvider],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve());

    await expect(
      authContext!.signIn('credentials', { email: 'wrong@example.com' })
    ).rejects.toThrow('Authentication failed');
  });

  it('should call onSessionCreated callback', async () => {
    const mockProvider = credentials({
      authorize: async () => ({ userId: 'user-123', email: 'test@example.com' }),
    });

    const onSessionCreated = bunMock(async (session) => ({
      ...session,
      roles: ['admin'],
    }));

    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mockProvider],
      callbacks: { onSessionCreated },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve());

    const session = await authContext!.signIn('credentials', { email: 'test@example.com' });

    expect(onSessionCreated).toHaveBeenCalled();
    expect(session.roles).toEqual(['admin']);
  });
});

describe('createAuthPlugin - signOut', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;

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
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    // Set up a session via cookie
    const session = { userId: 'user-123' };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: { cookie: `areo.session=${encodedSession}` },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());
    expect(authContext?.isAuthenticated()).toBe(true);

    await authContext!.signOut();

    expect(authContext?.session).toBeNull();
    expect(authContext?.isAuthenticated()).toBe(false);
  });

  it('should call onSignOut callback', async () => {
    const onSignOut = bunMock(async () => {});

    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
      callbacks: { onSignOut },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123' };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: { cookie: `areo.session=${encodedSession}` },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());
    await authContext!.signOut();

    expect(onSignOut).toHaveBeenCalled();
  });

  it('should not call onSignOut callback when no session', async () => {
    const onSignOut = bunMock(async () => {});

    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
      callbacks: { onSignOut },
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve());
    await authContext!.signOut();

    expect(onSignOut).not.toHaveBeenCalled();
  });
});

describe('createAuthPlugin - hasRole and hasAnyRole', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;

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
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123', roles: ['admin', 'user'] };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: { cookie: `areo.session=${encodedSession}` },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.hasRole('admin')).toBe(true);
    expect(authContext?.hasRole('user')).toBe(true);
    expect(authContext?.hasRole('superadmin')).toBe(false);
  });

  it('should return false for hasRole when no session', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test');
    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.hasRole('admin')).toBe(false);
  });

  it('should return false for hasRole when session has no roles', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123' }; // no roles
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: { cookie: `areo.session=${encodedSession}` },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.hasRole('admin')).toBe(false);
  });

  it('should check hasAnyRole correctly', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123', roles: ['editor'] };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: { cookie: `areo.session=${encodedSession}` },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.hasAnyRole(['admin', 'editor'])).toBe(true);
    expect(authContext?.hasAnyRole(['admin', 'superadmin'])).toBe(false);
  });

  it('should return false for hasAnyRole when no matching roles', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123', roles: ['user'] };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: { cookie: `areo.session=${encodedSession}` },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.hasAnyRole(['admin', 'superadmin'])).toBe(false);
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
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result).toBe(false);
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
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result).toBe(true);
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
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result).toBe(false);
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
      };

      const mockContext = {
        get: (key: string) => (key === 'auth' ? mockAuth : undefined),
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result).toBe(true);
    });

    it('should return false when auth context is undefined', async () => {
      const config = requireAuth();

      const mockContext = {
        get: () => undefined,
      } as AppContext;

      const result = await config.auth?.check?.({ context: mockContext } as any);
      expect(result).toBe(false);
    });
  });
});

describe('optionalAuth', () => {
  it('should create auth config with optional authentication', () => {
    const config = optionalAuth();

    expect(config.auth?.required).toBe(false);
  });
});

describe('useAuth', () => {
  it('should retrieve auth from context', () => {
    const mockAuth = {
      session: null,
      signIn: async () => ({ userId: '123', email: '' }),
      signOut: async () => {},
      isAuthenticated: () => false,
      hasRole: () => false,
      hasAnyRole: () => false,
    };

    const context = {
      get: (key: string) => (key === 'auth' ? mockAuth : undefined),
    } as AppContext;

    const auth = useAuth(context);
    expect(auth.isAuthenticated()).toBe(false);
  });
});

describe('credentials provider', () => {
  it('should create credentials provider', () => {
    const provider = credentials({
      authorize: async () => ({
        userId: '123',
        email: 'user@example.com',
      }),
    });

    expect(provider.id).toBe('credentials');
    expect(typeof provider.authorize).toBe('function');
  });

  it('should use custom name', () => {
    const provider = credentials({
      name: 'Custom Login',
      authorize: async () => ({ userId: '123' }),
    });

    expect(provider.name).toBe('Custom Login');
  });

  it('should use default name when not provided', () => {
    const provider = credentials({
      authorize: async () => ({ userId: '123' }),
    });

    expect(provider.name).toBe('Credentials');
  });

  it('should authorize with valid credentials', async () => {
    const provider = credentials({
      authorize: async (creds) => {
        if (creds.email === 'test@example.com' && creds.password === 'password') {
          return {
            userId: '123',
            email: 'test@example.com',
          };
        }
        return null;
      },
    });

    const session = await provider.authorize({
      email: 'test@example.com',
      password: 'password',
    });

    expect(session).not.toBeNull();
    expect(session?.userId).toBe('123');
  });
});

describe('mock provider', () => {
  it('should create mock provider', () => {
    const provider = mock();

    expect(provider.id).toBe('mock');
    expect(provider.name).toBe('Mock');
  });

  it('should return default mock session', async () => {
    const provider = mock();
    const session = await provider.authorize({});

    expect(session).not.toBeNull();
    expect(session?.userId).toBe('mock-user-123');
  });

  it('should return custom session', async () => {
    const provider = mock({
      session: {
        userId: 'custom-123',
        email: 'custom@example.com',
        name: 'Custom User',
      },
    });

    const session = await provider.authorize({});

    expect(session?.userId).toBe('custom-123');
    expect(session?.email).toBe('custom@example.com');
  });
});

describe('parseCookie edge cases', () => {
  let middlewares: Array<(request: Request, ctx: any, next: () => any) => any>;
  let authContext: AuthContext | null;
  let mockCtx: any;

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

  it('should parse cookie from multiple cookies', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123' };
    const encodedSession = btoa(JSON.stringify(session));
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `other=value; areo.session=${encodedSession}; another=data`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session?.userId).toBe('user-123');
  });

  it('should return null when cookie name not found', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const request = new Request('http://localhost/test', {
      headers: {
        cookie: 'other=value; another=data',
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session).toBeNull();
  });

  it('should handle URL-encoded cookie values', async () => {
    const plugin = createAuthPlugin({
      secret: 'test-secret',
      providers: [mock()],
    });

    const mockServer = { middlewares };
    plugin.configureServer?.(mockServer as any);

    const session = { userId: 'user-123' };
    const encodedSession = encodeURIComponent(btoa(JSON.stringify(session)));
    const request = new Request('http://localhost/test', {
      headers: {
        cookie: `areo.session=${encodedSession}`,
      },
    });

    await middlewares[0](request, mockCtx, () => Promise.resolve());

    expect(authContext?.session?.userId).toBe('user-123');
  });
});
