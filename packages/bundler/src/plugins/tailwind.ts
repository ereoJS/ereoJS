/**
 * @oreo/bundler - Tailwind CSS Plugin
 *
 * Zero-config Tailwind CSS integration.
 */

import { join, resolve } from 'node:path';
import type { Plugin } from '@oreo/core';

/**
 * Tailwind plugin options.
 */
export interface TailwindPluginOptions {
  /** Content paths to scan for classes */
  content?: string[];
  /** Custom Tailwind config path */
  config?: string;
  /** Enable dark mode */
  darkMode?: 'class' | 'media' | false;
}

/**
 * Default content paths.
 */
const DEFAULT_CONTENT_PATHS = [
  './app/**/*.{js,ts,jsx,tsx}',
  './components/**/*.{js,ts,jsx,tsx}',
];

/**
 * Create Tailwind plugin.
 */
export function createTailwindPlugin(options: TailwindPluginOptions = {}): Plugin {
  const { content = DEFAULT_CONTENT_PATHS, config, darkMode = 'class' } = options;

  let tailwindConfig: any = null;
  let cssCache = new Map<string, string>();

  return {
    name: 'oreo:tailwind',

    async setup(context) {
      const root = context.root;

      // Check for existing tailwind.config.js
      const configPath = config || join(root, 'tailwind.config.js');

      try {
        if (await Bun.file(configPath).exists()) {
          tailwindConfig = await import(configPath);
        } else {
          // Use default config
          tailwindConfig = {
            content: content.map((p) => resolve(root, p)),
            darkMode,
            theme: {
              extend: {},
            },
            plugins: [],
          };
        }
      } catch (error) {
        console.warn('Failed to load Tailwind config:', error);
        tailwindConfig = { content, darkMode };
      }
    },

    async transform(code: string, id: string) {
      // Only process CSS files
      if (!id.endsWith('.css')) {
        return null;
      }

      // Check if this is a Tailwind entry
      if (!code.includes('@tailwind')) {
        return null;
      }

      // Check cache
      const cached = cssCache.get(id);
      if (cached) {
        return cached;
      }

      try {
        // Process with Tailwind (using Bun's built-in PostCSS support)
        const result = await processTailwind(code, id, tailwindConfig);
        cssCache.set(id, result);
        return result;
      } catch (error) {
        console.error('Tailwind processing error:', error);
        return null;
      }
    },

    resolveId(id: string) {
      // Handle virtual tailwind module
      if (id === 'virtual:tailwind.css') {
        return '\0virtual:tailwind.css';
      }
      return null;
    },

    load(id: string) {
      // Return default Tailwind CSS
      if (id === '\0virtual:tailwind.css') {
        return `
@tailwind base;
@tailwind components;
@tailwind utilities;
        `.trim();
      }
      return null;
    },
  };
}

/**
 * Process CSS with Tailwind.
 * This is a simplified implementation - production should use PostCSS.
 */
async function processTailwind(
  css: string,
  filename: string,
  config: any
): Promise<string> {
  // For now, return the CSS as-is
  // In a full implementation, this would use PostCSS + Tailwind

  // Replace @tailwind directives with placeholder comments
  let processed = css;

  // Base styles
  processed = processed.replace('@tailwind base;', '/* Tailwind base styles */');

  // Component styles
  processed = processed.replace('@tailwind components;', '/* Tailwind component styles */');

  // Utility styles
  processed = processed.replace('@tailwind utilities;', '/* Tailwind utility styles */');

  return processed;
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
  darkMode: '${darkMode}',
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
  `.trim();
}

/**
 * Check if Tailwind is configured.
 */
export async function hasTailwindConfig(root: string): Promise<boolean> {
  const configFiles = [
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.cjs',
    'tailwind.config.mjs',
  ];

  for (const file of configFiles) {
    if (await Bun.file(join(root, file)).exists()) {
      return true;
    }
  }

  return false;
}

/**
 * Create Tailwind CSS middleware for dev server.
 */
export function tailwindMiddleware() {
  return async (request: Request, context: any, next: () => Promise<Response>) => {
    const url = new URL(request.url);

    // Handle Tailwind CSS requests
    if (url.pathname === '/__tailwind.css') {
      const css = `
/* Generated Tailwind CSS */
@tailwind base;
@tailwind components;
@tailwind utilities;
      `.trim();

      return new Response(css, {
        headers: {
          'Content-Type': 'text/css',
          'Cache-Control': 'no-cache',
        },
      });
    }

    return next();
  };
}
