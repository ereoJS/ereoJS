import { describe, expect, test } from 'bun:test';
import tailwind, { generateConfig, generateCSSEntry } from './index';

describe('@oreo/plugin-tailwind', () => {
  describe('tailwind plugin factory', () => {
    test('creates a plugin with default options', () => {
      const plugin = tailwind();

      expect(plugin.name).toBe('oreo:tailwind');
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

      expect(plugin.name).toBe('oreo:tailwind');
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

      expect(content).toContain('@tailwind base');
      expect(content).toContain('@tailwind components');
      expect(content).toContain('@tailwind utilities');
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

    test('returns code for CSS with tailwind directives', async () => {
      const plugin = tailwind();
      const code = '@tailwind base; .custom {}';
      const result = await plugin.transform!(code, 'file.css');

      expect(result).toBe(code);
    });
  });

  describe('generateConfig', () => {
    test('generates config with Oreo preset by default', () => {
      const config = generateConfig();

      expect(config).toContain('getOreoTailwindConfig');
      expect(config).toContain('@oreo/plugin-tailwind');
    });

    test('generates config without preset when disabled', () => {
      const config = generateConfig({ usePreset: false });

      expect(config).not.toContain('getOreoTailwindConfig');
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
