/**
 * @areo/core - Environment Variable Tests
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  env,
  parseEnvFile,
  validateEnv,
  initializeEnv,
  getEnv,
  requireEnv,
  getAllEnv,
  generateEnvTypes,
  type EnvConfig,
} from './env';

describe('env schema builders', () => {
  test('env.string() creates string schema', () => {
    const schema = env.string();
    expect(schema._schema.type).toBe('string');
    expect(schema._schema.required).toBe(false);
  });

  test('env.string().required() marks as required', () => {
    const schema = env.string().required();
    expect(schema._schema.required).toBe(true);
  });

  test('env.string().default() sets default', () => {
    const schema = env.string().default('hello');
    expect(schema._schema.default).toBe('hello');
    expect(schema._schema.required).toBe(false);
  });

  test('env.number() creates number schema with transform', () => {
    const schema = env.number();
    expect(schema._schema.type).toBe('number');
    expect(schema._schema.transform).toBeDefined();
    expect(schema._schema.transform!('42')).toBe(42);
  });

  test('env.boolean() creates boolean schema', () => {
    const schema = env.boolean();
    expect(schema._schema.type).toBe('boolean');
    expect(schema._schema.transform!('true')).toBe(true);
    expect(schema._schema.transform!('false')).toBe(false);
    expect(schema._schema.transform!('1')).toBe(true);
    expect(schema._schema.transform!('0')).toBe(false);
  });

  test('env.array() creates array schema', () => {
    const schema = env.array();
    expect(schema._schema.type).toBe('array');
    expect(schema._schema.transform!('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(schema._schema.transform!('  a , b , c  ')).toEqual(['a', 'b', 'c']);
    expect(schema._schema.transform!('')).toEqual([]);
  });

  test('env.json() creates json schema', () => {
    const schema = env.json();
    expect(schema._schema.type).toBe('json');
    expect(schema._schema.transform!('{"key":"value"}')).toEqual({ key: 'value' });
  });

  test('env.url() validates URLs', () => {
    const schema = env.url();
    expect(schema._schema.validate!('https://example.com')).toBe(true);
    expect(schema._schema.validate!('not-a-url')).toBe('Invalid URL');
  });

  test('env.port() validates port numbers', () => {
    const schema = env.port();
    expect(schema._schema.validate!(3000)).toBe(true);
    expect(schema._schema.validate!(0)).not.toBe(true);
    expect(schema._schema.validate!(70000)).not.toBe(true);
  });

  test('env.enum() restricts values', () => {
    const schema = env.enum(['development', 'production', 'test'] as const);
    expect(schema._schema.validate!('development')).toBe(true);
    expect(schema._schema.validate!('invalid')).toContain('Must be one of');
  });
});

describe('parseEnvFile', () => {
  test('parses simple key-value pairs', () => {
    const content = `
KEY1=value1
KEY2=value2
`;
    const result = parseEnvFile(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  test('handles quoted values', () => {
    const content = `
QUOTED_DOUBLE="hello world"
QUOTED_SINGLE='hello world'
`;
    const result = parseEnvFile(content);
    expect(result.QUOTED_DOUBLE).toBe('hello world');
    expect(result.QUOTED_SINGLE).toBe('hello world');
  });

  test('handles comments', () => {
    const content = `
# This is a comment
KEY=value
# Another comment
`;
    const result = parseEnvFile(content);
    expect(result).toEqual({ KEY: 'value' });
  });

  test('handles empty lines', () => {
    const content = `
KEY1=value1

KEY2=value2
`;
    const result = parseEnvFile(content);
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  test('handles escape sequences in double quotes', () => {
    const content = `MULTILINE="line1\\nline2"`;
    const result = parseEnvFile(content);
    expect(result.MULTILINE).toBe('line1\nline2');
  });
});

describe('validateEnv', () => {
  test('validates required fields', () => {
    const schema: EnvConfig = {
      REQUIRED_VAR: env.string().required(),
    };

    const result = validateEnv(schema, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].key).toBe('REQUIRED_VAR');
  });

  test('uses default values', () => {
    const schema: EnvConfig = {
      WITH_DEFAULT: env.string().default('default_value'),
    };

    const result = validateEnv(schema, {});
    expect(result.valid).toBe(true);
    expect(result.env.WITH_DEFAULT).toBe('default_value');
  });

  test('transforms values', () => {
    const schema: EnvConfig = {
      PORT: env.number(),
      DEBUG: env.boolean(),
    };

    const result = validateEnv(schema, {
      PORT: '3000',
      DEBUG: 'true',
    });

    expect(result.valid).toBe(true);
    expect(result.env.PORT).toBe(3000);
    expect(result.env.DEBUG).toBe(true);
  });

  test('runs validation functions', () => {
    const schema: EnvConfig = {
      URL: env.url().required(),
    };

    const result = validateEnv(schema, {
      URL: 'not-a-url',
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe('Invalid URL');
  });

  test('warns about unknown AREO_ prefixed variables', () => {
    const schema: EnvConfig = {
      KNOWN_VAR: env.string(),
    };

    const result = validateEnv(schema, {
      KNOWN_VAR: 'value',
      AREO_UNKNOWN: 'something',
    });

    expect(result.warnings).toContain('Unknown environment variable with AREO_ prefix: AREO_UNKNOWN');
  });
});

describe('environment access', () => {
  beforeEach(() => {
    initializeEnv({
      TEST_VAR: 'test_value',
      TEST_NUMBER: 42,
    });
  });

  test('getEnv returns values', () => {
    expect(getEnv('TEST_VAR')).toBe('test_value');
    expect(getEnv<number>('TEST_NUMBER')).toBe(42);
    expect(getEnv('NONEXISTENT')).toBeUndefined();
  });

  test('requireEnv throws for missing values', () => {
    expect(requireEnv('TEST_VAR')).toBe('test_value');
    expect(() => requireEnv('NONEXISTENT')).toThrow();
  });

  test('getAllEnv returns all values', () => {
    const all = getAllEnv();
    expect(all.TEST_VAR).toBe('test_value');
    expect(all.TEST_NUMBER).toBe(42);
  });
});

describe('generateEnvTypes', () => {
  test('generates TypeScript types for schema', () => {
    const schema: EnvConfig = {
      DATABASE_URL: env.string().required(),
      PORT: env.number().default(3000),
      DEBUG: env.boolean(),
      TAGS: env.array(),
    };

    const types = generateEnvTypes(schema);

    expect(types).toContain("declare module '@areo/core'");
    expect(types).toContain('interface EnvTypes');
    expect(types).toContain('DATABASE_URL: string;');
    expect(types).toContain('PORT: number;');
    expect(types).toContain('DEBUG?: boolean;');
    expect(types).toContain('TAGS?: string[];');
  });
});
