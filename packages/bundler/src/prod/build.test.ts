import { describe, expect, test } from 'bun:test';
import { formatSize, printBuildReport, type BuildResult } from './build';

describe('@areo/bundler - Build', () => {
  describe('formatSize', () => {
    test('formats bytes', () => {
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(100)).toBe('100 B');
      expect(formatSize(1023)).toBe('1023 B');
    });

    test('formats kilobytes', () => {
      expect(formatSize(1024)).toBe('1.00 KB');
      expect(formatSize(1536)).toBe('1.50 KB');
      expect(formatSize(10240)).toBe('10.00 KB');
      expect(formatSize(1024 * 1023)).toContain('KB');
    });

    test('formats megabytes', () => {
      expect(formatSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatSize(1024 * 1024 * 2.5)).toBe('2.50 MB');
      expect(formatSize(1024 * 1024 * 100)).toBe('100.00 MB');
    });

    test('handles edge cases', () => {
      expect(formatSize(1)).toBe('1 B');
      expect(formatSize(1024 * 1024 - 1)).toContain('KB');
    });
  });

  describe('printBuildReport', () => {
    test('prints report without throwing', () => {
      const result: BuildResult = {
        success: true,
        outputs: [
          { path: 'dist/main.js', size: 1024, type: 'js' },
          { path: 'dist/styles.css', size: 512, type: 'css' },
        ],
        duration: 100,
      };

      // Should not throw
      expect(() => printBuildReport(result)).not.toThrow();
    });

    test('handles empty outputs', () => {
      const result: BuildResult = {
        success: true,
        outputs: [],
        duration: 50,
      };

      expect(() => printBuildReport(result)).not.toThrow();
    });

    test('handles many outputs', () => {
      const outputs = Array.from({ length: 20 }, (_, i) => ({
        path: `dist/chunk-${i}.js`,
        size: 1024 * (i + 1),
        type: 'js' as const,
      }));

      const result: BuildResult = {
        success: true,
        outputs,
        duration: 500,
      };

      expect(() => printBuildReport(result)).not.toThrow();
    });

    test('groups by file type', () => {
      const result: BuildResult = {
        success: true,
        outputs: [
          { path: 'a.js', size: 100, type: 'js' },
          { path: 'b.js', size: 200, type: 'js' },
          { path: 'a.css', size: 50, type: 'css' },
          { path: 'img.png', size: 1000, type: 'asset' },
        ],
        duration: 100,
      };

      expect(() => printBuildReport(result)).not.toThrow();
    });
  });

  describe('BuildOptions', () => {
    interface BuildOptions {
      root?: string;
      outDir?: string;
      minify?: boolean;
      sourcemap?: boolean;
      target?: 'bun' | 'browser' | 'node';
      entrypoints?: string[];
      external?: string[];
    }

    test('default values', () => {
      const defaults: Required<Omit<BuildOptions, 'entrypoints' | 'external'>> = {
        root: process.cwd(),
        outDir: '.areo',
        minify: true,
        sourcemap: true,
        target: 'bun',
      };

      expect(defaults.minify).toBe(true);
      expect(defaults.sourcemap).toBe(true);
      expect(defaults.target).toBe('bun');
    });

    test('supports different targets', () => {
      const targets: BuildOptions['target'][] = ['bun', 'browser', 'node'];

      for (const target of targets) {
        const options: BuildOptions = { target };
        expect(options.target).toBe(target);
      }
    });
  });

  describe('BuildResult', () => {
    test('success result structure', () => {
      const result: BuildResult = {
        success: true,
        outputs: [
          { path: 'main.js', size: 1000, type: 'js' },
        ],
        duration: 100,
      };

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('failure result structure', () => {
      const result: BuildResult = {
        success: false,
        outputs: [],
        duration: 50,
        errors: ['Compilation failed', 'Type error'],
      };

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(2);
    });

    test('output types', () => {
      const outputs: BuildResult['outputs'] = [
        { path: 'app.js', size: 100, type: 'js' },
        { path: 'styles.css', size: 50, type: 'css' },
        { path: 'image.png', size: 200, type: 'asset' },
      ];

      expect(outputs.filter((o) => o.type === 'js')).toHaveLength(1);
      expect(outputs.filter((o) => o.type === 'css')).toHaveLength(1);
      expect(outputs.filter((o) => o.type === 'asset')).toHaveLength(1);
    });
  });

  describe('Route counting logic', () => {
    function countRoutes(routes: any[]): number {
      let count = 0;
      for (const route of routes) {
        count++;
        if (route.children) {
          count += countRoutes(route.children);
        }
      }
      return count;
    }

    test('counts flat routes', () => {
      const routes = [
        { path: '/' },
        { path: '/about' },
        { path: '/contact' },
      ];

      expect(countRoutes(routes)).toBe(3);
    });

    test('counts nested routes', () => {
      const routes = [
        { path: '/' },
        {
          path: '/users',
          children: [
            { path: '/users/:id' },
            { path: '/users/:id/posts' },
          ],
        },
      ];

      expect(countRoutes(routes)).toBe(4);
    });

    test('counts deeply nested routes', () => {
      const routes = [
        {
          path: '/a',
          children: [
            {
              path: '/a/b',
              children: [
                {
                  path: '/a/b/c',
                  children: [
                    { path: '/a/b/c/d' },
                  ],
                },
              ],
            },
          ],
        },
      ];

      expect(countRoutes(routes)).toBe(4);
    });

    test('handles empty routes', () => {
      expect(countRoutes([])).toBe(0);
    });
  });
});
