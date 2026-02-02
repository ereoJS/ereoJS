/**
 * @areo/auth - Auth tests
 */

import { describe, it, expect } from 'bun:test';
import { createAuthPlugin, requireAuth, optionalAuth, useAuth } from './auth';
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
