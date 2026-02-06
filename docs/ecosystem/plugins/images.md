# Images Plugin

Automatic image optimization and responsive images for EreoJS applications.

## Installation

```bash
bun add @ereo/plugin-images
```

## Setup

Add the plugin to your config:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { imagesPlugin } from '@ereo/plugin-images'

export default defineConfig({
  plugins: [
    imagesPlugin(),
  ],
})
```

## Image Component

Use the `Image` component for automatic optimization:

```tsx
import { Image } from '@ereo/plugin-images/client'

export default function Hero() {
  return (
    <Image
      src="/images/hero.jpg"
      alt="Hero image"
      width={1200}
      height={600}
    />
  )
}
```

The component automatically:

- Converts images to modern formats (WebP, AVIF) based on browser support
- Generates responsive `srcset` attributes
- Sets proper `width` and `height` to prevent layout shift
- Adds `loading="lazy"` by default

## Responsive Images

Generate multiple sizes for different screen widths:

```tsx
<Image
  src="/images/photo.jpg"
  alt="Photo"
  width={1200}
  height={800}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

The plugin generates appropriately sized variants and builds the `srcset` automatically.

## Lazy Loading

Images are lazy-loaded by default. For above-the-fold images that should load immediately, disable lazy loading and add priority:

```tsx
<Image
  src="/images/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  loading="eager"
  priority
/>
```

The `priority` prop adds `fetchpriority="high"` to hint the browser to load this image first.

## Blur Placeholder

Show a blurred preview while the full image loads:

```tsx
<Image
  src="/images/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
/>
```

The plugin generates a tiny base64-encoded blur image at build time and inlines it as a CSS background. The full image fades in when loaded.

You can also provide a custom placeholder:

```tsx
<Image
  src="/images/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

## Plugin Options

```ts
imagesPlugin({
  dir: './public/images',         // Source image directory
  formats: ['webp', 'avif'],     // Output formats (default: ['webp'])
  sizes: [640, 750, 1080, 1200, 1920],  // Generated widths
  quality: 80,                    // Compression quality (1-100)
  placeholder: true,              // Generate blur placeholders
})
```

## Static Imports

Import images directly for automatic path resolution and type safety:

```tsx
import heroImage from './images/hero.jpg'

<Image src={heroImage} alt="Hero" />
```

The import resolves to the optimized image path with dimensions metadata.

## API Reference

See the [@ereo/plugin-images API reference](/api/plugins/images) for the full component props and plugin options.
