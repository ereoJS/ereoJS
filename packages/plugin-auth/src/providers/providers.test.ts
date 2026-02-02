/**
 * @areo/auth/providers - Provider tests
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { github, google, credentials, mock } from './index';

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
  });

  it('should return null when no code is provided', async () => {
    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const session = await provider.authorize({});

    expect(session).toBeNull();
  });

  it('should return null when code is empty', async () => {
    const provider = github({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const session = await provider.authorize({ code: '' });

    expect(session).toBeNull();
  });

  it('should exchange code for access token and get user info', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'mock-access-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
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

    const session = await provider.authorize({ code: 'auth-code-123' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('12345');
    expect(session?.email).toBe('github@example.com');
    expect(session?.name).toBe('GitHub User');
    expect(session?.claims?.avatar).toBe('https://github.com/avatar.png');
    expect(session?.claims?.username).toBe('githubuser');

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

    const session = await provider.authorize({ code: 'auth-code-123' });

    expect(session?.name).toBe('githubuser');

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

    const session = await provider.authorize({ code: 'invalid-code' });

    expect(session).toBeNull();

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
      if (urlString.includes('api.github.com/user')) {
        return new Response(
          JSON.stringify({ id: 1, login: 'user' }),
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
  });

  it('should return null when no code is provided', async () => {
    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const session = await provider.authorize({});

    expect(session).toBeNull();
  });

  it('should return null when code is empty', async () => {
    const provider = google({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    });

    const session = await provider.authorize({ code: '' });

    expect(session).toBeNull();
  });

  it('should exchange code for access token and get user info', async () => {
    const mockFetch = spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlString = url.toString();
      if (urlString.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'mock-google-token' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlString.includes('googleapis.com/oauth2/v1/userinfo')) {
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

    const session = await provider.authorize({ code: 'google-auth-code' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('google-user-123');
    expect(session?.email).toBe('google@example.com');
    expect(session?.name).toBe('Google User');
    expect(session?.claims?.picture).toBe('https://google.com/avatar.png');
    expect(session?.claims?.verified).toBe(true);

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

    const session = await provider.authorize({ code: 'invalid-code' });

    expect(session).toBeNull();

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
      if (urlString.includes('googleapis.com/oauth2/v1/userinfo')) {
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
      if (urlString.includes('googleapis.com/oauth2/v1/userinfo')) {
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
      if (urlString.includes('googleapis.com/oauth2/v1/userinfo')) {
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
});

describe('credentials provider', () => {
  it('should create credentials provider with default name', () => {
    const provider = credentials({
      authorize: async () => ({ userId: '123' }),
    });

    expect(provider.id).toBe('credentials');
    expect(provider.name).toBe('Credentials');
  });

  it('should create credentials provider with custom name', () => {
    const provider = credentials({
      name: 'Email & Password',
      authorize: async () => ({ userId: '123' }),
    });

    expect(provider.name).toBe('Email & Password');
  });

  it('should call custom authorize function', async () => {
    const authorizeFunc = async (creds: Record<string, unknown>) => {
      if (creds.username === 'admin' && creds.password === 'secret') {
        return { userId: 'admin-user', email: 'admin@example.com', roles: ['admin'] };
      }
      return null;
    };

    const provider = credentials({ authorize: authorizeFunc });

    const successSession = await provider.authorize({ username: 'admin', password: 'secret' });
    expect(successSession?.userId).toBe('admin-user');
    expect(successSession?.roles).toEqual(['admin']);

    const failSession = await provider.authorize({ username: 'wrong', password: 'wrong' });
    expect(failSession).toBeNull();
  });
});

describe('mock provider', () => {
  it('should create mock provider with correct id and name', () => {
    const provider = mock();

    expect(provider.id).toBe('mock');
    expect(provider.name).toBe('Mock');
  });

  it('should return default session when no config provided', async () => {
    const provider = mock();
    const session = await provider.authorize({});

    expect(session?.userId).toBe('mock-user-123');
    expect(session?.email).toBe('mock@example.com');
    expect(session?.name).toBe('Mock User');
    expect(session?.roles).toEqual(['user']);
  });

  it('should return custom session when config provided', async () => {
    const customSession = {
      userId: 'custom-id',
      email: 'custom@example.com',
      name: 'Custom Name',
      roles: ['admin', 'super'],
      claims: { custom: 'value' },
    };

    const provider = mock({ session: customSession });
    const session = await provider.authorize({});

    expect(session).toEqual(customSession);
  });

  it('should return same session regardless of credentials', async () => {
    const provider = mock();

    const session1 = await provider.authorize({});
    const session2 = await provider.authorize({ any: 'credentials' });
    const session3 = await provider.authorize({ email: 'test@example.com', password: 'secret' });

    expect(session1?.userId).toBe('mock-user-123');
    expect(session2?.userId).toBe('mock-user-123');
    expect(session3?.userId).toBe('mock-user-123');
  });
});
