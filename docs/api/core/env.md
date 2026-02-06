# Environment Variables

EreoJS provides type-safe environment variable handling with validation and schema support.

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
  // Make the variable required (no default allowed)
  required(): EnvSchemaBuilder<T>

  // Set a default value (makes variable optional)
  default(value: T): EnvSchemaBuilder<T>

  // Add a description for documentation
  description(desc: string): EnvSchemaBuilder<T>

  // Add custom validation (return true or error message string)
  validate(fn: (value: T) => boolean | string): EnvSchemaBuilder<T>

  // Mark as public (exposed to client)
  public(): EnvSchemaBuilder<T>
}
```

Note: Variables are optional by default unless `.required()` is called. Using `.default()` also makes a variable optional.

### Example Schema

```ts
// env.config.ts
import { env } from '@ereo/core'

export const envSchema = {
  // Required string (throws validation error if missing)
  DATABASE_URL: env.string().required(),

  // With default (optional, uses default if missing)
  PORT: env.port().default(3000),

  // Boolean with default
  DEBUG: env.boolean().default(false),

  // Enum with restricted values
  NODE_ENV: env.enum(['development', 'production', 'test']).default('development'),

  // Public (exposed to client) and required
  PUBLIC_API_URL: env.string().required().public(),

  // JSON object with default
  FEATURE_FLAGS: env.json<{ beta: boolean }>().default({ beta: false }),

  // Array (comma-separated values)
  ALLOWED_ORIGINS: env.array().default([]),

  // With custom validation (return true or error message)
  API_KEY: env.string()
    .required()
    .validate(key => key.length >= 32 || 'API_KEY must be at least 32 characters'),

  // URL validation
  SENTRY_DSN: env.url().description('Sentry DSN for error tracking'),

  // With description for documentation
  SESSION_SECRET: env.string()
    .required()
    .description('Secret key for session encryption')
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

Loads environment variables from `.env` files. Later files override earlier ones.

### Signature

```ts
function loadEnvFiles(
  root: string,
  mode?: 'development' | 'production' | 'test'
): Promise<Record<string, string>>
```

### Loading Order (lowest to highest priority)

1. `.env` - Base configuration
2. `.env.{mode}` - Mode-specific (e.g., `.env.production`)
3. `.env.{mode}.local` - Mode-specific local overrides
4. `.env.local` - Local overrides (highest priority)

Note: `process.env` values take precedence over all loaded files.

### Example

```ts
const env = await loadEnvFiles('./project', 'production')
// Loads: .env, .env.production, .env.production.local, .env.local
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
  valid: boolean
  env: ParsedEnv
  errors: EnvValidationError[]
  warnings: string[]
}

interface EnvValidationError {
  key: string
  message: string
  expected?: string
  received?: string
}
```

### Example

```ts
const result = validateEnv(envSchema, process.env)

if (!result.valid) {
  console.error('Environment validation failed:')
  for (const error of result.errors) {
    console.error(`  ${error.key}: ${error.message}`)
    if (error.expected) console.error(`    Expected: ${error.expected}`)
    if (error.received) console.error(`    Received: ${error.received}`)
  }
  process.exit(1)
}

// Log any warnings
for (const warning of result.warnings) {
  console.warn(`Warning: ${warning}`)
}

const validatedEnv = result.env
```

## setupEnv

Complete environment setup: load files, validate, and return result.

### Signature

```ts
function setupEnv(
  root: string,
  schema: EnvConfig,
  mode?: 'development' | 'production' | 'test'
): Promise<EnvValidationResult>
```

### Example

```ts
import { setupEnv } from '@ereo/core'
import { envSchema } from './env.config'

const result = await setupEnv('.', envSchema, process.env.NODE_ENV as 'development' | 'production' | 'test')

if (!result.valid) {
  throw new Error('Invalid environment configuration')
}

// Environment is initialized and ready to use
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
// setupEnv already calls initializeEnv if valid, but you can also call manually:
if (result.valid) {
  initializeEnv(result.env)
}

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
// Auto-generated by @ereo/core
// Do not edit this file manually

declare module '@ereo/core' {
  interface EnvTypes {
    DATABASE_URL: string
    PORT: number
    DEBUG: boolean
    NODE_ENV: string
    PUBLIC_API_URL: string
    FEATURE_FLAGS: Record<string, unknown>
    ALLOWED_ORIGINS: string[]
    API_KEY: string
    SENTRY_DSN?: string
  }
}

export {}
```

> **Note:** The generated types use the actual parsed types (e.g., `number` for port, `boolean` for boolean vars), not raw strings. This enables type-safe access via `typedEnv`.

## typedEnv

A Proxy object that provides type-safe access to environment variables. It reads from the global env store initialized by `setupEnv`. No function call needed — just access properties directly.

### Example

```ts
import { typedEnv } from '@ereo/core'

// Access environment variables directly (after setupEnv has been called)
const port = typedEnv.PORT        // typed via EnvTypes module augmentation
const debug = typedEnv.DEBUG
const dbUrl = typedEnv.DATABASE_URL
```

> **Note:** `typedEnv` is a Proxy object, not a function. Access properties directly on it. Types come from the auto-generated `EnvTypes` interface via module augmentation (see `generateEnvTypes`).

## Complete Setup Example

```ts
// src/env.ts
import { env, setupEnv, initializeEnv, getEnv, requireEnv } from '@ereo/core'

export const envSchema = {
  DATABASE_URL: env.string().required(),
  PORT: env.port().default(3000),
  NODE_ENV: env.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_API_URL: env.string().required().public(),
  JWT_SECRET: env.string()
    .required()
    .validate(s => s.length >= 32 || 'JWT_SECRET must be at least 32 characters')
}

export type Env = typeof envSchema

export async function initEnv() {
  const mode = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test'
  const result = await setupEnv('.', envSchema, mode)

  if (!result.valid) {
    console.error('Environment validation failed:')
    result.errors.forEach(e => {
      console.error(`  ${e.key}: ${e.message}`)
      if (e.expected) console.error(`    Expected: ${e.expected}`)
      if (e.received) console.error(`    Received: ${e.received}`)
    })
    process.exit(1)
  }

  // setupEnv already calls initializeEnv, but explicit is fine too
  return result.env
}
```

```ts
// src/index.ts
import { initEnv } from './env'
import { requireEnv } from '@ereo/core'

await initEnv()

// Now safe to use environment
const dbUrl = requireEnv<string>('DATABASE_URL')
const port = requireEnv<number>('PORT')

import { createApp } from '@ereo/core'
// ... start your app
```

## Related

- [Guide: Environment Variables](/guides/environment-variables)
- [createApp](/api/core/create-app)
