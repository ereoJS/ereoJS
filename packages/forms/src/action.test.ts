import { describe, expect, test } from 'bun:test';
import { createFormAction, parseActionResult } from './action';

describe('createFormAction', () => {
  test('handles JSON request successfully', async () => {
    const action = createFormAction<{ name: string }, { id: number }>({
      handler: async (values) => ({ id: 1 }),
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    const result = await action(request);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1 });
  });

  test('handles FormData request', async () => {
    const action = createFormAction<{ name: string }, { id: number }>({
      handler: async (values) => ({ id: 1 }),
    });

    const fd = new FormData();
    fd.append('name', 'Alice');

    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: fd,
    });

    const result = await action(request);
    expect(result.success).toBe(true);
  });

  test('validates with schema and returns errors', async () => {
    const action = createFormAction<{ name: string }, void>({
      schema: {
        parse: () => { throw new Error('Should not be called'); },
        safeParse: (data: unknown) => ({
          success: false as const,
          error: {
            issues: [{ path: ['name'], message: 'Name is required' }],
          },
        }),
      },
      handler: async () => {},
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['Name is required']);
  });

  test('validates with schema parse (no safeParse)', async () => {
    const action = createFormAction<{ name: string }, void>({
      schema: {
        parse: (data: unknown) => {
          const obj = data as any;
          if (!obj.name) throw { issues: [{ path: ['name'], message: 'Required' }] };
          return obj;
        },
      },
      handler: async () => {},
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['Required']);
  });

  test('handles handler errors', async () => {
    const action = createFormAction<{ name: string }, void>({
      handler: async () => {
        throw new Error('Database error');
      },
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Database error']);
  });

  test('uses custom onError handler', async () => {
    const action = createFormAction<{ name: string }, void>({
      handler: async () => {
        throw new Error('Oops');
      },
      onError: (error) => ({
        success: false,
        errors: { '': ['Custom error message'] },
      }),
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Custom error message']);
  });

  test('handles text body fallback to JSON', async () => {
    const action = createFormAction<{ name: string }, { ok: boolean }>({
      handler: async () => ({ ok: true }),
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    const result = await action(request);
    expect(result.success).toBe(true);
  });

  test('handles invalid body gracefully', async () => {
    const action = createFormAction<any, void>({
      handler: async () => {},
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json at all {{{',
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Invalid request body']);
  });
});

describe('parseActionResult', () => {
  test('parses standard ActionResult', () => {
    const result = parseActionResult({ success: true, data: { id: 1 } });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1 });
  });

  test('parses { data } shape', () => {
    const result = parseActionResult({ data: { id: 1 } });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1 });
  });

  test('parses { error } shape', () => {
    const result = parseActionResult({ error: 'Something went wrong' });
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Something went wrong']);
  });

  test('parses { errors } shape', () => {
    const result = parseActionResult({ errors: { name: ['Required'] } });
    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['Required']);
  });

  test('handles null', () => {
    const result = parseActionResult(null);
    expect(result.success).toBe(false);
  });

  test('handles undefined', () => {
    const result = parseActionResult(undefined);
    expect(result.success).toBe(false);
  });

  test('handles raw value', () => {
    const result = parseActionResult('raw string');
    expect(result.success).toBe(true);
    expect(result.data).toBe('raw string');
  });
});
