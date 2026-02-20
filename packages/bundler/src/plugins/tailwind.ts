/**
 * @ereo/bundler - Tailwind CSS Plugin
 *
 * Full Tailwind CSS integration with PostCSS processing.
 * Supports @tailwind directives, @apply, custom config, and production minification.
 */

import { join, resolve, dirname } from 'node:path';
import { readFileSync, existsSync, statSync } from 'node:fs';
import type { Plugin, PluginContext, DevServer } from '@ereo/core';

// PostCSS and Tailwind types
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/**
 * Tailwind plugin options.
 */
export interface TailwindPluginOptions {
  /** Content paths to scan for classes (glob patterns) */
  content?: string[];
  /** Custom Tailwind config path */
  config?: string;
  /** Enable dark mode */
  darkMode?: 'class' | 'media' | 'selector' | false;
  /** Minify CSS in production */
  minify?: boolean;
  /** Enable source maps */
  sourcemap?: boolean;
  /** Custom PostCSS plugins */
  postcssPlugins?: any[];
  /** Watch content files for changes (dev mode) */
  watch?: boolean;
}

/**
 * Default content paths.
 */
const DEFAULT_CONTENT_PATHS = [
  './app/**/*.{js,ts,jsx,tsx,mdx}',
  './components/**/*.{js,ts,jsx,tsx,mdx}',
  './pages/**/*.{js,ts,jsx,tsx,mdx}',
  './src/**/*.{js,ts,jsx,tsx,mdx}',
];

/**
 * Cache entry for processed CSS.
 */
interface CacheEntry {
  css: string;
  map?: string;
  timestamp: number;
  dependencies: string[];
}

/**
 * Class scanner result.
 */
interface ScanResult {
  classes: Set<string>;
  files: string[];
}

/**
 * Create Tailwind plugin with full CSS processing.
 */
export function createTailwindPlugin(options: TailwindPluginOptions = {}): Plugin {
  const {
    content = DEFAULT_CONTENT_PATHS,
    config,
    darkMode = 'class',
    minify = process.env.NODE_ENV === 'production',
    sourcemap = process.env.NODE_ENV !== 'production',
    postcssPlugins = [],
    watch = true,
  } = options;

  // Internal state
  let tailwindConfig: any = null;
  let root: string = process.cwd();
  let mode: 'development' | 'production' = 'development';
  let cssCache = new Map<string, CacheEntry>();
  let processor: postcss.Processor | null = null;
  let contentFilesCache: Map<string, number> = new Map();
  let scannedClasses: Set<string> = new Set();

  /**
   * Load Tailwind configuration.
   */
  async function loadTailwindConfig(): Promise<any> {
    const configPaths = [
      config ? resolve(root, config) : null,
      join(root, 'tailwind.config.js'),
      join(root, 'tailwind.config.ts'),
      join(root, 'tailwind.config.mjs'),
      join(root, 'tailwind.config.cjs'),
    ].filter(Boolean) as string[];

    for (const configPath of configPaths) {
      try {
        if (existsSync(configPath)) {
          // Clear module cache for hot reload
          delete require.cache?.[configPath];

          // Import the config (supports ESM and CJS)
          const imported = await import(configPath);
          const loadedConfig = imported.default || imported;

          console.log(`  [Tailwind] Using config: ${configPath}`);
          return loadedConfig;
        }
      } catch (error) {
        console.warn(`  [Tailwind] Failed to load config from ${configPath}:`, error);
      }
    }

    // Return default config if no custom config found
    console.log('  [Tailwind] Using default configuration');
    return createDefaultConfig();
  }

  /**
   * Create default Tailwind configuration.
   */
  function createDefaultConfig() {
    return {
      content: content.map((p) => resolve(root, p)),
      darkMode,
      theme: {
        extend: {},
      },
      plugins: [],
    };
  }

  /**
   * Merge user config with defaults.
   */
  function mergeConfig(userConfig: any): any {
    const resolvedContent = userConfig.content || content.map((p) => resolve(root, p));

    return {
      ...userConfig,
      content: Array.isArray(resolvedContent)
        ? resolvedContent.map((p: string) =>
            typeof p === 'string' && !p.startsWith('/') && !p.startsWith('.')
              ? resolve(root, p)
              : p
          )
        : resolvedContent,
      darkMode: userConfig.darkMode ?? darkMode,
    };
  }

  /**
   * Create PostCSS processor.
   */
  function createProcessor(tailwindCfg: any): postcss.Processor {
    const plugins: postcss.AcceptedPlugin[] = [
      tailwindcss(tailwindCfg),
      autoprefixer(),
      ...postcssPlugins,
    ];

    // Add minification for production
    if (minify) {
      try {
        const cssnano = require('cssnano');
        plugins.push(cssnano({
          preset: ['default', {
            discardComments: { removeAll: true },
            normalizeWhitespace: true,
          }],
        }));
      } catch {
        console.warn('  [Tailwind] cssnano not available, skipping minification');
      }
    }

    return postcss(plugins);
  }

  /**
   * Process CSS with Tailwind.
   */
  async function processTailwindCSS(
    css: string,
    filename: string,
    force = false
  ): Promise<{ css: string; map?: string }> {
    // Check cache
    const cached = cssCache.get(filename);
    if (cached && !force) {
      const fileStats = existsSync(filename) ? statSync(filename).mtimeMs : 0;
      if (cached.timestamp >= fileStats) {
        // Check if any content files changed
        let contentChanged = false;
        for (const dep of cached.dependencies) {
          if (existsSync(dep)) {
            const depStats = statSync(dep).mtimeMs;
            if (depStats > cached.timestamp) {
              contentChanged = true;
              break;
            }
          }
        }
        if (!contentChanged) {
          return { css: cached.css, map: cached.map };
        }
      }
    }

    if (!processor) {
      processor = createProcessor(tailwindConfig);
    }

    try {
      const result = await processor.process(css, {
        from: filename,
        to: filename.replace(/\.css$/, '.out.css'),
        map: sourcemap ? { inline: false, annotation: false } : false,
      });

      // Extract dependencies from messages
      const dependencies: string[] = [];
      for (const message of result.messages) {
        if (message.type === 'dependency') {
          dependencies.push(message.file);
        }
      }

      // Update cache
      cssCache.set(filename, {
        css: result.css,
        map: result.map?.toString(),
        timestamp: Date.now(),
        dependencies,
      });

      return {
        css: result.css,
        map: result.map?.toString(),
      };
    } catch (error: any) {
      console.error(`  [Tailwind] Processing error in ${filename}:`);
      console.error(`    ${error.message}`);

      if (error.line && error.column) {
        console.error(`    at line ${error.line}, column ${error.column}`);
      }

      throw error;
    }
  }

  /**
   * Scan content files for Tailwind classes.
   * This is used for generating optimized CSS.
   */
  async function scanContentFiles(): Promise<ScanResult> {
    const classes = new Set<string>();
    const files: string[] = [];

    try {
      const { glob } = await import('glob');

      for (const pattern of tailwindConfig.content) {
        if (typeof pattern === 'string') {
          const matches = await glob(pattern, {
            cwd: root,
            absolute: true,
            ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
          });

          for (const file of matches) {
            files.push(file);
            const content = readFileSync(file, 'utf-8');
            extractClasses(content, classes);
          }
        } else if (pattern.raw) {
          // Handle raw content patterns
          extractClasses(pattern.raw, classes);
        }
      }
    } catch (error) {
      console.warn('  [Tailwind] Failed to scan content files:', error);
    }

    return { classes, files };
  }

  /**
   * Extract Tailwind classes from content.
   */
  function extractClasses(content: string, classes: Set<string>): void {
    // Match class names in className="...", class="...", and template literals
    const patterns = [
      /class(?:Name)?=["'`]([^"'`]+)["'`]/g,
      /class(?:Name)?={[`"]([^`"]+)[`"]}/g,
      /clsx\(([^)]+)\)/g,
      /cn\(([^)]+)\)/g,
      /tw`([^`]+)`/g,
      /cva\(([^)]+)\)/g,
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const classString = match[1];
        // Split by whitespace and add each class
        const individualClasses = classString.split(/\s+/).filter(Boolean);
        for (const cls of individualClasses) {
          // Clean up the class (remove quotes, commas, etc.)
          const cleanClass = cls.replace(/['"`,]/g, '').trim();
          if (cleanClass && !cleanClass.includes('{') && !cleanClass.includes('$')) {
            classes.add(cleanClass);
          }
        }
      }
    }
  }

  /**
   * Check if content files have changed.
   */
  async function haveContentFilesChanged(): Promise<boolean> {
    const { glob } = await import('glob');

    for (const pattern of tailwindConfig.content) {
      if (typeof pattern !== 'string') continue;

      const matches = await glob(pattern, {
        cwd: root,
        absolute: true,
        ignore: ['**/node_modules/**'],
      });

      for (const file of matches) {
        try {
          const stats = statSync(file);
          const cachedTime = contentFilesCache.get(file);

          if (!cachedTime || stats.mtimeMs > cachedTime) {
            contentFilesCache.set(file, stats.mtimeMs);
            return true;
          }
        } catch {
          // File doesn't exist or can't be read
        }
      }
    }

    return false;
  }

  /**
   * Invalidate cache for hot reload.
   */
  function invalidateCache(): void {
    cssCache.clear();
    processor = null;
  }

  return {
    name: 'ereo:tailwind',

    async setup(context: PluginContext) {
      root = context.root;
      mode = context.mode;

      // Load Tailwind configuration
      const userConfig = await loadTailwindConfig();
      tailwindConfig = mergeConfig(userConfig);

      // Create processor
      processor = createProcessor(tailwindConfig);

      console.log(`  [Tailwind] Initialized in ${mode} mode`);
      console.log(`  [Tailwind] Scanning ${tailwindConfig.content.length} content patterns`);
    },

    async transform(code: string, id: string) {
      // Only process CSS files
      if (!id.endsWith('.css')) {
        return null;
      }

      // Check if this file uses Tailwind directives
      const hasTailwindDirectives =
        code.includes('@tailwind') ||
        code.includes('@apply') ||
        code.includes('@layer') ||
        code.includes('@config');

      if (!hasTailwindDirectives) {
        return null;
      }

      try {
        // Check if content files changed (for cache invalidation)
        if (mode === 'development' && watch) {
          const changed = await haveContentFilesChanged();
          if (changed) {
            invalidateCache();
          }
        }

        const result = await processTailwindCSS(code, id);
        return result.css;
      } catch (error: any) {
        // In development, return CSS with error comment
        if (mode === 'development') {
          return `/* Tailwind CSS Error: ${error.message.replace(/\*\//g, '*\\/')} */\n${code}`;
        }
        throw error;
      }
    },

    resolveId(id: string) {
      // Handle virtual tailwind module
      if (id === 'virtual:tailwind.css' || id === '@ereo/tailwind') {
        return '\0virtual:tailwind.css';
      }
      return null;
    },

    async load(id: string) {
      // Return generated Tailwind CSS for virtual module
      if (id === '\0virtual:tailwind.css') {
        const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;
        `.trim();

        try {
          const result = await processTailwindCSS(css, 'virtual:tailwind.css');
          return result.css;
        } catch (error: any) {
          console.error('  [Tailwind] Failed to generate virtual CSS:', error.message);
          return css;
        }
      }
      return null;
    },

    async configureServer(server: DevServer) {
      // Add file watcher for Tailwind config
      const configPaths = [
        'tailwind.config.js',
        'tailwind.config.ts',
        'tailwind.config.mjs',
        'tailwind.config.cjs',
      ];

      // Watch for config changes
      if (server.watcher) {
        for (const configFile of configPaths) {
          const fullPath = join(root, configFile);
          if (existsSync(fullPath)) {
            server.watcher.add(fullPath);
          }
        }

        server.watcher.on('change', async (file: string) => {
          // Check if it's a Tailwind config file
          if (configPaths.some(cfg => file.endsWith(cfg))) {
            console.log('  [Tailwind] Config changed, reloading...');

            // Reload config
            const userConfig = await loadTailwindConfig();
            tailwindConfig = mergeConfig(userConfig);

            // Recreate processor
            processor = createProcessor(tailwindConfig);

            // Invalidate cache
            invalidateCache();

            // Trigger HMR
            if (server.ws) {
              server.ws.send({
                type: 'full-reload',
                path: '*',
              });
            }
          }
        });
      }

      // Add middleware to serve Tailwind CSS
      if (server.middlewares) {
        server.middlewares.push(async (request: Request, context: any, next: () => Promise<Response>) => {
          const url = new URL(request.url);

          // Handle /__tailwind.css endpoint
          if (url.pathname === '/__tailwind.css') {
            try {
              const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;
              `.trim();

              const result = await processTailwindCSS(css, '__tailwind.css');

              return new Response(result.css, {
                headers: {
                  'Content-Type': 'text/css',
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'X-Tailwind-Version': '3.4',
                },
              });
            } catch (error: any) {
              return new Response(
                `/* Tailwind CSS Error: ${error.message} */`,
                {
                  status: 500,
                  headers: { 'Content-Type': 'text/css' },
                }
              );
            }
          }

          return next();
        });
      }
    },

    async buildStart() {
      // Pre-scan content files for production builds
      if (mode === 'production') {
        console.log('  [Tailwind] Scanning content files...');
        const { classes, files } = await scanContentFiles();
        scannedClasses = classes;
        console.log(`  [Tailwind] Found ${classes.size} unique classes in ${files.length} files`);
      }
    },

    async buildEnd() {
      // Log final stats
      if (mode === 'production') {
        console.log('  [Tailwind] Build complete');
      }
    },
  };
}

/**
 * Generate Tailwind config file content.
 */
export function generateTailwindConfig(options: TailwindPluginOptions = {}): string {
  const { content = DEFAULT_CONTENT_PATHS, darkMode = 'class' } = options;

  return `
/** @type {import('tailwindcss').Config} */
export default {
  content: ${JSON.stringify(content, null, 4)},
  darkMode: ${darkMode === false ? 'false' : `'${darkMode}'`},
  theme: {
    extend: {
      // Add your custom theme extensions here
      colors: {
        // primary: '#3b82f6',
      },
      fontFamily: {
        // sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    // Add plugins here
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
  ],
};
  `.trim();
}

/**
 * Generate CSS entry file with Tailwind directives.
 */
export function generateCSSEntry(): string {
  return `
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
 * Custom base styles
 * Use @layer base { ... } for base styles
 */

/*
 * Custom components
 * Use @layer components { ... } for component styles
 */

/*
 * Custom utilities
 * Use @layer utilities { ... } for utility styles
 */
  `.trim();
}

/**
 * Check if Tailwind is configured in a project.
 */
export async function hasTailwindConfig(root: string): Promise<boolean> {
  const configFiles = [
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.cjs',
    'tailwind.config.mjs',
  ];

  for (const file of configFiles) {
    if (existsSync(join(root, file))) {
      return true;
    }
  }

  // Also check package.json for tailwindcss dependency
  try {
    const pkgPath = join(root, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return 'tailwindcss' in deps;
    }
  } catch {
    // Ignore package.json read errors
  }

  return false;
}

/**
 * Create Tailwind CSS middleware for dev server.
 * This provides a standalone middleware for serving processed Tailwind CSS.
 */
export function tailwindMiddleware(options: TailwindPluginOptions = {}) {
  let processor: postcss.Processor | null = null;
  let tailwindConfig: any = null;
  let cssCache: string | null = null;
  let cacheTimestamp = 0;

  // Initialize processor lazily
  async function getProcessor(root: string): Promise<postcss.Processor> {
    if (!processor) {
      // Load config
      const configPaths = [
        options.config ? resolve(root, options.config) : null,
        join(root, 'tailwind.config.js'),
        join(root, 'tailwind.config.ts'),
      ].filter(Boolean) as string[];

      for (const configPath of configPaths) {
        if (existsSync(configPath)) {
          try {
            const imported = await import(configPath);
            tailwindConfig = imported.default || imported;
            break;
          } catch {
            // Continue to next config
          }
        }
      }

      if (!tailwindConfig) {
        tailwindConfig = {
          content: (options.content || DEFAULT_CONTENT_PATHS).map(p => resolve(root, p)),
          darkMode: options.darkMode || 'class',
          theme: { extend: {} },
          plugins: [],
        };
      }

      processor = postcss([
        tailwindcss(tailwindConfig),
        autoprefixer(),
      ]);
    }
    return processor;
  }

  return async (request: Request, context: any, next: () => Promise<Response>) => {
    const url = new URL(request.url);

    // Handle Tailwind CSS requests
    if (url.pathname === '/__tailwind.css') {
      const root = context.root || process.cwd();

      try {
        // Check cache validity (1 second in dev)
        const now = Date.now();
        if (cssCache && now - cacheTimestamp < 1000) {
          return new Response(cssCache, {
            headers: {
              'Content-Type': 'text/css',
              'Cache-Control': 'no-cache',
            },
          });
        }

        const proc = await getProcessor(root);

        const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;
        `.trim();

        const result = await proc.process(css, {
          from: '__tailwind.css',
        });

        cssCache = result.css;
        cacheTimestamp = now;

        return new Response(result.css, {
          headers: {
            'Content-Type': 'text/css',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (error: any) {
        return new Response(
          `/* Tailwind CSS Error: ${error.message} */`,
          {
            status: 500,
            headers: { 'Content-Type': 'text/css' },
          }
        );
      }
    }

    return next();
  };
}

/**
 * Extract Tailwind classes from a file for safelist generation.
 */
export function extractTailwindClasses(content: string): string[] {
  const classes = new Set<string>();

  // Common patterns for class declarations
  const patterns = [
    /class(?:Name)?=["']([^"']+)["']/g,
    /class(?:Name)?={`([^`]+)`}/g,
    /class(?:Name)?={\s*["']([^"']+)["']\s*}/g,
    /tw`([^`]+)`/g,
    /clsx\(\s*["']([^"']+)["']/g,
    /cn\(\s*["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const classString = match[1];
      classString.split(/\s+/).filter(Boolean).forEach(cls => {
        const cleanClass = cls.replace(/['"`,]/g, '').trim();
        if (cleanClass && !cleanClass.includes('{') && !cleanClass.includes('$')) {
          classes.add(cleanClass);
        }
      });
    }
  }

  return Array.from(classes);
}

/**
 * Generate safelist from content files for JIT optimization.
 */
export async function generateSafelist(root: string, patterns: string[]): Promise<string[]> {
  const classes = new Set<string>();

  try {
    const { glob } = await import('glob');

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: root,
        absolute: true,
        ignore: ['**/node_modules/**'],
      });

      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        extractTailwindClasses(content).forEach(cls => classes.add(cls));
      }
    }
  } catch (error) {
    console.warn('Failed to generate safelist:', error);
  }

  return Array.from(classes);
}
