/**
 * Tests for useServerFn React hook
 *
 * Uses a minimal React-like test approach since Bun doesn't include a
 * full React test renderer. We test the hook logic by calling it through
 * a simple hook runner.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ServerFnError, type ServerFn, type ServerFnErrorShape } from '../server-fn';

// We test the underlying logic extracted from the hook,
// since full React rendering requires a DOM environment.
// The hook itself is thin — the logic is in the callbacks.

// =============================================================================
// Helper: simulate hook behavior without React
// =============================================================================

interface HookState<TInput, TOutput> {
  execute: (input: TInput) => Promise<TOutput>;
  data: TOutput | undefined;
  error: ServerFnErrorShape | undefined;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

/**
 * Simulates useServerFn behavior without React.
 * This tests the core logic independent of React's state management.
 */
function createServerFnHook<TInput, TOutput>(
  fn: ServerFn<TInput, TOutput>,
  options: {
    onSuccess?: (data: TOutput) => void;
    onError?: (error: ServerFnErrorShape) => void;
    onSettled?: () => void;
  } = {}
): HookState<TInput, TOutput> {
  const { onSuccess, onError, onSettled } = options;

  let data: TOutput | undefined = undefined;
  let error: ServerFnErrorShape | undefined = undefined;
  let isPending = false;
  let requestId = 0;

  const state: HookState<TInput, TOutput> = {
    get data() { return data; },
    get error() { return error; },
    get isPending() { return isPending; },
    get isSuccess() { return data !== undefined && error === undefined; },
    get isError() { return error !== undefined; },

    async execute(input: TInput): Promise<TOutput> {
      const currentId = ++requestId;
      isPending = true;
      error = undefined;

      try {
        const result = await fn(input);

        if (currentId === requestId) {
          data = result;
          isPending = false;
          onSuccess?.(result);
        }

        return result;
      } catch (err: unknown) {
        const errorShape = toErrorShape(err);

        if (currentId === requestId) {
          error = errorShape;
          data = undefined;
          isPending = false;
          onError?.(errorShape);
        }

        throw err;
      } finally {
        if (currentId === requestId) {
          onSettled?.();
        }
      }
    },

    reset() {
      requestId++;
      data = undefined;
      error = undefined;
      isPending = false;
    },
  };

  return state;
}

function toErrorShape(err: unknown): ServerFnErrorShape {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const e = err as { code: string; message: string; details?: Record<string, unknown> };
    return { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) };
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message };
  }
  return { code: 'UNKNOWN', message: String(err) };
}

// =============================================================================
// Mock Server Function
// =============================================================================

function createMockFn<TInput, TOutput>(
  impl: (input: TInput) => Promise<TOutput>
): ServerFn<TInput, TOutput> {
  const fn = impl as unknown as ServerFn<TInput, TOutput>;
  Object.defineProperties(fn, {
    _id: { value: 'mock-fn', writable: false, enumerable: true },
    _url: { value: '/_server-fn/mock-fn', writable: false, enumerable: true },
  });
  return fn;
}

// =============================================================================
// Tests
// =============================================================================

describe('useServerFn (logic simulation)', () => {
  describe('initial state', () => {
    test('starts with undefined data and no error', () => {
      const fn = createMockFn(async () => 'hello');
      const hook = createServerFnHook(fn);

      expect(hook.data).toBeUndefined();
      expect(hook.error).toBeUndefined();
      expect(hook.isPending).toBe(false);
      expect(hook.isSuccess).toBe(false);
      expect(hook.isError).toBe(false);
    });
  });

  describe('successful execution', () => {
    test('sets data after successful call', async () => {
      const fn = createMockFn(async (name: string) => `Hello, ${name}!`);
      const hook = createServerFnHook(fn);

      const result = await hook.execute('World');

      expect(result).toBe('Hello, World!');
      expect(hook.data).toBe('Hello, World!');
      expect(hook.error).toBeUndefined();
      expect(hook.isPending).toBe(false);
      expect(hook.isSuccess).toBe(true);
      expect(hook.isError).toBe(false);
    });

    test('calls onSuccess callback', async () => {
      let successData: string | undefined;
      const fn = createMockFn(async () => 'data');

      const hook = createServerFnHook(fn, {
        onSuccess: (data) => { successData = data; },
      });

      await hook.execute(undefined as void);
      expect(successData).toBe('data');
    });

    test('calls onSettled after success', async () => {
      let settled = false;
      const fn = createMockFn(async () => 'ok');

      const hook = createServerFnHook(fn, {
        onSettled: () => { settled = true; },
      });

      await hook.execute(undefined as void);
      expect(settled).toBe(true);
    });
  });

  describe('error handling', () => {
    test('sets error after failed call', async () => {
      const fn = createMockFn(async () => {
        throw new ServerFnError('FAIL', 'Something went wrong');
      });
      const hook = createServerFnHook(fn);

      await expect(hook.execute(undefined as void)).rejects.toThrow();

      expect(hook.error).toBeDefined();
      expect(hook.error!.code).toBe('FAIL');
      expect(hook.error!.message).toBe('Something went wrong');
      expect(hook.data).toBeUndefined();
      expect(hook.isError).toBe(true);
      expect(hook.isSuccess).toBe(false);
    });

    test('handles generic Error', async () => {
      const fn = createMockFn(async () => {
        throw new Error('generic error');
      });
      const hook = createServerFnHook(fn);

      await expect(hook.execute(undefined as void)).rejects.toThrow();

      expect(hook.error!.code).toBe('UNKNOWN');
      expect(hook.error!.message).toBe('generic error');
    });

    test('handles string throw', async () => {
      const fn = createMockFn(async () => {
        throw 'string error';
      });
      const hook = createServerFnHook(fn);

      await expect(hook.execute(undefined as void)).rejects.toThrow();

      expect(hook.error!.code).toBe('UNKNOWN');
      expect(hook.error!.message).toBe('string error');
    });

    test('calls onError callback', async () => {
      let capturedError: ServerFnErrorShape | undefined;
      const fn = createMockFn(async () => {
        throw new ServerFnError('TEST_ERR', 'test');
      });

      const hook = createServerFnHook(fn, {
        onError: (err) => { capturedError = err; },
      });

      await hook.execute(undefined as void).catch(() => {});
      expect(capturedError).toBeDefined();
      expect(capturedError!.code).toBe('TEST_ERR');
    });

    test('calls onSettled after error', async () => {
      let settled = false;
      const fn = createMockFn(async () => {
        throw new Error('boom');
      });

      const hook = createServerFnHook(fn, {
        onSettled: () => { settled = true; },
      });

      await hook.execute(undefined as void).catch(() => {});
      expect(settled).toBe(true);
    });
  });

  describe('last-write-wins (stale request handling)', () => {
    test('ignores stale responses', async () => {
      let resolvers: Array<(val: string) => void> = [];

      const fn = createMockFn(async (id: string) => {
        return new Promise<string>((resolve) => {
          resolvers.push(resolve);
        });
      });

      const hook = createServerFnHook(fn);

      // Start two requests
      const first = hook.execute('first');
      const second = hook.execute('second');

      // Resolve the second one first
      resolvers[1]!('second-result');
      await second;

      // Now resolve the first (stale) one
      resolvers[0]!('first-result');
      await first;

      // Should have the second result, not the first
      expect(hook.data).toBe('second-result');
    });
  });

  describe('reset', () => {
    test('resets all state to initial values', async () => {
      const fn = createMockFn(async () => 'data');
      const hook = createServerFnHook(fn);

      await hook.execute(undefined as void);
      expect(hook.data).toBe('data');

      hook.reset();

      expect(hook.data).toBeUndefined();
      expect(hook.error).toBeUndefined();
      expect(hook.isPending).toBe(false);
      expect(hook.isSuccess).toBe(false);
      expect(hook.isError).toBe(false);
    });

    test('reset invalidates in-flight requests', async () => {
      let resolver: ((val: string) => void) | null = null;

      const fn = createMockFn(async () => {
        return new Promise<string>((resolve) => {
          resolver = resolve;
        });
      });

      const hook = createServerFnHook(fn);

      // Start a request
      const promise = hook.execute(undefined as void);

      // Reset before it completes
      hook.reset();

      // Resolve the now-stale request
      resolver!('stale-data');
      await promise;

      // Data should not be set (request was invalidated by reset)
      expect(hook.data).toBeUndefined();
    });
  });

  describe('ServerFnError shape preservation', () => {
    test('preserves error details', async () => {
      const fn = createMockFn(async () => {
        throw new ServerFnError('VALIDATION', 'Bad input', {
          details: { field: 'email', issues: ['required'] },
        });
      });
      const hook = createServerFnHook(fn);

      await hook.execute(undefined as void).catch(() => {});

      expect(hook.error!.details).toEqual({
        field: 'email',
        issues: ['required'],
      });
    });
  });
});
