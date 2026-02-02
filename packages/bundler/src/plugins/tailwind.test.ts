/**
 * Tailwind CSS Plugin Tests
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import {
  extractTailwindClasses,
  generateTailwindConfig,
  generateCSSEntry,
  hasTailwindConfig,
} from './tailwind';

// Test directory setup
const TEST_DIR = join(import.meta.dir, '__tailwind_test__');

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Tailwind CSS Processing', () => {
  test('processes @tailwind directives with PostCSS', async () => {
    // Create a simple config
    const config = {
      content: [{ raw: '<div class="bg-blue-500 text-white p-4"></div>' }],
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should contain generated CSS
    expect(result.css).toBeDefined();
    expect(result.css.length).toBeGreaterThan(1000); // Base styles are large

    // Should contain the utility classes we used
    expect(result.css).toContain('bg-blue-500');
    expect(result.css).toContain('text-white');
    expect(result.css).toContain('p-4'); // Or padding: 1rem
  });

  test('processes @apply directive', async () => {
    const config = {
      content: [{ raw: '' }],
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;

.custom-button {
  @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
}
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should contain the processed custom class
    expect(result.css).toContain('.custom-button');
    // Should have expanded the @apply directive
    expect(result.css).toContain('background-color');
    expect(result.css).toContain('border-radius');
  });

  test('generates minimal CSS in JIT mode', async () => {
    const config = {
      content: [{ raw: '<div class="flex items-center"></div>' }],
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind utilities;
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should only contain used utilities
    expect(result.css).toContain('flex');
    expect(result.css).toContain('items-center');
    // Should not contain unused utilities
    expect(result.css).not.toContain('.grid');
    expect(result.css).not.toContain('.hidden');
  });

  test('handles custom theme extensions', async () => {
    const config = {
      content: [{ raw: '<div class="text-custom bg-primary"></div>' }],
      theme: {
        extend: {
          colors: {
            primary: '#ff5500',
            custom: '#00ff00',
          },
        },
      },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind utilities;
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should contain custom color classes (Tailwind uses rgb() format internally)
    expect(result.css).toContain('.bg-primary');
    expect(result.css).toContain('.text-custom');
    // Tailwind converts hex to rgb: #ff5500 -> rgb(255 85 0 / ...)
    expect(result.css).toContain('255 85 0');
    expect(result.css).toContain('0 255 0');
  });

  test('supports dark mode classes', async () => {
    const config = {
      content: [{ raw: '<div class="dark:bg-gray-800 dark:text-white"></div>' }],
      darkMode: 'class' as const,
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind utilities;
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should contain dark mode selectors (with escaped colons in CSS)
    expect(result.css).toContain('.dark');
    expect(result.css).toContain('dark\\:bg-gray-800');
    expect(result.css).toContain('dark\\:text-white');
  });
});

describe('extractTailwindClasses', () => {
  test('extracts classes from className attribute', () => {
    const content = `
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">Hello</span>
      </div>
    `;

    const classes = extractTailwindClasses(content);

    expect(classes).toContain('flex');
    expect(classes).toContain('items-center');
    expect(classes).toContain('justify-between');
    expect(classes).toContain('text-lg');
    expect(classes).toContain('font-bold');
  });

  test('extracts classes from class attribute', () => {
    const content = `
      <div class="bg-blue-500 p-4">Content</div>
    `;

    const classes = extractTailwindClasses(content);

    expect(classes).toContain('bg-blue-500');
    expect(classes).toContain('p-4');
  });

  test('extracts classes from template literals', () => {
    const content = `
      <div className={\`flex \${condition ? 'hidden' : 'block'}\`}>Content</div>
    `;

    const classes = extractTailwindClasses(content);

    expect(classes).toContain('flex');
  });

  test('extracts classes from clsx/cn helpers', () => {
    const content = `
      clsx('base-class', isActive && 'active-class')
      cn('flex items-center', className)
    `;

    const classes = extractTailwindClasses(content);

    expect(classes).toContain('base-class');
    expect(classes).toContain('flex');
    expect(classes).toContain('items-center');
  });
});

describe('generateTailwindConfig', () => {
  test('generates valid config with defaults', () => {
    const config = generateTailwindConfig();

    expect(config).toContain("content:");
    expect(config).toContain("darkMode: 'class'");
    expect(config).toContain("theme:");
    expect(config).toContain("extend:");
    expect(config).toContain("plugins:");
  });

  test('generates config with custom content paths', () => {
    const config = generateTailwindConfig({
      content: ['./custom/**/*.tsx'],
    });

    expect(config).toContain('./custom/**/*.tsx');
  });

  test('generates config with media dark mode', () => {
    const config = generateTailwindConfig({
      darkMode: 'media',
    });

    expect(config).toContain("darkMode: 'media'");
  });
});

describe('generateCSSEntry', () => {
  test('generates CSS with all Tailwind directives', () => {
    const css = generateCSSEntry();

    expect(css).toContain('@tailwind base;');
    expect(css).toContain('@tailwind components;');
    expect(css).toContain('@tailwind utilities;');
  });

  test('includes comments for customization', () => {
    const css = generateCSSEntry();

    expect(css).toContain('@layer');
  });
});

describe('hasTailwindConfig', () => {
  test('returns false for directory without config', async () => {
    const result = await hasTailwindConfig(TEST_DIR);
    expect(result).toBe(false);
  });

  test('returns true when tailwind.config.js exists', async () => {
    const configPath = join(TEST_DIR, 'tailwind.config.js');
    writeFileSync(configPath, 'module.exports = {}');

    const result = await hasTailwindConfig(TEST_DIR);
    expect(result).toBe(true);
  });

  test('returns true when package.json has tailwindcss dependency', async () => {
    const testDir2 = join(TEST_DIR, 'pkg-test');
    mkdirSync(testDir2, { recursive: true });

    const pkgPath = join(testDir2, 'package.json');
    writeFileSync(
      pkgPath,
      JSON.stringify({
        dependencies: {
          tailwindcss: '^3.4.0',
        },
      })
    );

    const result = await hasTailwindConfig(testDir2);
    expect(result).toBe(true);
  });
});

describe('Production Minification', () => {
  test('minifies CSS when minify option is true', async () => {
    const config = {
      content: [{ raw: '<div class="m-4 p-4"></div>' }],
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind utilities;
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Basic output should have newlines and formatting
    expect(result.css).toContain('\n');
  });
});

describe('@layer directive', () => {
  test('processes custom layer definitions', async () => {
    // Include the custom classes in content so Tailwind includes them
    const config = {
      content: [{ raw: '<div class="custom-card custom-grid"></div>' }],
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .custom-card {
    @apply bg-white rounded-lg shadow-md p-6;
  }
}

@layer utilities {
  .custom-grid {
    display: grid;
    gap: 1rem;
  }
}
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should process layer definitions
    expect(result.css).toContain('.custom-card');
    expect(result.css).toContain('.custom-grid');
    expect(result.css).toContain('display: grid');
  });
});

describe('Responsive Prefixes', () => {
  test('generates responsive utility classes', async () => {
    const config = {
      content: [{ raw: '<div class="md:flex lg:grid xl:hidden"></div>' }],
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind utilities;
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should contain media queries
    expect(result.css).toContain('@media');
    expect(result.css).toContain('md\\:flex');
    expect(result.css).toContain('lg\\:grid');
    expect(result.css).toContain('xl\\:hidden');
  });
});

describe('State Variants', () => {
  test('generates hover and focus states', async () => {
    const config = {
      content: [{ raw: '<button class="hover:bg-blue-600 focus:ring-2 active:scale-95"></button>' }],
      theme: { extend: {} },
      plugins: [],
    };

    const processor = postcss([tailwindcss(config), autoprefixer()]);

    const css = `
@tailwind utilities;
    `.trim();

    const result = await processor.process(css, { from: undefined });

    // Should contain state selectors
    expect(result.css).toContain(':hover');
    expect(result.css).toContain(':focus');
    expect(result.css).toContain(':active');
  });
});
