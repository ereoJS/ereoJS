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

---

## TypeScript API Reference

This section documents all exported TypeScript interfaces and types.

### StaticImageData

Represents metadata for a statically imported image.

```ts
interface StaticImageData {
  /** Source URL of the image */
  src: string
  /** Original width in pixels */
  width: number
  /** Original height in pixels */
  height: number
  /** Base64 encoded blur placeholder (if generated) */
  blurDataURL?: string
  /** Dominant color (if extracted) */
  dominantColor?: string
  /** MIME type of the original image */
  type?: string
}
```

**Example:**

```ts
import heroImg from './hero.jpg'

console.log(heroImg)
// {
//   src: '/images/hero.jpg',
//   width: 1920,
//   height: 1080,
//   blurDataURL: 'data:image/webp;base64,...',
//   dominantColor: 'rgb(26, 43, 60)',
//   type: 'image/jpeg'
// }
```

### ImageVariant

Represents a generated image variant at a specific size and format.

```ts
interface ImageVariant {
  /** Output path */
  path: string
  /** Width in pixels */
  width: number
  /** Height in pixels */
  height: number
  /** Output format */
  format: 'webp' | 'avif' | 'jpeg' | 'png'
  /** File size in bytes */
  size: number
}
```

### ImageManifestEntry

Represents an image entry in the build manifest.

```ts
interface ImageManifestEntry {
  /** Original source path */
  src: string
  /** Original width */
  width: number
  /** Original height */
  height: number
  /** Generated variants */
  variants: ImageVariant[]
  /** Blur placeholder data URL */
  blurDataURL?: string
  /** Dominant color */
  dominantColor?: string
  /** File hash for cache busting */
  hash: string
}
```

### ProcessedImage

Result of image processing operations.

```ts
interface ProcessedImage {
  /** Processed image buffer */
  buffer: Buffer
  /** MIME type */
  contentType: string
  /** Width in pixels */
  width: number
  /** Height in pixels */
  height: number
  /** Output format */
  format: string
}
```

### ImageOptimizationParams

Parameters for image optimization requests.

```ts
interface ImageOptimizationParams {
  /** Source image path or URL */
  src: string
  /** Target width */
  width: number
  /** Target height (optional, maintains aspect ratio if omitted) */
  height?: number
  /** Quality (1-100) */
  quality?: number
  /** Output format */
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
}
```

### RemotePattern

Pattern for allowing remote image sources.

```ts
interface RemotePattern {
  /** Protocol (http or https) */
  protocol?: 'http' | 'https'
  /** Hostname pattern (supports wildcards like '*.example.com') */
  hostname: string
  /** Port number */
  port?: string
  /** Path prefix pattern (e.g., '/images/*') */
  pathname?: string
}
```

### BlurPlaceholderOptions

Options for blur placeholder generation.

```ts
interface BlurPlaceholderOptions {
  /** Width of the placeholder (default: 8px) */
  width?: number
  /** Quality for encoding (default: 10) */
  quality?: number
  /** Blur sigma (default: 1) */
  sigma?: number
}
```

### BlurPlaceholderResult

Result of blur placeholder generation.

```ts
interface BlurPlaceholderResult {
  /** Base64-encoded data URL */
  dataURL: string
  /** Width of the placeholder */
  width: number
  /** Height of the placeholder */
  height: number
}
```

### ColorExtractionResult

Result of dominant color extraction.

```ts
interface ColorExtractionResult {
  /** Primary dominant color as CSS rgb() string */
  dominant: string
  /** Palette of dominant colors */
  palette: string[]
  /** Primary color as RGB object */
  dominantRGB: RGBColor
  /** Whether the image has significant transparency */
  hasTransparency: boolean
}
```

### RGBColor

RGB color representation.

```ts
interface RGBColor {
  r: number
  g: number
  b: number
}
```

### ColorExtractionOptions

Options for color extraction.

```ts
interface ColorExtractionOptions {
  /** Number of colors to extract (default: 5) */
  colorCount?: number
  /** Sample size for analysis (default: 64) */
  sampleSize?: number
  /** Minimum saturation for "colorful" detection (default: 0.1) */
  minSaturation?: number
  /** Transparency threshold (default: 0.5) */
  transparencyThreshold?: number
}
```

### ImageMetadata

Image metadata from processing.

```ts
interface ImageMetadata {
  width: number
  height: number
  format: string
  space?: string
  channels?: number
  depth?: string
  density?: number
  hasAlpha?: boolean
  orientation?: number
}
```

### ImageLoaderParams

Parameters passed to custom image loaders.

```ts
interface ImageLoaderParams {
  src: string
  width: number
  quality?: number
}

type ImageLoader = (params: ImageLoaderParams) => string
```

---

## ImageProcessor Direct Usage

The `ImageProcessor` class provides programmatic access to image processing capabilities.

### Creating an Instance

```ts
import { createImageProcessor, ImageProcessor } from '@ereo/plugin-images'

const processor = createImageProcessor({
  quality: 80,
  formats: { webp: true, avif: true },
  generateBlurPlaceholder: true,
  extractDominantColor: true,
})

// Or instantiate directly
const processor = new ImageProcessor({
  quality: 85,
  maxDimension: 2048,
})
```

### process()

Process a single image with given parameters.

```ts
const result = await processor.process(imageBuffer, {
  src: '/images/hero.jpg',
  width: 800,
  quality: 85,
  format: 'webp',
})

console.log(result.buffer)      // Buffer
console.log(result.contentType) // 'image/webp'
console.log(result.width)       // 800
console.log(result.height)      // calculated from aspect ratio
console.log(result.format)      // 'webp'
```

### processWithMetadata()

Process an image and generate all metadata including blur placeholder and dominant color.

```ts
const result = await processor.processWithMetadata(imageBuffer, {
  src: '/images/product.jpg',
  width: 600,
  format: 'webp',
})

console.log(result.processed)  // ProcessedImage
console.log(result.metadata)   // ImageMetadata (original dimensions, format, etc.)
console.log(result.blur)       // BlurPlaceholderResult (if enabled)
console.log(result.colors)     // ColorExtractionResult (if enabled)
```

### processFile()

Process a local image file and generate all variants.

```ts
const result = await processor.processFile('/path/to/image.jpg')

console.log(result.staticData)  // StaticImageData for component use
console.log(result.path)        // Original file path
console.log(result.variants)    // Array of all generated variants

// Each variant includes:
result.variants.forEach(variant => {
  console.log(variant.width)   // e.g., 640
  console.log(variant.height)  // calculated
  console.log(variant.format)  // 'webp', 'avif', etc.
  console.log(variant.path)    // output path
  console.log(variant.buffer)  // Buffer to write to disk
})
```

### getMetadata()

Get image metadata without processing.

```ts
const metadata = await processor.getMetadata(imageBuffer)

console.log(metadata.width)       // 1920
console.log(metadata.height)      // 1080
console.log(metadata.format)      // 'jpeg'
console.log(metadata.hasAlpha)    // false
console.log(metadata.orientation) // 1 (EXIF orientation)
console.log(metadata.density)     // DPI if available
```

### generateBlur()

Generate a blur placeholder for an image.

```ts
const blur = await processor.generateBlur(imageBuffer)

console.log(blur.dataURL)  // 'data:image/webp;base64,...'
console.log(blur.width)    // 8 (default)
console.log(blur.height)   // calculated from aspect ratio
```

### extractColor()

Extract dominant color from an image.

```ts
const colors = await processor.extractColor(imageBuffer)

console.log(colors.dominant)        // 'rgb(26, 43, 60)'
console.log(colors.palette)         // ['rgb(26, 43, 60)', 'rgb(255, 128, 64)', ...]
console.log(colors.dominantRGB)     // { r: 26, g: 43, b: 60 }
console.log(colors.hasTransparency) // false
```

### isSupported()

Check if a file is a supported image format.

```ts
processor.isSupported('image.jpg')   // true
processor.isSupported('image.webp')  // true
processor.isSupported('image.svg')   // true
processor.isSupported('document.pdf') // false
```

### clearCache()

Clear the internal processing cache.

```ts
processor.clearCache()
```

---

## BuildOptimizer Integration

The `BuildOptimizer` handles batch image processing during production builds.

### Creating an Instance

```ts
import { createBuildOptimizer, optimizeImages, BuildOptimizer } from '@ereo/plugin-images'

const optimizer = createBuildOptimizer({
  root: process.cwd(),
  outDir: '.ereo/public',
  config: {
    formats: { webp: true, avif: true },
    quality: 80,
  },
  scanDirs: ['public', 'app/assets', 'assets'],
  force: false,  // Set to true to reprocess all images
  onProgress: (current, total, file) => {
    console.log(`Processing ${current}/${total}: ${file}`)
  },
})
```

### BuildOptimizerOptions

```ts
interface BuildOptimizerOptions {
  /** Project root directory */
  root: string
  /** Output directory for optimized images */
  outDir: string
  /** Plugin configuration */
  config?: ImagePluginConfig
  /** Directories to scan for images */
  scanDirs?: string[]
  /** Whether to force reprocessing all images */
  force?: boolean
  /** Progress callback */
  onProgress?: (current: number, total: number, file: string) => void
}
```

### run()

Run the build optimization process.

```ts
const result = await optimizer.run()

console.log(result.processed)  // Number of images processed
console.log(result.skipped)    // Number unchanged (cached)
console.log(result.variants)   // Total variants generated
console.log(result.totalSize)  // Total output size in bytes
console.log(result.duration)   // Processing time in ms
console.log(result.errors)     // Array of { file, error }
```

### BuildResult

```ts
interface BuildResult {
  /** Number of images processed */
  processed: number
  /** Number of images skipped (unchanged) */
  skipped: number
  /** Total variants generated */
  variants: number
  /** Total output size in bytes */
  totalSize: number
  /** Processing time in milliseconds */
  duration: number
  /** Any errors encountered */
  errors: Array<{ file: string; error: string }>
}
```

### getManifest()

Access the manifest manager.

```ts
const manifest = optimizer.getManifest()
const allImages = manifest.getAllImages()
```

### One-liner with optimizeImages()

```ts
import { optimizeImages } from '@ereo/plugin-images'

const result = await optimizeImages({
  root: process.cwd(),
  outDir: 'dist/images',
  config: { formats: { webp: true } },
})
```

---

## ManifestManager

The `ImageManifestManager` tracks processed images and their variants.

### Creating an Instance

```ts
import { createManifestManager, ImageManifestManager } from '@ereo/plugin-images'

const manifest = createManifestManager('./dist/images')
```

### load()

Load the manifest from disk.

```ts
await manifest.load()
```

### save()

Save the manifest to disk.

```ts
await manifest.save()
```

### addImage()

Add or update an image entry.

```ts
manifest.addImage('/images/hero.jpg', {
  src: '/images/hero.jpg',
  width: 1920,
  height: 1080,
  variants: [
    { path: 'hero-640w.webp', width: 640, height: 360, format: 'webp', size: 12500 },
    { path: 'hero-1080w.webp', width: 1080, height: 608, format: 'webp', size: 35000 },
  ],
  blurDataURL: 'data:image/webp;base64,...',
  dominantColor: 'rgb(26, 43, 60)',
})
```

### getImage()

Get an image entry by source path.

```ts
const entry = manifest.getImage('/images/hero.jpg')
if (entry) {
  console.log(entry.width, entry.height)
  console.log(entry.variants.length)
}
```

### needsReprocessing()

Check if an image needs to be reprocessed based on file hash.

```ts
const fileHash = 'abc12345'  // MD5 hash of file content
if (manifest.needsReprocessing('/images/hero.jpg', fileHash)) {
  // Process the image
}
```

### removeImage()

Remove an image entry.

```ts
manifest.removeImage('/images/old.jpg')
```

### getAllImages()

Get all image entries.

```ts
const images = manifest.getAllImages()
// Returns: Record<string, ImageManifestEntry>

for (const [path, entry] of Object.entries(images)) {
  console.log(path, entry.variants.length)
}
```

### Statistics Methods

```ts
manifest.getImageCount()   // Number of images
manifest.getVariantCount() // Total variants across all images
manifest.getTotalSize()    // Total size of all variants in bytes
```

### clear()

Clear all entries.

```ts
manifest.clear()
```

### Helper Functions

```ts
import { generateImageModule, generateSrcset, getBestVariant } from '@ereo/plugin-images'

// Generate a virtual module for image metadata
const moduleCode = generateImageModule(entry, '/assets')
// Returns: 'export default { src: "/assets/hero.jpg", ... };'

// Generate srcset string from variants
const srcset = generateSrcset(entry.variants, '/assets', 'webp')
// Returns: '/assets/hero-640w.webp 640w, /assets/hero-1080w.webp 1080w'

// Get best variant for a given width
const variant = getBestVariant(entry.variants, 800, 'webp')
// Returns the smallest variant >= 800px wide in webp format
```

---

## Blur Generation Functions

### generateBlurPlaceholder()

Generate a tiny blurred version of an image for use as a loading placeholder.

```ts
import { generateBlurPlaceholder } from '@ereo/plugin-images'

const blur = await generateBlurPlaceholder(imageBuffer, {
  width: 8,      // Placeholder width (default: 8)
  quality: 10,   // Encoding quality (default: 10)
  sigma: 1,      // Blur amount (default: 1)
})

console.log(blur.dataURL)  // 'data:image/webp;base64,UklGRlYAAABXRUJQ...'
console.log(blur.width)    // 8
console.log(blur.height)   // Calculated from aspect ratio
```

### generateBlurHash()

Generate a blur hash using an SVG gradient representation.

```ts
import { generateBlurHash } from '@ereo/plugin-images'

const hash = await generateBlurHash(imageBuffer)

console.log(hash.dataURL)  // 'data:image/svg+xml;base64,...'
console.log(hash.width)    // 4 (landscape) or 3 (portrait)
console.log(hash.height)   // 3 (landscape) or 4 (portrait)
```

### generateCSSBlurPlaceholder()

Generate an ultra-compact blur placeholder optimized for CSS backgrounds.

```ts
import { generateCSSBlurPlaceholder } from '@ereo/plugin-images'

const dataURL = await generateCSSBlurPlaceholder(imageBuffer)
// Uses width: 4, quality: 5, sigma: 2 for minimal size
```

### generateShimmerSVG()

Generate an animated shimmer placeholder SVG.

```ts
import { generateShimmerSVG, generateShimmerDataURL } from '@ereo/plugin-images'

// Get raw SVG string
const svg = generateShimmerSVG(400, 300, '#f3f4f6')

// Get as data URL
const dataURL = generateShimmerDataURL(400, 300, '#f3f4f6')
```

---

## Color Utilities

### extractDominantColor()

Extract dominant colors from an image using k-means clustering.

```ts
import { extractDominantColor } from '@ereo/plugin-images'

const result = await extractDominantColor(imageBuffer, {
  colorCount: 5,              // Number of colors to extract
  sampleSize: 64,             // Analysis sample size
  minSaturation: 0.1,         // Minimum saturation for vibrant colors
  transparencyThreshold: 0.5, // Threshold for transparency detection
})

console.log(result.dominant)        // 'rgb(26, 43, 60)'
console.log(result.palette)         // ['rgb(26, 43, 60)', 'rgb(255, 128, 64)', ...]
console.log(result.dominantRGB)     // { r: 26, g: 43, b: 60 }
console.log(result.hasTransparency) // false
```

### rgbToHex()

Convert RGB color to hex string.

```ts
import { rgbToHex } from '@ereo/plugin-images'

const hex = rgbToHex({ r: 255, g: 128, b: 64 })
console.log(hex)  // '#ff8040'
```

### hexToRgb()

Convert hex string to RGB color.

```ts
import { hexToRgb } from '@ereo/plugin-images'

const rgb = hexToRgb('#ff8040')
console.log(rgb)  // { r: 255, g: 128, b: 64 }

// Throws Error for invalid hex
hexToRgb('invalid')  // Error: Invalid hex color: invalid
```

### getContrastColor()

Get a contrasting text color (black or white) for a background.

```ts
import { getContrastColor } from '@ereo/plugin-images'

const textColor = getContrastColor({ r: 26, g: 43, b: 60 })
console.log(textColor)  // '#ffffff' (white text on dark background)

const textColor2 = getContrastColor({ r: 255, g: 255, b: 200 })
console.log(textColor2)  // '#000000' (black text on light background)
```

---

## Error Handling

### ConfigValidationError

Thrown when plugin configuration is invalid.

```ts
import { validateConfig, ConfigValidationError } from '@ereo/plugin-images'

try {
  const config = validateConfig({
    quality: 150,  // Invalid: must be 1-100
  })
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.log(error.message)  // "Invalid configuration for 'quality': quality must be between 1 and 100"
    console.log(error.field)    // 'quality'
    console.log(error.value)    // 150
  }
}
```

### Common Validation Errors

```ts
// Quality out of range
validateConfig({ quality: 0 })    // Error: quality must be between 1 and 100
validateConfig({ quality: 101 })  // Error: quality must be between 1 and 100

// Invalid remote pattern
validateConfig({
  remotePatterns: [{ hostname: '' }]  // Error: hostname is required
})

// Invalid path
validateConfig({ path: 'no-slash' })  // Error: path must be a string starting with "/"

// Invalid sizes
validateConfig({
  sizes: { deviceSizes: [5000] }  // Error: deviceSizes[0] must be a positive number <= 3840
})
```

### Image Processing Error Handling

```ts
import { createImageProcessor } from '@ereo/plugin-images'

const processor = createImageProcessor()

try {
  const result = await processor.process(buffer, {
    src: '/image.jpg',
    width: 5000,  // Exceeds maxDimension
  })
} catch (error) {
  console.error('Processing failed:', error.message)
  // "Width 5000 exceeds maximum dimension 3840"
}

// Metadata errors
try {
  const metadata = await processor.getMetadata(corruptBuffer)
} catch (error) {
  console.error('Metadata failed:', error.message)
  // "Unable to read image metadata"
}
```

### Graceful Degradation Pattern

```ts
const processor = createImageProcessor({
  generateBlurPlaceholder: true,
  extractDominantColor: true,
})

// processWithMetadata handles errors gracefully
const result = await processor.processWithMetadata(buffer, params)

// blur and colors may be undefined if generation failed
if (result.blur) {
  console.log('Blur generated:', result.blur.dataURL)
} else {
  console.log('Blur generation failed, using fallback')
}

if (result.colors) {
  console.log('Dominant color:', result.colors.dominant)
} else {
  console.log('Color extraction failed, using default')
}
```

### Build Optimizer Error Collection

```ts
import { optimizeImages } from '@ereo/plugin-images'

const result = await optimizeImages({
  root: process.cwd(),
  outDir: 'dist/images',
})

// Errors are collected, not thrown
if (result.errors.length > 0) {
  console.log(`${result.errors.length} images failed to process:`)
  result.errors.forEach(({ file, error }) => {
    console.log(`  - ${file}: ${error}`)
  })
}
```

---

## Caching

The plugin includes a two-tier caching system for optimized images.

### Memory Cache

```ts
import { MemoryCache } from '@ereo/plugin-images'

const cache = new MemoryCache({
  maxItems: 100,                   // Maximum cached items
  maxSize: 100 * 1024 * 1024,      // 100MB max size
  ttl: 3600000,                    // 1 hour TTL
})

cache.set('key', imageBuffer)
const result = cache.get('key')

// Check and manage cache
cache.has('key')     // boolean
cache.delete('key')  // boolean
cache.clear()

// Statistics
const stats = cache.stats()
console.log(stats.items)    // Current item count
console.log(stats.size)     // Current size in bytes
console.log(stats.maxItems) // Max items allowed
console.log(stats.maxSize)  // Max size allowed
```

### Disk Cache

```ts
import { DiskCache } from '@ereo/plugin-images'

const cache = new DiskCache({
  dir: '.ereo/images/cache',
  maxSize: 500 * 1024 * 1024,        // 500MB
  ttl: 7 * 24 * 60 * 60 * 1000,      // 7 days
})

await cache.set('key', imageBuffer)
const result = await cache.get('key')

// Async operations
await cache.has('key')
await cache.delete('key')

// Statistics
const stats = await cache.stats()
console.log(stats.files)  // File count
console.log(stats.size)   // Total size

// Cleanup expired entries
const cleanup = await cache.cleanup()
console.log(cleanup.deleted)  // Files deleted
console.log(cleanup.freed)    // Bytes freed
```

### Two-Tier Cache

```ts
import { TwoTierCache } from '@ereo/plugin-images'

const cache = new TwoTierCache({
  memory: { maxItems: 100, maxSize: 50 * 1024 * 1024 },
  disk: { dir: '.ereo/images/cache', maxSize: 500 * 1024 * 1024 },
})

// Checks memory first, then disk (promotes to memory on hit)
const result = await cache.get('key')

// Writes to both tiers
await cache.set('key', imageBuffer)

// Combined statistics
const stats = await cache.stats()
console.log(stats.memory.items)
console.log(stats.disk.files)
```

### Cache Key Generation

```ts
import { generateCacheKey } from '@ereo/plugin-images'

const key = generateCacheKey({
  src: '/images/hero.jpg',
  width: 800,
  height: 600,
  quality: 80,
  format: 'webp',
})
// Returns: '/images/hero.jpg:w800:h600:q80:fwebp'
```

---

## Middleware

The plugin provides runtime image optimization middleware.

### createImageMiddleware()

```ts
import { createImageMiddleware, imageMiddleware } from '@ereo/plugin-images'

const middleware = createImageMiddleware({
  root: process.cwd(),
  config: {
    formats: { webp: true, avif: true },
    quality: 80,
    remotePatterns: [
      { hostname: 'cdn.example.com' }
    ],
  },
  cache: true,
  cacheDir: '.ereo/images',
})

// Or use the wrapper
const handler = imageMiddleware({
  root: process.cwd(),
  config: { /* ... */ },
})
```

### Endpoint

The middleware handles requests to `/_ereo/image` with query parameters:

```
/_ereo/image?src=/images/hero.jpg&w=800&q=80&f=webp
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `src` | Yes | Source image path or URL |
| `w` | Yes | Target width (1 to maxDimension) |
| `h` | No | Target height |
| `q` | No | Quality 1-100 (default: 80) |
| `f` | No | Format: auto, webp, avif, jpeg, png |

### Response Headers

```
Content-Type: image/webp
Content-Length: 12345
Cache-Control: public, max-age=31536000, immutable
Vary: Accept
X-Cache: HIT (or MISS)
```

### Format Negotiation

The middleware automatically selects the best format based on the Accept header:

1. If `f` parameter is specified (not `auto`), uses that format
2. Checks Accept header for `image/avif` support (if AVIF enabled)
3. Checks Accept header for `image/webp` support
4. Falls back to JPEG

---

## Supported Formats

### Input Formats

The plugin accepts the following input formats:

| Format | Extension | Notes |
|--------|-----------|-------|
| JPEG | `.jpg`, `.jpeg` | Most common photo format |
| PNG | `.png` | Supports transparency |
| WebP | `.webp` | Modern format with good compression |
| AVIF | `.avif` | Best compression, newer format |
| GIF | `.gif` | Animated images (first frame only) |
| SVG | `.svg` | Vector graphics (passed through) |

### Output Formats

| Format | Extension | MIME Type | Notes |
|--------|-----------|-----------|-------|
| WebP | `.webp` | `image/webp` | Default, good balance |
| AVIF | `.avif` | `image/avif` | Best compression, slower encode |
| JPEG | `.jpg` | `image/jpeg` | Fallback for older browsers |
| PNG | `.png` | `image/png` | For images with transparency |

---

## Troubleshooting Guide

### Common Issues

#### "Unable to read image dimensions"

**Cause:** The image file is corrupted or in an unsupported format.

**Solution:**
```ts
// Verify the file is a valid image
const metadata = await processor.getMetadata(buffer)
if (!metadata.width || !metadata.height) {
  console.error('Invalid image file')
}

// Check if format is supported
if (!processor.isSupported(filePath)) {
  console.error('Unsupported format:', extname(filePath))
}
```

#### "Width exceeds maximum dimension"

**Cause:** Requested width is larger than `maxDimension` (default: 3840).

**Solution:**
```ts
// Either reduce the requested width
const result = await processor.process(buffer, {
  width: Math.min(requestedWidth, 3840),
})

// Or increase maxDimension in config
const processor = createImageProcessor({
  maxDimension: 4096,
})
```

#### "Source not allowed"

**Cause:** Remote image URL doesn't match any configured pattern.

**Solution:**
```ts
images({
  remotePatterns: [
    { hostname: 'cdn.example.com' },
    { hostname: '*.cloudinary.com' },
  ],
  // Or for development only:
  // dangerouslyAllowAllRemote: true,
})
```

#### Blur Placeholder Not Generated

**Cause:** Image is too small or has issues.

**Solution:**
```ts
// Check if blur was generated
const result = await processor.processWithMetadata(buffer, params)
if (!result.blur) {
  console.log('Blur generation failed, using fallback')
  // Use a solid color or shimmer instead
}
```

#### Color Extraction Returns Gray

**Cause:** Image is mostly transparent or has low color variance.

**Solution:**
```ts
const result = await extractDominantColor(buffer)
if (result.hasTransparency) {
  // Use a default color for transparent images
  const color = '#f3f4f6'
}
```

#### Build Process Slow

**Cause:** Processing many large images or generating AVIF format.

**Solutions:**
```ts
// 1. Disable AVIF (slower to encode)
images({
  formats: { webp: true, avif: false },
})

// 2. Reduce device sizes
images({
  sizes: {
    deviceSizes: [640, 1080, 1920],  // Fewer sizes
  }
})

// 3. Use caching (reprocesses only changed files)
// Caching is automatic with the manifest system
```

#### Memory Issues During Build

**Cause:** Processing very large images or too many concurrent operations.

**Solution:**
```ts
// The BuildOptimizer processes images sequentially
// Reduce memory cache size if needed
const cache = new MemoryCache({
  maxItems: 50,
  maxSize: 25 * 1024 * 1024,  // 25MB
})
```

### Debug Logging

```ts
// Enable verbose logging
const result = await processor.processWithMetadata(buffer, params)

console.log('Original:', result.metadata.width, 'x', result.metadata.height)
console.log('Processed:', result.processed.width, 'x', result.processed.height)
console.log('Format:', result.processed.format)
console.log('Size:', result.processed.buffer.length, 'bytes')
console.log('Blur:', result.blur ? 'generated' : 'failed')
console.log('Color:', result.colors?.dominant || 'failed')
```

---

## Best Practices

1. **Use static imports** - Get automatic blur placeholders and dimensions
2. **Set priority on LCP images** - Mark above-the-fold images as priority
3. **Use appropriate sizes** - Help the browser choose the right image
4. **Enable AVIF for new projects** - Best compression but slower encode
5. **Cache aggressively** - Images are immutable, cache for a year
6. **Use Picture for art direction** - Different crops for different screens
7. **Handle errors gracefully** - Always check for undefined blur/color results
8. **Validate configuration early** - Use `validateConfig()` to catch issues

## Related

- [Tailwind CSS Plugin](/api/plugins/tailwind)
- [Performance Guide](/guides/performance)
- [Static Assets](/guides/static-assets)
