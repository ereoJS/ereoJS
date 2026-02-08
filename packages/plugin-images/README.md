# @ereo/plugin-images

Complete image optimization plugin for the EreoJS framework. Provides automatic image optimization, blur placeholders, responsive srcset generation, and art direction support.

## Installation

```bash
bun add @ereo/plugin-images sharp
```

## Quick Start

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import images from '@ereo/plugin-images';

export default defineConfig({
  plugins: [
    images({
      formats: { webp: true, avif: true },
      quality: 80,
    }),
  ],
});
```

```tsx
// In your components
import { Image, Picture } from '@ereo/plugin-images/components';
import heroImg from './hero.jpg';

function Hero() {
  return (
    <Image
      src={heroImg}
      alt="Hero image"
      placeholder="blur"
      priority
    />
  );
}
```

## Key Features

- **Automatic Optimization**: Compress and resize images at build time
- **Modern Formats**: Generate WebP and AVIF variants automatically
- **Blur Placeholders**: Create LQIP (Low Quality Image Placeholders) for smooth loading
- **Responsive Images**: Generate srcset with multiple sizes for different viewports
- **Image and Picture Components**: React components with built-in optimization
- **Dominant Color Extraction**: Extract colors for placeholder backgrounds using k-means clustering
- **Runtime Middleware**: On-demand image processing in development
- **Build-time Processing**: Batch optimize all images during production build
- **Two-Tier Caching**: Memory and disk caching for optimized images
- **Format Negotiation**: Automatic best format selection based on browser Accept header

## Supported Formats

**Input:** JPEG, PNG, WebP, AVIF, GIF, SVG

**Output:** WebP, AVIF, JPEG, PNG

## Exports

### Main Plugin

```ts
import images from '@ereo/plugin-images';
// or
import { imagesPlugin } from '@ereo/plugin-images';
```

### Components

```ts
import { Image, Picture } from '@ereo/plugin-images/components';
```

### Processing Utilities

```ts
import {
  // Image processor
  createImageProcessor,
  ImageProcessor,
  createSharpProcessor,
  SharpProcessor,

  // Blur generation
  generateBlurPlaceholder,
  generateShimmerSVG,
  generateShimmerDataURL,

  // Color extraction
  extractDominantColor,
  rgbToHex,
  hexToRgb,
  getContrastColor,
} from '@ereo/plugin-images';
```

### Build Utilities

```ts
import {
  createBuildOptimizer,
  optimizeImages,
  BuildOptimizer,
  createManifestManager,
  ImageManifestManager,
} from '@ereo/plugin-images';
```

### Runtime Utilities

```ts
import {
  createImageMiddleware,
  imageMiddleware,
  MemoryCache,
  DiskCache,
  TwoTierCache,
  generateCacheKey,
} from '@ereo/plugin-images';
```

### Configuration Utilities

```ts
import {
  validateConfig,
  matchesRemotePattern,
  ConfigValidationError,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  DEFAULT_QUALITY,
  MAX_DIMENSION,
  IMAGE_PATH_PREFIX,
  SUPPORTED_INPUT_FORMATS,
  SUPPORTED_OUTPUT_FORMATS,
  FORMAT_MIME_TYPES,
  getAllSizes,
  getSizesForWidth,
} from '@ereo/plugin-images';
```

### TypeScript Types

```ts
import type {
  ImageProps,
  PictureProps,
  PictureSource,
  StaticImageData,
  PlaceholderType,
  ObjectFit,
  ObjectPosition,
  ImageLoading,
  ImageDecoding,
  ImageLoader,
  ImageLoaderParams,
  ImagePluginConfig,
  RemotePattern,
  ImageManifestEntry,
  ImageVariant,
  ImageOptimizationParams,
  ProcessedImage,
} from '@ereo/plugin-images';
```

## Documentation

For full documentation, visit the [EreoJS Images Plugin Documentation](https://ereojs.dev/docs/api/plugins/images).

### Documentation Sections

- **[Basic Usage](#quick-start)** - Getting started with the plugin
- **[Image Component](https://ereojs.dev/docs/api/plugins/images#image-component)** - Props and examples
- **[Picture Component](https://ereojs.dev/docs/api/plugins/images#picture-component)** - Art direction support
- **[TypeScript API Reference](https://ereojs.dev/docs/api/plugins/images#typescript-api-reference)** - All exported interfaces
- **[ImageProcessor Direct Usage](https://ereojs.dev/docs/api/plugins/images#imageprocessor-direct-usage)** - Programmatic processing
- **[BuildOptimizer Integration](https://ereojs.dev/docs/api/plugins/images#buildoptimizer-integration)** - Build-time optimization
- **[ManifestManager](https://ereojs.dev/docs/api/plugins/images#manifestmanager)** - Tracking processed images
- **[Blur Generation Functions](https://ereojs.dev/docs/api/plugins/images#blur-generation-functions)** - LQIP utilities
- **[Color Utilities](https://ereojs.dev/docs/api/plugins/images#color-utilities)** - Color extraction and manipulation
- **[Error Handling](https://ereojs.dev/docs/api/plugins/images#error-handling)** - ConfigValidationError and patterns
- **[Caching](https://ereojs.dev/docs/api/plugins/images#caching)** - Memory and disk cache
- **[Troubleshooting Guide](https://ereojs.dev/docs/api/plugins/images#troubleshooting-guide)** - Common issues and solutions

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack JavaScript framework.

## License

MIT
