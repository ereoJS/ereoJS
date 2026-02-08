# Auth Plugin

Authentication plugin for EreoJS applications. Provides authentication and authorization with multiple providers, JWT/cookie-based sessions, and role-based access control.

## Installation

```bash
bun add @ereo/auth
```

## Setup

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createAuthPlugin, credentials, github } from '@ereo/auth';

export default defineConfig({
  plugins: [
    createAuthPlugin({
      session: {
        secret: process.env.AUTH_SECRET!,
        strategy: 'jwt',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      },
      providers: [
        credentials({
          authorize: async ({ email, password }) => {
            const user = await db.users.findByEmail(email);
            if (user && await bcrypt.compare(password, user.passwordHash)) {
              return { id: user.id, email: user.email, roles: user.roles };
            }
            return null;
          },
        }),
        github({
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }),
      ],
    }),
  ],
});
```

## Exports

All exports are available from the main `@ereo/auth` package:

```ts
// Main plugin and utilities
import {
  createAuthPlugin,
  requireAuth,
  optionalAuth,
  requireRoles,
  getAuth,
  getSession,
  getUser,
  withAuth,
  getOAuthUrl,
  handleOAuthCallback,
} from '@ereo/auth';

// Providers
import {
  credentials,
  github,
  google,
  discord,
  oauth,
  mock,
  apiKey,
} from '@ereo/auth';

// Types
import type {
  User,
  Session,
  JWTPayload,
  AuthProvider,
  SessionStrategy,
  SessionConfig,
  AuthConfig,
  AuthContext,
  CredentialsConfig,
  OAuthConfig,
  GitHubConfig,
  GoogleConfig,
  DiscordConfig,
  GenericOAuthConfig,
  OAuthTokens,
  MockConfig,
  ApiKeyConfig,
} from '@ereo/auth';
```

## Configuration

### AuthConfig

```ts
interface AuthConfig {
  /** Session secret for signing cookies/JWT (deprecated, use session.secret) */
  secret?: string;
  /** Session duration in seconds (deprecated, use session.maxAge) */
  sessionDuration?: number;
  /** Authentication providers */
  providers?: AuthProvider[];
  /** Session configuration */
  session?: SessionConfig;
  /** Callbacks for customization */
  callbacks?: {
    /** Called when session is created */
    onSessionCreated?: (session: Session) => Promise<Session> | Session;
    /** Called to validate session */
    onSessionValidate?: (session: Session) => Promise<boolean> | boolean;
    /** Called when user signs in */
    onSignIn?: (user: User) => Promise<void> | void;
    /** Called when user signs out */
    onSignOut?: (session: Session) => Promise<void> | void;
    /** Called to generate JWT payload from session */
    jwt?: (params: { token: JWTPayload; user?: User; session?: Session }) => Promise<JWTPayload> | JWTPayload;
    /** Called to generate session from JWT payload */
    session?: (params: { token: JWTPayload; session: Session }) => Promise<Session> | Session;
  };
  /** Cookie configuration */
  cookie?: {
    name?: string;        // Default: 'ereo.session'
    secure?: boolean;     // Default: true in production
    sameSite?: 'strict' | 'lax' | 'none';  // Default: 'lax'
    domain?: string;
    path?: string;        // Default: '/'
    httpOnly?: boolean;   // Default: true
  };
  /** Debug mode */
  debug?: boolean;
}
```

### SessionConfig

```ts
interface SessionConfig {
  /** Session strategy: 'jwt', 'cookie', or 'hybrid' */
  strategy?: SessionStrategy;
  /** Session max age in seconds (default: 7 days) */
  maxAge?: number;
  /** Secret for signing JWT/cookies (required) */
  secret: string;
  /** Session update age - refresh session if older than this (seconds) */
  updateAge?: number;
}
```

### Session Strategies

The plugin supports three session strategies:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `'jwt'` | Session data stored entirely in a signed JWT token. Stateless - no server-side session storage required. | API-first apps, microservices, horizontal scaling |
| `'cookie'` | Session ID stored in cookie, session data stored in server memory. | Traditional web apps with single server |
| `'hybrid'` | JWT token in cookie with session validation against server-side store. Provides stateless benefits with revocation capability. | Apps needing immediate session invalidation |

```ts
createAuthPlugin({
  session: {
    secret: process.env.AUTH_SECRET!,
    strategy: 'jwt',      // or 'cookie' or 'hybrid'
    maxAge: 7 * 24 * 60 * 60,  // 7 days
    updateAge: 24 * 60 * 60,    // Refresh after 1 day
  },
  // ...
});
```

## TypeScript Interfaces

### User

```ts
interface User {
  /** User ID */
  id: string;
  /** User email */
  email?: string;
  /** User name */
  name?: string;
  /** User roles for RBAC */
  roles?: string[];
  /** Custom user data */
  [key: string]: unknown;
}
```

### Session

```ts
interface Session {
  /** User ID */
  userId: string;
  /** User email */
  email?: string;
  /** User name */
  name?: string;
  /** User roles */
  roles?: string[];
  /** Custom claims */
  claims?: Record<string, unknown>;
  /** Session expiration */
  expiresAt?: Date;
  /** Session ID for in-memory tracking */
  sessionId?: string;
  /** Issued at timestamp */
  issuedAt?: Date;
  /** Provider used for authentication */
  provider?: string;
}
```

### JWTPayload

```ts
interface JWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** Session ID */
  sid?: string;
  /** Custom claims */
  [key: string]: unknown;
}
```

### AuthProvider

```ts
interface AuthProvider {
  /** Provider ID */
  id: string;
  /** Provider name */
  name: string;
  /** Provider type */
  type: 'credentials' | 'oauth';
  /** Authorize/authenticate user */
  authorize(credentials: Record<string, unknown>): Promise<User | null>;
  /** Get OAuth authorization URL (for OAuth providers) */
  getAuthorizationUrl?(state: string, redirectUri: string): string;
  /** Handle OAuth callback (for OAuth providers) */
  handleCallback?(params: { code: string; state: string; redirectUri: string }): Promise<User | null>;
}
```

### AuthContext

The `AuthContext` is available in route handlers via `context.get('auth')` or using the `getAuth()` helper:

```ts
interface AuthContext {
  /** Current session (if authenticated) */
  session: Session | null;
  /** Sign in with credentials */
  signIn: (provider: string, credentials: Record<string, unknown>) => Promise<Session>;
  /** Sign out current user */
  signOut: () => Promise<void>;
  /** Check if user is authenticated */
  isAuthenticated: () => boolean;
  /** Check if user has role */
  hasRole: (role: string) => boolean;
  /** Check if user has any of the roles */
  hasAnyRole: (roles: string[]) => boolean;
  /** Check if user has all of the roles */
  hasAllRoles: (roles: string[]) => boolean;
  /** Get the current user */
  getUser: () => User | null;
  /** Get session token (JWT) */
  getToken: () => Promise<string | null>;
  /** Refresh the session */
  refreshSession: () => Promise<Session | null>;
  /** Get Set-Cookie header value for response */
  getCookieHeader: () => string | null;
}
```

## Providers

### credentials()

Email/password or custom credential authentication.

```ts
import { credentials } from '@ereo/auth';

interface CredentialsConfig {
  /** Provider display name */
  name?: string;
  /** Custom provider ID (default: 'credentials') */
  id?: string;
  /** Authorize function - receives credentials, returns user or null */
  authorize: (credentials: Record<string, unknown>) => Promise<User | null>;
}

// Usage
credentials({
  authorize: async ({ email, password }) => {
    const user = await db.users.findByEmail(email);
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      return { id: user.id, email: user.email, roles: user.roles };
    }
    return null;
  },
});
```

### github()

GitHub OAuth provider.

```ts
import { github } from '@ereo/auth';

interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string[];  // Default: ['read:user', 'user:email']
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  enterprise?: {
    baseUrl: string;
  };
}

// Usage
github({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
});

// GitHub Enterprise
github({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  enterprise: {
    baseUrl: 'https://github.mycompany.com',
  },
});
```

### google()

Google OAuth provider.

```ts
import { google } from '@ereo/auth';

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string[];  // Default: ['openid', 'email', 'profile']
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  hostedDomain?: string;  // Restrict to Google Workspace domain
}

// Usage
google({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
});

// Restrict to company domain
google({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  hostedDomain: 'mycompany.com',
});
```

### discord()

Discord OAuth provider.

```ts
import { discord } from '@ereo/auth';

interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string[];  // Default: ['identify', 'email']
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  guildId?: string;  // Require membership in specific Discord server
}

// Usage
discord({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
});

// Require guild membership
discord({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  guildId: '123456789',
});
```

### oauth()

Generic OAuth 2.0 provider for any service.

```ts
import { oauth } from '@ereo/auth';

interface GenericOAuthConfig {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  profileUrl?: string;
  profile?: (profile: Record<string, unknown>, tokens: OAuthTokens) => User | Promise<User>;
}

// Usage
oauth({
  id: 'custom',
  name: 'Custom OAuth',
  clientId: process.env.OAUTH_CLIENT_ID!,
  clientSecret: process.env.OAUTH_CLIENT_SECRET!,
  authorizationUrl: 'https://example.com/oauth/authorize',
  tokenUrl: 'https://example.com/oauth/token',
  userInfoUrl: 'https://example.com/api/user',
  profile: (profile) => ({
    id: profile.sub as string,
    email: profile.email as string,
    name: profile.name as string,
  }),
});
```

### mock()

Mock provider for development and testing.

```ts
import { mock } from '@ereo/auth';

interface MockConfig {
  /** Pre-configured user to return */
  user?: User;
  /** Pre-configured session to return */
  session?: Session;
  /** Delay before returning (for testing loading states) */
  delay?: number;
}

// Usage - returns default mock user
mock();

// Usage - custom user
mock({
  user: { id: 'test-123', email: 'test@example.com', roles: ['admin'] },
});

// Usage - with delay for testing loading states
mock({
  user: { id: 'test-123', email: 'test@example.com' },
  delay: 1000,
});
```

### apiKey()

API key authentication provider.

```ts
import { apiKey } from '@ereo/auth';

interface ApiKeyConfig {
  /** Function to validate API key and return user */
  validate: (apiKey: string) => Promise<User | null>;
  /** Header name to check (default: 'x-api-key') */
  header?: string;
  /** Query parameter name to check */
  queryParam?: string;
}

// Usage
apiKey({
  validate: async (key) => {
    const apiKey = await db.apiKeys.findByKey(key);
    if (apiKey && !apiKey.expired) {
      return { id: apiKey.userId, roles: apiKey.scopes };
    }
    return null;
  },
});
```

## Using Auth in Routes

### Get Auth Context

Use the `getAuth()` helper to access the auth context in loaders and actions:

```ts
import { getAuth } from '@ereo/auth';

export async function loader({ context }) {
  const auth = getAuth(context);

  if (!auth.isAuthenticated()) {
    return { user: null };
  }

  return { user: auth.getUser() };
}
```

### Get Session Directly

```ts
import { getSession } from '@ereo/auth';

export async function loader({ context }) {
  const session = getSession(context);

  if (!session) {
    return { user: null };
  }

  return {
    userId: session.userId,
    email: session.email,
    roles: session.roles,
  };
}
```

### Get User Directly

```ts
import { getUser } from '@ereo/auth';

export async function loader({ context }) {
  const user = getUser(context);
  return { user };
}
```

### Protect Routes with requireAuth()

```ts
import { requireAuth } from '@ereo/auth';

export const config = {
  ...requireAuth(),
};

export async function loader({ context }) {
  // User is guaranteed to be authenticated here
  const auth = getAuth(context);
  return { user: auth.getUser() };
}
```

With redirect:

```ts
export const config = {
  ...requireAuth({
    redirect: '/login',
  }),
};
```

With custom unauthorized response:

```ts
export const config = {
  ...requireAuth({
    unauthorizedResponse: {
      status: 401,
      body: { error: 'Authentication required' },
    },
  }),
};
```

### Protect Routes with requireRoles()

```ts
import { requireRoles } from '@ereo/auth';

// Require any of the specified roles (OR logic)
export const config = {
  ...requireRoles(['admin', 'moderator']),
};

// Require all of the specified roles (AND logic)
export const config = {
  ...requireRoles(['admin', 'verified'], { requireAll: true }),
};
```

### Optional Auth

Allow both authenticated and anonymous access:

```ts
import { optionalAuth } from '@ereo/auth';

export const config = {
  ...optionalAuth(),
};

export async function loader({ context }) {
  const auth = getAuth(context);

  if (auth.isAuthenticated()) {
    return { user: auth.getUser(), personalized: true };
  }

  return { user: null, personalized: false };
}
```

### Using withAuth() Wrapper

```ts
import { withAuth } from '@ereo/auth';

export const loader = withAuth(
  async ({ request, context, auth, params }) => {
    // auth is guaranteed to exist and be authenticated
    const user = auth.getUser();
    return { user };
  },
  { roles: ['admin'] }  // Optional: require specific roles
);
```

## Sign In / Sign Out

### Sign In Action

```ts
import { getAuth } from '@ereo/auth';

export async function action({ request, context }) {
  const auth = getAuth(context);
  const formData = await request.formData();

  try {
    const session = await auth.signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
    });

    // Get the cookie header to include in response
    const cookieHeader = auth.getCookieHeader();

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Set-Cookie': cookieHeader } : {}),
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### Sign Out Action

```ts
import { getAuth } from '@ereo/auth';

export async function action({ context }) {
  const auth = getAuth(context);
  await auth.signOut();

  const cookieHeader = auth.getCookieHeader();

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      ...(cookieHeader ? { 'Set-Cookie': cookieHeader } : {}),
    },
  });
}
```

## OAuth Flow

### Get OAuth URL

```ts
import { getOAuthUrl } from '@ereo/auth';

export async function loader({ context }) {
  const githubUrl = getOAuthUrl(context, 'github', 'http://localhost:3000/auth/callback/github');

  return { githubUrl };
}
```

### Handle OAuth Callback

```ts
import { handleOAuthCallback, getAuth } from '@ereo/auth';

export async function loader({ request, context }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  try {
    const session = await handleOAuthCallback(context, 'github', {
      code,
      state,
      redirectUri: 'http://localhost:3000/auth/callback/github',
    });

    const auth = getAuth(context);
    const cookieHeader = auth.getCookieHeader();

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/dashboard',
        ...(cookieHeader ? { 'Set-Cookie': cookieHeader } : {}),
      },
    });
  } catch (error) {
    return new Response('OAuth authentication failed', { status: 401 });
  }
}
```

## Callbacks

### onSessionCreated

Customize session data when created:

```ts
createAuthPlugin({
  callbacks: {
    onSessionCreated: async (session) => {
      // Add custom claims
      const permissions = await db.permissions.getForUser(session.userId);
      return {
        ...session,
        claims: {
          ...session.claims,
          permissions,
        },
      };
    },
  },
});
```

### onSessionValidate

Validate session on each request:

```ts
createAuthPlugin({
  callbacks: {
    onSessionValidate: async (session) => {
      // Check if user still exists
      const user = await db.users.findById(session.userId);
      return user !== null && !user.banned;
    },
  },
});
```

### onSignIn

Execute logic after successful sign in:

```ts
createAuthPlugin({
  callbacks: {
    onSignIn: async (user) => {
      await db.users.updateLastLogin(user.id);
      await analytics.track('user_signed_in', { userId: user.id });
    },
  },
});
```

### onSignOut

Execute logic after sign out:

```ts
createAuthPlugin({
  callbacks: {
    onSignOut: async (session) => {
      await analytics.track('user_signed_out', { userId: session.userId });
    },
  },
});
```

### jwt

Customize JWT token payload:

```ts
createAuthPlugin({
  callbacks: {
    jwt: async ({ token, user, session }) => {
      if (user) {
        // Add custom claims on sign in
        token.customClaim = 'value';
      }
      return token;
    },
  },
});
```

### session

Customize session from JWT:

```ts
createAuthPlugin({
  callbacks: {
    session: async ({ token, session }) => {
      // Add custom data to session from JWT
      session.claims = {
        ...session.claims,
        customClaim: token.customClaim,
      };
      return session;
    },
  },
});
```

## Cookie Configuration

```ts
createAuthPlugin({
  cookie: {
    name: 'ereo.session',     // Cookie name
    secure: true,              // HTTPS only (default: true in production)
    httpOnly: true,            // Not accessible via JavaScript (default: true)
    sameSite: 'lax',           // CSRF protection (default: 'lax')
    domain: '.example.com',    // Cookie domain
    path: '/',                 // Cookie path (default: '/')
  },
});
```

## Role-Based Access Control

### Check Roles in Handlers

```ts
export async function loader({ context }) {
  const auth = getAuth(context);

  if (!auth.hasRole('admin')) {
    throw new Response('Forbidden', { status: 403 });
  }

  // Admin-only logic
  return { adminData: await getAdminData() };
}
```

### Check Multiple Roles

```ts
// Has ANY of the roles
if (auth.hasAnyRole(['admin', 'moderator'])) {
  // User is admin OR moderator
}

// Has ALL of the roles
if (auth.hasAllRoles(['verified', 'premium'])) {
  // User is verified AND premium
}
```

## Debug Mode

Enable debug logging:

```ts
createAuthPlugin({
  debug: true,  // Logs auth events to console
  // ...
});
```

## Related

- [Authentication Guide](/guides/authentication)
- [Middleware](/api/router/middleware)
