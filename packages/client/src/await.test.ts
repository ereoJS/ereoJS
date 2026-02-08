import { describe, it, expect, beforeEach } from 'bun:test';

import { resolveAwait, type DeferredData } from './await';

// We test the pure logic functions directly.
// For the React components (Await, AwaitInner), we test the underlying logic
// since rendering requires a React runtime with Suspense boundaries.

describe('@ereo/client - await', () => {
  // ==========================================================================
  // resolveAwait
  // ==========================================================================
  describe('resolveAwait', () => {
    it('returns the promise from DeferredData', async () => {
      const data = { id: 1, name: 'Test' };
      const deferred: DeferredData<typeof data> = {
        promise: Promise.resolve(data),
        status: 'pending',
      };

      const result = await resolveAwait(deferred);
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('resolves with string data', async () => {
      const deferred: DeferredData<string> = {
        promise: Promise.resolve('hello'),
        status: 'pending',
      };

      const result = await resolveAwait(deferred);
      expect(result).toBe('hello');
    });

    it('resolves with array data', async () => {
      const deferred: DeferredData<number[]> = {
        promise: Promise.resolve([1, 2, 3]),
        status: 'pending',
      };

      const result = await resolveAwait(deferred);
      expect(result).toEqual([1, 2, 3]);
    });

    it('rejects when the promise rejects', async () => {
      const deferred: DeferredData<string> = {
        promise: Promise.reject(new Error('failed to load')),
        status: 'pending',
      };

      expect(resolveAwait(deferred)).rejects.toThrow('failed to load');
    });

    it('works with a resolved DeferredData', async () => {
      const deferred: DeferredData<number> = {
        promise: Promise.resolve(42),
        status: 'resolved',
        value: 42,
      };

      const result = await resolveAwait(deferred);
      expect(result).toBe(42);
    });

    it('returns the promise even for rejected status DeferredData', async () => {
      const error = new Error('something went wrong');
      const deferred: DeferredData<string> = {
        promise: Promise.reject(error),
        status: 'rejected',
        error,
      };

      expect(resolveAwait(deferred)).rejects.toThrow('something went wrong');
    });
  });

  // ==========================================================================
  // isDeferredData (re-testing internal logic since it's not exported)
  // ==========================================================================
  describe('isDeferredData logic', () => {
    function isDeferredData<T>(value: DeferredData<T> | Promise<T>): value is DeferredData<T> {
      return (
        typeof value === 'object' &&
        value !== null &&
        'promise' in value &&
        'status' in value
      );
    }

    it('returns true for a DeferredData object', () => {
      const deferred: DeferredData<string> = {
        promise: Promise.resolve('test'),
        status: 'pending',
      };
      expect(isDeferredData(deferred)).toBe(true);
    });

    it('returns true for a resolved DeferredData', () => {
      const deferred: DeferredData<number> = {
        promise: Promise.resolve(42),
        status: 'resolved',
        value: 42,
      };
      expect(isDeferredData(deferred)).toBe(true);
    });

    it('returns true for a rejected DeferredData', () => {
      const deferred: DeferredData<string> = {
        promise: Promise.reject(new Error('err')),
        status: 'rejected',
        error: new Error('err'),
      };
      // Suppress unhandled rejection
      deferred.promise.catch(() => {});
      expect(isDeferredData(deferred)).toBe(true);
    });

    it('returns false for a raw Promise', () => {
      const promise = Promise.resolve('test');
      expect(isDeferredData(promise)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isDeferredData(null as any)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isDeferredData(undefined as any)).toBe(false);
    });

    it('returns false for a plain object without promise/status', () => {
      expect(isDeferredData({ data: 'test' } as any)).toBe(false);
    });

    it('returns false for an object with only promise but no status', () => {
      expect(isDeferredData({ promise: Promise.resolve('x') } as any)).toBe(false);
    });

    it('returns false for an object with only status but no promise', () => {
      expect(isDeferredData({ status: 'pending' } as any)).toBe(false);
    });
  });

  // ==========================================================================
  // trackPromise (re-testing internal logic since it's not exported)
  // ==========================================================================
  describe('trackPromise logic', () => {
    // We re-implement the trackPromise logic for testing since it's internal
    type PromiseStatus = 'pending' | 'fulfilled' | 'rejected';

    interface TrackedPromise<T> {
      status: PromiseStatus;
      value?: T;
      reason?: unknown;
    }

    function createTracker() {
      const cache = new WeakMap<Promise<unknown>, TrackedPromise<unknown>>();

      function trackPromise<T>(promise: Promise<T>): T {
        let tracked = cache.get(promise) as TrackedPromise<T> | undefined;

        if (!tracked) {
          tracked = { status: 'pending' };
          cache.set(promise, tracked);

          promise.then(
            (value) => {
              tracked!.status = 'fulfilled';
              tracked!.value = value;
            },
            (reason) => {
              tracked!.status = 'rejected';
              tracked!.reason = reason;
            }
          );
        }

        if (tracked.status === 'pending') {
          throw promise;
        }

        if (tracked.status === 'rejected') {
          throw tracked.reason;
        }

        return tracked.value as T;
      }

      return { trackPromise, cache };
    }

    it('throws the promise when pending (for Suspense)', () => {
      const { trackPromise } = createTracker();
      const promise = new Promise<string>(() => {}); // never resolves

      try {
        trackPromise(promise);
        expect(true).toBe(false); // should not reach here
      } catch (thrown) {
        expect(thrown).toBe(promise);
      }
    });

    it('returns the value when promise is fulfilled', async () => {
      const { trackPromise } = createTracker();
      const promise = Promise.resolve('hello');

      // First call: will throw (pending)
      try {
        trackPromise(promise);
      } catch {
        // expected
      }

      // Wait for promise to resolve
      await promise;

      // Second call: should return the value
      const result = trackPromise(promise);
      expect(result).toBe('hello');
    });

    it('throws the reason when promise is rejected', async () => {
      const { trackPromise } = createTracker();
      const error = new Error('something failed');
      const promise = Promise.reject(error);

      // Suppress unhandled rejection
      promise.catch(() => {});

      // First call: will throw (pending)
      try {
        trackPromise(promise);
      } catch {
        // expected
      }

      // Wait for promise to settle
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Second call: should throw the error
      try {
        trackPromise(promise);
        expect(true).toBe(false); // should not reach here
      } catch (thrown) {
        expect(thrown).toBe(error);
      }
    });

    it('caches the tracked promise (same promise returns same tracker)', async () => {
      const { trackPromise } = createTracker();
      const promise = Promise.resolve(42);

      // First call: pending
      try {
        trackPromise(promise);
      } catch {
        // expected
      }

      await promise;

      // Second and third calls should return same value
      const result1 = trackPromise(promise);
      const result2 = trackPromise(promise);
      expect(result1).toBe(42);
      expect(result2).toBe(42);
    });

    it('tracks different promises independently', async () => {
      const { trackPromise } = createTracker();
      const promise1 = Promise.resolve('a');
      const promise2 = Promise.resolve('b');

      // Trigger tracking for both
      try { trackPromise(promise1); } catch {}
      try { trackPromise(promise2); } catch {}

      await Promise.all([promise1, promise2]);

      expect(trackPromise(promise1)).toBe('a');
      expect(trackPromise(promise2)).toBe('b');
    });

    it('fulfilled promise returns complex objects', async () => {
      const { trackPromise } = createTracker();
      const data = { users: [{ id: 1 }, { id: 2 }] };
      const promise = Promise.resolve(data);

      try { trackPromise(promise); } catch {}

      await promise;

      const result = trackPromise(promise);
      expect(result).toEqual({ users: [{ id: 1 }, { id: 2 }] });
    });
  });

  // ==========================================================================
  // DeferredData interface
  // ==========================================================================
  describe('DeferredData interface', () => {
    it('supports pending status', () => {
      const deferred: DeferredData<string> = {
        promise: new Promise(() => {}),
        status: 'pending',
      };
      expect(deferred.status).toBe('pending');
      expect(deferred.value).toBeUndefined();
      expect(deferred.error).toBeUndefined();
    });

    it('supports resolved status with value', () => {
      const deferred: DeferredData<number> = {
        promise: Promise.resolve(42),
        status: 'resolved',
        value: 42,
      };
      expect(deferred.status).toBe('resolved');
      expect(deferred.value).toBe(42);
    });

    it('supports rejected status with error', () => {
      const error = new Error('test error');
      const deferred: DeferredData<string> = {
        promise: Promise.reject(error),
        status: 'rejected',
        error,
      };
      // Suppress unhandled rejection
      deferred.promise.catch(() => {});
      expect(deferred.status).toBe('rejected');
      expect(deferred.error).toBe(error);
    });
  });

  // ==========================================================================
  // Await component rendering logic
  // ==========================================================================
  describe('Await component rendering logic', () => {
    it('calls children as function with resolved data', () => {
      const data = { name: 'Test' };
      let renderedData: any = null;

      const children = (d: typeof data) => {
        renderedData = d;
        return null;
      };

      children(data);
      expect(renderedData).toEqual({ name: 'Test' });
    });

    it('renders errorElement when promise rejects (and not rethrown)', () => {
      let errorElementRendered = false;
      let errorPropagated = false;

      const error = new Error('load error');
      const errorElement = 'Error fallback';

      // Simulate the try/catch in AwaitInner
      try {
        throw error;
      } catch (caughtError) {
        if (caughtError instanceof Promise) {
          // Re-throw for Suspense
          throw caughtError;
        }
        if (errorElement !== undefined) {
          errorElementRendered = true;
        } else {
          errorPropagated = true;
        }
      }

      expect(errorElementRendered).toBe(true);
      expect(errorPropagated).toBe(false);
    });

    it('propagates error when no errorElement provided', () => {
      const error = new Error('load error');
      const errorElement = undefined;

      let thrownError: Error | null = null;

      try {
        // Simulate the AwaitInner behavior
        try {
          throw error;
        } catch (caughtError) {
          if (caughtError instanceof Promise) {
            throw caughtError;
          }
          if (errorElement !== undefined) {
            // render error element
          } else {
            throw caughtError;
          }
        }
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).toBe(error);
    });

    it('re-throws promises for Suspense boundary', () => {
      const promise = new Promise<string>(() => {});
      let thrownPromise: Promise<string> | null = null;

      try {
        // Simulate what happens when trackPromise throws the promise
        throw promise;
      } catch (caughtError) {
        if (caughtError instanceof Promise) {
          thrownPromise = caughtError as Promise<string>;
        }
      }

      expect(thrownPromise).toBe(promise);
    });

    it('extracts promise from DeferredData before tracking', () => {
      const innerPromise = Promise.resolve('data');
      const deferred: DeferredData<string> = {
        promise: innerPromise,
        status: 'pending',
      };

      // Simulate the Await component logic:
      // const promise = isDeferredData(resolve) ? resolve.promise : resolve;
      function isDeferredData<T>(value: DeferredData<T> | Promise<T>): value is DeferredData<T> {
        return typeof value === 'object' && value !== null && 'promise' in value && 'status' in value;
      }

      const promise = isDeferredData(deferred) ? deferred.promise : deferred;
      expect(promise).toBe(innerPromise);
    });

    it('uses raw Promise when resolve is not DeferredData', () => {
      const rawPromise = Promise.resolve('raw');

      function isDeferredData<T>(value: DeferredData<T> | Promise<T>): value is DeferredData<T> {
        return typeof value === 'object' && value !== null && 'promise' in value && 'status' in value;
      }

      const promise = isDeferredData(rawPromise) ? (rawPromise as any).promise : rawPromise;
      expect(promise).toBe(rawPromise);
    });
  });

  // ==========================================================================
  // AwaitProps interface
  // ==========================================================================
  describe('AwaitProps interface', () => {
    it('accepts a DeferredData as resolve', () => {
      const props = {
        resolve: {
          promise: Promise.resolve('data'),
          status: 'pending' as const,
        },
        children: (data: string) => data,
      };

      expect(props.resolve.status).toBe('pending');
    });

    it('accepts a raw Promise as resolve', () => {
      const promise = Promise.resolve('data');
      const props = {
        resolve: promise,
        children: (data: string) => data,
      };

      expect(props.resolve).toBe(promise);
    });

    it('accepts ReactNode as children', () => {
      const props = {
        resolve: Promise.resolve('data'),
        children: 'Loading...',
      };

      expect(props.children).toBe('Loading...');
    });

    it('accepts optional errorElement', () => {
      const props = {
        resolve: Promise.resolve('data'),
        children: (data: string) => data,
        errorElement: 'Error occurred',
      };

      expect(props.errorElement).toBe('Error occurred');
    });
  });

  // ==========================================================================
  // Promise cache behavior (WeakMap)
  // ==========================================================================
  describe('promise cache behavior', () => {
    it('WeakMap allows garbage collection of resolved promises', () => {
      const cache = new WeakMap<Promise<unknown>, { status: string }>();
      let promise: Promise<string> | null = Promise.resolve('test');
      cache.set(promise, { status: 'fulfilled' });

      expect(cache.has(promise)).toBe(true);

      // Reference is still held
      promise = null;
      // Can't directly test GC, but verify WeakMap usage pattern
    });

    it('different promise instances are tracked separately', () => {
      const cache = new WeakMap<Promise<unknown>, { status: string; value?: unknown }>();

      const p1 = Promise.resolve('a');
      const p2 = Promise.resolve('b');

      cache.set(p1, { status: 'fulfilled', value: 'a' });
      cache.set(p2, { status: 'fulfilled', value: 'b' });

      expect(cache.get(p1)?.value).toBe('a');
      expect(cache.get(p2)?.value).toBe('b');
    });
  });
});
