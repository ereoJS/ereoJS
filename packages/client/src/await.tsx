/**
 * @ereo/client - Await Component for Streaming SSR
 *
 * Used with React Suspense to render deferred data from loaders.
 * Works with the `defer()` function from @ereo/data.
 */

import React, {
  type ReactNode,
  type ReactElement,
  useState,
  useEffect,
} from 'react';

/**
 * Deferred data structure from @ereo/data defer() function.
 */
export interface DeferredData<T> {
  promise: Promise<T>;
  status: 'pending' | 'resolved' | 'rejected';
  value?: T;
  error?: Error;
}

/**
 * Props for the Await component.
 */
export interface AwaitProps<T> {
  /**
   * The deferred data promise to resolve.
   * Usually comes from a loader using `defer()`.
   */
  resolve: DeferredData<T> | Promise<T>;

  /**
   * Render function called with resolved data.
   * Also accepts a React element directly.
   */
  children: ((data: T) => ReactNode) | ReactNode;

  /**
   * Optional fallback UI to show when the promise rejects.
   * If not provided, the error will propagate to the nearest error boundary.
   */
  errorElement?: ReactNode;
}

/**
 * Promise status tracker for suspense.
 */
type PromiseStatus = 'pending' | 'fulfilled' | 'rejected';

interface TrackedPromise<T> {
  status: PromiseStatus;
  value?: T;
  reason?: unknown;
}

const promiseCache = new WeakMap<Promise<unknown>, TrackedPromise<unknown>>();

/**
 * Track a promise for use with suspense.
 * Throws the promise while pending (triggers Suspense).
 * Throws the error if rejected.
 * Returns the value if fulfilled.
 */
function trackPromise<T>(promise: Promise<T>): T {
  let tracked = promiseCache.get(promise) as TrackedPromise<T> | undefined;

  if (!tracked) {
    tracked = { status: 'pending' };
    promiseCache.set(promise, tracked);

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
    // Throw promise to trigger Suspense
    throw promise;
  }

  if (tracked.status === 'rejected') {
    throw tracked.reason;
  }

  return tracked.value as T;
}

/**
 * Internal component that handles suspense for promises.
 */
function AwaitInner<T>({
  promise,
  children,
  errorElement,
}: {
  promise: Promise<T>;
  children: AwaitProps<T>['children'];
  errorElement?: ReactNode;
}): ReactElement | null {
  try {
    // Track promise - throws if pending (triggers Suspense)
    const data = trackPromise(promise);

    // Render children with resolved data
    if (typeof children === 'function') {
      return <>{children(data)}</>;
    }

    return <>{children}</>;
  } catch (error) {
    // If it's a promise, re-throw for Suspense
    if (error instanceof Promise) {
      throw error;
    }

    // If errorElement is provided, render it
    if (errorElement !== undefined) {
      return <>{errorElement}</>;
    }

    // Otherwise, re-throw to let error boundary handle it
    throw error;
  }
}

/**
 * Await component for rendering deferred data in streaming SSR.
 *
 * Must be used inside a `<Suspense>` boundary.
 * Works with deferred data from `@ereo/data`'s `defer()` function.
 *
 * @example
 * ```tsx
 * import { Suspense } from 'react';
 * import { Await } from '@ereo/client';
 * import { defer, createLoader } from '@ereo/data';
 *
 * export const loader = createLoader({
 *   load: async () => ({
 *     // Critical data loaded immediately
 *     post: await db.posts.find(id),
 *     // Non-critical data deferred
 *     comments: defer(db.comments.findByPost(id)),
 *   })
 * });
 *
 * export default function Post({ loaderData }) {
 *   return (
 *     <article>
 *       <h1>{loaderData.post.title}</h1>
 *
 *       <Suspense fallback={<CommentsSkeleton />}>
 *         <Await resolve={loaderData.comments}>
 *           {(comments) => <CommentList comments={comments} />}
 *         </Await>
 *       </Suspense>
 *     </article>
 *   );
 * }
 * ```
 *
 * @example With error handling
 * ```tsx
 * <Suspense fallback={<Loading />}>
 *   <Await
 *     resolve={loaderData.comments}
 *     errorElement={<div>Failed to load comments</div>}
 *   >
 *     {(comments) => <CommentList comments={comments} />}
 *   </Await>
 * </Suspense>
 * ```
 */
export function Await<T>({
  resolve,
  children,
  errorElement,
}: AwaitProps<T>): ReactElement {
  // Extract promise from DeferredData if needed
  const promise = isDeferredData(resolve) ? resolve.promise : resolve;

  return (
    <AwaitInner promise={promise} errorElement={errorElement}>
      {children}
    </AwaitInner>
  );
}

/**
 * Type guard to check if a value is DeferredData.
 */
function isDeferredData<T>(value: DeferredData<T> | Promise<T>): value is DeferredData<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'promise' in value &&
    'status' in value
  );
}

/**
 * Helper to resolve deferred data.
 * Can be used in loaders or components to wait for deferred data.
 *
 * @param deferred - The deferred data to resolve
 * @returns Promise that resolves to the data
 */
export async function resolveAwait<T>(deferred: DeferredData<T>): Promise<T> {
  return deferred.promise;
}
