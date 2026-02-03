/**
 * @ereo/plugin-images - Image plugin tests
 */

import { describe, expect, test } from 'bun:test';
import {
  validateConfig,
  matchesRemotePattern,
  ConfigValidationError,
  DEFAULT_QUALITY,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  MAX_DIMENSION,
  getAllSizes,
  getSizesForWidth,
} from './index';
import type { ImagePluginConfig } from './index';

describe('validateConfig', () => {
  test('validates empty config and returns defaults', () => {
    const result = validateConfig({});
    expect(result.quality).toBeDefined();
    expect(result.formats).toBeDefined();
    expect(result.sizes).toBeDefined();
  });

  test('validates quality setting', () => {
    const result = validateConfig({ quality: 80 });
    expect(result.quality).toBe(80);
  });

  test('throws for invalid quality (too high)', () => {
    expect(() => validateConfig({ quality: 150 })).toThrow(ConfigValidationError);
  });

  test('throws for invalid quality (too low)', () => {
    expect(() => validateConfig({ quality: -10 })).toThrow(ConfigValidationError);
  });

  test('validates with deviceSizes', () => {
    const result = validateConfig({
      sizes: { deviceSizes: [320, 768, 1024] },
    });
    expect(result.sizes.deviceSizes).toEqual([320, 768, 1024]);
  });

  test('validates with imageSizes', () => {
    const result = validateConfig({
      sizes: { imageSizes: [16, 32, 64, 128] },
    });
    expect(result.sizes.imageSizes).toEqual([16, 32, 64, 128]);
  });

  test('validates with formats', () => {
    const result = validateConfig({
      formats: { webp: true, avif: true },
    });
    expect(result.formats.webp).toBe(true);
    expect(result.formats.avif).toBe(true);
  });

  test('validates with remotePatterns', () => {
    const result = validateConfig({
      remotePatterns: [{ protocol: 'https', hostname: 'example.com' }],
    });
    expect(result.remotePatterns).toHaveLength(1);
  });
});

describe('matchesRemotePattern', () => {
  test('matches exact hostname', () => {
    const patterns = [{ hostname: 'example.com' }];
    const url = new URL('https://example.com/image.jpg');
    expect(matchesRemotePattern(url, patterns)).toBe(true);
  });

  test('does not match different hostname', () => {
    const patterns = [{ hostname: 'example.com' }];
    const url = new URL('https://other.com/image.jpg');
    expect(matchesRemotePattern(url, patterns)).toBe(false);
  });

  test('matches with protocol restriction', () => {
    const patterns = [{ protocol: 'https' as const, hostname: 'example.com' }];
    const httpsUrl = new URL('https://example.com/image.jpg');
    const httpUrl = new URL('http://example.com/image.jpg');
    expect(matchesRemotePattern(httpsUrl, patterns)).toBe(true);
    expect(matchesRemotePattern(httpUrl, patterns)).toBe(false);
  });

  test('matches wildcard subdomain', () => {
    const patterns = [{ hostname: '*.example.com' }];
    const subUrl = new URL('https://cdn.example.com/image.jpg');
    const mainUrl = new URL('https://example.com/image.jpg');
    expect(matchesRemotePattern(subUrl, patterns)).toBe(true);
    // *.example.com regex also matches example.com itself
    expect(matchesRemotePattern(mainUrl, patterns)).toBe(true);
  });

  test('matches with pathname pattern', () => {
    const patterns = [{ hostname: 'example.com', pathname: '/images/**' }];
    const matchUrl = new URL('https://example.com/images/photo.jpg');
    const noMatchUrl = new URL('https://example.com/assets/icon.jpg');
    expect(matchesRemotePattern(matchUrl, patterns)).toBe(true);
    expect(matchesRemotePattern(noMatchUrl, patterns)).toBe(false);
  });

  test('matches with port', () => {
    const patterns = [{ hostname: 'localhost', port: '3000' }];
    const matchUrl = new URL('http://localhost:3000/image.jpg');
    const noMatchUrl = new URL('http://localhost:8080/image.jpg');
    expect(matchesRemotePattern(matchUrl, patterns)).toBe(true);
    expect(matchesRemotePattern(noMatchUrl, patterns)).toBe(false);
  });
});

describe('ConfigValidationError', () => {
  test('creates error with message', () => {
    const error = new ConfigValidationError('Invalid configuration', 'field', 'value');
    expect(error.message).toContain('Invalid configuration');
    expect(error).toBeInstanceOf(Error);
    expect(error.field).toBe('field');
  });
});

describe('Constants', () => {
  test('DEFAULT_QUALITY is defined', () => {
    expect(DEFAULT_QUALITY).toBeDefined();
    expect(typeof DEFAULT_QUALITY).toBe('number');
    expect(DEFAULT_QUALITY).toBeGreaterThan(0);
    expect(DEFAULT_QUALITY).toBeLessThanOrEqual(100);
  });

  test('DEFAULT_DEVICE_SIZES is array of numbers', () => {
    expect(Array.isArray(DEFAULT_DEVICE_SIZES)).toBe(true);
    expect(DEFAULT_DEVICE_SIZES.length).toBeGreaterThan(0);
    DEFAULT_DEVICE_SIZES.forEach((size) => {
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });
  });

  test('DEFAULT_IMAGE_SIZES is array of numbers', () => {
    expect(Array.isArray(DEFAULT_IMAGE_SIZES)).toBe(true);
    expect(DEFAULT_IMAGE_SIZES.length).toBeGreaterThan(0);
    DEFAULT_IMAGE_SIZES.forEach((size) => {
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });
  });

  test('MAX_DIMENSION is reasonable value', () => {
    expect(typeof MAX_DIMENSION).toBe('number');
    expect(MAX_DIMENSION).toBeGreaterThan(1000);
  });
});

describe('getAllSizes', () => {
  test('returns combined device and image sizes', () => {
    const sizes = getAllSizes({});
    expect(Array.isArray(sizes)).toBe(true);
    expect(sizes.length).toBe(DEFAULT_DEVICE_SIZES.length + DEFAULT_IMAGE_SIZES.length);
  });

  test('returns unique sorted sizes', () => {
    const sizes = getAllSizes({});
    const uniqueSizes = [...new Set(sizes)];
    expect(sizes).toEqual(uniqueSizes);
    // Check sorted in ascending order
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    }
  });

  test('respects custom config', () => {
    const sizes = getAllSizes({
      sizes: { deviceSizes: [100, 200], imageSizes: [50] },
    });
    expect(sizes).toContain(50);
    expect(sizes).toContain(100);
    expect(sizes).toContain(200);
    expect(sizes).toHaveLength(3);
  });
});

describe('getSizesForWidth', () => {
  test('returns sizes for given width', () => {
    const sizes = getSizesForWidth(800, {});
    expect(Array.isArray(sizes)).toBe(true);
    // All sizes should be <= 1600 (2x target width)
    sizes.forEach((size) => {
      expect(size).toBeLessThanOrEqual(1600);
    });
  });

  test('filters sizes above 2x target width', () => {
    const sizes = getSizesForWidth(100, {
      sizes: { deviceSizes: [100, 200, 300], imageSizes: [50] },
    });
    // Max size should be 200 (2x 100)
    expect(sizes).toContain(50);
    expect(sizes).toContain(100);
    expect(sizes).toContain(200);
    expect(sizes).not.toContain(300);
  });
});
