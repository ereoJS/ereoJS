# @ereo/auth

Authentication plugin for the EreoJS framework. Provides authentication and authorization with multiple providers, JWT/cookie-based sessions, and role-based access control.

## Installation

```bash
bun add @ereo/auth
```

## Quick Start

```typescript
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
            // Validate credentials and return user
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

## Using Auth in Routes

```typescript
import { useAuth, requireAuth, getSession, getUser } from '@ereo/auth';

// Protect route with requireAuth
export const config = {
  ...requireAuth({ redirect: '/login' }),
};

// Access auth in loader/action
export async function loader({ context }) {
  const auth = useAuth(context);

  if (auth.isAuthenticated()) {
    return { user: auth.getUser() };
  }

  return { user: null };
}

// Sign in
export async function action({ request, context }) {
  const auth = useAuth(context);
  const formData = await request.formData();

  const session = await auth.signIn('credentials', {
    email: formData.get('email'),
    password: formData.get('password'),
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/dashboard',
      'Set-Cookie': auth.getCookieHeader()!,
    },
  });
}
```

## Features

- **Multiple Auth Providers**: `credentials()`, `github()`, `google()`, `discord()`, `oauth()`, `apiKey()`, `mock()`
- **Session Strategies**: JWT (stateless), cookie (server-side), or hybrid
- **Role-Based Access Control**: `hasRole()`, `hasAnyRole()`, `hasAllRoles()`
- **Route Protection**: `requireAuth()`, `requireRoles()`, `optionalAuth()`, `withAuth()`
- **Session Callbacks**: `onSessionCreated`, `onSessionValidate`, `onSignIn`, `onSignOut`, `jwt`, `session`
- **Cookie Configuration**: Secure defaults with full customization
- **TypeScript Support**: Full type safety with exported interfaces

## Exports

```typescript
// Plugin and utilities
import {
  createAuthPlugin,
  requireAuth,
  optionalAuth,
  requireRoles,
  useAuth,
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
} from '@ereo/auth';
```

## AuthContext Methods

| Method | Description |
|--------|-------------|
| `session` | Current session object or null |
| `signIn(provider, credentials)` | Sign in with provider |
| `signOut()` | Sign out current user |
| `isAuthenticated()` | Check if authenticated |
| `hasRole(role)` | Check for specific role |
| `hasAnyRole(roles)` | Check for any of the roles |
| `hasAllRoles(roles)` | Check for all roles |
| `getUser()` | Get current user object |
| `getToken()` | Get JWT token |
| `refreshSession()` | Refresh session expiration |
| `getCookieHeader()` | Get Set-Cookie header for response |

## Session Strategies

| Strategy | Description |
|----------|-------------|
| `'jwt'` | Stateless - session data in signed JWT |
| `'cookie'` | Server-side - session ID in cookie, data in memory |
| `'hybrid'` | JWT with server-side validation for revocation |

## Documentation

For full documentation, see [Auth Plugin API Reference](https://ereojs.dev/docs/api/plugins/auth).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack JavaScript framework.

## License

MIT
