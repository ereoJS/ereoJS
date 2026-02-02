/**
 * @areo/testing - Snapshot Testing
 *
 * Utilities for snapshot testing loaders and actions.
 */

import type { LoaderFunction, ActionFunction, RouteParams } from '@areo/core';
import { testLoader, type LoaderTestOptions } from './loader';
import { testAction, type ActionTestOptions } from './action';

/**
 * Snapshot options.
 */
export interface SnapshotOptions {
  /** Fields to exclude from snapshot */
  exclude?: string[];
  /** Fields to include in snapshot (if specified, only these are included) */
  include?: string[];
  /** Custom serializer */
  serialize?: (data: unknown) => string;
  /** Replace dynamic values */
  replacers?: Record<string, unknown>;
}

/**
 * Prepare data for snapshot by removing dynamic fields.
 */
function prepareForSnapshot(
  data: unknown,
  options: SnapshotOptions = {}
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => prepareForSnapshot(item, options));
  }

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check exclusions
    if (options.exclude?.includes(key)) {
      continue;
    }

    // Check inclusions
    if (options.include && !options.include.includes(key)) {
      continue;
    }

    // Apply replacers
    if (options.replacers && key in options.replacers) {
      result[key] = options.replacers[key];
      continue;
    }

    // Recurse for nested objects
    result[key] = prepareForSnapshot(value, options);
  }

  return result;
}

/**
 * Create a snapshot of loader data.
 *
 * @example
 * test('loader snapshot', async () => {
 *   const snapshot = await snapshotLoader(loader, {
 *     params: { slug: 'test-post' },
 *   }, {
 *     exclude: ['createdAt', 'updatedAt'],
 *     replacers: { id: '[ID]' },
 *   });
 *
 *   expect(snapshot).toMatchSnapshot();
 * });
 */
export async function snapshotLoader<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  testOptions: LoaderTestOptions<P> = {},
  snapshotOptions: SnapshotOptions = {}
): Promise<unknown> {
  const result = await testLoader(loader, testOptions);
  return prepareForSnapshot(result.data, snapshotOptions);
}

/**
 * Create a snapshot of action result.
 *
 * @example
 * test('action snapshot', async () => {
 *   const snapshot = await snapshotAction(action, {
 *     formData: { title: 'Test', content: 'Content' },
 *   }, {
 *     exclude: ['id', 'createdAt'],
 *   });
 *
 *   expect(snapshot).toMatchSnapshot();
 * });
 */
export async function snapshotAction<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  testOptions: ActionTestOptions<P> = {},
  snapshotOptions: SnapshotOptions = {}
): Promise<unknown> {
  const result = await testAction(action, testOptions);
  return prepareForSnapshot(result.data, snapshotOptions);
}

/**
 * Create a snapshot object for multiple test scenarios.
 *
 * @example
 * const snapshots = await createSnapshotMatrix(loader, {
 *   scenarios: {
 *     'loads featured posts': { params: { featured: 'true' } },
 *     'loads recent posts': { params: { sort: 'recent' } },
 *     'loads by author': { params: { author: 'test-user' } },
 *   },
 * });
 *
 * expect(snapshots).toMatchSnapshot();
 */
export async function createSnapshotMatrix<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  options: {
    scenarios: Record<string, LoaderTestOptions<P>>;
    snapshotOptions?: SnapshotOptions;
  }
): Promise<Record<string, unknown>> {
  const snapshots: Record<string, unknown> = {};

  for (const [name, testOptions] of Object.entries(options.scenarios)) {
    snapshots[name] = await snapshotLoader(
      loader,
      testOptions,
      options.snapshotOptions
    );
  }

  return snapshots;
}

/**
 * Common replacers for dynamic values.
 */
export const commonReplacers = {
  /** Replace ISO date strings */
  date: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g,
  /** Replace UUIDs */
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  /** Replace numeric IDs */
  numericId: /\d+/g,
};

/**
 * Apply string replacements for snapshot stability.
 *
 * @example
 * const stableData = applyReplacements(data, {
 *   [commonReplacers.date]: '[DATE]',
 *   [commonReplacers.uuid]: '[UUID]',
 * });
 */
export function applyReplacements(
  data: unknown,
  replacements: Record<string | RegExp, string>
): unknown {
  const json = JSON.stringify(data);

  let result = json;
  for (const [pattern, replacement] of Object.entries(replacements)) {
    if (typeof pattern === 'string') {
      result = result.split(pattern).join(replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }

  return JSON.parse(result);
}

/**
 * Create a deterministic snapshot by sorting object keys.
 */
export function deterministicSnapshot(data: unknown): string {
  return JSON.stringify(data, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {} as Record<string, unknown>);
    }
    return value;
  }, 2);
}
