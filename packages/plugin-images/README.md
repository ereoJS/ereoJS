# @ereo/plugin-images

Complete image optimization plugin for the EreoJS framework. Provides automatic image optimization, blur placeholders, responsive srcset generation, and art direction support.

## Installation

```bash
bun add @ereo/plugin-images
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
- **Dominant Color Extraction**: Extract colors for placeholder backgrounds
- **Runtime Middleware**: On-demand image processing in development
- **Build-time Processing**: Batch optimize all images during production build
- **Caching**: Memory and disk caching for optimized images

## Documentation

For full documentation, visit the [EreoJS Documentation](https://ereojs.dev/docs/plugins/images).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack JavaScript framework.

## License

MIT
