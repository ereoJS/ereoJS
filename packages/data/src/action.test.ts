import { describe, expect, test } from 'bun:test';
import {
  createAction,
  action,
  redirect,
  json,
  error,
  parseFormData,
  validateRequired,
  combineValidators,
} from './action';
import { createContext } from '@oreo/core';

describe('@oreo/data - Action', () => {
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
});
