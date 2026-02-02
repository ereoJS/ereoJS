/**
 * @areo/data - Pipeline Tests
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import {
  createPipeline,
  dataSource,
  cachedSource,
  optionalSource,
  formatMetrics,
} from './pipeline';

// Mock context
const createMockContext = () => ({
  cache: {
    set: () => {},
    get: () => undefined,
    getTags: () => [],
  },
  get: () => undefined,
  set: () => {},
  responseHeaders: new Headers(),
  url: new URL('http://localhost:3000/'),
  env: {},
});

describe('createPipeline', () => {
  test('executes independent loaders in parallel', async () => {
    const executionOrder: string[] = [];

    const pipeline = createPipeline({
      loaders: {
        user: {
          load: async () => {
            executionOrder.push('user-start');
            await sleep(50);
            executionOrder.push('user-end');
            return { id: 1, name: 'Test User' };
          },
        },
        posts: {
          load: async () => {
            executionOrder.push('posts-start');
            await sleep(30);
            executionOrder.push('posts-end');
            return [{ id: 1, title: 'Post 1' }];
          },
        },
      },
    });

    const result = await pipeline.execute({
      request: new Request('http://localhost:3000/'),
      params: {},
      context: createMockContext(),
    });

    expect(result.data.user).toEqual({ id: 1, name: 'Test User' });
    expect(result.data.posts).toEqual([{ id: 1, title: 'Post 1' }]);

    // Both should start before either finishes (parallel)
    expect(executionOrder[0]).toBe('user-start');
    expect(executionOrder[1]).toBe('posts-start');
  });

  test('respects dependencies', async () => {
    const executionOrder: string[] = [];

    const pipeline = createPipeline({
      loaders: {
        user: {
          load: async () => {
            executionOrder.push('user');
            return { id: 1 };
          },
        },
        posts: {
          load: async ({ data }) => {
            executionOrder.push('posts');
            return [{ authorId: (data as any).user?.id }];
          },
        },
      },
      dependencies: {
        posts: ['user'],
      },
    });

    const result = await pipeline.execute({
      request: new Request('http://localhost:3000/'),
      params: {},
      context: createMockContext(),
    });

    expect(executionOrder).toEqual(['user', 'posts']);
    expect(result.data.posts[0].authorId).toBe(1);
  });

  test('detects circular dependencies', () => {
    expect(() =>
      createPipeline({
        loaders: {
          a: { load: async () => 'a' },
          b: { load: async () => 'b' },
        },
        dependencies: {
          a: ['b'],
          b: ['a'],
        },
      })
    ).toThrow(/Circular dependency/);
  });

  test('handles loader errors with fallback', async () => {
    const pipeline = createPipeline({
      loaders: {
        failing: {
          load: async () => {
            throw new Error('Load failed');
          },
          fallback: 'default value',
        },
      },
    });

    const result = await pipeline.execute({
      request: new Request('http://localhost:3000/'),
      params: {},
      context: createMockContext(),
    });

    expect(result.data.failing).toBe('default value');
    expect(result.errors.size).toBe(0);
  });

  test('collects errors for required loaders without fallback', async () => {
    const pipeline = createPipeline({
      loaders: {
        failing: {
          load: async () => {
            throw new Error('Required loader failed');
          },
          required: true,
        },
      },
    });

    const result = await pipeline.execute({
      request: new Request('http://localhost:3000/'),
      params: {},
      context: createMockContext(),
    });

    expect(result.errors.size).toBe(1);
    expect(result.errors.get('failing')?.message).toBe('Required loader failed');
  });

  test('collects timing metrics', async () => {
    const pipeline = createPipeline({
      loaders: {
        fast: {
          load: async () => {
            await sleep(10);
            return 'fast';
          },
        },
        slow: {
          load: async () => {
            await sleep(50);
            return 'slow';
          },
        },
      },
      metrics: true,
    });

    const result = await pipeline.execute({
      request: new Request('http://localhost:3000/'),
      params: {},
      context: createMockContext(),
    });

    expect(result.metrics.loaders.size).toBe(2);
    expect(result.metrics.loaders.get('fast')!.duration).toBeLessThan(
      result.metrics.loaders.get('slow')!.duration
    );
    expect(result.metrics.parallelEfficiency).toBeGreaterThan(0);
  });

  test('toLoader() creates standard loader function', async () => {
    const pipeline = createPipeline({
      loaders: {
        data: { load: async () => ({ value: 42 }) },
      },
    });

    const loader = pipeline.toLoader();
    const data = await loader({
      request: new Request('http://localhost:3000/'),
      params: {},
      context: createMockContext(),
    });

    expect(data).toEqual({ data: { value: 42 } });
  });

  test('toLoader() throws on required loader failure', async () => {
    const pipeline = createPipeline({
      loaders: {
        failing: {
          load: async () => {
            throw new Error('Failed');
          },
        },
      },
    });

    const loader = pipeline.toLoader();

    await expect(
      loader({
        request: new Request('http://localhost:3000/'),
        params: {},
        context: createMockContext(),
      })
    ).rejects.toThrow(/Loader 'failing' failed/);
  });
});

describe('dataSource helpers', () => {
  test('dataSource creates simple source', () => {
    const source = dataSource(async () => 'value');
    expect(source.load).toBeDefined();
  });

  test('cachedSource adds cache options', () => {
    const source = cachedSource(async () => 'value', {
      tags: ['test'],
      ttl: 300,
    });

    expect(source.tags).toEqual(['test']);
    expect(source.ttl).toBe(300);
  });

  test('optionalSource sets fallback', () => {
    const source = optionalSource(async () => 'value', 'fallback');

    expect(source.fallback).toBe('fallback');
    expect(source.required).toBe(false);
  });
});

describe('formatMetrics', () => {
  test('formats metrics for console output', () => {
    const metrics = {
      total: 150,
      loaders: new Map([
        ['user', { key: 'user', startTime: 0, endTime: 50, duration: 50, cacheHit: true, waitingFor: [] }],
        ['posts', { key: 'posts', startTime: 0, endTime: 120, duration: 120, cacheHit: false, waitingFor: [] }],
      ]),
      executionOrder: [],
      parallelEfficiency: 0.75,
      waterfalls: [],
    };

    const output = formatMetrics(metrics);

    expect(output).toContain('150.0ms');
    expect(output).toContain('75%');
    expect(output).toContain('user');
    expect(output).toContain('posts');
    expect(output).toContain('cache');
  });
});

// Helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
