/**
 * @oreo/testing - Action Testing
 *
 * Utilities for testing route actions.
 */

import type { ActionFunction, RouteParams } from '@oreo/core';
import { createTestContext, type TestContextOptions, type TestContext } from './context';
import { createMockRequest, type MockRequestOptions, parseJsonResponse } from './request';

/**
 * Options for testing an action.
 */
export interface ActionTestOptions<P = RouteParams> {
  /** Route parameters */
  params?: P;
  /** Request options (method defaults to POST) */
  request?: MockRequestOptions;
  /** Context options */
  context?: TestContextOptions;
  /** Form data to submit */
  formData?: Record<string, string | Blob>;
  /** JSON body to submit */
  body?: Record<string, unknown>;
}

/**
 * Result of testing an action.
 */
export interface ActionTestResult<T = unknown> {
  /** The action's return value (parsed if Response) */
  data: T;
  /** The raw response if action returned a Response */
  response: Response | null;
  /** The test context (for inspection) */
  context: TestContext;
  /** The request used */
  request: Request;
  /** Execution time in milliseconds */
  duration: number;
  /** Whether the action returned a redirect */
  isRedirect: boolean;
  /** Redirect location if applicable */
  redirectTo: string | null;
}

/**
 * Test an action function directly.
 *
 * @example
 * import { testAction } from '@oreo/testing';
 * import { action } from './routes/blog/[slug]';
 *
 * test('creates a comment', async () => {
 *   const result = await testAction(action, {
 *     params: { slug: 'my-post' },
 *     formData: { content: 'Great post!' },
 *   });
 *
 *   expect(result.data.success).toBe(true);
 * });
 */
export async function testAction<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  options: ActionTestOptions<P> = {}
): Promise<ActionTestResult<T>> {
  // Default to POST method for actions
  const requestOptions: MockRequestOptions = {
    method: 'POST',
    ...options.request,
  };

  // Add form data or body
  if (options.formData) {
    requestOptions.formData = options.formData;
  } else if (options.body) {
    requestOptions.body = options.body;
  }

  const request = createMockRequest(requestOptions);
  const context = createTestContext(options.context);
  const params = (options.params || {}) as P;

  const startTime = performance.now();
  const result = await action({ request, params, context });
  const duration = performance.now() - startTime;

  // Handle Response objects
  let data: T;
  let response: Response | null = null;
  let isRedirect = false;
  let redirectTo: string | null = null;

  if (result instanceof Response) {
    response = result;
    isRedirect = result.status >= 300 && result.status < 400;
    redirectTo = result.headers.get('Location');

    // Try to parse JSON body
    try {
      const cloned = result.clone();
      data = await parseJsonResponse<T>(cloned);
    } catch {
      data = undefined as T;
    }
  } else {
    data = result as T;
  }

  return {
    data,
    response,
    context,
    request,
    duration,
    isRedirect,
    redirectTo,
  };
}

/**
 * Create a reusable action tester with preset options.
 *
 * @example
 * const testCommentAction = createActionTester(action, {
 *   context: { store: { user: testUser } },
 * });
 *
 * test('creates comment', async () => {
 *   const result = await testCommentAction({
 *     params: { slug: 'test' },
 *     formData: { content: 'Hello!' },
 *   });
 *   expect(result.data.success).toBe(true);
 * });
 */
export function createActionTester<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  baseOptions: ActionTestOptions<P> = {}
) {
  return async (overrides: Partial<ActionTestOptions<P>> = {}): Promise<ActionTestResult<T>> => {
    return testAction(action, {
      ...baseOptions,
      ...overrides,
      params: { ...baseOptions.params, ...overrides.params } as P,
      request: { ...baseOptions.request, ...overrides.request },
      context: {
        ...baseOptions.context,
        ...overrides.context,
        store: { ...baseOptions.context?.store, ...overrides.context?.store },
        env: { ...baseOptions.context?.env, ...overrides.context?.env },
      },
      formData: overrides.formData || baseOptions.formData,
      body: overrides.body || baseOptions.body,
    });
  };
}

/**
 * Test action with multiple form submissions.
 *
 * @example
 * const results = await testActionMatrix(action, {
 *   params: { slug: 'post-1' },
 *   submissions: [
 *     { formData: { content: 'Comment 1' } },
 *     { formData: { content: 'Comment 2' } },
 *     { formData: { content: '' } }, // Invalid
 *   ],
 * });
 *
 * expect(results[0].data.success).toBe(true);
 * expect(results[2].data.error).toBeDefined();
 */
export async function testActionMatrix<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  options: {
    params?: P;
    submissions: Array<{
      formData?: Record<string, string | Blob>;
      body?: Record<string, unknown>;
    }>;
    context?: TestContextOptions;
  }
): Promise<ActionTestResult<T>[]> {
  return Promise.all(
    options.submissions.map((submission) =>
      testAction(action, {
        params: options.params,
        context: options.context,
        formData: submission.formData,
        body: submission.body,
      })
    )
  );
}

/**
 * Test action error handling.
 *
 * @example
 * test('handles validation error', async () => {
 *   const result = await testActionError(action, {
 *     formData: { content: '' },
 *   });
 *
 *   expect(result.error).toBeInstanceOf(ValidationError);
 * });
 */
export async function testActionError<P = RouteParams>(
  action: ActionFunction<unknown, P>,
  options: ActionTestOptions<P> = {}
): Promise<{
  error: Error | null;
  context: TestContext;
  request: Request;
}> {
  const requestOptions: MockRequestOptions = {
    method: 'POST',
    ...options.request,
  };

  if (options.formData) {
    requestOptions.formData = options.formData;
  } else if (options.body) {
    requestOptions.body = options.body;
  }

  const request = createMockRequest(requestOptions);
  const context = createTestContext(options.context);
  const params = (options.params || {}) as P;

  try {
    await action({ request, params, context });
    return { error: null, context, request };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      context,
      request,
    };
  }
}

/**
 * Test action with file upload.
 *
 * @example
 * test('uploads file', async () => {
 *   const result = await testActionWithFile(action, {
 *     params: { id: '1' },
 *     file: {
 *       field: 'avatar',
 *       name: 'avatar.png',
 *       content: imageBlob,
 *       type: 'image/png',
 *     },
 *   });
 *
 *   expect(result.data.url).toContain('avatar.png');
 * });
 */
export async function testActionWithFile<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  options: {
    params?: P;
    file: {
      field: string;
      name: string;
      content: string | Blob;
      type?: string;
    };
    extraFields?: Record<string, string>;
    context?: TestContextOptions;
  }
): Promise<ActionTestResult<T>> {
  const { file, extraFields = {}, ...rest } = options;

  const blob = typeof file.content === 'string'
    ? new Blob([file.content], { type: file.type || 'application/octet-stream' })
    : file.content;

  const formData: Record<string, string | Blob> = {
    ...extraFields,
    [file.field]: new File([blob], file.name, { type: file.type }),
  };

  return testAction(action, {
    ...rest,
    formData,
  });
}
