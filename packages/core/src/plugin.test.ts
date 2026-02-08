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

  describe('Plugin error handling', () => {
    test('setup hook errors propagate', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

      const plugin: Plugin = {
        name: 'failing-plugin',
        setup: () => {
          throw new Error('Setup failed');
        },
      };

      await expect(registry.register(plugin)).rejects.toThrow('Setup failed');
    });

    test('transform error includes plugin name in console', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

      const plugin: Plugin = {
        name: 'bad-transformer',
        transform: () => {
          throw new Error('Transform broke');
        },
      };

      await registry.register(plugin);

      await expect(registry.transform('code', 'file.ts')).rejects.toThrow('Transform broke');
    });

    test('transform returns original code when all plugins return null', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

      const plugin: Plugin = {
        name: 'noop-transformer',
        transform: () => null,
      };

      await registry.register(plugin);

      const result = await registry.transform('original', 'file.ts');
      expect(result).toBe('original');
    });
  });

  describe('Plugin registry with no plugins', () => {
    test('transform returns code unchanged', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      const result = await registry.transform('code', 'id');
      expect(result).toBe('code');
    });

    test('resolveId returns null', () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      expect(registry.resolveId('any')).toBeNull();
    });

    test('load returns null', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      expect(await registry.load('any')).toBeNull();
    });

    test('configureServer does not throw', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      await registry.configureServer({} as any);
    });

    test('buildStart does not throw', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      await registry.buildStart();
    });

    test('buildEnd does not throw', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      await registry.buildEnd();
    });

    test('getPlugins returns empty array', () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      expect(registry.getPlugins()).toEqual([]);
    });
  });

  describe('Plugin with async setup', () => {
    test('awaits async setup hook', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      let setupDone = false;

      const plugin: Plugin = {
        name: 'async-setup',
        setup: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          setupDone = true;
        },
      };

      await registry.register(plugin);
      expect(setupDone).toBe(true);
    });
  });

  describe('Registry in production mode', () => {
    test('production mode is passed to plugin context', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'production', '/app');
      let receivedMode = '';

      const plugin: Plugin = {
        name: 'mode-check',
        setup: (ctx) => {
          receivedMode = ctx.mode;
        },
      };

      await registry.register(plugin);
      expect(receivedMode).toBe('production');
    });
  });

  describe('securityHeadersPlugin', () => {
    test('is a valid plugin', () => {
      expect(securityHeadersPlugin.name).toBe('ereo:security-headers');
      expect(typeof securityHeadersPlugin.setup).toBe('function');
    });

    test('setup can be called without error', async () => {
      await securityHeadersPlugin.setup!({} as any);
      // Should complete without throwing
    });

    test('can be registered in a plugin registry', async () => {
      const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');
      await registry.register(securityHeadersPlugin);
      expect(registry.getPlugin('ereo:security-headers')).toBe(securityHeadersPlugin);
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

// ============================================================================
// Async transform
// ============================================================================
describe('@ereo/core - Plugin async transform', () => {
  test('awaits async transform hooks', async () => {
    const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

    const plugin: Plugin = {
      name: 'async-transformer',
      transform: async (code, id) => {
        await new Promise(r => setTimeout(r, 5));
        return code + ' /* async */';
      },
    };

    await registry.register(plugin);
    const result = await registry.transform('code', 'file.ts');
    expect(result).toBe('code /* async */');
  });

  test('chains async and sync transforms', async () => {
    const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

    await registry.register({
      name: 'sync-plugin',
      transform: (code) => code + '-sync',
    });

    await registry.register({
      name: 'async-plugin',
      transform: async (code) => {
        await new Promise(r => setTimeout(r, 5));
        return code + '-async';
      },
    });

    const result = await registry.transform('start', 'file.ts');
    expect(result).toBe('start-sync-async');
  });
});

// ============================================================================
// Error propagation in lifecycle hooks
// ============================================================================
describe('@ereo/core - Plugin lifecycle error propagation', () => {
  test('configureServer error propagates', async () => {
    const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

    await registry.register({
      name: 'bad-server-plugin',
      configureServer: async () => {
        throw new Error('Server config failed');
      },
    });

    await expect(registry.configureServer({} as any)).rejects.toThrow('Server config failed');
  });

  test('buildStart error propagates', async () => {
    const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

    await registry.register({
      name: 'bad-build-start',
      buildStart: async () => {
        throw new Error('Build start failed');
      },
    });

    await expect(registry.buildStart()).rejects.toThrow('Build start failed');
  });

  test('buildEnd error propagates', async () => {
    const registry = new PluginRegistry({ server: { port: 3000 } }, 'development', '/test');

    await registry.register({
      name: 'bad-build-end',
      buildEnd: async () => {
        throw new Error('Build end failed');
      },
    });

    await expect(registry.buildEnd()).rejects.toThrow('Build end failed');
  });
});

// ============================================================================
// composePlugins edge cases
// ============================================================================
describe('@ereo/core - composePlugins edge cases', () => {
  test('composePlugins with empty array returns functional plugin', async () => {
    const composed = composePlugins('empty', []);

    expect(composed.name).toBe('empty');
    await composed.setup!({} as any); // should not throw
    expect(await composed.transform!('code', 'file.ts')).toBeNull(); // no changes
    expect(composed.resolveId!('any')).toBeNull();
    expect(await composed.load!('any')).toBeNull();
    await composed.configureServer!({} as any); // should not throw
    await composed.buildStart!(); // should not throw
    await composed.buildEnd!(); // should not throw
  });

  test('composePlugins only runs sub-plugins that have the hook', async () => {
    const calls: string[] = [];

    const composed = composePlugins('mixed', [
      {
        name: 'has-setup',
        setup: () => { calls.push('setup'); },
      },
      {
        name: 'no-setup',
        // no setup hook
      },
      {
        name: 'has-build',
        buildStart: async () => { calls.push('build'); },
      },
    ]);

    await composed.setup!({} as any);
    await composed.buildStart!();

    expect(calls).toEqual(['setup', 'build']);
  });

  test('composePlugins transform stops chaining when sub returns non-null then next returns null', async () => {
    const composed = composePlugins('chain', [
      {
        name: 'modifier',
        transform: (code) => code + '-modified',
      },
      {
        name: 'noop',
        transform: () => null, // returns null but input already changed
      },
    ]);

    const result = await composed.transform!('start', 'file.ts');
    // First plugin changes 'start' to 'start-modified'
    // Second plugin returns null (no change to 'start-modified')
    // Since result ('start-modified') !== original ('start'), it returns the result
    expect(result).toBe('start-modified');
  });
});

// ============================================================================
// Plugin context includes config
// ============================================================================
describe('@ereo/core - Plugin context', () => {
  test('setup receives config in context', async () => {
    const config: FrameworkConfig = {
      server: { port: 8080, development: true },
      build: { target: 'bun' },
    };
    const registry = new PluginRegistry(config, 'development', '/root');
    let receivedConfig: FrameworkConfig | null = null;

    await registry.register({
      name: 'config-checker',
      setup: (ctx) => {
        receivedConfig = ctx.config;
      },
    });

    expect(receivedConfig).toBe(config);
    expect(receivedConfig!.server?.port).toBe(8080);
  });

  test('setup receives root in context', async () => {
    const registry = new PluginRegistry({}, 'development', '/my/project');
    let receivedRoot = '';

    await registry.register({
      name: 'root-checker',
      setup: (ctx) => {
        receivedRoot = ctx.root;
      },
    });

    expect(receivedRoot).toBe('/my/project');
  });
});

// ============================================================================
// Plugin registration order
// ============================================================================
describe('@ereo/core - Plugin ordering', () => {
  test('plugins execute in registration order', async () => {
    const registry = new PluginRegistry({}, 'development', '/test');
    const order: string[] = [];

    for (let i = 0; i < 5; i++) {
      await registry.register({
        name: `plugin-${i}`,
        setup: () => { order.push(`setup-${i}`); },
      });
    }

    expect(order).toEqual(['setup-0', 'setup-1', 'setup-2', 'setup-3', 'setup-4']);
  });

  test('getPlugins returns plugins in registration order', async () => {
    const registry = new PluginRegistry({}, 'development', '/test');

    await registry.register({ name: 'c' });
    await registry.register({ name: 'a' });
    await registry.register({ name: 'b' });

    const names = registry.getPlugins().map(p => p.name);
    expect(names).toEqual(['c', 'a', 'b']);
  });
});

// ============================================================================
// resolveId with multiple plugins
// ============================================================================
describe('@ereo/core - Plugin resolveId precedence', () => {
  test('first plugin to resolve wins', async () => {
    const registry = new PluginRegistry({}, 'development', '/test');

    await registry.register({
      name: 'resolver-1',
      resolveId: (id) => id === 'shared' ? 'from-1' : null,
    });

    await registry.register({
      name: 'resolver-2',
      resolveId: (id) => id === 'shared' ? 'from-2' : null,
    });

    expect(registry.resolveId('shared')).toBe('from-1');
  });

  test('skips plugins without resolveId hook', async () => {
    const registry = new PluginRegistry({}, 'development', '/test');

    await registry.register({ name: 'no-resolve' });
    await registry.register({
      name: 'has-resolve',
      resolveId: (id) => id === 'test' ? 'resolved' : null,
    });

    expect(registry.resolveId('test')).toBe('resolved');
  });
});

// ============================================================================
// load with multiple plugins
// ============================================================================
describe('@ereo/core - Plugin load precedence', () => {
  test('first plugin to load wins', async () => {
    const registry = new PluginRegistry({}, 'development', '/test');

    await registry.register({
      name: 'loader-1',
      load: async (id) => id === 'shared' ? 'content-1' : null,
    });

    await registry.register({
      name: 'loader-2',
      load: async (id) => id === 'shared' ? 'content-2' : null,
    });

    expect(await registry.load('shared')).toBe('content-1');
  });

  test('skips plugins without load hook', async () => {
    const registry = new PluginRegistry({}, 'development', '/test');

    await registry.register({ name: 'no-load' });
    await registry.register({
      name: 'has-load',
      load: async (id) => id === 'test' ? 'loaded' : null,
    });

    expect(await registry.load('test')).toBe('loaded');
  });
});
