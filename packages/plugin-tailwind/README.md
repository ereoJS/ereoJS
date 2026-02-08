# @ereo/plugin-tailwind

Zero-config Tailwind CSS integration for the EreoJS framework. Includes a custom preset with animations, colors, and sensible defaults.

## Installation

```bash
bun add @ereo/plugin-tailwind tailwindcss
```

## Quick Start

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import tailwind from '@ereo/plugin-tailwind'

export default defineConfig({
  plugins: [
    tailwind() // Zero-config setup
  ]
})
```

## Plugin Options

```typescript
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

```typescript
const defaults = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  config: 'tailwind.config.js',
  darkMode: 'class',
  usePreset: true
}
```

### With Custom Options

```typescript
import tailwind from '@ereo/plugin-tailwind'

export default defineConfig({
  plugins: [
    tailwind({
      content: ['./src/**/*.{js,ts,jsx,tsx}'],
      darkMode: 'media',
      usePreset: true
    })
  ]
})
```

## Key Features

- **Zero Configuration**: Works out of the box with sensible defaults
- **EreoJS Preset**: Custom preset with animations, typography, and colors
- **Dark Mode Support**: Built-in dark mode with class-based toggling (default)
- **Animation Utilities**: Pre-built fade, slide, and scale animations
- **Custom Color Palette**: EreoJS brand colors (`ereo-50` through `ereo-950`)
- **Typography Defaults**: Inter and JetBrains Mono font families
- **Virtual CSS Module**: Import Tailwind via `virtual:tailwind.css`
- **Config Generation**: Helper functions to generate Tailwind config files

## EreoJS Preset

The preset includes the following extensions:

### Color Palette

| Class | Hex |
|-------|-----|
| `ereo-50` | `#f5f7ff` |
| `ereo-100` | `#ebf0fe` |
| `ereo-200` | `#d6e0fd` |
| `ereo-300` | `#b3c7fb` |
| `ereo-400` | `#8aa8f8` |
| `ereo-500` | `#6285f4` |
| `ereo-600` | `#4361ee` |
| `ereo-700` | `#3451d1` |
| `ereo-800` | `#2c43aa` |
| `ereo-900` | `#273b87` |
| `ereo-950` | `#1a2552` |

### Animations

- `animate-fade-in` - Fade in (0.2s ease-out)
- `animate-slide-in` - Slide in from left (0.3s ease-out)
- `animate-slide-up` - Slide up from bottom (0.3s ease-out)
- `animate-scale-in` - Scale in (0.2s ease-out)

### Extended Spacing

- `18` = 4.5rem (72px)
- `88` = 22rem (352px)
- `128` = 32rem (512px)

### Font Families

- `font-sans`: Inter, ui-sans-serif, system-ui, ...
- `font-mono`: JetBrains Mono, ui-monospace, ...

### Additional Utilities

- Border radius: `rounded-4xl` (2rem)
- Box shadow: `shadow-inner-sm`
- Z-index: `z-60`, `z-70`, `z-80`, `z-90`, `z-100`

## Using the Preset

```typescript
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind'

export default getEreoTailwindConfig({
  // Add your customizations here
  theme: {
    extend: {
      colors: {
        brand: '#ff6b6b'
      }
    }
  }
})
```

## Virtual CSS Module

Import Tailwind styles without creating a CSS file:

```typescript
import 'virtual:tailwind.css'
```

## Helper Functions

### generateConfig(options?)

Generate Tailwind config file content:

```typescript
import { generateConfig } from '@ereo/plugin-tailwind'

const configContent = generateConfig()
```

### generateCSSEntry()

Generate CSS entry file content:

```typescript
import { generateCSSEntry } from '@ereo/plugin-tailwind'

const cssContent = generateCSSEntry()
// Returns:
// @tailwind base;
// @tailwind components;
// @tailwind utilities;
//
// /* Custom styles below */
```

## Exports

```typescript
// Default export
import tailwind from '@ereo/plugin-tailwind'

// Named exports
import {
  ereoPreset,
  getEreoTailwindConfig,
  generateConfig,
  generateCSSEntry
} from '@ereo/plugin-tailwind'

// Types
import type { TailwindPluginOptions } from '@ereo/plugin-tailwind'
```

## Documentation

For full documentation, visit the [EreoJS Documentation](https://ereojs.dev/docs/plugins/tailwind).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack JavaScript framework.

## License

MIT
