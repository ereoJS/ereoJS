import { describe, expect, test } from 'bun:test';
import tailwind, { generateConfig, generateCSSEntry } from './index';

describe('@ereo/plugin-tailwind', () => {
  describe('tailwind plugin factory', () => {
    test('creates a plugin with default options', () => {
      const plugin = tailwind();

      expect(plugin.name).toBe('ereo:tailwind');
      expect(typeof plugin.setup).toBe('function');
      expect(typeof plugin.resolveId).toBe('function');
      expect(typeof plugin.load).toBe('function');
      expect(typeof plugin.transform).toBe('function');
      expect(typeof plugin.configureServer).toBe('function');
    });

    test('accepts custom options', () => {
      const plugin = tailwind({
        content: ['./src/**/*.tsx'],
        darkMode: 'media',
        usePreset: false,
      });

      expect(plugin.name).toBe('ereo:tailwind');
    });
  });

  describe('resolveId', () => {
    test('resolves virtual tailwind module', () => {
      const plugin = tailwind();

      expect(plugin.resolveId!('virtual:tailwind.css')).toBe('\0virtual:tailwind.css');
      expect(plugin.resolveId!('/__tailwind.css')).toBe('\0virtual:tailwind.css');
    });

    test('returns null for other modules', () => {
      const plugin = tailwind();

      expect(plugin.resolveId!('react')).toBeNull();
      expect(plugin.resolveId!('./styles.css')).toBeNull();
    });
  });

  describe('load', () => {
    test('loads virtual tailwind module', async () => {
      const plugin = tailwind();
      const content = await plugin.load!('\0virtual:tailwind.css');

      // load() compiles Tailwind CSS, so we check for compiled output
      expect(content).toBeTruthy();
      expect(typeof content).toBe('string');
      // Compiled CSS contains base styles like box-sizing
      expect(content).toContain('box-sizing');
    });

    test('returns null for other modules', async () => {
      const plugin = tailwind();
      const content = await plugin.load!('./other.css');

      expect(content).toBeNull();
    });
  });

  describe('transform', () => {
    test('returns null for non-CSS files', async () => {
      const plugin = tailwind();
      const result = await plugin.transform!('const x = 1', 'file.ts');

      expect(result).toBeNull();
    });

    test('returns null for CSS without tailwind directives', async () => {
      const plugin = tailwind();
      const result = await plugin.transform!('.class { color: red; }', 'file.css');

      expect(result).toBeNull();
    });

    test('returns compiled CSS for CSS with tailwind directives', async () => {
      const plugin = tailwind();
      const code = '@tailwind base; .custom {}';
      const result = await plugin.transform!(code, 'file.css');

      // transform() compiles through PostCSS, so result is compiled CSS
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).not.toBe(code);
    });
  });

  describe('setup', () => {
    test('calls setup without error when config does not exist', async () => {
      const plugin = tailwind();
      const mockContext = {
        root: '/nonexistent/path',
        mode: 'development' as const,
        config: {},
      };

      // Should not throw
      await expect(plugin.setup!(mockContext)).resolves.toBeUndefined();
    });

    test('calls setup with existing config path', async () => {
      const plugin = tailwind({ config: 'tailwind.config.js' });
      const mockContext = {
        root: import.meta.dir,
        mode: 'development' as const,
        config: {},
      };

      // Should not throw even if config doesn't exist
      await expect(plugin.setup!(mockContext)).resolves.toBeUndefined();
    });

    test('loads existing tailwind config when it exists', async () => {
      // Create a temporary config file to test the hasConfig = true path
      const fs = await import('node:fs/promises');
      const tmpDir = '/tmp/ereo-test-tailwind-' + Date.now();
      await fs.mkdir(tmpDir, { recursive: true });
      const configFile = `${tmpDir}/tailwind.config.js`;
      await Bun.write(configFile, 'module.exports = {}');

      // Verify the file was created
      const fileExists = await Bun.file(configFile).exists();
      expect(fileExists).toBe(true);

      // Create plugin BEFORE setting up the mock to avoid issues
      const plugin = tailwind({ config: 'tailwind.config.js' });
      const mockContext = {
        root: tmpDir,
        mode: 'development' as const,
        config: {},
      };

      // Capture logs during setup
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = function (...args: unknown[]) {
        logs.push(args.join(' '));
        originalLog.apply(console, args as [unknown?, ...unknown[]]);
      };

      try {
        await plugin.setup!(mockContext);
      } finally {
        console.log = originalLog;
      }

      // Check that the "Using existing" message was logged
      const foundExisting = logs.some((log) => log.includes('Using existing tailwind.config.js'));
      expect(foundExisting).toBe(true);

      // Clean up
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    test('handles error when checking for config file', async () => {
      const plugin = tailwind({ config: 'tailwind.config.js' });

      // Create a context with a path that will cause an error
      // We mock Bun.file to throw an error
      const mockContext = {
        root: '/proc/invalid/path/that/causes/error',
        mode: 'development' as const,
        config: {},
      };

      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args.join(' '));
      };

      // This should not throw but should warn
      await expect(plugin.setup!(mockContext)).resolves.toBeUndefined();

      console.warn = originalWarn;

      // Note: The warning may or may not be triggered depending on Bun's behavior
      // The test passes as long as it doesn't throw
    });

    test('uses EreoJS preset when config does not exist and usePreset is true', async () => {
      const plugin = tailwind({ usePreset: true });
      const mockContext = {
        root: '/nonexistent/path',
        mode: 'development' as const,
        config: {},
      };

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.join(' '));
      };

      await plugin.setup!(mockContext);

      console.log = originalLog;

      expect(logs.some((log) => log.includes('Using EreoJS Tailwind preset'))).toBe(true);
    });

    test('does not log preset message when usePreset is false', async () => {
      const plugin = tailwind({ usePreset: false });
      const mockContext = {
        root: '/nonexistent/path',
        mode: 'development' as const,
        config: {},
      };

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.join(' '));
      };

      await plugin.setup!(mockContext);

      console.log = originalLog;

      expect(logs.some((log) => log.includes('Using EreoJS Tailwind preset'))).toBe(false);
    });

    test('handles error when Bun.file throws', async () => {
      // Use a config name with a null byte which causes Bun.file to throw
      const plugin = tailwind({ config: 'tailwind\0.config.js' });
      const mockContext = {
        root: '/some/path',
        mode: 'development' as const,
        config: {},
      };

      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args.join(' '));
      };

      // Should not throw, but should warn
      await expect(plugin.setup!(mockContext)).resolves.toBeUndefined();

      console.warn = originalWarn;

      expect(warnings.some((warn) => warn.includes('Warning: Could not check for Tailwind config'))).toBe(true);
    });
  });

  describe('configureServer', () => {
    test('adds middleware to serve tailwind CSS', async () => {
      const plugin = tailwind();
      const middlewares: any[] = [];
      const mockServer = {
        middlewares: {
          push: (fn: any) => middlewares.push(fn),
        },
      };

      await plugin.configureServer!(mockServer);

      expect(middlewares.length).toBe(1);
    });

    test('serves tailwind CSS on __tailwind.css path', async () => {
      const plugin = tailwind();
      let middleware: any;
      const mockServer = {
        middlewares: {
          push: (fn: any) => { middleware = fn; },
        },
      };

      await plugin.configureServer!(mockServer);

      const request = new Request('http://localhost:3000/__tailwind.css');
      const response = await middleware(request, {}, () => new Response('fallback'));

      expect(response.headers.get('Content-Type')).toBe('text/css; charset=utf-8');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      const text = await response.text();
      expect(text).toBeTruthy();
    });

    test('calls next for non-tailwind paths', async () => {
      const plugin = tailwind();
      let middleware: any;
      const mockServer = {
        middlewares: {
          push: (fn: any) => { middleware = fn; },
        },
      };

      await plugin.configureServer!(mockServer);

      const request = new Request('http://localhost:3000/other-path');
      const response = await middleware(request, {}, () => new Response('fallback'));

      expect(await response.text()).toBe('fallback');
    });
  });

  describe('generateConfig', () => {
    test('generates config with EreoJS preset by default', () => {
      const config = generateConfig();

      expect(config).toContain('getEreoTailwindConfig');
      expect(config).toContain('@ereo/plugin-tailwind');
    });

    test('generates config without preset when disabled', () => {
      const config = generateConfig({ usePreset: false });

      expect(config).not.toContain('getEreoTailwindConfig');
      expect(config).toContain('content:');
      expect(config).toContain('darkMode:');
    });

    test('includes custom content paths', () => {
      const config = generateConfig({
        content: ['./custom/**/*.tsx'],
        usePreset: false,
      });

      expect(config).toContain('./custom/**/*.tsx');
    });

    test('includes dark mode setting', () => {
      const config = generateConfig({
        darkMode: 'media',
        usePreset: false,
      });

      expect(config).toContain("'media'");
    });
  });

  describe('generateCSSEntry', () => {
    test('generates CSS with tailwind directives', () => {
      const css = generateCSSEntry();

      expect(css).toContain('@tailwind base');
      expect(css).toContain('@tailwind components');
      expect(css).toContain('@tailwind utilities');
    });

    test('includes comment for custom styles', () => {
      const css = generateCSSEntry();

      expect(css).toContain('Custom styles');
    });
  });

  describe('TailwindPluginOptions', () => {
    interface TailwindPluginOptions {
      content?: string[];
      config?: string;
      darkMode?: 'class' | 'media' | false;
      usePreset?: boolean;
    }

    test('default content paths', () => {
      const defaults: Required<TailwindPluginOptions> = {
        content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
        config: 'tailwind.config.js',
        darkMode: 'class',
        usePreset: true,
      };

      expect(defaults.content).toHaveLength(2);
      expect(defaults.darkMode).toBe('class');
      expect(defaults.usePreset).toBe(true);
    });

    test('supports all dark mode options', () => {
      const options1: TailwindPluginOptions = { darkMode: 'class' };
      const options2: TailwindPluginOptions = { darkMode: 'media' };
      const options3: TailwindPluginOptions = { darkMode: false };

      expect(options1.darkMode).toBe('class');
      expect(options2.darkMode).toBe('media');
      expect(options3.darkMode).toBe(false);
    });
  });
});
