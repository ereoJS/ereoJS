/**
 * @ereo/auth/providers - Built-in authentication providers
 *
 * Provides credential-based and OAuth authentication providers.
 */

import type { AuthProvider, User, Session } from '../auth';

// ============================================================================
// Type Definitions
// ============================================================================

/** Credentials provider configuration */
export interface CredentialsConfig {
  /** Provider display name */
  name?: string;
  /** Custom provider ID (default: 'credentials') */
  id?: string;
  /** Authorize function - receives credentials, returns user or null */
  authorize: (credentials: Record<string, unknown>) => Promise<User | null>;
}

/** OAuth provider base configuration */
export interface OAuthConfig {
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** Redirect URI (callback URL) */
  redirectUri?: string;
  /** OAuth scopes to request */
  scope?: string[];
  /** Authorization URL */
  authorizationUrl?: string;
  /** Token URL */
  tokenUrl?: string;
  /** User info URL */
  userInfoUrl?: string;
}

/** GitHub OAuth configuration */
export interface GitHubConfig extends OAuthConfig {
  /** Allow sign-in with GitHub Enterprise */
  enterprise?: {
    baseUrl: string;
  };
}

/** Google OAuth configuration */
export interface GoogleConfig extends OAuthConfig {
  /** Enable Google Workspace domain restriction */
  hostedDomain?: string;
}

/** Discord OAuth configuration */
export interface DiscordConfig extends OAuthConfig {
  /** Discord guild ID to require membership */
  guildId?: string;
}

/** Generic OAuth provider configuration */
export interface GenericOAuthConfig extends OAuthConfig {
  /** Provider ID */
  id: string;
  /** Provider display name */
  name: string;
  /** Profile URL for fetching user data */
  profileUrl?: string;
  /** Function to map provider profile to User */
  profile?: (profile: Record<string, unknown>, tokens: OAuthTokens) => User | Promise<User>;
}

/** OAuth tokens returned from token exchange */
export interface OAuthTokens {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
}

// ============================================================================
// Credentials Provider
// ============================================================================

/**
 * Credentials provider (email/password or custom authentication).
 *
 * @example
 * ```typescript
 * credentials({
 *   authorize: async ({ email, password }) => {
 *     const user = await db.users.findByEmail(email);
 *     if (user && await bcrypt.compare(password, user.passwordHash)) {
 *       return { id: user.id, email: user.email, roles: user.roles };
 *     }
 *     return null;
 *   }
 * })
 * ```
 */
export function credentials(config: CredentialsConfig): AuthProvider {
  return {
    id: config.id || 'credentials',
    name: config.name || 'Credentials',
    type: 'credentials',
    authorize: config.authorize,
  };
}

// ============================================================================
// GitHub OAuth Provider
// ============================================================================

/**
 * GitHub OAuth provider.
 *
 * @example
 * ```typescript
 * github({
 *   clientId: process.env.GITHUB_CLIENT_ID,
 *   clientSecret: process.env.GITHUB_CLIENT_SECRET,
 * })
 * ```
 */
export function github(config: GitHubConfig): AuthProvider {
  const baseUrl = config.enterprise?.baseUrl || 'https://github.com';
  const apiBaseUrl = config.enterprise?.baseUrl
    ? `${config.enterprise.baseUrl}/api/v3`
    : 'https://api.github.com';

  const authorizationUrl = config.authorizationUrl || `${baseUrl}/login/oauth/authorize`;
  const tokenUrl = config.tokenUrl || `${baseUrl}/login/oauth/access_token`;
  const userInfoUrl = config.userInfoUrl || `${apiBaseUrl}/user`;
  const scope = config.scope || ['read:user', 'user:email'];

  return {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',

    async authorize(credentials) {
      // Handle direct user object from OAuth callback
      if (credentials.user) {
        return credentials.user as User;
      }

      // Handle OAuth code exchange
      const code = credentials.code as string;
      if (!code) return null;

      const tokenResponse = await fetch(tokenUrl, {
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

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'User-Agent': 'Ereo-Auth',
          'Accept': 'application/json',
        },
      });

      const user = await userResponse.json() as Record<string, unknown>;

      // Get user email if not public
      let email = user.email as string | null;
      if (!email) {
        const emailsResponse = await fetch(`${apiBaseUrl}/user/emails`, {
          headers: {
            'Authorization': `token ${tokenData.access_token}`,
            'User-Agent': 'Ereo-Auth',
            'Accept': 'application/json',
          },
        });
        const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primaryEmail = emails.find(e => e.primary && e.verified);
        email = primaryEmail?.email || emails[0]?.email || null;
      }

      return {
        id: String(user.id),
        email: email || undefined,
        name: (user.name || user.login) as string | undefined,
        avatar: user.avatar_url as string | undefined,
        username: user.login as string | undefined,
      };
    },

    getAuthorizationUrl(state: string, redirectUri: string) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: scope.join(' '),
        state,
      });
      return `${authorizationUrl}?${params.toString()}`;
    },

    async handleCallback(params) {
      const { code, redirectUri } = params;

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'User-Agent': 'Ereo-Auth',
          'Accept': 'application/json',
        },
      });

      const user = await userResponse.json() as Record<string, unknown>;

      // Get user email if not public
      let email = user.email as string | null;
      if (!email) {
        const emailsResponse = await fetch(`${apiBaseUrl}/user/emails`, {
          headers: {
            'Authorization': `token ${tokenData.access_token}`,
            'User-Agent': 'Ereo-Auth',
            'Accept': 'application/json',
          },
        });
        const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primaryEmail = emails.find(e => e.primary && e.verified);
        email = primaryEmail?.email || emails[0]?.email || null;
      }

      return {
        id: String(user.id),
        email: email || undefined,
        name: (user.name || user.login) as string | undefined,
        avatar: user.avatar_url as string | undefined,
        username: user.login as string | undefined,
      };
    },
  };
}

// ============================================================================
// Google OAuth Provider
// ============================================================================

/**
 * Google OAuth provider.
 *
 * @example
 * ```typescript
 * google({
 *   clientId: process.env.GOOGLE_CLIENT_ID,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
 * })
 * ```
 */
export function google(config: GoogleConfig): AuthProvider {
  const authorizationUrl = config.authorizationUrl || 'https://accounts.google.com/o/oauth2/v2/auth';
  const tokenUrl = config.tokenUrl || 'https://oauth2.googleapis.com/token';
  const userInfoUrl = config.userInfoUrl || 'https://www.googleapis.com/oauth2/v2/userinfo';
  const scope = config.scope || ['openid', 'email', 'profile'];

  return {
    id: 'google',
    name: 'Google',
    type: 'oauth',

    async authorize(credentials) {
      // Handle direct user object from OAuth callback
      if (credentials.user) {
        return credentials.user as User;
      }

      // Handle OAuth code exchange
      const code = credentials.code as string;
      if (!code) return null;

      // Exchange code for tokens
      const tokenResponse = await fetch(tokenUrl, {
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

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch(
        `${userInfoUrl}?access_token=${tokenData.access_token}`
      );

      const user = await userResponse.json() as Record<string, unknown>;

      // Check hosted domain if configured
      if (config.hostedDomain && user.hd !== config.hostedDomain) {
        return null;
      }

      return {
        id: user.id as string,
        email: user.email as string | undefined,
        name: user.name as string | undefined,
        picture: user.picture as string | undefined,
        emailVerified: user.verified_email as boolean | undefined,
      };
    },

    getAuthorizationUrl(state: string, redirectUri: string) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope.join(' '),
        state,
        access_type: 'offline',
        prompt: 'consent',
      });

      if (config.hostedDomain) {
        params.set('hd', config.hostedDomain);
      }

      return `${authorizationUrl}?${params.toString()}`;
    },

    async handleCallback(params) {
      const { code, redirectUri } = params;

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch(
        `${userInfoUrl}?access_token=${tokenData.access_token}`
      );

      const user = await userResponse.json() as Record<string, unknown>;

      // Check hosted domain if configured
      if (config.hostedDomain && user.hd !== config.hostedDomain) {
        return null;
      }

      return {
        id: user.id as string,
        email: user.email as string | undefined,
        name: user.name as string | undefined,
        picture: user.picture as string | undefined,
        emailVerified: user.verified_email as boolean | undefined,
      };
    },
  };
}

// ============================================================================
// Discord OAuth Provider
// ============================================================================

/**
 * Discord OAuth provider.
 *
 * @example
 * ```typescript
 * discord({
 *   clientId: process.env.DISCORD_CLIENT_ID,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET,
 * })
 * ```
 */
export function discord(config: DiscordConfig): AuthProvider {
  const authorizationUrl = config.authorizationUrl || 'https://discord.com/api/oauth2/authorize';
  const tokenUrl = config.tokenUrl || 'https://discord.com/api/oauth2/token';
  const userInfoUrl = config.userInfoUrl || 'https://discord.com/api/users/@me';
  const scope = config.scope || ['identify', 'email'];

  return {
    id: 'discord',
    name: 'Discord',
    type: 'oauth',

    async authorize(credentials) {
      // Handle direct user object from OAuth callback
      if (credentials.user) {
        return credentials.user as User;
      }

      // Handle OAuth code exchange
      const code = credentials.code as string;
      if (!code) return null;

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri || '',
        }),
      });

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const user = await userResponse.json() as Record<string, unknown>;

      // Check guild membership if configured
      if (config.guildId) {
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });
        const guilds = await guildsResponse.json() as Array<{ id: string }>;
        const isMember = guilds.some(g => g.id === config.guildId);
        if (!isMember) return null;
      }

      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null;

      return {
        id: user.id as string,
        email: user.email as string | undefined,
        name: user.username as string | undefined,
        avatar: avatarUrl || undefined,
        discriminator: user.discriminator as string | undefined,
      };
    },

    getAuthorizationUrl(state: string, redirectUri: string) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope.join(' '),
        state,
      });
      return `${authorizationUrl}?${params.toString()}`;
    },

    async handleCallback(params) {
      const { code, redirectUri } = params;

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userResponse = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const user = await userResponse.json() as Record<string, unknown>;

      // Check guild membership if configured
      if (config.guildId) {
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });
        const guilds = await guildsResponse.json() as Array<{ id: string }>;
        const isMember = guilds.some(g => g.id === config.guildId);
        if (!isMember) return null;
      }

      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null;

      return {
        id: user.id as string,
        email: user.email as string | undefined,
        name: user.username as string | undefined,
        avatar: avatarUrl || undefined,
        discriminator: user.discriminator as string | undefined,
      };
    },
  };
}

// ============================================================================
// Generic OAuth Provider
// ============================================================================

/**
 * Generic OAuth provider for any OAuth 2.0 service.
 *
 * @example
 * ```typescript
 * oauth({
 *   id: 'custom',
 *   name: 'Custom OAuth',
 *   clientId: process.env.OAUTH_CLIENT_ID,
 *   clientSecret: process.env.OAUTH_CLIENT_SECRET,
 *   authorizationUrl: 'https://example.com/oauth/authorize',
 *   tokenUrl: 'https://example.com/oauth/token',
 *   userInfoUrl: 'https://example.com/api/user',
 *   profile: (profile) => ({
 *     id: profile.sub,
 *     email: profile.email,
 *     name: profile.name,
 *   }),
 * })
 * ```
 */
export function oauth(config: GenericOAuthConfig): AuthProvider {
  const scope = config.scope || [];

  return {
    id: config.id,
    name: config.name,
    type: 'oauth',

    async authorize(credentials) {
      // Handle direct user object from OAuth callback
      if (credentials.user) {
        return credentials.user as User;
      }

      // Handle OAuth code exchange
      const code = credentials.code as string;
      if (!code || !config.tokenUrl) return null;

      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri || '',
        }),
      });

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userInfoUrl = config.userInfoUrl || config.profileUrl;
      if (!userInfoUrl) {
        return null;
      }

      const userResponse = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const profile = await userResponse.json() as Record<string, unknown>;

      // Map profile to user
      if (config.profile) {
        return config.profile(profile, tokenData);
      }

      // Default mapping
      return {
        id: (profile.id || profile.sub || profile.user_id) as string,
        email: profile.email as string | undefined,
        name: (profile.name || profile.username) as string | undefined,
      };
    },

    getAuthorizationUrl(state: string, redirectUri: string) {
      if (!config.authorizationUrl) {
        throw new Error(`Authorization URL not configured for provider: ${config.id}`);
      }

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
      });

      if (scope.length > 0) {
        params.set('scope', scope.join(' '));
      }

      return `${config.authorizationUrl}?${params.toString()}`;
    },

    async handleCallback(params) {
      const { code, redirectUri } = params;

      if (!config.tokenUrl) {
        throw new Error(`Token URL not configured for provider: ${config.id}`);
      }

      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json() as OAuthTokens;
      if (!tokenData.access_token) return null;

      // Get user info
      const userInfoUrl = config.userInfoUrl || config.profileUrl;
      if (!userInfoUrl) {
        return null;
      }

      const userResponse = await fetch(userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const profile = await userResponse.json() as Record<string, unknown>;

      // Map profile to user
      if (config.profile) {
        return config.profile(profile, tokenData);
      }

      // Default mapping
      return {
        id: (profile.id || profile.sub || profile.user_id) as string,
        email: profile.email as string | undefined,
        name: (profile.name || profile.username) as string | undefined,
      };
    },
  };
}

// ============================================================================
// Mock Provider (Development)
// ============================================================================

/** Mock provider configuration */
export interface MockConfig {
  /** Pre-configured session to return */
  session?: Session;
  /** Pre-configured user to return */
  user?: User;
  /** Delay before returning (for testing loading states) */
  delay?: number;
}

/**
 * Simple mock provider for development and testing.
 *
 * @example
 * ```typescript
 * mock({
 *   user: { id: 'test-123', email: 'test@example.com', roles: ['admin'] }
 * })
 * ```
 */
export function mock(config?: MockConfig): AuthProvider {
  return {
    id: 'mock',
    name: 'Mock',
    type: 'credentials',

    async authorize() {
      // Apply optional delay
      if (config?.delay) {
        await new Promise(resolve => setTimeout(resolve, config.delay));
      }

      // Return user or session
      if (config?.user) {
        return config.user;
      }

      if (config?.session) {
        return {
          id: config.session.userId,
          email: config.session.email,
          name: config.session.name,
          roles: config.session.roles,
          ...config.session.claims,
        };
      }

      // Default mock user
      return {
        id: 'mock-user-123',
        email: 'mock@example.com',
        name: 'Mock User',
        roles: ['user'],
      };
    },
  };
}

// ============================================================================
// API Key Provider
// ============================================================================

/** API Key provider configuration */
export interface ApiKeyConfig {
  /** Function to validate API key and return user */
  validate: (apiKey: string) => Promise<User | null>;
  /** Header name to check (default: 'x-api-key') */
  header?: string;
  /** Query parameter name to check */
  queryParam?: string;
}

/**
 * API Key authentication provider.
 *
 * @example
 * ```typescript
 * apiKey({
 *   validate: async (key) => {
 *     const apiKey = await db.apiKeys.findByKey(key);
 *     if (apiKey && !apiKey.expired) {
 *       return { id: apiKey.userId, roles: apiKey.scopes };
 *     }
 *     return null;
 *   }
 * })
 * ```
 */
export function apiKey(config: ApiKeyConfig): AuthProvider {
  return {
    id: 'api-key',
    name: 'API Key',
    type: 'credentials',

    async authorize(credentials) {
      const key = credentials.apiKey as string;
      if (!key) return null;

      return config.validate(key);
    },
  };
}
