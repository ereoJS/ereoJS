/**
 * @ereo/plugin-tailwind
 *
 * Zero-config Tailwind CSS integration for EreoJS.
 * Compiles Tailwind CSS locally via PostCSS — no CDN dependency.
 */

import { join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from '@ereo/core';
import { ereoPreset, getEreoTailwindConfig } from './preset';

/**
 * Tailwind plugin options.
 */
export interface TailwindPluginOptions {
  /** Content paths to scan (auto-detected by default) */
  content?: string[];
  /** Path to tailwind.config.js (auto-detected by default) */
  config?: string;
  /** Path to CSS entry file (auto-detected: app/styles.css) */
  css?: string;
  /** Enable dark mode */
  darkMode?: 'class' | 'media' | false;
  /** Use EreoJS preset */
  usePreset?: boolean;
}

/**
 * Default options.
 */
const defaults: Required<TailwindPluginOptions> = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  config: 'tailwind.config.js',
  css: '',
  darkMode: 'class',
  usePreset: true,
};

/** Default Tailwind directives when no user CSS file is found. */
const DEFAULT_CSS = `@tailwind base;\n@tailwind components;\n@tailwind utilities;`;

/**
 * Create Tailwind CSS plugin.
 *
 * @example
 * import { defineConfig } from '@ereo/core';
 * import tailwind from '@ereo/plugin-tailwind';
 *
 * export default defineConfig({
 *   plugins: [
 *     tailwind(), // Zero-config
 *   ],
 * });
 */
export default function tailwind(options: TailwindPluginOptions = {}): Plugin {
  const opts = { ...defaults, ...options };
  let root = process.cwd();
  let processor: any = null;
  let cssCache: string | null = null;
  let cacheTimestamp = 0;
  let tailwindConfig: any = null;

  /**
   * Locate the user's CSS entry file (contains @tailwind directives + @apply).
   */
  function findCSSEntry(): string {
    if (opts.css) {
      const abs = resolve(root, opts.css);
      if (existsSync(abs)) return abs;
    }
    // Auto-detect common locations
    const candidates = [
      'app/styles.css',
      'app/globals.css',
      'app/global.css',
      'src/styles.css',
      'src/globals.css',
      'styles/globals.css',
    ];
    for (const c of candidates) {
      const abs = join(root, c);
      if (existsSync(abs)) return abs;
    }
    return '';
  }

  /**
   * Load Tailwind configuration from the project.
   */
  async function loadTailwindConfig(): Promise<any> {
    const configPaths = [
      opts.config ? resolve(root, opts.config) : null,
      join(root, 'tailwind.config.js'),
      join(root, 'tailwind.config.ts'),
      join(root, 'tailwind.config.mjs'),
      join(root, 'tailwind.config.cjs'),
    ].filter(Boolean) as string[];

    for (const configPath of configPaths) {
      try {
        if (existsSync(configPath)) {
          delete require.cache?.[configPath];
          const imported = await import(configPath);
          return imported.default || imported;
        }
      } catch (e) {
        console.warn(`  [Tailwind] Failed to load config: ${configPath}`);
      }
    }
    return null;
  }

  /**
   * Create PostCSS processor with Tailwind + Autoprefixer.
   */
  async function ensureProcessor(): Promise<any> {
    if (processor) return processor;

    const postcss = (await import('postcss')).default;
    const tailwindcss = (await import('tailwindcss')).default;
    let autoprefixer: any;
    try {
      autoprefixer = (await import('autoprefixer')).default;
    } catch {
      // autoprefixer is optional
    }

    const userConfig = await loadTailwindConfig();
    tailwindConfig = userConfig
      ? {
          ...userConfig,
          content: Array.isArray(userConfig.content)
            ? userConfig.content.map((p: string) =>
                typeof p === 'string' && !p.startsWith('/') ? resolve(root, p) : p
              )
            : userConfig.content,
        }
      : {
          content: opts.content.map((p) => resolve(root, p)),
          darkMode: opts.darkMode || 'class',
          theme: { extend: {} },
          plugins: [],
        };

    const plugins: any[] = [tailwindcss(tailwindConfig)];
    if (autoprefixer) plugins.push(autoprefixer());

    processor = postcss(plugins);
    return processor;
  }

  /**
   * Compile the CSS through PostCSS + Tailwind.
   */
  async function compileTailwind(): Promise<string> {
    // Check cache (1s TTL in dev)
    const now = Date.now();
    if (cssCache && now - cacheTimestamp < 1000) return cssCache;

    const proc = await ensureProcessor();

    // Read user CSS or fall back to defaults
    const cssEntryPath = findCSSEntry();
    const inputCSS = cssEntryPath ? readFileSync(cssEntryPath, 'utf-8') : DEFAULT_CSS;

    const result = await proc.process(inputCSS, {
      from: cssEntryPath || '__tailwind.css',
    });

    cssCache = result.css;
    cacheTimestamp = now;
    return result.css;
  }

  return {
    name: 'ereo:tailwind',

    async setup(context) {
      root = context.root;
      const configPath = join(root, opts.config);

      try {
        const hasConfig = await Bun.file(configPath).exists();
        if (hasConfig) {
          console.log('  Using existing tailwind.config.js');
        } else if (opts.usePreset) {
          console.log('  Using EreoJS Tailwind preset');
        }
      } catch {
        console.warn('  Warning: Could not check for Tailwind config');
      }

      // Eagerly initialize the processor so first request is fast
      try {
        await ensureProcessor();
        console.log('  [Tailwind] PostCSS processor ready');
      } catch (e: any) {
        console.warn('  [Tailwind] Could not initialize processor:', e.message);
      }
    },

    resolveId(id: string) {
      if (id === 'virtual:tailwind.css' || id === '/__tailwind.css') {
        return '\0virtual:tailwind.css';
      }
      return null;
    },

    async load(id: string) {
      if (id === '\0virtual:tailwind.css') {
        try {
          return await compileTailwind();
        } catch (e: any) {
          console.error('  [Tailwind] Compilation error:', e.message);
          return `/* Tailwind CSS Error: ${e.message} */`;
        }
      }
      return null;
    },

    async transform(code: string, id: string) {
      if (!id.endsWith('.css')) return null;
      if (!code.includes('@tailwind') && !code.includes('@apply')) return null;

      try {
        const proc = await ensureProcessor();
        const result = await proc.process(code, { from: id });
        return result.css;
      } catch (e: any) {
        console.error(`  [Tailwind] Transform error in ${id}:`, e.message);
        return code;
      }
    },

    async configureServer(server) {
      server.middlewares.push(async (request: Request, context: any, next: () => Promise<Response>) => {
        const url = new URL(request.url);

        if (url.pathname === '/__tailwind.css') {
          try {
            const css = await compileTailwind();
            return new Response(css, {
              headers: {
                'Content-Type': 'text/css; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            });
          } catch (e: any) {
            return new Response(`/* Tailwind CSS Error: ${e.message} */`, {
              status: 500,
              headers: { 'Content-Type': 'text/css' },
            });
          }
        }

        return next();
      });
    },
  };
}

// Export utilities
export { ereoPreset, getEreoTailwindConfig } from './preset';

/**
 * Generate Tailwind config file content.
 */
export function generateConfig(options: TailwindPluginOptions = {}): string {
  const opts = { ...defaults, ...options };

  if (opts.usePreset) {
    return `
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind';

export default getEreoTailwindConfig({
  // Add your customizations here
});
    `.trim();
  }

  return `
/** @type {import('tailwindcss').Config} */
export default {
  content: ${JSON.stringify(opts.content, null, 2)},
  darkMode: '${opts.darkMode}',
  theme: {
    extend: {},
  },
  plugins: [],
};
  `.trim();
}

/**
 * Generate CSS entry file.
 */
export function generateCSSEntry(): string {
  return `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles below */
  `.trim();
}
