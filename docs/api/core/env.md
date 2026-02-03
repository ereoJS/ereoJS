# Environment Variables

Ereo provides type-safe environment variable handling with validation and schema support.

## Import

```ts
import {
  env,
  parseEnvFile,
  loadEnvFiles,
  validateEnv,
  setupEnv,
  initializeEnv,
  getEnv,
  requireEnv,
  getAllEnv,
  getPublicEnv,
  generateEnvTypes,
  typedEnv
} from '@ereo/core'
```

## env Schema Builder

Build typed environment variable schemas.

### Available Types

```ts
env.string()    // String value
env.number()    // Numeric value
env.boolean()   // Boolean value
env.json<T>()   // JSON-parsed value
env.array()     // Comma-separated array
env.enum(values) // Enumerated values
env.url()       // URL string
env.port()      // Port number (1-65535)
```

### Schema Builder Methods

Each type returns a builder with these methods:

```ts
interface EnvSchemaBuilder<T> {
  // Make the variable optional
  optional(): EnvSchemaBuilder<T | undefined>

  // Set a default value
  default(value: T): EnvSchemaBuilder<T>

  // Mark as public (exposed to client)
  public(): EnvSchemaBuilder<T>

  // Add custom validation
  validate(fn: (value: T) => boolean): EnvSchemaBuilder<T>

  // Transform the value
  transform<U>(fn: (value: T) => U): EnvSchemaBuilder<U>
}
```

### Example Schema

```ts
// env.config.ts
import { env } from '@ereo/core'

export const envSchema = {
  // Required string
  DATABASE_URL: env.string(),

  // Optional with default
  PORT: env.port().default(3000),

  // Boolean
  DEBUG: env.boolean().default(false),

  // Enum
  NODE_ENV: env.enum(['development', 'production', 'test']).default('development'),

  // Public (exposed to client)
  PUBLIC_API_URL: env.string().public(),

  // JSON object
  FEATURE_FLAGS: env.json<{ beta: boolean }>().default({ beta: false }),

  // Array
  ALLOWED_ORIGINS: env.array().default([]),

  // With custom validation
  API_KEY: env.string().validate(key => key.length >= 32),

  // Optional
  SENTRY_DSN: env.url().optional()
}
```

## parseEnvFile

Parses a `.env` file string into key-value pairs.

### Signature

```ts
function parseEnvFile(content: string): Record<string, string>
```

### Example

```ts
const content = `
DATABASE_URL=postgres://localhost/mydb
PORT=3000
DEBUG=true
`

const parsed = parseEnvFile(content)
// { DATABASE_URL: 'postgres://localhost/mydb', PORT: '3000', DEBUG: 'true' }
```

## loadEnvFiles

Loads environment variables from `.env` files.

### Signature

```ts
function loadEnvFiles(
  root: string,
  mode?: string
): Promise<Record<string, string>>
```

### Loading Order

1. `.env` - Always loaded
2. `.env.local` - Local overrides (gitignored)
3. `.env.{mode}` - Mode-specific (e.g., `.env.production`)
4. `.env.{mode}.local` - Mode-specific local overrides

### Example

```ts
const env = await loadEnvFiles('./project', 'production')
// Loads: .env, .env.local, .env.production, .env.production.local
```

## validateEnv

Validates environment variables against a schema.

### Signature

```ts
function validateEnv(
  schema: EnvConfig,
  rawEnv: Record<string, string | undefined>
): EnvValidationResult
```

### EnvValidationResult

```ts
interface EnvValidationResult {
  success: boolean
  data: ParsedEnv
  errors: EnvValidationError[]
}
```

### Example

```ts
const result = validateEnv(envSchema, process.env)

if (!result.success) {
  console.error('Environment validation failed:')
  for (const error of result.errors) {
    console.error(`  ${error.key}: ${error.message}`)
  }
  process.exit(1)
}

const validatedEnv = result.data
```

## setupEnv

Complete environment setup: load files, validate, and return result.

### Signature

```ts
function setupEnv(
  root: string,
  schema: EnvConfig,
  mode?: string
): Promise<EnvValidationResult>
```

### Example

```ts
import { setupEnv } from '@ereo/core'
import { envSchema } from './env.config'

const result = await setupEnv('.', envSchema, process.env.NODE_ENV)

if (!result.success) {
  throw new Error('Invalid environment configuration')
}

// Environment is ready
```

## initializeEnv

Initializes the global environment with validated values.

### Signature

```ts
function initializeEnv(validatedEnv: ParsedEnv): void
```

### Example

```ts
const result = await setupEnv('.', envSchema)
initializeEnv(result.data)

// Now getEnv and requireEnv work
```

## getEnv

Gets an environment variable value.

### Signature

```ts
function getEnv<T>(key: string): T | undefined
```

### Example

```ts
const port = getEnv<number>('PORT')
const debug = getEnv<boolean>('DEBUG')
```

## requireEnv

Gets a required environment variable, throws if missing.

### Signature

```ts
function requireEnv<T>(key: string): T
```

### Example

```ts
// Throws if DATABASE_URL is not set
const dbUrl = requireEnv<string>('DATABASE_URL')
```

## getAllEnv

Gets all environment variables.

### Signature

```ts
function getAllEnv(): Readonly<ParsedEnv>
```

### Example

```ts
const allEnv = getAllEnv()
console.log(allEnv.PORT, allEnv.NODE_ENV)
```

## getPublicEnv

Gets only public environment variables (safe for client).

### Signature

```ts
function getPublicEnv(schema: EnvConfig): ParsedEnv
```

### Example

```ts
const publicEnv = getPublicEnv(envSchema)
// Only includes variables marked with .public()
```

## generateEnvTypes

Generates TypeScript types for environment variables.

### Signature

```ts
function generateEnvTypes(schema: EnvConfig): string
```

### Example

```ts
const types = generateEnvTypes(envSchema)
// Outputs TypeScript interface

await Bun.write('env.d.ts', types)
```

Generated output:

```ts
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    PORT: string
    DEBUG: string
    NODE_ENV: 'development' | 'production' | 'test'
    PUBLIC_API_URL: string
    FEATURE_FLAGS: string
    ALLOWED_ORIGINS: string
    API_KEY: string
    SENTRY_DSN?: string
  }
}
```

## typedEnv

Type-safe proxy for environment access.

### Example

```ts
import { typedEnv } from '@ereo/core'
import type { EnvSchema } from './env.config'

const env = typedEnv<EnvSchema>()

// Type-safe access
const port: number = env.PORT
const debug: boolean = env.DEBUG
```

## Complete Setup Example

```ts
// src/env.ts
import { env, setupEnv, initializeEnv } from '@ereo/core'

export const envSchema = {
  DATABASE_URL: env.string(),
  PORT: env.port().default(3000),
  NODE_ENV: env.enum(['development', 'production', 'test']),
  PUBLIC_API_URL: env.string().public(),
  JWT_SECRET: env.string().validate(s => s.length >= 32)
}

export type Env = typeof envSchema

export async function initEnv() {
  const result = await setupEnv('.', envSchema, process.env.NODE_ENV)

  if (!result.success) {
    console.error('Environment validation failed:')
    result.errors.forEach(e => console.error(`  ${e.key}: ${e.message}`))
    process.exit(1)
  }

  initializeEnv(result.data)
  return result.data
}
```

```ts
// src/index.ts
import { initEnv } from './env'

await initEnv()

// Now safe to use environment
import { createApp } from '@ereo/core'
```

## Related

- [Guide: Environment Variables](/guides/environment-variables)
- [createApp](/api/core/create-app)
