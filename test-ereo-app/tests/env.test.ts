/**
 * Test: Environment Variable Management
 *
 * Validates the @ereo/core env module features:
 * - Schema builders (string, number, boolean, etc.)
 * - .env file parsing
 * - Validation and transforms
 */

import { describe, expect, test } from 'bun:test';
import { env, parseEnvFile, validateEnv, type EnvConfig } from '@ereo/core';

describe('Environment Variable Schema Builders', () => {
  test('env.string() creates string schema with required/default', () => {
    const required = env.string().required();
    expect(required._schema.type).toBe('string');
    expect(required._schema.required).toBe(true);

    const withDefault = env.string().default('fallback');
    expect(withDefault._schema.default).toBe('fallback');
  });

  test('env.number() transforms string to number', () => {
    const schema = env.number();
    expect(schema._schema.transform!('42')).toBe(42);
    expect(schema._schema.transform!('3.14')).toBe(3.14);
  });

  test('env.boolean() handles various truthy/falsy strings', () => {
    const schema = env.boolean();
    expect(schema._schema.transform!('true')).toBe(true);
    expect(schema._schema.transform!('1')).toBe(true);
    expect(schema._schema.transform!('yes')).toBe(true);
    expect(schema._schema.transform!('false')).toBe(false);
    expect(schema._schema.transform!('0')).toBe(false);
  });

  test('env.array() splits comma-separated values', () => {
    const schema = env.array();
    expect(schema._schema.transform!('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(schema._schema.transform!('  x , y , z  ')).toEqual(['x', 'y', 'z']);
    expect(schema._schema.transform!('')).toEqual([]);
  });

  test('env.url() validates URL format', () => {
    const schema = env.url();
    expect(schema._schema.validate!('https://example.com')).toBe(true);
    expect(schema._schema.validate!('http://localhost:3000/path')).toBe(true);
    expect(schema._schema.validate!('not-a-url')).toBe('Invalid URL');
  });

  test('env.port() validates port range', () => {
    const schema = env.port();
    expect(schema._schema.validate!(3000)).toBe(true);
    expect(schema._schema.validate!(8080)).toBe(true);
    expect(schema._schema.validate!(0)).not.toBe(true);
    expect(schema._schema.validate!(70000)).not.toBe(true);
  });

  test('env.enum() restricts to allowed values', () => {
    const schema = env.enum(['dev', 'prod', 'test'] as const);
    expect(schema._schema.validate!('dev')).toBe(true);
    expect(schema._schema.validate!('prod')).toBe(true);
    expect(schema._schema.validate!('invalid')).toContain('Must be one of');
  });
});

describe('.env File Parsing', () => {
  test('parses simple key=value pairs', () => {
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

  test('handles quoted values correctly', () => {
    const content = `
DOUBLE="hello world"
SINGLE='another value'
`;
    const result = parseEnvFile(content);
    expect(result.DOUBLE).toBe('hello world');
    expect(result.SINGLE).toBe('another value');
  });

  test('ignores comments and empty lines', () => {
    const content = `
# This is a comment
KEY=value

# Another comment
`;
    const result = parseEnvFile(content);
    expect(result).toEqual({ KEY: 'value' });
  });
});

describe('Environment Validation', () => {
  test('validates required fields', () => {
    const schema: EnvConfig = {
      REQUIRED: env.string().required(),
    };

    const result = validateEnv(schema, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].key).toBe('REQUIRED');
  });

  test('uses default values when not provided', () => {
    const schema: EnvConfig = {
      WITH_DEFAULT: env.string().default('default_value'),
    };

    const result = validateEnv(schema, {});
    expect(result.valid).toBe(true);
    expect(result.env.WITH_DEFAULT).toBe('default_value');
  });

  test('transforms values according to schema', () => {
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
});
