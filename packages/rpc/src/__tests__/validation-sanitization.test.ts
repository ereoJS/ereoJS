/**
 * Tests for validation error sanitization
 */

import { describe, test, expect } from 'bun:test';
import { createRouter, RPCError } from '../router';
import { procedure } from '../procedure';

describe('Validation Error Sanitization', () => {
  const mockCtx = { user: null };

  test('sanitizes Zod-style validation errors', async () => {
    // Simulate a Zod-like schema with issues array
    const schema = {
      parse: (data: unknown) => {
        const error = new Error('Validation failed') as any;
        error.issues = [
          { path: ['email'], message: 'Invalid email format', code: 'invalid_string' },
          { path: ['age'], message: 'Must be a positive number', code: 'too_small' },
        ];
        throw error;
      },
    };

    const router = createRouter({
      createUser: procedure.mutation(schema, ({ input }) => input),
    });

    const request = new Request('http://localhost/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: ['createUser'],
        type: 'mutation',
        input: { email: 'invalid', age: -1 },
      }),
    });

    const response = await router.handler(request, mockCtx);
    const result = await response.json();

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.details).toBeDefined();
    expect(Array.isArray(result.error.details)).toBe(true);
    expect(result.error.details).toHaveLength(2);
    expect(result.error.details[0]).toHaveProperty('path');
    expect(result.error.details[0]).toHaveProperty('message');
    expect(result.error.details[0]).toHaveProperty('code');
    // Should NOT contain the full error stack or internal properties
    expect(result.error.details[0]).not.toHaveProperty('stack');
  });

  test('sanitizes generic Error objects', async () => {
    const schema = {
      parse: () => {
        throw new Error('Something went wrong in validation');
      },
    };

    const router = createRouter({
      test: procedure.query(schema, () => 'test'),
    });

    const request = new Request('http://localhost/rpc?path=test');
    const response = await router.handler(request, mockCtx);
    const result = await response.json();

    expect(result.ok).toBe(false);
    expect(result.error.details).toEqual({ message: 'Something went wrong in validation' });
  });

  test('handles non-Error throws gracefully', async () => {
    const schema = {
      parse: () => {
        throw 'String error'; // Non-error throw
      },
    };

    const router = createRouter({
      test: procedure.query(schema, () => 'test'),
    });

    const request = new Request('http://localhost/rpc?path=test');
    const response = await router.handler(request, mockCtx);
    const result = await response.json();

    expect(result.ok).toBe(false);
    expect(result.error.details).toEqual({ message: 'Validation failed' });
  });

  test('does not expose internal error details in production', async () => {
    const schema = {
      parse: () => {
        const error = new Error('Internal DB connection failed') as any;
        error.stack = 'Sensitive stack trace here';
        error.internalCode = 'DB_CONN_001';
        throw error;
      },
    };

    const router = createRouter({
      test: procedure.query(schema, () => 'test'),
    });

    const request = new Request('http://localhost/rpc?path=test');
    const response = await router.handler(request, mockCtx);
    const result = await response.json();

    expect(result.ok).toBe(false);
    const details = result.error.details;
    // Should only contain message, no stack or internal codes
    expect(Object.keys(details)).not.toContain('stack');
    expect(Object.keys(details)).not.toContain('internalCode');
  });
});
