# @ereo/auth

Authentication plugin for the EreoJS framework. Provides complete authentication and authorization with multiple providers, JWT-based sessions, and role-based access control.

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
        secret: process.env.AUTH_SECRET,
        strategy: 'jwt',
      },
      providers: [
        credentials({
          authorize: async ({ email, password }) => {
            // Validate credentials and return user
            return { id: '1', email, roles: ['user'] };
          },
        }),
        github({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        }),
      ],
    }),
  ],
});
```

## Key Features

- **Multiple Auth Providers**: Support for credentials, GitHub, Google, Discord, and generic OAuth 2.0
- **JWT-based Sessions**: Secure session management with configurable expiration
- **Cookie and Hybrid Strategies**: Flexible session storage options
- **Role-based Access Control (RBAC)**: Protect routes based on user roles
- **Protected Routes Middleware**: Easy route protection with `requireAuth()` and `requireRoles()`
- **Session Callbacks**: Customize session creation and validation
- **API Key Authentication**: Support for API key-based authentication
- **TypeScript Support**: Full type safety with exported types

## Documentation

For full documentation, visit the [EreoJS Documentation](https://ereojs.dev/docs/plugins/auth).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack JavaScript framework.

## License

MIT
