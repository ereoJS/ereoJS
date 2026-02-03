/**
 * @ereo/auth/providers - Provider tests
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { github, google, credentials, mock, discord, oauth, apiKey } from './index';
import type { User } from '../auth';

describe('github provider', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should create github provider with correct id and name', () => {
    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    expect(provider.id).toBe('github');
    expect(provider.name).toBe('GitHub');
    expect(provider.type).toBe('oauth');
  });

  it('should return null when no code is provided', async () => {
    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({});

    expect(user).toBeNull();
  });

  it('should return null when code is empty', async () => {
    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({ code: '' });

    expect(user).toBeNull();
  });

  it('should exchange code for access token and get user info', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'mock-access-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('api.github.com/user/emails')) {
        return new Response(
          JSON.stringify([
            { email: 'github@example.com', primary: true, verified: true },
          ]),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlString.includes('api.github.com/user')) {
        return new Response(
          JSON.stringify({
            id: 12345,
            email: 'github@example.com',
            name: 'GitHub User',
            login: 'githubuser',
            avatar_url: 'https://github.com/avatar.png',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const user = await provider.authorize({ code: 'auth-code-123' });

    expect(mockFetch).toHaveBeenCalled();
    expect(user).not.toBeNull();
    expect(user?.id).toBe('12345');
    expect(user?.email).toBe('github@example.com');
    expect(user?.name).toBe('GitHub User');
    expect(user?.avatar).toBe('https://github.com/avatar.png');
    expect(user?.username).toBe('githubuser');

    mockFetch.mockRestore();
  });

  it('should use login as name when name is not available', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'mock-access-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('api.github.com/user/emails')) {
        return new Response(
          JSON.stringify([
            { email: 'github@example.com', primary: true, verified: true },
          ]),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlString.includes('api.github.com/user')) {
        return new Response(
          JSON.stringify({
            id: 12345,
            email: 'github@example.com',
            name: null,
            login: 'githubuser',
            avatar_url: 'https://github.com/avatar.png',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({ code: 'auth-code-123' });

    expect(user?.name).toBe('githubuser');

    mockFetch.mockRestore();
  });

  it('should return null when access token request fails', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ error: 'bad_verification_code' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({ code: 'invalid-code' });

    expect(user).toBeNull();

    mockFetch.mockRestore();
  });

  it('should send correct request body to GitHub token endpoint', async () => {
    let capturedBody: any = null;

    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options: any) => {
      const urlString = url.toString();
      if (urlString.includes('github.com/login/oauth/access_token')) {
        capturedBody = JSON.parse(options?.body);
        return new Response(JSON.stringify({ access_token: 'mock-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('api.github.com/user/emails')) {
        return new Response(
          JSON.stringify([
            { email: 'test@example.com', primary: true, verified: true },
          ]),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlString.includes('api.github.com/user')) {
        return new Response(
          JSON.stringify({ id: 1, login: 'user', email: 'test@example.com' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = github({
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      redirectUri: 'http://localhost/auth/callback',
    });

    await provider.authorize({ code: 'test-code' });

    expect(capturedBody).toEqual({
      client_id: 'my-client-id',
      client_secret: 'my-client-secret',
      code: 'test-code',
      redirect_uri: 'http://localhost/auth/callback',
    });

    mockFetch.mockRestore();
  });

  it('should generate authorization URL', () => {
    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const url = provider.getAuthorizationUrl!('test-state', 'http://localhost/callback');

    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
  });

  it('should accept user object directly for OAuth callback', async () => {
    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const mockUser: User = { id: 'user-123', email: 'test@example.com' };
    const user = await provider.authorize({ user: mockUser });

    expect(user).toEqual(mockUser);
  });
});

describe('google provider', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should create google provider with correct id and name', () => {
    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    expect(provider.id).toBe('google');
    expect(provider.name).toBe('Google');
    expect(provider.type).toBe('oauth');
  });

  it('should return null when no code is provided', async () => {
    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({});

    expect(user).toBeNull();
  });

  it('should return null when code is empty', async () => {
    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({ code: '' });

    expect(user).toBeNull();
  });

  it('should exchange code for access token and get user info', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'mock-google-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('googleapis.com/oauth2/v2/userinfo')) {
        return new Response(
          JSON.stringify({
            id: 'google-user-123',
            email: 'google@example.com',
            name: 'Google User',
            picture: 'https://google.com/avatar.png',
            verified_email: true,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    });

    const user = await provider.authorize({ code: 'google-auth-code' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(user).not.toBeNull();
    expect(user?.id).toBe('google-user-123');
    expect(user?.email).toBe('google@example.com');
    expect(user?.name).toBe('Google User');
    expect(user?.picture).toBe('https://google.com/avatar.png');
    expect(user?.emailVerified).toBe(true);

    mockFetch.mockRestore();
  });

  it('should return null when access token request fails', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({ code: 'invalid-code' });

    expect(user).toBeNull();

    mockFetch.mockRestore();
  });

  it('should use default redirectUri when not provided', async () => {
    let capturedBody: string = '';

    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options: any) => {
      const urlString = url.toString();
      if (urlString.includes('oauth2.googleapis.com/token')) {
        capturedBody = options?.body;
        return new Response(JSON.stringify({ access_token: 'mock-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('googleapis.com/oauth2/v2/userinfo')) {
        return new Response(
          JSON.stringify({ id: '123', email: 'test@example.com', name: 'Test' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      // No redirectUri provided
    });

    await provider.authorize({ code: 'test-code' });

    const params = new URLSearchParams(capturedBody);
    expect(params.get('redirect_uri')).toBe('postmessage');

    mockFetch.mockRestore();
  });

  it('should send correct request body to Google token endpoint', async () => {
    let capturedBody: string = '';

    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options: any) => {
      const urlString = url.toString();
      if (urlString.includes('oauth2.googleapis.com/token')) {
        capturedBody = options?.body;
        return new Response(JSON.stringify({ access_token: 'mock-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('googleapis.com/oauth2/v2/userinfo')) {
        return new Response(
          JSON.stringify({ id: '123', email: 'test@example.com', name: 'Test' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = google({
      clientId: 'my-google-client-id',
      clientSecret: 'my-google-client-secret',
      redirectUri: 'http://localhost/google/callback',
    });

    await provider.authorize({ code: 'google-code-123' });

    const params = new URLSearchParams(capturedBody);
    expect(params.get('code')).toBe('google-code-123');
    expect(params.get('client_id')).toBe('my-google-client-id');
    expect(params.get('client_secret')).toBe('my-google-client-secret');
    expect(params.get('redirect_uri')).toBe('http://localhost/google/callback');
    expect(params.get('grant_type')).toBe('authorization_code');

    mockFetch.mockRestore();
  });

  it('should use access token in userinfo URL', async () => {
    let capturedUserInfoUrl: string = '';

    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'special-access-token-xyz' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('googleapis.com/oauth2/v2/userinfo')) {
        capturedUserInfoUrl = urlString;
        return new Response(
          JSON.stringify({ id: '123', email: 'test@example.com', name: 'Test' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    await provider.authorize({ code: 'test-code' });

    expect(capturedUserInfoUrl).toContain('access_token=special-access-token-xyz');

    mockFetch.mockRestore();
  });

  it('should generate authorization URL', () => {
    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const url = provider.getAuthorizationUrl!('test-state', 'http://localhost/callback');

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
    expect(url).toContain('response_type=code');
  });

  it('should include hosted domain in authorization URL when configured', () => {
    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      hostedDomain: 'example.com',
    });

    const url = provider.getAuthorizationUrl!('test-state', 'http://localhost/callback');

    expect(url).toContain('hd=example.com');
  });
});

describe('discord provider', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should create discord provider with correct id and name', () => {
    const provider = discord({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    expect(provider.id).toBe('discord');
    expect(provider.name).toBe('Discord');
    expect(provider.type).toBe('oauth');
  });

  it('should return null when no code is provided', async () => {
    const provider = discord({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const user = await provider.authorize({});

    expect(user).toBeNull();
  });

  it('should generate authorization URL', () => {
    const provider = discord({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const url = provider.getAuthorizationUrl!('test-state', 'http://localhost/callback');

    expect(url).toContain('https://discord.com/api/oauth2/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=test-state');
  });
});

describe('credentials provider', () => {
  it('should create credentials provider with default name', () => {
    const provider = credentials({
      authorize: async () => ({ id: '123' }),
    });

    expect(provider.id).toBe('credentials');
    expect(provider.name).toBe('Credentials');
    expect(provider.type).toBe('credentials');
  });

  it('should create credentials provider with custom name', () => {
    const provider = credentials({
      name: 'Email & Password',
      authorize: async () => ({ id: '123' }),
    });

    expect(provider.name).toBe('Email & Password');
  });

  it('should create credentials provider with custom id', () => {
    const provider = credentials({
      id: 'custom-credentials',
      authorize: async () => ({ id: '123' }),
    });

    expect(provider.id).toBe('custom-credentials');
  });

  it('should call custom authorize function', async () => {
    const authorizeFunc = async (creds: Record<string, unknown>) => {
      if (creds.username === 'admin' && creds.password === 'secret') {
        return { id: 'admin-user', email: 'admin@example.com', roles: ['admin'] };
      }
      return null;
    };

    const provider = credentials({ authorize: authorizeFunc });

    const successUser = await provider.authorize({ username: 'admin', password: 'secret' });
    expect(successUser?.id).toBe('admin-user');
    expect(successUser?.roles).toEqual(['admin']);

    const failUser = await provider.authorize({ username: 'wrong', password: 'wrong' });
    expect(failUser).toBeNull();
  });
});

describe('mock provider', () => {
  it('should create mock provider with correct id and name', () => {
    const provider = mock();

    expect(provider.id).toBe('mock');
    expect(provider.name).toBe('Mock');
    expect(provider.type).toBe('credentials');
  });

  it('should return default user when no config provided', async () => {
    const provider = mock();
    const user = await provider.authorize({});

    expect(user?.id).toBe('mock-user-123');
    expect(user?.email).toBe('mock@example.com');
    expect(user?.name).toBe('Mock User');
    expect(user?.roles).toEqual(['user']);
  });

  it('should return custom user when config provided', async () => {
    const customUser = {
      id: 'custom-id',
      email: 'custom@example.com',
      name: 'Custom Name',
      roles: ['admin', 'super'],
    };

    const provider = mock({ user: customUser });
    const user = await provider.authorize({});

    expect(user?.id).toBe('custom-id');
    expect(user?.email).toBe('custom@example.com');
    expect(user?.name).toBe('Custom Name');
    expect(user?.roles).toEqual(['admin', 'super']);
  });

  it('should return same user regardless of credentials', async () => {
    const provider = mock();

    const user1 = await provider.authorize({});
    const user2 = await provider.authorize({ any: 'credentials' });
    const user3 = await provider.authorize({ email: 'test@example.com', password: 'secret' });

    expect(user1?.id).toBe('mock-user-123');
    expect(user2?.id).toBe('mock-user-123');
    expect(user3?.id).toBe('mock-user-123');
  });

  it('should apply delay when configured', async () => {
    const provider = mock({ delay: 50 });

    const start = Date.now();
    await provider.authorize({});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
  });
});

describe('oauth provider', () => {
  it('should create generic oauth provider', () => {
    const provider = oauth({
      id: 'custom',
      name: 'Custom OAuth',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authorizationUrl: 'https://example.com/oauth/authorize',
      tokenUrl: 'https://example.com/oauth/token',
      userInfoUrl: 'https://example.com/api/user',
    });

    expect(provider.id).toBe('custom');
    expect(provider.name).toBe('Custom OAuth');
    expect(provider.type).toBe('oauth');
  });

  it('should generate authorization URL', () => {
    const provider = oauth({
      id: 'custom',
      name: 'Custom OAuth',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authorizationUrl: 'https://example.com/oauth/authorize',
      tokenUrl: 'https://example.com/oauth/token',
    });

    const url = provider.getAuthorizationUrl!('test-state', 'http://localhost/callback');

    expect(url).toContain('https://example.com/oauth/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=test-state');
  });

  it('should use custom profile mapper', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('example.com/oauth/token')) {
        return new Response(JSON.stringify({ access_token: 'mock-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('example.com/api/user')) {
        return new Response(
          JSON.stringify({ user_id: 'custom-123', display_name: 'Custom User' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const provider = oauth({
      id: 'custom',
      name: 'Custom OAuth',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tokenUrl: 'https://example.com/oauth/token',
      userInfoUrl: 'https://example.com/api/user',
      profile: (profile) => ({
        id: profile.user_id as string,
        name: profile.display_name as string,
      }),
    });

    const user = await provider.authorize({ code: 'auth-code' });

    expect(user?.id).toBe('custom-123');
    expect(user?.name).toBe('Custom User');

    mockFetch.mockRestore();
  });
});

describe('apiKey provider', () => {
  it('should create apiKey provider', () => {
    const provider = apiKey({
      validate: async (key) => {
        if (key === 'valid-key') {
          return { id: 'api-user-123' };
        }
        return null;
      },
    });

    expect(provider.id).toBe('api-key');
    expect(provider.name).toBe('API Key');
    expect(provider.type).toBe('credentials');
  });

  it('should validate API key', async () => {
    const provider = apiKey({
      validate: async (key) => {
        if (key === 'valid-key') {
          return { id: 'api-user-123', roles: ['api-user'] };
        }
        return null;
      },
    });

    const validUser = await provider.authorize({ apiKey: 'valid-key' });
    expect(validUser?.id).toBe('api-user-123');
    expect(validUser?.roles).toEqual(['api-user']);

    const invalidUser = await provider.authorize({ apiKey: 'invalid-key' });
    expect(invalidUser).toBeNull();
  });

  it('should return null when no API key provided', async () => {
    const provider = apiKey({
      validate: async () => ({ id: 'user' }),
    });

    const user = await provider.authorize({});
    expect(user).toBeNull();
  });
});
