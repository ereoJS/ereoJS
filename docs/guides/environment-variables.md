# Environment Variables

This guide covers environment variable management in EreoJS.

## Basics

EreoJS loads environment variables from `.env` files automatically.

### File Loading Order

1. `.env` - Base variables (committed)
2. `.env.local` - Local overrides (gitignored)
3. `.env.{mode}` - Mode-specific (e.g., `.env.production`)
4. `.env.{mode}.local` - Mode-specific local (gitignored)

Later files override earlier ones.

### Example Files

```bash
# .env - Base configuration
DATABASE_URL=postgres://localhost/myapp_dev
API_URL=http://localhost:3001

# .env.local - Local secrets (gitignored)
SESSION_SECRET=my-local-secret

# .env.production - Production settings
DATABASE_URL=postgres://prod-server/myapp
API_URL=https://api.example.com

# .env.production.local - Production secrets (gitignored)
SESSION_SECRET=super-secret-production-key
```

## Type-Safe Environment

### Define a Schema

```ts
// src/lib/env.ts
import { env, setupEnv, initializeEnv } from '@ereo/core'

export const envSchema = {
  // Required variables
  DATABASE_URL: env.string(),
  SESSION_SECRET: env.string().validate(s => s.length >= 32),

  // With defaults
  PORT: env.port().default(3000),
  NODE_ENV: env.enum(['development', 'production', 'test']).default('development'),

  // Optional
  SENTRY_DSN: env.url().optional(),

  // Public (exposed to client)
  PUBLIC_API_URL: env.string().public(),
  PUBLIC_APP_NAME: env.string().default('My App').public(),

  // Complex types
  FEATURE_FLAGS: env.json<{ beta: boolean }>().default({ beta: false }),
  ALLOWED_ORIGINS: env.array().default([])
}

export type Env = typeof envSchema
```

### Initialize Environment

```ts
// src/index.ts
import { setupEnv, initializeEnv } from '@ereo/core'
import { envSchema } from './lib/env'

async function main() {
  // Validate and load environment
  const result = await setupEnv('.', envSchema, process.env.NODE_ENV)

  if (!result.success) {
    console.error('Environment validation failed:')
    result.errors.forEach(e => console.error(`  ${e.key}: ${e.message}`))
    process.exit(1)
  }

  // Make available globally
  initializeEnv(result.data)

  // Now start the app
  // ...
}

main()
```

### Accessing Variables

```ts
import { getEnv, requireEnv } from '@ereo/core'

// Optional access
const sentryDsn = getEnv<string>('SENTRY_DSN')

// Required access (throws if missing)
const dbUrl = requireEnv<string>('DATABASE_URL')

// In components/routes
export const loader = createLoader(async () => {
  const apiUrl = requireEnv<string>('PUBLIC_API_URL')
  const data = await fetch(`${apiUrl}/posts`)
  return { posts: await data.json() }
})
```

## Public vs Private Variables

### Private Variables

Only available on the server:

```ts
// Only in loaders, actions, API routes
const dbUrl = requireEnv<string>('DATABASE_URL')
const secret = requireEnv<string>('SESSION_SECRET')
```

### Public Variables

Available on both server and client:

```ts
// Schema
PUBLIC_API_URL: env.string().public()

// Usage - works everywhere
const apiUrl = requireEnv<string>('PUBLIC_API_URL')
```

Convention: Prefix with `PUBLIC_` for clarity.

### Exposing to Client

```tsx
// routes/_layout.tsx
import { getPublicEnv } from '@ereo/core'
import { envSchema } from '../lib/env'

export const loader = createLoader(async () => {
  const publicEnv = getPublicEnv(envSchema)
  return { env: publicEnv }
})

export default function Layout({ children, loaderData }) {
  return (
    <html>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(loaderData.env)}`
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

Access in islands:

```tsx
// islands/SomeComponent.tsx
function getPublicEnv(key: string) {
  if (typeof window !== 'undefined') {
    return window.__ENV__?.[key]
  }
  return process.env[key]
}

export default function SomeComponent() {
  const apiUrl = getPublicEnv('PUBLIC_API_URL')
  // ...
}
```

## Schema Types

### String

```ts
DATABASE_URL: env.string()
```

### Number

```ts
MAX_ITEMS: env.number().default(100)
```

### Boolean

```ts
DEBUG: env.boolean().default(false)
// Accepts: true, false, 1, 0, yes, no
```

### Port

```ts
PORT: env.port().default(3000)
// Validates 1-65535
```

### URL

```ts
API_URL: env.url()
// Validates URL format
```

### Enum

```ts
LOG_LEVEL: env.enum(['debug', 'info', 'warn', 'error']).default('info')
```

### Array

```ts
ALLOWED_ORIGINS: env.array().default([])
// Parses comma-separated: "a,b,c" → ["a", "b", "c"]
```

### JSON

```ts
FEATURE_FLAGS: env.json<{ beta: boolean; newUI: boolean }>()
// Parses JSON string
```

## Validation

### Required vs Optional

```ts
// Required (throws if missing)
DATABASE_URL: env.string()

// Optional (undefined if missing)
SENTRY_DSN: env.string().optional()

// With default (uses default if missing)
PORT: env.port().default(3000)
```

### Custom Validation

```ts
// Minimum length
SESSION_SECRET: env.string().validate(s => s.length >= 32)

// Pattern matching
API_KEY: env.string().validate(s => /^sk_/.test(s))

// Custom error message
DATABASE_URL: env.string().validate(
  s => s.startsWith('postgres://'),
  'Must be a PostgreSQL connection string'
)
```

### Transform

```ts
// Parse to number
TIMEOUT_MS: env.string().transform(s => parseInt(s) * 1000)

// Parse JSON
CONFIG: env.string().transform(s => JSON.parse(s))
```

## Generate TypeScript Types

```ts
import { generateEnvTypes } from '@ereo/core'
import { envSchema } from './lib/env'

const types = generateEnvTypes(envSchema)
await Bun.write('src/env.d.ts', types)
```

Output:

```ts
// src/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    SESSION_SECRET: string
    PORT?: string
    NODE_ENV?: 'development' | 'production' | 'test'
    PUBLIC_API_URL: string
    // ...
  }
}
```

## Best Practices

1. **Never commit secrets** - Add `.env.local` to `.gitignore`
2. **Use PUBLIC_ prefix** - For client-exposed variables
3. **Validate early** - Fail fast on missing/invalid config
4. **Type your env** - Use schema for type safety
5. **Document variables** - List required vars in README
6. **Use defaults wisely** - Development defaults, required in production
7. **Rotate secrets** - Change production secrets periodically

## Example .gitignore

```gitignore
# Environment files
.env.local
.env.*.local
.env.production

# Keep .env and .env.development as templates
!.env
!.env.development
```
