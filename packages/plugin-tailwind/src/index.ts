/**
 * @ereo/plugin-tailwind
 *
 * Zero-config Tailwind CSS integration for Ereo.
 */

import { join } from 'node:path';
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
  /** Enable dark mode */
  darkMode?: 'class' | 'media' | false;
  /** Use Ereo preset */
  usePreset?: boolean;
}

/**
 * Default options.
 */
const defaults: Required<TailwindPluginOptions> = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  config: 'tailwind.config.js',
  darkMode: 'class',
  usePreset: true,
};

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
  let tailwindCSS: string | null = null;
  let configLoaded = false;

  return {
    name: 'ereo:tailwind',

    async setup(context) {
      const root = context.root;
      const configPath = join(root, opts.config);

      // Try to load existing config
      try {
        const hasConfig = await Bun.file(configPath).exists();

        if (hasConfig) {
          console.log('  Using existing tailwind.config.js');
          configLoaded = true;
        } else {
          // Generate default config if using preset
          if (opts.usePreset) {
            console.log('  Using Ereo Tailwind preset');
          }
        }
      } catch (error) {
        console.warn('  Warning: Could not check for Tailwind config');
      }
    },

    resolveId(id: string) {
      // Handle virtual Tailwind module
      if (id === 'virtual:tailwind.css' || id === '/__tailwind.css') {
        return '\0virtual:tailwind.css';
      }
      return null;
    },

    async load(id: string) {
      if (id === '\0virtual:tailwind.css') {
        // Return CSS content
        if (tailwindCSS) {
          return tailwindCSS;
        }

        // Default Tailwind directives
        return `
@tailwind base;
@tailwind components;
@tailwind utilities;
        `.trim();
      }
      return null;
    },

    async transform(code: string, id: string) {
      // Process CSS files with Tailwind directives
      if (!id.endsWith('.css')) {
        return null;
      }

      if (!code.includes('@tailwind')) {
        return null;
      }

      // For development, return as-is (Tailwind CLI will process)
      // In production, this would be processed by PostCSS
      return code;
    },

    async configureServer(server) {
      // Serve Tailwind CSS in dev mode
      server.middlewares.push(async (request: Request, context: any, next: () => Promise<Response>) => {
        const url = new URL(request.url);

        if (url.pathname === '/__tailwind.css') {
          // In development, serve the CSS directives
          // The browser will compile them with the Tailwind CDN
          const css = `
/* Tailwind CSS - Development Mode */
@import url('https://cdn.tailwindcss.com');
          `.trim();

          return new Response(css, {
            headers: {
              'Content-Type': 'text/css',
              'Cache-Control': 'no-cache',
            },
          });
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
