import { describe, expect, test } from 'bun:test';
import { createFormAction, parseActionResult } from './action';
import type { ValidationSchema } from './types';

// ─── createFormAction: additional coverage ──────────────────────────────────

describe('createFormAction: schema paths', () => {
  test('safeParse success path passes validated data to handler', async () => {
    let receivedValues: any = null;
    const action = createFormAction<{ name: string }, { ok: boolean }>({
      schema: {
        parse: () => { throw new Error('Should not be called'); },
        safeParse: (data: unknown) => ({
          success: true as const,
          data: { name: 'Validated Name' },
        }),
      },
      handler: async (values) => {
        receivedValues = values;
        return { ok: true };
      },
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'raw' }),
    });

    const result = await action(request);
    expect(result.success).toBe(true);
    expect(receivedValues).toEqual({ name: 'Validated Name' });
  });

  test('safeParse with multiple errors on same path', async () => {
    const action = createFormAction<any, void>({
      schema: {
        parse: () => { throw new Error('Not called'); },
        safeParse: () => ({
          success: false as const,
          error: {
            issues: [
              { path: ['name'], message: 'Too short' },
              { path: ['name'], message: 'Must start with uppercase' },
            ],
          },
        }),
      },
      handler: async () => {},
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['Too short', 'Must start with uppercase']);
  });

  test('parse success path (schema without safeParse)', async () => {
    const action = createFormAction<{ name: string }, { id: number }>({
      schema: {
        parse: (data: unknown) => data as { name: string },
        // No safeParse - will use parse path
      },
      handler: async (values) => ({ id: 1 }),
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    const result = await action(request);
    expect(result.success).toBe(true);
  });

  test('parse throws error without issues (generic error)', async () => {
    const action = createFormAction<any, void>({
      schema: {
        parse: () => { throw new Error('Schema parse failed'); },
        // No safeParse
      },
      handler: async () => {},
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Schema parse failed']);
  });

  test('parse throws error without issues and without message', async () => {
    const action = createFormAction<any, void>({
      schema: {
        parse: () => { throw { something: 'else' }; },
      },
      handler: async () => {},
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Validation failed']);
  });

  test('parse throws error with issues but missing path', async () => {
    const action = createFormAction<any, void>({
      schema: {
        parse: () => {
          throw { issues: [{ message: 'Bad value' }] };
        },
      },
      handler: async () => {},
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    // issue.path is undefined, so path?.join('.') ?? '' → ''
    expect(result.errors?.['']).toEqual(['Bad value']);
  });
});

describe('createFormAction: content type handling', () => {
  test('handles application/x-www-form-urlencoded', async () => {
    let receivedValues: any = null;
    const action = createFormAction<any, { ok: boolean }>({
      handler: async (values) => {
        receivedValues = values;
        return { ok: true };
      },
    });

    const body = new URLSearchParams({ name: 'Alice', email: 'a@b.com' });
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const result = await action(request);
    expect(result.success).toBe(true);
    expect(receivedValues).toBeDefined();
  });

  test('handles multipart/form-data content type', async () => {
    const action = createFormAction<any, { ok: boolean }>({
      handler: async () => ({ ok: true }),
    });

    const fd = new FormData();
    fd.append('name', 'Alice');
    fd.append('count', '5');

    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: fd,
    });

    const result = await action(request);
    expect(result.success).toBe(true);
  });

  test('handles request with no content-type header', async () => {
    const action = createFormAction<any, { ok: boolean }>({
      handler: async () => ({ ok: true }),
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
    });

    const result = await action(request);
    expect(result.success).toBe(true);
  });
});

describe('createFormAction: error handling', () => {
  test('handler throws non-Error object', async () => {
    const action = createFormAction<any, void>({
      handler: async () => {
        throw 'string error';
      },
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Server error']);
  });

  test('handler throws null', async () => {
    const action = createFormAction<any, void>({
      handler: async () => {
        throw null;
      },
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Server error']);
  });

  test('onError receives the thrown error', async () => {
    let receivedError: unknown;
    const action = createFormAction<any, void>({
      handler: async () => { throw new Error('Specific error'); },
      onError: (error) => {
        receivedError = error;
        return { success: false, errors: { '': ['Handled'] } };
      },
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    await action(request);
    expect(receivedError).toBeInstanceOf(Error);
    expect((receivedError as Error).message).toBe('Specific error');
  });
});

// ─── parseActionResult: additional edge cases ───────────────────────────────

describe('parseActionResult: edge cases', () => {
  test('error property is non-string object', () => {
    const result = parseActionResult({ error: { code: 500 } });
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Unknown error']);
  });

  test('error property is number', () => {
    const result = parseActionResult({ error: 42 });
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Unknown error']);
  });

  test('error property is null', () => {
    const result = parseActionResult({ error: null });
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Unknown error']);
  });

  test('success:false result passed through', () => {
    const result = parseActionResult({
      success: false,
      errors: { name: ['Required'] },
    });
    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['Required']);
  });

  test('number value treated as data', () => {
    const result = parseActionResult(42);
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  test('boolean value treated as data', () => {
    const result = parseActionResult(true);
    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  test('empty object (no recognized shape) treated as data', () => {
    const result = parseActionResult({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  test('object with unrecognized keys treated as data', () => {
    const result = parseActionResult({ foo: 'bar', baz: 123 });
    expect(result.success).toBe(true);
  });

  test('priority: success > error > errors > data', () => {
    // When 'success' is present, it takes priority
    const r1 = parseActionResult({ success: true, error: 'ignored', data: 'yes' });
    expect(r1.success).toBe(true);

    // When 'error' is present (no 'success'), it takes priority over 'data'
    const r2 = parseActionResult({ error: 'Bad', data: 'ignored' });
    expect(r2.success).toBe(false);

    // When 'errors' is present (no 'success' or 'error'), it takes priority over 'data'
    const r3 = parseActionResult({ errors: { x: ['y'] }, data: 'ignored' });
    expect(r3.success).toBe(false);
  });

  test('array value treated as data', () => {
    const result = parseActionResult([1, 2, 3]);
    // Arrays are objects, checked for success/error/errors/data, then fallback
    // Arrays don't have 'success', 'error', 'errors', or 'data' keys (normally)
    expect(result.success).toBe(true);
  });
});
