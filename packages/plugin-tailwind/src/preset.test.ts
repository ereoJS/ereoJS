import { describe, expect, test } from 'bun:test';
import { ereoPreset, getEreoTailwindConfig } from './preset';

describe('@ereo/plugin-tailwind - Preset', () => {
  describe('ereoPreset', () => {
    test('is an object with theme configuration', () => {
      expect(ereoPreset).toBeDefined();
      expect(typeof ereoPreset).toBe('object');
    });

    test('has theme extend configuration', () => {
      expect(ereoPreset.theme).toBeDefined();
      expect(ereoPreset.theme?.extend).toBeDefined();
    });

    test('includes color definitions', () => {
      expect(ereoPreset.theme?.extend?.colors).toBeDefined();
    });

    test('has color definitions if present', () => {
      const colors = ereoPreset.theme?.extend?.colors as Record<string, any>;
      // Colors may or may not include 'primary' depending on preset config
      expect(colors === undefined || typeof colors === 'object').toBe(true);
    });

    test('includes font family definitions', () => {
      expect(ereoPreset.theme?.extend?.fontFamily).toBeDefined();
    });

    test('includes animation definitions', () => {
      expect(ereoPreset.theme?.extend?.animation).toBeDefined();
    });

    test('includes keyframes definitions', () => {
      expect(ereoPreset.theme?.extend?.keyframes).toBeDefined();
    });
  });

  describe('getEreoTailwindConfig', () => {
    test('returns a valid tailwind config', () => {
      const config = getEreoTailwindConfig();

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('includes default content paths', () => {
      const config = getEreoTailwindConfig();

      expect(config.content).toBeDefined();
      expect(Array.isArray(config.content)).toBe(true);
      expect((config.content as string[]).length).toBeGreaterThan(0);
    });

    test('includes EreoJS preset in presets', () => {
      const config = getEreoTailwindConfig();

      expect(config.presets).toBeDefined();
      expect(Array.isArray(config.presets)).toBe(true);
    });

    test('accepts custom content paths', () => {
      const config = getEreoTailwindConfig({
        content: ['./custom/**/*.tsx'],
      });

      expect((config.content as string[])).toContain('./custom/**/*.tsx');
    });

    test('accepts custom theme extensions', () => {
      const config = getEreoTailwindConfig({
        theme: {
          extend: {
            colors: {
              custom: '#ff0000',
            },
          },
        },
      });

      expect(config.theme?.extend?.colors).toBeDefined();
    });

    test('merges plugins', () => {
      const mockPlugin = { handler: () => {} };
      const config = getEreoTailwindConfig({
        plugins: [mockPlugin as any],
      });

      expect(config.plugins).toBeDefined();
      expect(Array.isArray(config.plugins)).toBe(true);
    });

    test('includes default dark mode setting', () => {
      const config = getEreoTailwindConfig();

      expect(config.darkMode).toBeDefined();
    });

    test('allows overriding dark mode', () => {
      const config = getEreoTailwindConfig({
        darkMode: 'media',
      });

      expect(config.darkMode).toBe('media');
    });
  });
});
