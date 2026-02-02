/**
 * @areo/testing - Action Tests
 */

import { describe, expect, test } from 'bun:test';
import type { ActionFunction } from '@areo/core';
import {
  testAction,
  createActionTester,
  testActionMatrix,
  testActionError,
  testActionWithFile,
} from './action';

// Sample actions for testing
const simpleAction: ActionFunction<{ success: boolean }> = async () => {
  return { success: true };
};

const formAction: ActionFunction<{ name: string; email: string }> = async ({ request }) => {
  const formData = await request.formData();
  return {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
  };
};

const jsonAction: ActionFunction<{ data: unknown }> = async ({ request }) => {
  const data = await request.json();
  return { data };
};

const redirectAction: ActionFunction<Response> = async () => {
  return new Response(null, {
    status: 302,
    headers: { Location: '/success' },
  });
};

const jsonResponseAction: ActionFunction<Response> = async () => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const contextAction: ActionFunction<{ user: unknown }> = async ({ context }) => {
  return { user: context.get('user') };
};

const paramAction: ActionFunction<{ id: string }> = async ({ params }) => {
  return { id: (params as { id?: string }).id || 'default' };
};

const errorAction: ActionFunction<never> = async () => {
  throw new Error('Action failed');
};

const validationAction: ActionFunction<{ error?: string; success?: boolean }> = async ({ request }) => {
  const formData = await request.formData();
  const content = formData.get('content') as string;
  if (!content || content.trim() === '') {
    return { error: 'Content is required' };
  }
  return { success: true };
};

const fileAction: ActionFunction<{ filename: string; size: number; type: string }> = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  return {
    filename: file.name,
    size: file.size,
    type: file.type,
  };
};

describe('testAction', () => {
  test('tests simple action', async () => {
    const result = await testAction(simpleAction);

    expect(result.data).toEqual({ success: true });
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('defaults to POST method', async () => {
    let capturedMethod: string | null = null;
    const methodAction: ActionFunction = async ({ request }) => {
      capturedMethod = request.method;
      return {};
    };

    await testAction(methodAction);

    expect(capturedMethod).toBe('POST');
  });

  test('provides form data to action', async () => {
    const result = await testAction(formAction, {
      formData: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    expect(result.data).toEqual({
      name: 'Test User',
      email: 'test@example.com',
    });
  });

  test('provides JSON body to action', async () => {
    const result = await testAction(jsonAction, {
      body: { key: 'value', nested: { data: true } },
    });

    expect(result.data).toEqual({
      data: { key: 'value', nested: { data: true } },
    });
  });

  test('provides params to action', async () => {
    const result = await testAction(paramAction, {
      params: { id: 'test-id' },
    });

    expect(result.data).toEqual({ id: 'test-id' });
  });

  test('provides context to action', async () => {
    const result = await testAction(contextAction, {
      context: {
        store: { user: { id: 1, name: 'Test' } },
      },
    });

    expect(result.data).toEqual({ user: { id: 1, name: 'Test' } });
  });

  test('handles redirect response', async () => {
    const result = await testAction(redirectAction);

    expect(result.isRedirect).toBe(true);
    expect(result.redirectTo).toBe('/success');
    expect(result.response?.status).toBe(302);
  });

  test('handles non-redirect response', async () => {
    const result = await testAction(simpleAction);

    expect(result.isRedirect).toBe(false);
    expect(result.redirectTo).toBeNull();
    expect(result.response).toBeNull();
  });

  test('parses JSON from Response', async () => {
    const result = await testAction(jsonResponseAction);

    expect(result.data).toEqual({ status: 'ok' });
    expect(result.response).toBeInstanceOf(Response);
  });

  test('handles non-JSON Response body', async () => {
    const textResponseAction: ActionFunction<Response> = async () => {
      return new Response('plain text', { status: 200 });
    };

    const result = await testAction(textResponseAction);

    expect(result.data).toBeUndefined();
    expect(result.response).toBeInstanceOf(Response);
  });

  test('returns context for inspection', async () => {
    const result = await testAction(simpleAction, {
      context: { store: { initial: 'value' } },
    });

    expect(result.context.get('initial')).toBe('value');
  });

  test('returns request object', async () => {
    const result = await testAction(simpleAction, {
      request: {
        url: '/test',
        headers: { 'X-Custom': 'header' },
      },
    });

    expect(result.request.url).toContain('/test');
    expect(result.request.headers.get('X-Custom')).toBe('header');
  });

  test('allows overriding method', async () => {
    let capturedMethod: string | null = null;
    const methodAction: ActionFunction = async ({ request }) => {
      capturedMethod = request.method;
      return {};
    };

    await testAction(methodAction, {
      request: { method: 'PUT' },
    });

    expect(capturedMethod).toBe('PUT');
  });

  test('prefers formData over body', async () => {
    let usedFormData = false;
    const checkAction: ActionFunction = async ({ request }) => {
      const contentType = request.headers.get('Content-Type');
      usedFormData = contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded') || false;
      return {};
    };

    await testAction(checkAction, {
      formData: { key: 'value' },
      body: { key: 'value' },
    });

    expect(usedFormData).toBe(true);
  });

  test('handles empty options', async () => {
    const result = await testAction(simpleAction, {});

    expect(result.data).toEqual({ success: true });
  });
});

describe('createActionTester', () => {
  test('creates tester with base options', async () => {
    const testMyAction = createActionTester(contextAction, {
      context: { store: { user: { id: 1 } } },
    });

    const result = await testMyAction();

    expect(result.data).toEqual({ user: { id: 1 } });
  });

  test('overrides base params', async () => {
    const testMyAction = createActionTester(paramAction, {
      params: { id: 'base-id' },
    });

    const result = await testMyAction({
      params: { id: 'override-id' },
    });

    expect(result.data).toEqual({ id: 'override-id' });
  });

  test('overrides base formData', async () => {
    const testMyAction = createActionTester(formAction, {
      formData: { name: 'Base', email: 'base@test.com' },
    });

    const result = await testMyAction({
      formData: { name: 'Override', email: 'override@test.com' },
    });

    expect(result.data).toEqual({ name: 'Override', email: 'override@test.com' });
  });

  test('overrides base body', async () => {
    const testMyAction = createActionTester(jsonAction, {
      body: { base: 'data' },
    });

    const result = await testMyAction({
      body: { override: 'data' },
    });

    expect(result.data).toEqual({ data: { override: 'data' } });
  });

  test('merges store values', async () => {
    const testMyAction = createActionTester(contextAction, {
      context: { store: { user: { id: 1 } } },
    });

    const result = await testMyAction({
      context: { store: { extra: 'value' } },
    });

    expect(result.context.get('user')).toEqual({ id: 1 });
    expect(result.context.get('extra')).toBe('value');
  });

  test('merges env values', async () => {
    const testMyAction = createActionTester(simpleAction, {
      context: { env: { API_URL: 'http://base.com' } },
    });

    const result = await testMyAction({
      context: { env: { OTHER_VAR: 'value' } },
    });

    expect(result.context.env.API_URL).toBe('http://base.com');
    expect(result.context.env.OTHER_VAR).toBe('value');
  });

  test('merges request options', async () => {
    const testMyAction = createActionTester(simpleAction, {
      request: { headers: { 'X-Base': 'header' } },
    });

    const result = await testMyAction({
      request: { headers: { 'X-Override': 'header' } },
    });

    expect(result.request.headers.get('X-Override')).toBe('header');
  });

  test('uses base formData when override not provided', async () => {
    const testMyAction = createActionTester(formAction, {
      formData: { name: 'Base', email: 'base@test.com' },
    });

    const result = await testMyAction();

    expect(result.data).toEqual({ name: 'Base', email: 'base@test.com' });
  });

  test('uses base body when override not provided', async () => {
    const testMyAction = createActionTester(jsonAction, {
      body: { base: 'data' },
    });

    const result = await testMyAction();

    expect(result.data).toEqual({ data: { base: 'data' } });
  });
});

describe('testActionMatrix', () => {
  test('tests action with multiple submissions', async () => {
    const results = await testActionMatrix(validationAction, {
      submissions: [
        { formData: { content: 'Valid content' } },
        { formData: { content: '' } },
        { formData: { content: '   ' } },
      ],
    });

    expect(results.length).toBe(3);
    expect(results[0].data).toEqual({ success: true });
    expect(results[1].data).toEqual({ error: 'Content is required' });
    expect(results[2].data).toEqual({ error: 'Content is required' });
  });

  test('uses shared params', async () => {
    const results = await testActionMatrix(paramAction, {
      params: { id: 'shared' },
      submissions: [
        { formData: {} },
        { formData: {} },
      ],
    });

    expect(results[0].data).toEqual({ id: 'shared' });
    expect(results[1].data).toEqual({ id: 'shared' });
  });

  test('uses shared context', async () => {
    const results = await testActionMatrix(contextAction, {
      context: { store: { user: 'shared' } },
      submissions: [{}, {}],
    });

    expect(results[0].data).toEqual({ user: 'shared' });
    expect(results[1].data).toEqual({ user: 'shared' });
  });

  test('supports body submissions', async () => {
    const results = await testActionMatrix(jsonAction, {
      submissions: [
        { body: { item: 1 } },
        { body: { item: 2 } },
      ],
    });

    expect(results[0].data).toEqual({ data: { item: 1 } });
    expect(results[1].data).toEqual({ data: { item: 2 } });
  });

  test('handles mixed formData and body submissions', async () => {
    const mixedAction: ActionFunction<{ type: string }> = async ({ request }) => {
      const contentType = request.headers.get('Content-Type') || '';
      if (contentType.includes('json')) {
        return { type: 'json' };
      }
      return { type: 'form' };
    };

    const results = await testActionMatrix(mixedAction, {
      submissions: [
        { formData: { key: 'value' } },
        { body: { key: 'value' } },
      ],
    });

    expect(results[0].data.type).toBe('form');
    expect(results[1].data.type).toBe('json');
  });

  test('returns results in order', async () => {
    const results = await testActionMatrix(formAction, {
      submissions: [
        { formData: { name: 'First', email: 'first@test.com' } },
        { formData: { name: 'Second', email: 'second@test.com' } },
        { formData: { name: 'Third', email: 'third@test.com' } },
      ],
    });

    expect(results[0].data.name).toBe('First');
    expect(results[1].data.name).toBe('Second');
    expect(results[2].data.name).toBe('Third');
  });
});

describe('testActionError', () => {
  test('catches action errors', async () => {
    const result = await testActionError(errorAction);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Action failed');
  });

  test('returns null error when no error occurs', async () => {
    const result = await testActionError(simpleAction);

    expect(result.error).toBeNull();
  });

  test('returns context even on error', async () => {
    const result = await testActionError(errorAction, {
      context: { store: { initial: 'value' } },
    });

    expect(result.context.get('initial')).toBe('value');
  });

  test('returns request even on error', async () => {
    const result = await testActionError(errorAction, {
      request: { url: '/test' },
    });

    expect(result.request.url).toContain('/test');
  });

  test('handles formData', async () => {
    const formErrorAction: ActionFunction = async ({ request }) => {
      const formData = await request.formData();
      if (formData.get('fail') === 'true') {
        throw new Error('Requested failure');
      }
      return {};
    };

    const errorResult = await testActionError(formErrorAction, {
      formData: { fail: 'true' },
    });
    const successResult = await testActionError(formErrorAction, {
      formData: { fail: 'false' },
    });

    expect(errorResult.error?.message).toBe('Requested failure');
    expect(successResult.error).toBeNull();
  });

  test('handles body', async () => {
    const bodyErrorAction: ActionFunction = async ({ request }) => {
      const data = await request.json();
      if (data.fail) {
        throw new Error('Requested failure');
      }
      return {};
    };

    const errorResult = await testActionError(bodyErrorAction, {
      body: { fail: true },
    });
    const successResult = await testActionError(bodyErrorAction, {
      body: { fail: false },
    });

    expect(errorResult.error?.message).toBe('Requested failure');
    expect(successResult.error).toBeNull();
  });

  test('handles non-Error throws', async () => {
    const stringThrowAction: ActionFunction = async () => {
      throw 'string error';
    };

    const result = await testActionError(stringThrowAction);

    expect(result.error?.message).toBe('string error');
  });

  test('defaults to POST method', async () => {
    let capturedMethod: string | null = null;
    const methodAction: ActionFunction = async ({ request }) => {
      capturedMethod = request.method;
      return {};
    };

    await testActionError(methodAction);

    expect(capturedMethod).toBe('POST');
  });

  test('allows overriding method', async () => {
    let capturedMethod: string | null = null;
    const methodAction: ActionFunction = async ({ request }) => {
      capturedMethod = request.method;
      return {};
    };

    await testActionError(methodAction, {
      request: { method: 'DELETE' },
    });

    expect(capturedMethod).toBe('DELETE');
  });
});

describe('testActionWithFile', () => {
  test('uploads file with string content', async () => {
    const result = await testActionWithFile(fileAction, {
      file: {
        field: 'file',
        name: 'test.txt',
        content: 'Hello World',
        type: 'text/plain',
      },
    });

    expect(result.data.filename).toBe('test.txt');
    expect(result.data.type).toContain('text/plain');
    expect(result.data.size).toBe(11); // 'Hello World' length
  });

  test('uploads file with Blob content', async () => {
    const blob = new Blob(['Binary content'], { type: 'application/octet-stream' });

    const result = await testActionWithFile(fileAction, {
      file: {
        field: 'file',
        name: 'data.bin',
        content: blob,
        type: 'application/octet-stream',
      },
    });

    expect(result.data.filename).toBe('data.bin');
    expect(result.data.type).toBe('application/octet-stream');
  });

  test('includes extra fields', async () => {
    const multiFieldAction: ActionFunction<{ filename: string; description: string }> = async ({ request }) => {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      return {
        filename: file.name,
        description: formData.get('description') as string,
      };
    };

    const result = await testActionWithFile(multiFieldAction, {
      file: {
        field: 'file',
        name: 'doc.pdf',
        content: 'PDF content',
        type: 'application/pdf',
      },
      extraFields: {
        description: 'Important document',
      },
    });

    expect(result.data.filename).toBe('doc.pdf');
    expect(result.data.description).toBe('Important document');
  });

  test('provides params to action', async () => {
    const paramFileAction: ActionFunction<{ id: string; filename: string }> = async ({ request, params }) => {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      return {
        id: (params as { id?: string }).id || 'default',
        filename: file.name,
      };
    };

    const result = await testActionWithFile(paramFileAction, {
      params: { id: 'upload-123' },
      file: {
        field: 'file',
        name: 'photo.jpg',
        content: 'Image data',
        type: 'image/jpeg',
      },
    });

    expect(result.data.id).toBe('upload-123');
    expect(result.data.filename).toBe('photo.jpg');
  });

  test('provides context to action', async () => {
    const contextFileAction: ActionFunction<{ user: unknown; filename: string }> = async ({ request, context }) => {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      return {
        user: context.get('user'),
        filename: file.name,
      };
    };

    const result = await testActionWithFile(contextFileAction, {
      context: { store: { user: { id: 1 } } },
      file: {
        field: 'file',
        name: 'avatar.png',
        content: 'PNG data',
        type: 'image/png',
      },
    });

    expect(result.data.user).toEqual({ id: 1 });
    expect(result.data.filename).toBe('avatar.png');
  });

  test('uses default type for string content', async () => {
    const result = await testActionWithFile(fileAction, {
      file: {
        field: 'file',
        name: 'data.bin',
        content: 'binary data',
        // No type specified
      },
    });

    expect(result.data.type).toBe('application/octet-stream');
  });

  test('handles large file content', async () => {
    const largeContent = 'x'.repeat(10000);

    const result = await testActionWithFile(fileAction, {
      file: {
        field: 'file',
        name: 'large.txt',
        content: largeContent,
        type: 'text/plain',
      },
    });

    expect(result.data.size).toBe(10000);
  });

  test('handles empty extraFields', async () => {
    const result = await testActionWithFile(fileAction, {
      file: {
        field: 'file',
        name: 'test.txt',
        content: 'content',
        type: 'text/plain',
      },
      extraFields: {},
    });

    expect(result.data.filename).toBe('test.txt');
  });
});
