/**
 * @areo/core - Plugin System
 *
 * A simple yet powerful plugin system inspired by Vite.
 * Plugins can hook into various lifecycle events and transform code.
 */
import type { Plugin, DevServer, FrameworkConfig } from './types';
/**
 * Plugin registry for managing framework plugins.
 */
export declare class PluginRegistry {
    private plugins;
    private context;
    constructor(config: FrameworkConfig, mode: 'development' | 'production', root: string);
    /**
     * Register a plugin.
     */
    register(plugin: Plugin): Promise<void>;
    /**
     * Register multiple plugins.
     */
    registerAll(plugins: Plugin[]): Promise<void>;
    /**
     * Get all registered plugins.
     */
    getPlugins(): readonly Plugin[];
    /**
     * Get a plugin by name.
     */
    getPlugin(name: string): Plugin | undefined;
    /**
     * Run transform hooks on code.
     */
    transform(code: string, id: string): Promise<string>;
    /**
     * Resolve a module ID (for virtual modules).
     */
    resolveId(id: string): string | null;
    /**
     * Load a virtual module.
     */
    load(id: string): Promise<string | null>;
    /**
     * Configure the dev server with all plugins.
     */
    configureServer(server: DevServer): Promise<void>;
    /**
     * Run buildStart hooks.
     */
    buildStart(): Promise<void>;
    /**
     * Run buildEnd hooks.
     */
    buildEnd(): Promise<void>;
}
/**
 * Helper to create a plugin with proper typing.
 */
export declare function definePlugin(plugin: Plugin): Plugin;
/**
 * Compose multiple plugins into one.
 */
export declare function composePlugins(name: string, plugins: Plugin[]): Plugin;
/**
 * Built-in security headers plugin.
 * Adds sensible security defaults to all responses.
 */
export declare const securityHeadersPlugin: Plugin;
/**
 * Check if a value is a valid plugin.
 */
export declare function isPlugin(value: unknown): value is Plugin;
//# sourceMappingURL=plugin.d.ts.map