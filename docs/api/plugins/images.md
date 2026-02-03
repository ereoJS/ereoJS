# Image Optimization Plugin

Automatic image optimization for EreoJS with responsive srcsets, blur placeholders, modern formats, and lazy loading.

## Installation

```bash
bun add @ereo/plugin-images sharp
```

## Setup

### 1. Add Plugin

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import images from '@ereo/plugin-images'

export default defineConfig({
  plugins: [
    images({
      formats: { webp: true, avif: true },
      quality: 80,
    })
  ]
})
```

### 2. Use Components

```tsx
import { Image, Picture } from '@ereo/plugin-images/components'
import heroImg from './hero.jpg'

function Hero() {
  return (
    <Image
      src={heroImg}
      alt="Hero image"
      placeholder="blur"
      priority
    />
  )
}
```

## Image Component

The `Image` component is a drop-in replacement for the HTML `<img>` element with automatic optimization.

### Import

```ts
import { Image } from '@ereo/plugin-images'
```

### Basic Usage

```tsx
// With static import (recommended)
import heroImg from './hero.jpg'

<Image src={heroImg} alt="Hero image" />

// With URL string
<Image src="/images/hero.jpg" alt="Hero image" width={800} height={600} />
```

### Props

```ts
interface ImageProps {
  // Image source - URL string or imported StaticImageData
  src: string | StaticImageData

  // Alt text for accessibility (required)
  alt: string

  // Dimensions (auto-detected from static imports)
  width?: number
  height?: number

  // Fill parent container
  fill?: boolean

  // Object-fit when using fill mode
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'

  // Object-position when using fill mode
  objectPosition?: string

  // Aspect ratio (e.g., '16/9', '4/3')
  aspectRatio?: string

  // Sizes attribute for responsive images
  sizes?: string

  // Placeholder while loading
  placeholder?: 'blur' | 'color' | 'shimmer' | 'empty'

  // Custom blur data URL (for placeholder='blur')
  blurDataURL?: string

  // Image quality (1-100)
  quality?: number

  // Preload for above-the-fold images
  priority?: boolean

  // Loading strategy
  loading?: 'lazy' | 'eager'

  // Decoding strategy
  decoding?: 'async' | 'sync' | 'auto'

  // Custom image loader
  loader?: (params: ImageLoaderParams) => string

  // Disable optimization
  unoptimized?: boolean

  // Event handlers
  onLoad?: (event: SyntheticEvent) => void
  onError?: (event: SyntheticEvent) => void
}
```

### Examples

#### Static Import with Blur Placeholder

```tsx
import productImg from './product.jpg'

<Image
  src={productImg}
  alt="Product photo"
  placeholder="blur"
  quality={85}
/>
```

#### Fill Container

```tsx
<div style={{ position: 'relative', width: '100%', height: 400 }}>
  <Image
    src="/images/background.jpg"
    alt="Background"
    fill
    objectFit="cover"
    objectPosition="center top"
  />
</div>
```

#### Responsive with Sizes

```tsx
<Image
  src={heroImg}
  alt="Hero"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  priority
/>
```

#### Aspect Ratio

```tsx
<Image
  src={thumbnailImg}
  alt="Thumbnail"
  aspectRatio="16/9"
  width={400}
/>
```

## Picture Component

The `Picture` component provides art direction for responsive images, allowing different images at different breakpoints.

### Import

```ts
import { Picture } from '@ereo/plugin-images'
```

### Basic Usage

```tsx
import heroMobile from './hero-mobile.jpg'
import heroDesktop from './hero-desktop.jpg'

<Picture
  alt="Hero image"
  sources={[
    { src: heroMobile, media: '(max-width: 640px)' },
    { src: heroDesktop, media: '(min-width: 641px)' },
  ]}
/>
```

### Props

```ts
interface PictureProps {
  // Array of sources for different breakpoints/formats
  sources: PictureSource[]

  // Fallback source
  fallback?: string | StaticImageData

  // Alt text (required)
  alt: string

  // Same props as Image component
  width?: number
  height?: number
  fill?: boolean
  objectFit?: ObjectFit
  placeholder?: PlaceholderType
  quality?: number
  priority?: boolean
  // ...
}

interface PictureSource {
  // Image source for this breakpoint
  src: string | StaticImageData

  // Media query for when to use this source
  media?: string

  // MIME type hint
  type?: string

  // Dimensions for this variant
  width?: number
  height?: number

  // Sizes attribute for this source
  sizes?: string
}
```

### Examples

#### Art Direction

```tsx
<Picture
  alt="Product showcase"
  sources={[
    { src: productSquare, media: '(max-width: 480px)' },
    { src: productPortrait, media: '(max-width: 768px)' },
    { src: productLandscape, media: '(min-width: 769px)' },
  ]}
  placeholder="blur"
/>
```

#### Format-Based Sources

```tsx
<Picture
  alt="Product photo"
  sources={[
    { src: '/product.avif', type: 'image/avif' },
    { src: '/product.webp', type: 'image/webp' },
    { src: '/product.jpg' },
  ]}
/>
```

## Lazy Loading

Images are lazy loaded by default unless `priority` is set.

### Default Behavior

```tsx
// Lazy loaded (default)
<Image src={img} alt="Below fold" />

// Eager loaded (for above-the-fold)
<Image src={img} alt="Hero" priority />
```

### Custom Loading Strategy

```tsx
<Image
  src={img}
  alt="Custom loading"
  loading="eager"  // Override lazy loading
/>
```

## Placeholders

### Blur Placeholder

```tsx
import heroImg from './hero.jpg'  // Blur data auto-generated

<Image src={heroImg} alt="Hero" placeholder="blur" />
```

### Dominant Color

```tsx
<Image src={heroImg} alt="Hero" placeholder="color" />
```

### Shimmer Effect

```tsx
<Image src="/api/photo.jpg" alt="Photo" placeholder="shimmer" />
```

### Custom Blur Data URL

```tsx
<Image
  src="/images/hero.jpg"
  alt="Hero"
  placeholder="blur"
  blurDataURL="data:image/webp;base64,..."
  width={1200}
  height={600}
/>
```

## Format Optimization

The plugin automatically converts images to modern formats.

### Configuration

```ts
images({
  formats: {
    webp: true,   // WebP (recommended, good balance)
    avif: true,   // AVIF (best compression, slower encode)
    jpeg: true,   // JPEG fallback
    png: true,    // PNG for transparency
  }
})
```

### Browser Negotiation

The middleware automatically selects the best format based on the browser's Accept header:

1. AVIF (if enabled and supported)
2. WebP (if enabled and supported)
3. Original format (JPEG/PNG)

## Responsive Images

### srcset Generation

The plugin automatically generates srcsets for responsive images:

```ts
// Default device sizes
const deviceSizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840]

// Default image sizes (for smaller images)
const imageSizes = [16, 32, 48, 64, 96, 128, 256, 384]
```

### Custom Sizes

```ts
images({
  sizes: {
    deviceSizes: [640, 1080, 1920],
    imageSizes: [32, 64, 128],
  }
})
```

### Using the sizes Prop

```tsx
<Image
  src={heroImg}
  alt="Hero"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
/>
```

## Remote Images

### Allow Remote Patterns

```ts
images({
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'cdn.example.com',
      pathname: '/images/*',
    },
    {
      hostname: '*.cloudinary.com',
    },
  ]
})
```

### Legacy Domains

```ts
// Deprecated - use remotePatterns instead
images({
  domains: ['cdn.example.com', 'images.unsplash.com']
})
```

### Allow All Remote (Unsafe)

```ts
images({
  dangerouslyAllowAllRemote: true  // Not recommended for production
})
```

## Custom Loader

Use a custom loader for external image services:

### Cloudinary

```tsx
const cloudinaryLoader = ({ src, width, quality }) => {
  return `https://res.cloudinary.com/demo/image/upload/w_${width},q_${quality || 80}/${src}`
}

<Image
  src="sample.jpg"
  alt="Cloudinary image"
  loader={cloudinaryLoader}
  width={800}
  height={600}
/>
```

### Imgix

```tsx
const imgixLoader = ({ src, width, quality }) => {
  const params = new URLSearchParams({
    w: width.toString(),
    q: (quality || 80).toString(),
    auto: 'format',
  })
  return `https://example.imgix.net/${src}?${params}`
}

<Image src="hero.jpg" alt="Hero" loader={imgixLoader} width={1200} height={600} />
```

## Performance Tuning

### Quality Settings

```ts
images({
  quality: 80,  // Default quality (1-100)
})
```

```tsx
// Override per image
<Image src={img} alt="High quality" quality={95} />
<Image src={img} alt="Optimized" quality={60} />
```

### Caching

```ts
images({
  cacheDir: '.ereo/images',      // Cache directory
  minimumCacheTTL: 31536000,     // 1 year in seconds
})
```

### Max Dimensions

```ts
images({
  maxDimension: 3840,  // Maximum width or height
})
```

### Build-time Optimization

```ts
images({
  generateBlurPlaceholder: true,   // Generate blur at build
  extractDominantColor: true,      // Extract colors at build
})
```

## Plugin Options

```ts
interface ImagePluginConfig {
  // Remote image patterns
  remotePatterns?: RemotePattern[]

  // Output formats to generate
  formats?: {
    webp?: boolean    // Default: true
    avif?: boolean    // Default: false
    jpeg?: boolean    // Default: true
    png?: boolean     // Default: true
  }

  // Default quality (1-100)
  quality?: number    // Default: 80

  // Responsive sizes
  sizes?: {
    deviceSizes?: number[]  // Default: [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
    imageSizes?: number[]   // Default: [16, 32, 48, 64, 96, 128, 256, 384]
  }

  // Cache TTL in seconds
  minimumCacheTTL?: number  // Default: 31536000 (1 year)

  // Cache directory
  cacheDir?: string         // Default: '.ereo/images'

  // Build-time features
  generateBlurPlaceholder?: boolean  // Default: true
  extractDominantColor?: boolean     // Default: true

  // Maximum dimension
  maxDimension?: number     // Default: 3840

  // API endpoint path
  path?: string             // Default: '/_ereo/image'

  // Allow any remote image (unsafe)
  dangerouslyAllowAllRemote?: boolean  // Default: false
}
```

## Static Image Data

When importing images, you get a `StaticImageData` object:

```ts
interface StaticImageData {
  src: string           // Image URL
  width: number         // Original width
  height: number        // Original height
  blurDataURL?: string  // Base64 blur placeholder
  dominantColor?: string // Extracted dominant color
  type?: string         // MIME type
}
```

```ts
import heroImg from './hero.jpg'

console.log(heroImg)
// {
//   src: '/images/hero.jpg',
//   width: 1920,
//   height: 1080,
//   blurDataURL: 'data:image/webp;base64,...',
//   dominantColor: '#1a2b3c',
//   type: 'image/jpeg'
// }
```

## Processing Utilities

For advanced use cases, you can use the processing utilities directly:

### Blur Placeholder Generation

```ts
import {
  generateBlurPlaceholder,
  generateShimmerSVG,
  generateShimmerDataURL,
} from '@ereo/plugin-images'

// Generate blur from image buffer
const { dataURL, width, height } = await generateBlurPlaceholder(imageBuffer, {
  width: 8,      // Placeholder width
  quality: 10,   // Encoding quality
  sigma: 1,      // Blur amount
})

// Generate shimmer SVG
const shimmerSVG = generateShimmerSVG(400, 300, '#f0f0f0')
const shimmerDataURL = generateShimmerDataURL(400, 300)
```

### Color Extraction

```ts
import {
  extractDominantColor,
  rgbToHex,
  hexToRgb,
  getContrastColor,
} from '@ereo/plugin-images'

const { dominant, palette, vibrant } = await extractDominantColor(imageBuffer)

// Color utilities
const hex = rgbToHex(255, 128, 64)       // '#ff8040'
const rgb = hexToRgb('#ff8040')          // { r: 255, g: 128, b: 64 }
const contrast = getContrastColor('#ff8040')  // '#000000' or '#ffffff'
```

### Image Processing

```ts
import { createImageProcessor } from '@ereo/plugin-images'

const processor = createImageProcessor({
  quality: 80,
  formats: { webp: true },
})

// Process image
const result = await processor.process(imageBuffer, {
  src: '/images/hero.jpg',
  width: 800,
  quality: 85,
  format: 'webp',
})

// Get metadata
const metadata = await processor.getMetadata(imageBuffer)
console.log(metadata.width, metadata.height, metadata.format)
```

## Caching

The plugin includes a two-tier caching system:

### Memory Cache

```ts
import { MemoryCache } from '@ereo/plugin-images'

const cache = new MemoryCache({
  maxItems: 100,
  maxSize: 100 * 1024 * 1024,  // 100MB
  ttl: 3600000,                 // 1 hour
})

cache.set('key', imageBuffer)
const result = cache.get('key')
```

### Disk Cache

```ts
import { DiskCache } from '@ereo/plugin-images'

const cache = new DiskCache({
  dir: '.ereo/images/cache',
  maxSize: 500 * 1024 * 1024,  // 500MB
  ttl: 7 * 24 * 60 * 60 * 1000,  // 7 days
})

await cache.set('key', imageBuffer)
const result = await cache.get('key')
```

### Two-Tier Cache

```ts
import { TwoTierCache } from '@ereo/plugin-images'

const cache = new TwoTierCache({
  memory: { maxItems: 100, maxSize: 50 * 1024 * 1024 },
  disk: { dir: '.ereo/images/cache', maxSize: 500 * 1024 * 1024 },
})

// Checks memory first, then disk
const result = await cache.get('key')
```

## Middleware

The plugin provides runtime image optimization middleware:

```ts
import { createImageMiddleware } from '@ereo/plugin-images'

const middleware = createImageMiddleware({
  root: process.cwd(),
  config: {
    formats: { webp: true, avif: true },
    quality: 80,
  },
  cache: true,
  cacheDir: '.ereo/images',
})
```

### Endpoint

The middleware handles requests to `/_ereo/image` with query parameters:

```
/_ereo/image?src=/images/hero.jpg&w=800&q=80&f=webp
```

Parameters:
- `src` - Source image path (required)
- `w` - Target width (required)
- `h` - Target height (optional)
- `q` - Quality 1-100 (optional)
- `f` - Format: auto, webp, avif, jpeg, png (optional)

## Best Practices

1. **Use static imports** - Get automatic blur placeholders and dimensions
2. **Set priority on LCP images** - Mark above-the-fold images as priority
3. **Use appropriate sizes** - Help the browser choose the right image
4. **Enable AVIF for new projects** - Best compression but slower encode
5. **Cache aggressively** - Images are immutable, cache for a year
6. **Use Picture for art direction** - Different crops for different screens

## Related

- [Tailwind CSS Plugin](/api/plugins/tailwind)
- [Performance Guide](/guides/performance)
- [Static Assets](/guides/static-assets)
