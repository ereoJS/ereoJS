/**
 * @ereo/core - Environment Variable Management
 *
 * Type-safe environment variable handling with validation,
 * .env file loading, and runtime access.
 */

import { join } from 'node:path';

// ============================================================================
// Types
// ============================================================================

/** Supported environment variable types */
export type EnvType = 'string' | 'number' | 'boolean' | 'json' | 'array';

/** Environment variable schema definition */
export interface EnvSchema<T = unknown> {
  type: EnvType;
  required?: boolean;
  default?: T;
  description?: string;
  /** Validation function */
  validate?: (value: T) => boolean | string;
  /** Transform function */
  transform?: (value: string) => T;
  /** Mark as public (exposed to client) */
  public?: boolean;
}

/** Type-safe schema builder */
export interface EnvSchemaBuilder<T> {
  /** Mark as required (no default) */
  required(): EnvSchemaBuilder<T>;
  /** Set default value */
  default(value: T): EnvSchemaBuilder<T>;
  /** Add description */
  description(desc: string): EnvSchemaBuilder<T>;
  /** Add validation */
  validate(fn: (value: T) => boolean | string): EnvSchemaBuilder<T>;
  /** Mark as public (exposed to client) */
  public(): EnvSchemaBuilder<T>;
  /** Get the schema definition */
  _schema: EnvSchema<T>;
}

/** Parsed environment configuration */
export interface ParsedEnv {
  [key: string]: string | number | boolean | unknown[] | Record<string, unknown> | null;
}

/** Environment validation result */
export interface EnvValidationResult {
  valid: boolean;
  errors: EnvValidationError[];
  warnings: string[];
  env: ParsedEnv;
}

/** Environment validation error */
export interface EnvValidationError {
  key: string;
  message: string;
  expected?: string;
  received?: string;
}

/** Environment config for defineConfig */
export interface EnvConfig {
  [key: string]: EnvSchemaBuilder<unknown>;
}

// ============================================================================
// Schema Builders
// ============================================================================

function createSchemaBuilder<T>(baseSchema: EnvSchema<T>): EnvSchemaBuilder<T> {
  const schema: EnvSchema<T> = { ...baseSchema };

  const builder: EnvSchemaBuilder<T> = {
    required() {
      schema.required = true;
      schema.default = undefined;
      return builder;
    },
    default(value: T) {
      schema.default = value;
      schema.required = false;
      return builder;
    },
    description(desc: string) {
      schema.description = desc;
      return builder;
    },
    validate(fn: (value: T) => boolean | string) {
      schema.validate = fn;
      return builder;
    },
    public() {
      schema.public = true;
      return builder;
    },
    _schema: schema,
  };

  // Update _schema reference when mutations happen
  Object.defineProperty(builder, '_schema', {
    get: () => schema,
  });

  return builder;
}

/**
 * Environment variable schema builders.
 * Use these to define your environment variables in ereo.config.ts.
 *
 * @example
 * import { env } from '@ereo/core';
 *
 * export default defineConfig({
 *   env: {
 *     DATABASE_URL: env.string().required(),
 *     PORT: env.number().default(3000),
 *     DEBUG: env.boolean().default(false),
 *     ALLOWED_ORIGINS: env.array().default([]),
 *   },
 * });
 */
export const env = {
  /** String environment variable */
  string(): EnvSchemaBuilder<string> {
    return createSchemaBuilder<string>({
      type: 'string',
      required: false,
    });
  },

  /** Number environment variable */
  number(): EnvSchemaBuilder<number> {
    return createSchemaBuilder<number>({
      type: 'number',
      required: false,
      transform: (value: string) => {
        const num = Number(value);
        if (Number.isNaN(num)) {
          throw new Error(`Invalid number: ${value}`);
        }
        return num;
      },
    });
  },

  /** Boolean environment variable */
  boolean(): EnvSchemaBuilder<boolean> {
    return createSchemaBuilder<boolean>({
      type: 'boolean',
      required: false,
      transform: (value: string) => {
        const lower = value.toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lower)) return true;
        if (['false', '0', 'no', 'off', ''].includes(lower)) return false;
        throw new Error(`Invalid boolean: ${value}`);
      },
    });
  },

  /** JSON environment variable (parses as object) */
  json<T = Record<string, unknown>>(): EnvSchemaBuilder<T> {
    return createSchemaBuilder<T>({
      type: 'json',
      required: false,
      transform: (value: string) => {
        try {
          return JSON.parse(value) as T;
        } catch {
          throw new Error(`Invalid JSON: ${value}`);
        }
      },
    });
  },

  /** Array environment variable (comma-separated) */
  array(): EnvSchemaBuilder<string[]> {
    return createSchemaBuilder<string[]>({
      type: 'array',
      required: false,
      transform: (value: string) => {
        if (!value.trim()) return [];
        return value.split(',').map((s) => s.trim());
      },
    });
  },

  /** Enum environment variable (restricted values) */
  enum<T extends string>(values: readonly T[]): EnvSchemaBuilder<T> {
    return createSchemaBuilder<T>({
      type: 'string',
      required: false,
      validate: (value: T) => {
        if (!values.includes(value)) {
          return `Must be one of: ${values.join(', ')}`;
        }
        return true;
      },
    });
  },

  /** URL environment variable */
  url(): EnvSchemaBuilder<string> {
    return createSchemaBuilder<string>({
      type: 'string',
      required: false,
      validate: (value: string) => {
        try {
          new URL(value);
          return true;
        } catch {
          return 'Invalid URL';
        }
      },
    });
  },

  /** Port environment variable (1-65535) */
  port(): EnvSchemaBuilder<number> {
    return createSchemaBuilder<number>({
      type: 'number',
      required: false,
      transform: (value: string) => parseInt(value, 10),
      validate: (value: number) => {
        if (!Number.isInteger(value) || value < 1 || value > 65535) {
          return 'Port must be an integer between 1 and 65535';
        }
        return true;
      },
    });
  },
};

// ============================================================================
// .env File Parsing
// ============================================================================

/**
 * Parse a .env file content into key-value pairs.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (let line of lines) {
    // Remove comments
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // Find the first = sign
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle escape sequences in double-quoted strings
    if (line.slice(eqIndex + 1).trim().startsWith('"')) {
      value = value
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    }

    result[key] = value;
  }

  return result;
}

/**
 * Load environment variables from .env files.
 * Priority (highest to lowest):
 * 1. process.env (already set)
 * 2. .env.local (never committed)
 * 3. .env.[mode].local
 * 4. .env.[mode]
 * 5. .env
 */
export async function loadEnvFiles(
  root: string,
  mode: 'development' | 'production' | 'test' = 'development'
): Promise<Record<string, string>> {
  const envFiles = [
    '.env',
    `.env.${mode}`,
    `.env.${mode}.local`,
    '.env.local',
  ];

  const loaded: Record<string, string> = {};

  for (const file of envFiles) {
    const filePath = join(root, file);
    try {
      const bunFile = Bun.file(filePath);
      if (await bunFile.exists()) {
        const content = await bunFile.text();
        const parsed = parseEnvFile(content);
        Object.assign(loaded, parsed);
      }
    } catch {
      // File doesn't exist or can't be read, skip
    }
  }

  return loaded;
}

// ============================================================================
// Validation & Parsing
// ============================================================================

/**
 * Validate and parse environment variables against a schema.
 */
export function validateEnv(
  schema: EnvConfig,
  rawEnv: Record<string, string | undefined>
): EnvValidationResult {
  const errors: EnvValidationError[] = [];
  const warnings: string[] = [];
  const parsed: ParsedEnv = {};

  for (const [key, builder] of Object.entries(schema)) {
    const definition = builder._schema;
    const rawValue = rawEnv[key];

    // Handle missing values
    if (rawValue === undefined || rawValue === '') {
      if (definition.required) {
        errors.push({
          key,
          message: `Missing required environment variable: ${key}`,
          expected: definition.type,
        });
        continue;
      }

      if (definition.default !== undefined) {
        parsed[key] = definition.default as ParsedEnv[string];
        continue;
      }

      // Skip optional undefined values
      continue;
    }

    // Parse value based on type
    try {
      let value: unknown;

      if (definition.transform) {
        value = definition.transform(rawValue);
      } else {
        value = rawValue;
      }

      // Run validation
      if (definition.validate) {
        const result = definition.validate(value as never);
        if (result !== true) {
          errors.push({
            key,
            message: typeof result === 'string' ? result : `Validation failed for ${key}`,
            expected: definition.description || definition.type,
            received: String(rawValue),
          });
          continue;
        }
      }

      parsed[key] = value as ParsedEnv[string];
    } catch (error) {
      errors.push({
        key,
        message: error instanceof Error ? error.message : `Invalid value for ${key}`,
        expected: definition.type,
        received: rawValue,
      });
    }
  }

  // Warn about unknown environment variables with EREO_ prefix
  for (const key of Object.keys(rawEnv)) {
    if (key.startsWith('EREO_') && !schema[key]) {
      warnings.push(`Unknown environment variable with EREO_ prefix: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    env: parsed,
  };
}

// ============================================================================
// Runtime Environment Access
// ============================================================================

/** Global environment store */
let globalEnv: ParsedEnv = {};
let envInitialized = false;

/**
 * Initialize the environment with validated values.
 * Called during app startup.
 */
export function initializeEnv(validatedEnv: ParsedEnv): void {
  globalEnv = { ...validatedEnv };
  envInitialized = true;
}

/**
 * Get an environment variable.
 * Returns undefined if not set (and no default).
 */
export function getEnv<T = string>(key: string): T | undefined {
  if (!envInitialized) {
    // Fallback to process.env if not initialized
    return process.env[key] as T | undefined;
  }
  return globalEnv[key] as T | undefined;
}

/**
 * Get an environment variable or throw if not set.
 */
export function requireEnv<T = string>(key: string): T {
  const value = getEnv<T>(key);
  if (value === undefined) {
    throw new Error(`Required environment variable not set: ${key}`);
  }
  return value;
}

/**
 * Get all environment variables.
 */
export function getAllEnv(): Readonly<ParsedEnv> {
  return { ...globalEnv };
}

/**
 * Get public environment variables (safe for client).
 */
export function getPublicEnv(schema: EnvConfig): ParsedEnv {
  const publicEnv: ParsedEnv = {};

  for (const [key, builder] of Object.entries(schema)) {
    const definition = builder._schema;
    if (definition.public && globalEnv[key] !== undefined) {
      publicEnv[key] = globalEnv[key];
    }
  }

  return publicEnv;
}

// ============================================================================
// Environment Initialization
// ============================================================================

/**
 * Complete environment initialization.
 * Loads .env files and validates against schema.
 */
export async function setupEnv(
  root: string,
  schema: EnvConfig,
  mode: 'development' | 'production' | 'test' = 'development'
): Promise<EnvValidationResult> {
  // Load .env files
  const fileEnv = await loadEnvFiles(root, mode);

  // Merge with process.env (process.env takes precedence)
  const combinedEnv: Record<string, string | undefined> = {
    ...fileEnv,
    ...process.env,
  };

  // Validate and parse
  const result = validateEnv(schema, combinedEnv);

  // Initialize global env if valid
  if (result.valid) {
    initializeEnv(result.env);
  }

  // Log warnings
  for (const warning of result.warnings) {
    console.warn(`[env] Warning: ${warning}`);
  }

  // Log errors
  if (!result.valid) {
    console.error('[env] Environment validation failed:');
    for (const error of result.errors) {
      console.error(`  - ${error.key}: ${error.message}`);
      if (error.expected) console.error(`    Expected: ${error.expected}`);
      if (error.received) console.error(`    Received: ${error.received}`);
    }
  }

  return result;
}

// ============================================================================
// Type Generation
// ============================================================================

/**
 * Generate TypeScript type definitions for environment variables.
 */
export function generateEnvTypes(schema: EnvConfig): string {
  const lines: string[] = [
    '// Auto-generated by @ereo/core',
    '// Do not edit this file manually',
    '',
    "declare module '@ereo/core' {",
    '  interface EnvTypes {',
  ];

  for (const [key, builder] of Object.entries(schema)) {
    const definition = builder._schema;
    let tsType: string;

    switch (definition.type) {
      case 'number':
        tsType = 'number';
        break;
      case 'boolean':
        tsType = 'boolean';
        break;
      case 'json':
        tsType = 'Record<string, unknown>';
        break;
      case 'array':
        tsType = 'string[]';
        break;
      default:
        tsType = 'string';
    }

    const optional = !definition.required && definition.default === undefined;
    lines.push(`    ${key}${optional ? '?' : ''}: ${tsType};`);
  }

  lines.push('  }');
  lines.push('}');
  lines.push('');
  lines.push('export {};');

  return lines.join('\n');
}

// ============================================================================
// Type-Safe Env Access (with module augmentation)
// ============================================================================

/**
 * Module augmentation target for environment types.
 * Generated by the CLI during development.
 */
export interface EnvTypes {}

/**
 * Type-safe environment variable accessor.
 * Use after defining env schema in ereo.config.ts.
 *
 * @example
 * const dbUrl = typedEnv.DATABASE_URL; // TypeScript knows this is string
 */
export const typedEnv = new Proxy({} as EnvTypes, {
  get(_target, key: string) {
    return getEnv(key);
  },
});
