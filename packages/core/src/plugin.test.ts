import { describe, expect, test, beforeEach } from 'bun:test';
import {
  PluginRegistry,
  definePlugin,
  composePlugins,
  isPlugin,
  securityHeadersPlugin,
} from './plugin';
import type { Plugin, FrameworkConfig } from './types';

describe('@ereo/core - Plugin', () => {
  describe('PluginRegistry', () => {
    let registry: PluginRegistry;
    const mockConfig: FrameworkConfig = { server: { port: 3000 } };

    beforeEach(() => {
      registry = new PluginRegistry(mockConfig, 'development', '/test');
    });

    test('creates a registry', () => {
      expect(registry).toBeInstanceOf(PluginRegistry);
    });

    test('registers a plugin', async () => {
      const plugin: Plugin = { name: 'test-plugin' };

      await registry.register(plugin);

      expect(registry.getPlugins()).toHaveLength(1);
      expect(registry.getPlugin('test-plugin')).toBe(plugin);
    });

    test('throws when plugin has no name', async () => {
      const plugin = {} as Plugin;

      await expect(registry.register(plugin)).rejects.toThrow('Plugin must have a name');
    });

    test('warns and skips duplicate plugins', async () => {
      const plugin: Plugin = { name: 'duplicate' };

      await registry.register(plugin);
      await registry.register(plugin);

      expect(registry.getPlugins()).toHaveLength(1);
    });

    test('calls setup hook on registration', async () => {
      let setupCalled = false;
      const plugin: Plugin = {
        name: 'setup-test',
        setup: (context) => {
          setupCalled = true;
          expect(context.mode).toBe('development');
          expect(context.root).toBe('/test');
        },
      };

      await registry.register(plugin);

      expect(setupCalled).toBe(true);
    });

    test('registers multiple plugins', async () => {
      const plugins: Plugin[] = [
        { name: 'plugin-1' },
        { name: 'plugin-2' },
        { name: 'plugin-3' },
      ];

      await registry.registerAll(plugins);

      expect(registry.getPlugins()).toHaveLength(3);
    });

    test('returns undefined for unknown plugin', () => {
      expect(registry.getPlugin('unknown')).toBeUndefined();
    });

    test('transforms code through plugins', async () => {
      const plugin: Plugin = {
        name: 'transform-test',
        transform: (code, id) => {
          if (id.endsWith('.ts')) {
            return code.replace('const', 'let');
          }
          return null;
        },
      };

      await registry.register(plugin);

      const result = await registry.transform('const x = 1;', 'file.ts');
      expect(result).toBe('let x = 1;');
    });

    test('chains transforms across plugins', async () => {
      const plugin1: Plugin = {
        name: 'transform-1',
        transform: (code) => code + ' // plugin1',
      };
      const plugin2: Plugin = {
        name: 'transform-2',
        transform: (code) => code + ' // plugin2',
      };

      await registry.register(plugin1);
      await registry.register(plugin2);

      const result = await registry.transform('code', 'file.ts');
      expect(result).toBe('code // plugin1 // plugin2');
    });

    test('resolves virtual module IDs', async () => {
      const plugin: Plugin = {
        name: 'resolve-test',
        resolveId: (id) => {
          if (id === 'virtual:test') {
            return '\0virtual:test';
          }
          return null;
        },
      };

      await registry.register(plugin);

      expect(registry.resolveId('virtual:test')).toBe('\0virtual:test');
      expect(registry.resolveId('real-module')).toBeNull();
    });

    test('loads virtual modules', async () => {
      const plugin: Plugin = {
        name: 'load-test',
        load: async (id) => {
          if (id === '\0virtual:test') {
            return 'export default "virtual content"';
          }
          return null;
        },
      };

      await registry.register(plugin);

      const content = await registry.load('\0virtual:test');
      expect(content).toBe('export default "virtual content"');

      const noContent = await registry.load('other-id');
      expect(noContent).toBeNull();
    });

    test('configures dev server', async () => {
      let configured = false;
      const plugin: Plugin = {
        name: 'server-test',
        configureServer: async (server) => {
          configured = true;
        },
      };

      await registry.register(plugin);
      await registry.configureServer({} as any);

      expect(configured).toBe(true);
    });

    test('runs buildStart hooks', async () => {
      let started = false;
      const plugin: Plugin = {
        name: 'build-start-test',
        buildStart: async () => {
          started = true;
        },
      };

      await registry.register(plugin);
      await registry.buildStart();

      expect(started).toBe(true);
    });

    test('runs buildEnd hooks', async () => {
      let ended = false;
      const plugin: Plugin = {
        name: 'build-end-test',
        buildEnd: async () => {
          ended = true;
        },
      };

      await registry.register(plugin);
      await registry.buildEnd();

      expect(ended).toBe(true);
    });
  });

  describe('definePlugin', () => {
    test('returns the plugin object unchanged', () => {
      const plugin: Plugin = {
        name: 'test',
        setup: () => {},
      };

      const result = definePlugin(plugin);

      expect(result).toBe(plugin);
    });
  });

  describe('composePlugins', () => {
    test('creates a composed plugin with combined name', () => {
      const composed = composePlugins('composed', [
        { name: 'sub-1' },
        { name: 'sub-2' },
      ]);

      expect(composed.name).toBe('composed');
    });

    test('runs setup for all sub-plugins', async () => {
      const calls: string[] = [];

      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          setup: () => { calls.push('sub-1'); },
        },
        {
          name: 'sub-2',
          setup: () => { calls.push('sub-2'); },
        },
      ]);

      await composed.setup!({} as any);

      expect(calls).toEqual(['sub-1', 'sub-2']);
    });

    test('chains transforms from sub-plugins', async () => {
      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          transform: (code) => code + '-1',
        },
        {
          name: 'sub-2',
          transform: (code) => code + '-2',
        },
      ]);

      const result = await composed.transform!('start', 'file.ts');

      expect(result).toBe('start-1-2');
    });

    test('returns null from transform if no changes', async () => {
      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          transform: () => null,
        },
      ]);

      const result = await composed.transform!('unchanged', 'file.ts');

      expect(result).toBeNull();
    });

    test('resolves IDs from first matching sub-plugin', () => {
      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          resolveId: (id) => (id === 'a' ? 'resolved-a' : null),
        },
        {
          name: 'sub-2',
          resolveId: (id) => (id === 'b' ? 'resolved-b' : null),
        },
      ]);

      expect(composed.resolveId!('a')).toBe('resolved-a');
      expect(composed.resolveId!('b')).toBe('resolved-b');
      expect(composed.resolveId!('c')).toBeNull();
    });

    test('loads from first matching sub-plugin', async () => {
      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          load: async (id) => (id === 'a' ? 'content-a' : null),
        },
        {
          name: 'sub-2',
          load: async (id) => (id === 'b' ? 'content-b' : null),
        },
      ]);

      expect(await composed.load!('a')).toBe('content-a');
      expect(await composed.load!('b')).toBe('content-b');
      expect(await composed.load!('c')).toBeNull();
    });

    test('configures server for all sub-plugins', async () => {
      const calls: string[] = [];

      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          configureServer: async () => { calls.push('sub-1'); },
        },
        {
          name: 'sub-2',
          configureServer: async () => { calls.push('sub-2'); },
        },
      ]);

      await composed.configureServer!({} as any);

      expect(calls).toEqual(['sub-1', 'sub-2']);
    });

    test('runs buildStart for all sub-plugins', async () => {
      const calls: string[] = [];

      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          buildStart: async () => { calls.push('sub-1'); },
        },
        {
          name: 'sub-2',
          buildStart: async () => { calls.push('sub-2'); },
        },
      ]);

      await composed.buildStart!();

      expect(calls).toEqual(['sub-1', 'sub-2']);
    });

    test('runs buildEnd for all sub-plugins', async () => {
      const calls: string[] = [];

      const composed = composePlugins('composed', [
        {
          name: 'sub-1',
          buildEnd: async () => { calls.push('sub-1'); },
        },
        {
          name: 'sub-2',
          buildEnd: async () => { calls.push('sub-2'); },
        },
      ]);

      await composed.buildEnd!();

      expect(calls).toEqual(['sub-1', 'sub-2']);
    });
  });

  describe('securityHeadersPlugin', () => {
    test('is a valid plugin', () => {
      expect(securityHeadersPlugin.name).toBe('ereo:security-headers');
      expect(typeof securityHeadersPlugin.setup).toBe('function');
    });
  });

  describe('isPlugin', () => {
    test('returns true for valid plugins', () => {
      expect(isPlugin({ name: 'test' })).toBe(true);
      expect(isPlugin({ name: 'test', setup: () => {} })).toBe(true);
    });

    test('returns false for invalid values', () => {
      expect(isPlugin(null)).toBe(false);
      expect(isPlugin(undefined)).toBe(false);
      expect(isPlugin({})).toBe(false);
      expect(isPlugin({ setup: () => {} })).toBe(false);
      expect(isPlugin('string')).toBe(false);
      expect(isPlugin(123)).toBe(false);
      expect(isPlugin({ name: 123 })).toBe(false);
    });
  });
});
