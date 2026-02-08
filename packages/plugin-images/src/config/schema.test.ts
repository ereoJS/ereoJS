/**
 * @ereo/plugin-images - Config Schema Validation Tests
 */

import { describe, expect, test } from 'bun:test';
import { validateConfig, matchesRemotePattern, ConfigValidationError } from './schema';

describe('validateConfig', () => {
  test('returns defaults for empty config', () => {
    const result = validateConfig({});
    expect(result.quality).toBe(80);
    expect(result.formats.webp).toBe(true);
    expect(result.formats.avif).toBe(false);
    expect(result.sizes.deviceSizes).toBeDefined();
    expect(result.sizes.imageSizes).toBeDefined();
  });

  test('rejects quality below 1', () => {
    expect(() => validateConfig({ quality: 0 })).toThrow(ConfigValidationError);
  });

  test('rejects quality above 100', () => {
    expect(() => validateConfig({ quality: 101 })).toThrow(ConfigValidationError);
  });

  test('rejects non-number quality', () => {
    expect(() => validateConfig({ quality: 'high' as any })).toThrow(ConfigValidationError);
  });

  test('rounds fractional quality', () => {
    const result = validateConfig({ quality: 75.7 });
    expect(result.quality).toBe(76);
  });

  test('rejects non-array remotePatterns', () => {
    expect(() => validateConfig({ remotePatterns: 'bad' as any })).toThrow(ConfigValidationError);
  });

  test('rejects remote pattern without hostname', () => {
    expect(() => validateConfig({ remotePatterns: [{ hostname: '' } as any] })).toThrow(ConfigValidationError);
  });

  test('rejects invalid protocol in remote pattern', () => {
    expect(() =>
      validateConfig({ remotePatterns: [{ hostname: 'example.com', protocol: 'ftp' as any }] })
    ).toThrow(ConfigValidationError);
  });

  test('rejects non-boolean format values', () => {
    expect(() => validateConfig({ formats: { webp: 'yes' } as any })).toThrow(ConfigValidationError);
  });

  test('rejects negative maxDimension', () => {
    expect(() => validateConfig({ maxDimension: -1 })).toThrow(ConfigValidationError);
  });

  test('rejects path not starting with /', () => {
    expect(() => validateConfig({ path: 'images' })).toThrow(ConfigValidationError);
  });

  test('validates valid remote pattern', () => {
    const result = validateConfig({
      remotePatterns: [{ hostname: 'cdn.example.com', protocol: 'https' }],
    });
    expect(result.remotePatterns).toHaveLength(1);
  });

  test('rejects deviceSizes exceeding MAX_DIMENSION', () => {
    expect(() =>
      validateConfig({ sizes: { deviceSizes: [99999] } })
    ).toThrow(ConfigValidationError);
  });

  test('rejects non-array deviceSizes', () => {
    expect(() =>
      validateConfig({ sizes: { deviceSizes: 'bad' as any } })
    ).toThrow(ConfigValidationError);
  });
});

describe('matchesRemotePattern', () => {
  test('matches exact hostname', () => {
    const url = new URL('https://cdn.example.com/image.png');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com' }])).toBe(true);
  });

  test('matches wildcard hostname', () => {
    const url = new URL('https://img.cdn.example.com/image.png');
    expect(matchesRemotePattern(url, [{ hostname: '*.cdn.example.com' }])).toBe(true);
  });

  test('rejects non-matching hostname', () => {
    const url = new URL('https://evil.com/image.png');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com' }])).toBe(false);
  });

  test('matches protocol filter', () => {
    const url = new URL('https://cdn.example.com/image.png');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com', protocol: 'https' }])).toBe(true);
  });

  test('rejects wrong protocol', () => {
    const url = new URL('http://cdn.example.com/image.png');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com', protocol: 'https' }])).toBe(false);
  });

  test('matches legacy domains', () => {
    const url = new URL('https://cdn.example.com/image.png');
    expect(matchesRemotePattern(url, [], ['cdn.example.com'])).toBe(true);
  });

  test('matches pathname pattern', () => {
    const url = new URL('https://cdn.example.com/images/photo.jpg');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com', pathname: '/images/*' }])).toBe(true);
  });

  test('rejects non-matching pathname', () => {
    const url = new URL('https://cdn.example.com/other/photo.jpg');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com', pathname: '/images/*' }])).toBe(false);
  });

  test('matches port filter', () => {
    const url = new URL('https://cdn.example.com:8080/image.png');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com', port: '8080' }])).toBe(true);
  });

  test('rejects wrong port', () => {
    const url = new URL('https://cdn.example.com:3000/image.png');
    expect(matchesRemotePattern(url, [{ hostname: 'cdn.example.com', port: '8080' }])).toBe(false);
  });
});
