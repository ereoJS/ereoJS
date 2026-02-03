/**
 * @ereo/plugin-images - Configuration Validation
 *
 * Schema validation for plugin configuration.
 */

import type { ImagePluginConfig, RemotePattern } from '../components/types';
import { DEFAULT_CONFIG, MAX_DIMENSION, SUPPORTED_OUTPUT_FORMATS } from './defaults';

/**
 * Validation error with details.
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(`Invalid configuration for '${field}': ${message}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validate a remote pattern configuration.
 */
function validateRemotePattern(pattern: RemotePattern, index: number): void {
  if (!pattern.hostname) {
    throw new ConfigValidationError(
      'hostname is required',
      `remotePatterns[${index}].hostname`,
      pattern
    );
  }

  if (typeof pattern.hostname !== 'string') {
    throw new ConfigValidationError(
      'hostname must be a string',
      `remotePatterns[${index}].hostname`,
      pattern.hostname
    );
  }

  if (pattern.protocol && !['http', 'https'].includes(pattern.protocol)) {
    throw new ConfigValidationError(
      'protocol must be "http" or "https"',
      `remotePatterns[${index}].protocol`,
      pattern.protocol
    );
  }

  if (pattern.port && typeof pattern.port !== 'string') {
    throw new ConfigValidationError(
      'port must be a string',
      `remotePatterns[${index}].port`,
      pattern.port
    );
  }
}

/**
 * Validate quality value.
 */
function validateQuality(quality: unknown): number {
  if (quality === undefined) {
    return DEFAULT_CONFIG.quality;
  }

  if (typeof quality !== 'number') {
    throw new ConfigValidationError('quality must be a number', 'quality', quality);
  }

  if (quality < 1 || quality > 100) {
    throw new ConfigValidationError('quality must be between 1 and 100', 'quality', quality);
  }

  return Math.round(quality);
}

/**
 * Validate formats configuration.
 */
function validateFormats(formats: unknown): ImagePluginConfig['formats'] {
  if (formats === undefined) {
    return DEFAULT_CONFIG.formats;
  }

  if (typeof formats !== 'object' || formats === null) {
    throw new ConfigValidationError('formats must be an object', 'formats', formats);
  }

  const validFormats = formats as Record<string, unknown>;
  const result: ImagePluginConfig['formats'] = {};

  for (const format of SUPPORTED_OUTPUT_FORMATS) {
    if (format in validFormats) {
      if (typeof validFormats[format] !== 'boolean') {
        throw new ConfigValidationError(
          `formats.${format} must be a boolean`,
          `formats.${format}`,
          validFormats[format]
        );
      }
      result[format] = validFormats[format] as boolean;
    }
  }

  return result;
}

/**
 * Validate sizes configuration.
 */
function validateSizes(sizes: unknown): ImagePluginConfig['sizes'] {
  if (sizes === undefined) {
    return DEFAULT_CONFIG.sizes;
  }

  if (typeof sizes !== 'object' || sizes === null) {
    throw new ConfigValidationError('sizes must be an object', 'sizes', sizes);
  }

  const sizesConfig = sizes as Record<string, unknown>;
  const result: ImagePluginConfig['sizes'] = {};

  if (sizesConfig.deviceSizes !== undefined) {
    if (!Array.isArray(sizesConfig.deviceSizes)) {
      throw new ConfigValidationError(
        'deviceSizes must be an array',
        'sizes.deviceSizes',
        sizesConfig.deviceSizes
      );
    }

    for (let i = 0; i < sizesConfig.deviceSizes.length; i++) {
      const size = sizesConfig.deviceSizes[i];
      if (typeof size !== 'number' || size <= 0 || size > MAX_DIMENSION) {
        throw new ConfigValidationError(
          `deviceSizes[${i}] must be a positive number <= ${MAX_DIMENSION}`,
          `sizes.deviceSizes[${i}]`,
          size
        );
      }
    }

    result.deviceSizes = sizesConfig.deviceSizes as number[];
  }

  if (sizesConfig.imageSizes !== undefined) {
    if (!Array.isArray(sizesConfig.imageSizes)) {
      throw new ConfigValidationError(
        'imageSizes must be an array',
        'sizes.imageSizes',
        sizesConfig.imageSizes
      );
    }

    for (let i = 0; i < sizesConfig.imageSizes.length; i++) {
      const size = sizesConfig.imageSizes[i];
      if (typeof size !== 'number' || size <= 0 || size > MAX_DIMENSION) {
        throw new ConfigValidationError(
          `imageSizes[${i}] must be a positive number <= ${MAX_DIMENSION}`,
          `sizes.imageSizes[${i}]`,
          size
        );
      }
    }

    result.imageSizes = sizesConfig.imageSizes as number[];
  }

  return result;
}

/**
 * Validate and normalize plugin configuration.
 */
export function validateConfig(config: ImagePluginConfig = {}): Required<ImagePluginConfig> {
  // Validate remote patterns
  if (config.remotePatterns) {
    if (!Array.isArray(config.remotePatterns)) {
      throw new ConfigValidationError(
        'remotePatterns must be an array',
        'remotePatterns',
        config.remotePatterns
      );
    }
    config.remotePatterns.forEach((pattern, index) => validateRemotePattern(pattern, index));
  }

  // Validate domains (deprecated)
  if (config.domains) {
    if (!Array.isArray(config.domains)) {
      throw new ConfigValidationError('domains must be an array', 'domains', config.domains);
    }
    for (const domain of config.domains) {
      if (typeof domain !== 'string') {
        throw new ConfigValidationError('domains must be strings', 'domains', domain);
      }
    }
    // Convert legacy domains to remote patterns
    console.warn(
      '[@ereo/plugin-images] The "domains" option is deprecated. Use "remotePatterns" instead.'
    );
  }

  // Validate quality
  const quality = validateQuality(config.quality);

  // Validate formats
  const formats = validateFormats(config.formats);

  // Validate sizes
  const sizes = validateSizes(config.sizes);

  // Validate max dimension
  if (config.maxDimension !== undefined) {
    if (typeof config.maxDimension !== 'number' || config.maxDimension <= 0) {
      throw new ConfigValidationError(
        'maxDimension must be a positive number',
        'maxDimension',
        config.maxDimension
      );
    }
  }

  // Validate path
  if (config.path !== undefined) {
    if (typeof config.path !== 'string' || !config.path.startsWith('/')) {
      throw new ConfigValidationError(
        'path must be a string starting with "/"',
        'path',
        config.path
      );
    }
  }

  // Validate cache dir
  if (config.cacheDir !== undefined) {
    if (typeof config.cacheDir !== 'string') {
      throw new ConfigValidationError('cacheDir must be a string', 'cacheDir', config.cacheDir);
    }
  }

  // Merge with defaults
  return {
    ...DEFAULT_CONFIG,
    ...config,
    quality,
    formats: { ...DEFAULT_CONFIG.formats, ...formats },
    sizes: { ...DEFAULT_CONFIG.sizes, ...sizes },
  };
}

/**
 * Check if a URL matches the allowed remote patterns.
 */
export function matchesRemotePattern(
  url: URL,
  patterns: RemotePattern[],
  domains: string[] = []
): boolean {
  // Check legacy domains first
  if (domains.includes(url.hostname)) {
    return true;
  }

  // Check remote patterns
  for (const pattern of patterns) {
    // Check protocol
    if (pattern.protocol) {
      const urlProtocol = url.protocol.slice(0, -1); // Remove trailing colon
      if (urlProtocol !== pattern.protocol) {
        continue;
      }
    }

    // Check hostname (supports wildcards)
    const hostnamePattern = pattern.hostname.replace(/\./g, '\\.').replace(/\*/g, '.*');
    const hostnameRegex = new RegExp(`^${hostnamePattern}$`, 'i');
    if (!hostnameRegex.test(url.hostname)) {
      continue;
    }

    // Check port
    if (pattern.port && url.port !== pattern.port) {
      continue;
    }

    // Check pathname
    if (pattern.pathname) {
      const pathnamePattern = pattern.pathname.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const pathnameRegex = new RegExp(`^${pathnamePattern}`, 'i');
      if (!pathnameRegex.test(url.pathname)) {
        continue;
      }
    }

    return true;
  }

  return false;
}
