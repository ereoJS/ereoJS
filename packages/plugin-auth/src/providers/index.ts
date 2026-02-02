/**
 * @areo/auth/providers - Built-in authentication providers
 */

import type { AuthProvider, Session } from '../auth';

/** Credentials provider (email/password) */
export function credentials(config: {
  name?: string;
  authorize: (credentials: Record<string, unknown>) => Promise<Session | null>;
}): AuthProvider {
  return {
    id: 'credentials',
    name: config.name || 'Credentials',
    authorize: config.authorize,
  };
}

/** GitHub OAuth provider */
export function github(config: {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}): AuthProvider {
  return {
    id: 'github',
    name: 'GitHub',
    async authorize(credentials) {
      // Exchange code for access token
      const code = credentials.code as string;
      if (!code) return null;

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'User-Agent': 'Areo-Auth',
        },
      });

      const user = await userResponse.json();

      return {
        userId: String(user.id),
        email: user.email,
        name: user.name || user.login,
        claims: {
          avatar: user.avatar_url,
          username: user.login,
        },
      };
    },
  };
}

/** Google OAuth provider */
export function google(config: {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}): AuthProvider {
  return {
    id: 'google',
    name: 'Google',
    async authorize(credentials) {
      const code = credentials.code as string;
      if (!code) return null;

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri || 'postmessage',
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokenData.access_token}`
      );

      const user = await userResponse.json();

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        claims: {
          picture: user.picture,
          verified: user.verified_email,
        },
      };
    },
  };
}

/** Simple mock provider for development */
export function mock(config?: {
  session?: Session;
}): AuthProvider {
  return {
    id: 'mock',
    name: 'Mock',
    async authorize() {
      return (
        config?.session || {
          userId: 'mock-user-123',
          email: 'mock@example.com',
          name: 'Mock User',
          roles: ['user'],
        }
      );
    },
  };
}
