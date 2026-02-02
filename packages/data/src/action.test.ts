import { describe, expect, test } from 'bun:test';
import {
  createAction,
  action,
  typedAction,
  jsonAction,
  parseRequestBody,
  formDataToObject,
  coerceValue,
  redirect,
  json,
  error,
  parseFormData,
  validateRequired,
  combineValidators,
} from './action';
import { createContext } from '@areo/core';

describe('@areo/data - Action', () => {
  const createMockArgs = (formData: FormData) => {
    const request = new Request('http://localhost:3000/', {
      method: 'POST',
      body: formData,
    });

    return {
      request,
      params: {},
      context: createContext(request),
    };
  };

  describe('createAction', () => {
    test('executes action handler', async () => {
      const actionFn = createAction({
        handler: async ({ formData }) => {
          return { title: formData.get('title') };
        },
      });

      const formData = new FormData();
      formData.set('title', 'Test Title');

      const result = await actionFn(createMockArgs(formData));

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Test Title');
    });

    test('validates form data', async () => {
      const actionFn = createAction({
        handler: async ({ formData }) => {
          return { title: formData.get('title') };
        },
        validate: (formData) => {
          if (!formData.get('title')) {
            return { success: false, errors: { title: ['Required'] } };
          }
          return { success: true };
        },
      });

      const formData = new FormData();
      const result = await actionFn(createMockArgs(formData));

      expect(result.success).toBe(false);
      expect(result.errors?.title).toContain('Required');
    });

    test('passes validation and executes handler', async () => {
      const actionFn = createAction({
        handler: async ({ formData }) => {
          return { title: formData.get('title') };
        },
        validate: (formData) => {
          if (!formData.get('title')) {
            return { success: false, errors: { title: ['Required'] } };
          }
          return { success: true };
        },
      });

      const formData = new FormData();
      formData.set('title', 'Valid Title');

      const result = await actionFn(createMockArgs(formData));

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Valid Title');
    });

    test('calls onError handler when handler throws', async () => {
      const actionFn = createAction({
        handler: async () => {
          throw new Error('Handler error');
        },
        onError: (error) => {
          return { errorMessage: error.message };
        },
      });

      const formData = new FormData();
      const result = await actionFn(createMockArgs(formData));

      expect(result.success).toBe(true);
      expect(result.data?.errorMessage).toBe('Handler error');
    });

    test('onError can return Response which is thrown', async () => {
      const actionFn = createAction({
        handler: async () => {
          throw new Error('Handler error');
        },
        onError: () => {
          return new Response('Error redirect', { status: 302, headers: { Location: '/error' } });
        },
      });

      const formData = new FormData();

      try {
        await actionFn(createMockArgs(formData));
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(302);
      }
    });

    test('rethrows error when no onError handler', async () => {
      const actionFn = createAction({
        handler: async () => {
          throw new Error('Unhandled error');
        },
      });

      const formData = new FormData();

      try {
        await actionFn(createMockArgs(formData));
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('Unhandled error');
      }
    });
  });

  describe('action', () => {
    test('creates simple action', async () => {
      const actionFn = action(async ({ formData }) => {
        return { value: formData.get('value') };
      });

      const formData = new FormData();
      formData.set('value', 'test');

      const result = await actionFn(createMockArgs(formData));
      expect(result.success).toBe(true);
      expect(result.data?.value).toBe('test');
    });
  });

  describe('redirect', () => {
    test('creates redirect response', () => {
      const response = redirect('/dashboard');

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/dashboard');
    });

    test('supports custom status codes', () => {
      const response = redirect('/new-location', 301);

      expect(response.status).toBe(301);
    });
  });

  describe('json', () => {
    test('creates JSON response', () => {
      const response = json({ data: 'test' });

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('error', () => {
    test('creates error response', () => {
      const response = error('Something went wrong');

      expect(response.status).toBe(500);
    });

    test('supports custom status codes', () => {
      const response = error('Not found', 404);

      expect(response.status).toBe(404);
    });
  });

  describe('parseFormData', () => {
    test('converts FormData to object', () => {
      const formData = new FormData();
      formData.set('name', 'John');
      formData.set('email', 'john@example.com');

      const result = parseFormData<{ name: string; email: string }>(formData);

      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
    });

    test('handles array fields', () => {
      const formData = new FormData();
      formData.append('tags[]', 'react');
      formData.append('tags[]', 'typescript');

      const result = parseFormData<{ tags: string[] }>(formData);

      expect(result.tags).toEqual(['react', 'typescript']);
    });

    test('converts multiple values with same key to array', () => {
      const formData = new FormData();
      formData.append('colors', 'red');
      formData.append('colors', 'blue');
      formData.append('colors', 'green');

      const result = parseFormData<{ colors: string[] }>(formData);

      expect(result.colors).toEqual(['red', 'blue', 'green']);
    });
  });

  describe('validateRequired', () => {
    test('passes when all fields present', () => {
      const formData = new FormData();
      formData.set('name', 'John');
      formData.set('email', 'john@example.com');

      const result = validateRequired(formData, ['name', 'email']);

      expect(result.success).toBe(true);
    });

    test('fails when fields missing', () => {
      const formData = new FormData();
      formData.set('name', 'John');

      const result = validateRequired(formData, ['name', 'email']);

      expect(result.success).toBe(false);
      expect(result.errors?.email).toBeDefined();
    });
  });

  describe('combineValidators', () => {
    test('combines multiple validators', async () => {
      const validator = combineValidators(
        (formData) => validateRequired(formData, ['name']),
        (formData) => validateRequired(formData, ['email'])
      );

      const formData = new FormData();
      const result = await validator(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
      expect(result.errors?.email).toBeDefined();
    });
  });

  describe('coerceValue', () => {
    test('coerces boolean strings', () => {
      expect(coerceValue('true')).toBe(true);
      expect(coerceValue('false')).toBe(false);
    });

    test('coerces null and undefined', () => {
      expect(coerceValue('null')).toBe(null);
      expect(coerceValue('undefined')).toBe(undefined);
    });

    test('coerces numbers', () => {
      expect(coerceValue('42')).toBe(42);
      expect(coerceValue('3.14')).toBe(3.14);
      expect(coerceValue('-10')).toBe(-10);
      expect(coerceValue('0')).toBe(0);
    });

    test('coerces ISO dates', () => {
      const result = coerceValue('2024-01-15');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getFullYear()).toBe(2024);
    });

    test('coerces ISO datetime', () => {
      const result = coerceValue('2024-01-15T10:30:00');
      expect(result).toBeInstanceOf(Date);
    });

    test('coerces JSON objects', () => {
      const result = coerceValue('{"name":"test"}');
      expect(result).toEqual({ name: 'test' });
    });

    test('coerces JSON arrays', () => {
      const result = coerceValue('[1,2,3]');
      expect(result).toEqual([1, 2, 3]);
    });

    test('returns string for non-coercible values', () => {
      expect(coerceValue('hello')).toBe('hello');
      expect(coerceValue('')).toBe('');
    });
  });

  describe('formDataToObject', () => {
    test('converts simple fields', () => {
      const formData = new FormData();
      formData.set('name', 'John');
      formData.set('age', '30');

      const result = formDataToObject<{ name: string; age: number }>(formData);

      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    test('handles array notation with []', () => {
      const formData = new FormData();
      formData.append('tags[]', 'react');
      formData.append('tags[]', 'typescript');

      const result = formDataToObject<{ tags: string[] }>(formData);

      expect(result.tags).toEqual(['react', 'typescript']);
    });

    test('handles nested objects with dot notation', () => {
      const formData = new FormData();
      formData.set('user.name', 'John');
      formData.set('user.email', 'john@example.com');

      const result = formDataToObject<{ user: { name: string; email: string } }>(formData);

      expect(result.user.name).toBe('John');
      expect(result.user.email).toBe('john@example.com');
    });

    test('handles indexed arrays', () => {
      const formData = new FormData();
      formData.set('items[0]', 'first');
      formData.set('items[1]', 'second');

      const result = formDataToObject<{ items: string[] }>(formData);

      expect(result.items[0]).toBe('first');
      expect(result.items[1]).toBe('second');
    });

    test('handles complex nested structures', () => {
      const formData = new FormData();
      formData.set('users[0].name', 'John');
      formData.set('users[0].age', '30');
      formData.set('users[1].name', 'Jane');
      formData.set('users[1].age', '25');

      const result = formDataToObject<{ users: Array<{ name: string; age: number }> }>(formData);

      expect(result.users[0].name).toBe('John');
      expect(result.users[0].age).toBe(30);
      expect(result.users[1].name).toBe('Jane');
      expect(result.users[1].age).toBe(25);
    });

    test('coerces boolean values', () => {
      const formData = new FormData();
      formData.set('active', 'true');
      formData.set('disabled', 'false');

      const result = formDataToObject<{ active: boolean; disabled: boolean }>(formData);

      expect(result.active).toBe(true);
      expect(result.disabled).toBe(false);
    });

    test('skips coercion when disabled', () => {
      const formData = new FormData();
      formData.set('count', '42');
      formData.set('flag', 'true');

      const result = formDataToObject(formData, { coerce: false });

      expect(result.count).toBe('42');
      expect(result.flag).toBe('true');
    });
  });

  describe('parseRequestBody', () => {
    test('parses JSON body', async () => {
      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test', count: 42 }),
      });

      const { body, contentType } = await parseRequestBody(request);

      expect(contentType).toBe('json');
      expect(body).toEqual({ title: 'Test', count: 42 });
    });

    test('parses FormData body', async () => {
      const formData = new FormData();
      formData.set('name', 'John');
      formData.set('age', '30');

      const request = new Request('http://localhost/api', {
        method: 'POST',
        body: formData,
      });

      const { body, contentType, formData: fd } = await parseRequestBody(request);

      expect(contentType).toBe('form');
      expect((body as any).name).toBe('John');
      expect((body as any).age).toBe(30);
      expect(fd).toBeDefined();
    });

    test('parses text body', async () => {
      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'Hello World',
      });

      const { body, contentType } = await parseRequestBody(request);

      expect(contentType).toBe('text');
      expect(body).toBe('Hello World');
    });

    test('tries to parse unknown content type as JSON', async () => {
      const request = new Request('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
      });

      const { body, contentType } = await parseRequestBody(request);

      expect(contentType).toBe('json');
      expect(body).toEqual({ data: 'test' });
    });

    test('returns unknown content type for non-JSON text without content-type', async () => {
      const request = new Request('http://localhost/api', {
        method: 'POST',
        body: 'not valid json at all {{{',
      });

      const { body, contentType } = await parseRequestBody(request);

      expect(contentType).toBe('unknown');
      expect(body).toBeNull();
    });
  });

  describe('typedAction', () => {
    test('handles JSON request with typed body', async () => {
      interface PostInput {
        title: string;
        count: number;
        tags: string[];
      }

      const actionFn = typedAction<PostInput, { id: string; title: string }>({
        handler: async ({ body }) => {
          return { id: '123', title: body.title };
        },
      });

      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Post', count: 5, tags: ['a', 'b'] }),
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Test Post');
    });

    test('handles FormData with type coercion', async () => {
      interface UserInput {
        name: string;
        age: number;
        active: boolean;
      }

      const actionFn = typedAction<UserInput>({
        handler: async ({ body }) => body,
      });

      const formData = new FormData();
      formData.set('name', 'John');
      formData.set('age', '30');
      formData.set('active', 'true');

      const request = new Request('http://localhost/api', {
        method: 'POST',
        body: formData,
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('John');
      expect(result.data?.age).toBe(30);
      expect(result.data?.active).toBe(true);
    });

    test('validates body with custom validator', async () => {
      const actionFn = typedAction<{ email: string }>({
        handler: async ({ body }) => body,
        validate: (body) => {
          if (!body.email.includes('@')) {
            return { success: false, errors: { email: ['Invalid email'] } };
          }
          return { success: true };
        },
      });

      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid' }),
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(false);
      expect(result.errors?.email).toContain('Invalid email');
    });

    test('transforms body before validation', async () => {
      const actionFn = typedAction<{ items: string[] }>({
        handler: async ({ body }) => body,
        transform: (raw: any) => ({
          items: Array.isArray(raw.items) ? raw.items : [raw.items],
        }),
      });

      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: 'single' }),
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(true);
      expect(result.data?.items).toEqual(['single']);
    });

    test('works with schema validation (zod-like)', async () => {
      // Mock zod-like schema
      const mockSchema = {
        safeParse: (data: unknown) => {
          const d = data as any;
          if (typeof d.name !== 'string' || d.name.length === 0) {
            return {
              success: false as const,
              error: { errors: [{ path: ['name'], message: 'Name is required' }] },
            };
          }
          return { success: true as const, data: d as { name: string } };
        },
      };

      const actionFn = typedAction<{ name: string }>({
        schema: mockSchema,
        handler: async ({ body }) => body,
      });

      // Test invalid data
      const request1 = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      const result1 = await actionFn({
        request: request1,
        params: {},
        context: createContext(request1),
      });

      expect(result1.success).toBe(false);
      expect(result1.errors?.name).toContain('Name is required');

      // Test valid data
      const request2 = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }),
      });

      const result2 = await actionFn({
        request: request2,
        params: {},
        context: createContext(request2),
      });

      expect(result2.success).toBe(true);
      expect(result2.data?.name).toBe('John');
    });

    test('handles errors with onError', async () => {
      const actionFn = typedAction<{ value: number }>({
        handler: async () => {
          throw new Error('Handler error');
        },
        onError: (error) => ({ errorMessage: error.message }),
      });

      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 1 }),
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(true);
      expect((result.data as any)?.errorMessage).toBe('Handler error');
    });

    test('works with schema using parse instead of safeParse', async () => {
      // Mock schema with only parse method (no safeParse)
      const mockSchema = {
        parse: (data: unknown) => {
          const d = data as { name: string };
          if (!d.name) {
            throw new Error('Name is required');
          }
          return d;
        },
      };

      const actionFn = typedAction<{ name: string }>({
        schema: mockSchema as any,
        handler: async ({ body }) => body,
      });

      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' }),
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('John');
    });

    test('onError can return Response which is thrown', async () => {
      const actionFn = typedAction<{ value: number }>({
        handler: async () => {
          throw new Error('Handler error');
        },
        onError: () => {
          return new Response('Redirecting', { status: 302, headers: { Location: '/error' } });
        },
      });

      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 1 }),
      });

      try {
        await actionFn({
          request,
          params: {},
          context: createContext(request),
        });
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(Response);
        expect((e as Response).status).toBe(302);
      }
    });
  });

  describe('jsonAction', () => {
    test('handles JSON requests', async () => {
      const actionFn = jsonAction<{ data: string }>({
        handler: async ({ body }) => body,
      });

      const request = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(true);
      expect(result.data?.data).toBe('test');
    });

    test('rejects non-JSON in strict mode', async () => {
      const actionFn = jsonAction<{ data: string }>({
        strict: true,
        handler: async ({ body }) => body,
      });

      const formData = new FormData();
      formData.set('data', 'test');

      const request = new Request('http://localhost/api', {
        method: 'POST',
        body: formData,
      });

      const result = await actionFn({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.success).toBe(false);
      expect(result.errors?._request).toBeDefined();
    });
  });
});
