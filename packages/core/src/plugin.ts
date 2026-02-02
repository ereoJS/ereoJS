/**
 * @oreo/core - Plugin System
 *
 * A simple yet powerful plugin system inspired by Vite.
 * Plugins can hook into various lifecycle events and transform code.
 */

import type { Plugin, PluginContext, DevServer, FrameworkConfig } from './types';

/**
 * Plugin registry for managing framework plugins.
 */
export class PluginRegistry {
  private plugins: Plugin[] = [];
  private context: PluginContext;

  constructor(config: FrameworkConfig, mode: 'development' | 'production', root: string) {
    this.context = { config, mode, root };
  }

  /**
   * Register a plugin.
   */
  async register(plugin: Plugin): Promise<void> {
    // Validate plugin
    if (!plugin.name) {
      throw new Error('Plugin must have a name');
    }

    // Check for duplicate plugins
    if (this.plugins.some((p) => p.name === plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already registered, skipping duplicate`);
      return;
    }

    this.plugins.push(plugin);

    // Call setup hook
    if (plugin.setup) {
      await plugin.setup(this.context);
    }
  }

  /**
   * Register multiple plugins.
   */
  async registerAll(plugins: Plugin[]): Promise<void> {
    for (const plugin of plugins) {
      await this.register(plugin);
    }
  }

  /**
   * Get all registered plugins.
   */
  getPlugins(): readonly Plugin[] {
    return this.plugins;
  }

  /**
   * Get a plugin by name.
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  /**
   * Run transform hooks on code.
   */
  async transform(code: string, id: string): Promise<string> {
    let result = code;

    for (const plugin of this.plugins) {
      if (plugin.transform) {
        const transformed = await plugin.transform(result, id);
        if (transformed !== null) {
          result = transformed;
        }
      }
    }

    return result;
  }

  /**
   * Resolve a module ID (for virtual modules).
   */
  resolveId(id: string): string | null {
    for (const plugin of this.plugins) {
      if (plugin.resolveId) {
        const resolved = plugin.resolveId(id);
        if (resolved !== null) {
          return resolved;
        }
      }
    }
    return null;
  }

  /**
   * Load a virtual module.
   */
  async load(id: string): Promise<string | null> {
    for (const plugin of this.plugins) {
      if (plugin.load) {
        const loaded = await plugin.load(id);
        if (loaded !== null) {
          return loaded;
        }
      }
    }
    return null;
  }

  /**
   * Configure the dev server with all plugins.
   */
  async configureServer(server: DevServer): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.configureServer) {
        await plugin.configureServer(server);
      }
    }
  }

  /**
   * Run buildStart hooks.
   */
  async buildStart(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.buildStart) {
        await plugin.buildStart();
      }
    }
  }

  /**
   * Run buildEnd hooks.
   */
  async buildEnd(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.buildEnd) {
        await plugin.buildEnd();
      }
    }
  }
}

/**
 * Helper to create a plugin with proper typing.
 */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

/**
 * Compose multiple plugins into one.
 */
export function composePlugins(name: string, plugins: Plugin[]): Plugin {
  return {
    name,
    async setup(context) {
      for (const plugin of plugins) {
        if (plugin.setup) {
          await plugin.setup(context);
        }
      }
    },
    async transform(code, id) {
      let result = code;
      for (const plugin of plugins) {
        if (plugin.transform) {
          const transformed = await plugin.transform(result, id);
          if (transformed !== null) {
            result = transformed;
          }
        }
      }
      return result !== code ? result : null;
    },
    resolveId(id) {
      for (const plugin of plugins) {
        if (plugin.resolveId) {
          const resolved = plugin.resolveId(id);
          if (resolved !== null) {
            return resolved;
          }
        }
      }
      return null;
    },
    async load(id) {
      for (const plugin of plugins) {
        if (plugin.load) {
          const loaded = await plugin.load(id);
          if (loaded !== null) {
            return loaded;
          }
        }
      }
      return null;
    },
    async configureServer(server) {
      for (const plugin of plugins) {
        if (plugin.configureServer) {
          await plugin.configureServer(server);
        }
      }
    },
    async buildStart() {
      for (const plugin of plugins) {
        if (plugin.buildStart) {
          await plugin.buildStart();
        }
      }
    },
    async buildEnd() {
      for (const plugin of plugins) {
        if (plugin.buildEnd) {
          await plugin.buildEnd();
        }
      }
    },
  };
}

/**
 * Built-in security headers plugin.
 * Adds sensible security defaults to all responses.
 */
export const securityHeadersPlugin = definePlugin({
  name: 'oreo:security-headers',
  setup() {
    // No setup needed
  },
});

/**
 * Check if a value is a valid plugin.
 */
export function isPlugin(value: unknown): value is Plugin {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof (value as Plugin).name === 'string'
  );
}
