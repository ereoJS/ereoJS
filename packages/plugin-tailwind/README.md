# @ereo/plugin-tailwind

Zero-config Tailwind CSS integration for the EreoJS framework. Includes a custom preset with animations, colors, and sensible defaults.

## Installation

```bash
bun add @ereo/plugin-tailwind
```

## Quick Start

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  plugins: [
    tailwind(), // Zero-config setup
  ],
});
```

```typescript
// With custom options
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  plugins: [
    tailwind({
      content: ['./app/**/*.{js,ts,jsx,tsx}'],
      darkMode: 'class',
      usePreset: true,
    }),
  ],
});
```

## Key Features

- **Zero Configuration**: Works out of the box with sensible defaults
- **EreoJS Preset**: Custom preset with animations, typography, and colors
- **Dark Mode Support**: Built-in dark mode with class-based toggling
- **Animation Utilities**: Pre-built fade, slide, and scale animations
- **Custom Color Palette**: EreoJS brand colors included
- **Typography Defaults**: Inter and JetBrains Mono font families
- **Virtual CSS Module**: Import Tailwind via `virtual:tailwind.css`
- **Config Generation**: Helper functions to generate Tailwind config files

## Using the Preset

```typescript
// tailwind.config.js
import { getEreoTailwindConfig } from '@ereo/plugin-tailwind';

export default getEreoTailwindConfig({
  // Add your customizations here
});
```

## Documentation

For full documentation, visit the [EreoJS Documentation](https://ereojs.dev/docs/plugins/tailwind).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack JavaScript framework.

## License

MIT
