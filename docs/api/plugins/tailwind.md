# Tailwind CSS Plugin

Official Tailwind CSS integration for EreoJS with zero-config setup and a custom framework preset.

## Installation

```bash
bun add @ereo/plugin-tailwind tailwindcss
```

## Setup

### 1. Add Plugin

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import tailwind from '@ereo/plugin-tailwind'

export default defineConfig({
  plugins: [
    tailwind() // Zero-config setup
  ]
})
```

### 2. Create Tailwind Config (Optional)

If you want to customize Tailwind, create a config file:

```bash
touch tailwind.config.js
```

```js
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind'

export default getEreoTailwindConfig({
  // Add your customizations here
})
```

Or create a standard config without the preset:

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
}
```

### 3. Create CSS Entry

```css
/* src/styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Or use the virtual module:

```tsx
// In your root layout or entry
import 'virtual:tailwind.css'
```

### 4. Import in Root

```tsx
// src/routes/_layout.tsx
import '../styles/global.css'

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}
```

## Plugin Options

```ts
interface TailwindPluginOptions {
  /** Content paths to scan (auto-detected by default) */
  content?: string[]
  /** Path to tailwind.config.js (auto-detected by default) */
  config?: string
  /** Enable dark mode */
  darkMode?: 'class' | 'media' | false
  /** Use EreoJS preset */
  usePreset?: boolean
}
```

### Default Values

```ts
const defaults = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  config: 'tailwind.config.js',
  darkMode: 'class',
  usePreset: true
}
```

### Usage Examples

```ts
// Zero-config (uses all defaults)
tailwind()

// Custom content paths
tailwind({
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}'
  ]
})

// Custom config path
tailwind({
  config: './config/tailwind.config.js'
})

// Media-based dark mode
tailwind({
  darkMode: 'media'
})

// Disable EreoJS preset
tailwind({
  usePreset: false
})

// Full custom configuration
tailwind({
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  config: './tailwind.config.js',
  darkMode: 'class',
  usePreset: true
})
```

## EreoJS Preset Features

When `usePreset: true` (default), you get access to the EreoJS Tailwind preset with the following extensions:

### Color Palette

The `ereo` color palette provides a complete range from light to dark:

| Class | Hex Value | Usage |
|-------|-----------|-------|
| `ereo-50` | `#f5f7ff` | Lightest background |
| `ereo-100` | `#ebf0fe` | Light background |
| `ereo-200` | `#d6e0fd` | Light accent |
| `ereo-300` | `#b3c7fb` | Light borders |
| `ereo-400` | `#8aa8f8` | Muted text |
| `ereo-500` | `#6285f4` | Primary color |
| `ereo-600` | `#4361ee` | Primary hover |
| `ereo-700` | `#3451d1` | Dark primary |
| `ereo-800` | `#2c43aa` | Darker accent |
| `ereo-900` | `#273b87` | Dark text |
| `ereo-950` | `#1a2552` | Darkest background |

```tsx
// Example usage
<div className="bg-ereo-50 text-ereo-900">
  <button className="bg-ereo-500 hover:bg-ereo-600 text-white">
    Click me
  </button>
</div>
```

### Animations

Pre-built animation utilities for smooth transitions:

| Class | Animation | CSS |
|-------|-----------|-----|
| `animate-fade-in` | Fade in | `fadeIn 0.2s ease-out` |
| `animate-slide-in` | Slide in from left | `slideIn 0.3s ease-out` |
| `animate-slide-up` | Slide up from bottom | `slideUp 0.3s ease-out` |
| `animate-scale-in` | Scale in | `scaleIn 0.2s ease-out` |

**Keyframe Definitions:**

```css
/* fade-in */
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* slide-in */
@keyframes slideIn {
  0% { transform: translateX(-10px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

/* slide-up */
@keyframes slideUp {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

/* scale-in */
@keyframes scaleIn {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
```

```tsx
// Example usage
<div className="animate-fade-in">Fades in on mount</div>
<nav className="animate-slide-in">Slides in from left</nav>
<dialog className="animate-scale-in">Modal with scale effect</dialog>
```

### Extended Spacing

Additional spacing utilities beyond Tailwind defaults:

| Class | Value |
|-------|-------|
| `w-18`, `h-18`, `p-18`, `m-18`, etc. | `4.5rem` (72px) |
| `w-88`, `h-88`, `p-88`, `m-88`, etc. | `22rem` (352px) |
| `w-128`, `h-128`, `p-128`, `m-128`, etc. | `32rem` (512px) |

```tsx
// Example usage
<aside className="w-88">Sidebar with 22rem width</aside>
<main className="max-w-128">Content area with 32rem max width</main>
```

### Font Families

Optimized font stacks:

**Sans (default):**
```
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif
```

**Mono:**
```
JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace
```

```tsx
// Example usage
<p className="font-sans">Body text with Inter</p>
<code className="font-mono">Code with JetBrains Mono</code>
```

### Border Radius

Extended border radius:

| Class | Value |
|-------|-------|
| `rounded-4xl` | `2rem` (32px) |

```tsx
<div className="rounded-4xl">Extra large rounded corners</div>
```

### Box Shadows

Additional shadow utilities:

| Class | Value |
|-------|-------|
| `shadow-inner-sm` | `inset 0 1px 2px 0 rgb(0 0 0 / 0.05)` |

```tsx
<input className="shadow-inner-sm">Input with subtle inner shadow</input>
```

### Z-Index

Extended z-index scale:

| Class | Value |
|-------|-------|
| `z-60` | `60` |
| `z-70` | `70` |
| `z-80` | `80` |
| `z-90` | `90` |
| `z-100` | `100` |

```tsx
<div className="z-60">Above most content</div>
<div className="z-100">Highest priority overlay</div>
```

## Helper Functions

### getEreoTailwindConfig(overrides?)

Returns a complete Tailwind config with the EreoJS preset applied. Use this in your `tailwind.config.js`:

```js
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind'

// Basic usage
export default getEreoTailwindConfig()

// With custom overrides
export default getEreoTailwindConfig({
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './packages/ui/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#ff6b6b'
        }
      }
    }
  }
})
```

The function merges your overrides with the preset defaults:

```ts
function getEreoTailwindConfig(overrides = {}) {
  return {
    presets: [ereoPreset],
    content: [
      './app/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}'
    ],
    darkMode: 'class',
    ...overrides,
    theme: {
      extend: {
        ...ereoPreset.theme.extend,
        ...overrides.theme?.extend
      }
    }
  }
}
```

### generateConfig(options?)

Generates a Tailwind config file content as a string. Useful for scaffolding:

```ts
import { generateConfig } from '@ereo/plugin-tailwind'

// Generate config with preset (default)
const configWithPreset = generateConfig()
// Returns:
// import { getEreoTailwindConfig } from '@ereo/plugin-tailwind';
//
// export default getEreoTailwindConfig({
//   // Add your customizations here
// });

// Generate config without preset
const configWithoutPreset = generateConfig({ usePreset: false })
// Returns:
// /** @type {import('tailwindcss').Config} */
// export default {
//   content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
//   darkMode: 'class',
//   theme: {
//     extend: {},
//   },
//   plugins: [],
// };

// Generate with custom options
const customConfig = generateConfig({
  content: ['./src/**/*.tsx'],
  darkMode: 'media',
  usePreset: false
})
```

### generateCSSEntry()

Generates a CSS entry file content with Tailwind directives:

```ts
import { generateCSSEntry } from '@ereo/plugin-tailwind'

const cssContent = generateCSSEntry()
// Returns:
// @tailwind base;
// @tailwind components;
// @tailwind utilities;
//
// /* Custom styles below */
```

## Virtual Module

The plugin provides a virtual CSS module for importing Tailwind styles:

### virtual:tailwind.css

Import this virtual module to include Tailwind directives:

```tsx
// In your entry file or root layout
import 'virtual:tailwind.css'
```

This is equivalent to creating a CSS file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### /__tailwind.css

In development mode, the plugin serves Tailwind CSS via the `/__tailwind.css` endpoint:

```html
<link rel="stylesheet" href="/__tailwind.css" />
```

This endpoint serves the Tailwind CDN import for rapid development.

## Dark Mode

### Class-Based (Default)

```js
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind'

export default getEreoTailwindConfig({
  darkMode: 'class' // This is the default
})
```

```tsx
// components/ThemeToggle.tsx (island)
export default function ThemeToggle() {
  const toggle = () => {
    document.documentElement.classList.toggle('dark')
  }

  return <button onClick={toggle}>Toggle Theme</button>
}
```

### System Preference

```ts
tailwind({
  darkMode: 'media'
})
```

Or in your config:

```js
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind'

export default getEreoTailwindConfig({
  darkMode: 'media'
})
```

## Using with PostCSS

For additional PostCSS plugins:

```js
// postcss.config.js
export default {
  plugins: {
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {})
  }
}
```

## Component Classes

Use `@apply` for reusable component styles:

```css
/* src/styles/components.css */
@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }

  .btn-primary {
    @apply btn bg-ereo-500 text-white hover:bg-ereo-600;
  }

  .btn-secondary {
    @apply btn bg-gray-100 text-gray-900 hover:bg-gray-200;
  }

  .card {
    @apply bg-white rounded-xl shadow-sm border p-6;
  }
}
```

## Typography Plugin

For prose content:

```bash
bun add @tailwindcss/typography
```

```js
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind'
import typography from '@tailwindcss/typography'

export default getEreoTailwindConfig({
  plugins: [typography]
})
```

```tsx
<article className="prose lg:prose-xl">
  <h1>Article Title</h1>
  <p>Content with automatic styling...</p>
</article>
```

## Forms Plugin

For form styling:

```bash
bun add @tailwindcss/forms
```

```js
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind'
import forms from '@tailwindcss/forms'

export default getEreoTailwindConfig({
  plugins: [forms]
})
```

## Exports

The plugin exports the following:

```ts
// Default export - the plugin function
import tailwind from '@ereo/plugin-tailwind'

// Named exports
import {
  ereoPreset,           // The raw Tailwind preset object
  getEreoTailwindConfig, // Helper to generate full config
  generateConfig,        // Generate config file content
  generateCSSEntry       // Generate CSS entry file content
} from '@ereo/plugin-tailwind'

// Types
import type { TailwindPluginOptions } from '@ereo/plugin-tailwind'
```

## Related

- [Styling Guide](/guides/styling)
- [Plugins](/api/core/plugins)
