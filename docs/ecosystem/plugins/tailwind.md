# Tailwind CSS Plugin

Integrate [Tailwind CSS](https://tailwindcss.com) into your EreoJS application with zero-config setup.

## Installation

```bash
bun add @ereo/plugin-tailwind tailwindcss
```

## Setup

### 1. Add the Plugin

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { tailwindPlugin } from '@ereo/plugin-tailwind'

export default defineConfig({
  plugins: [
    tailwindPlugin(),
  ],
})
```

### 2. Create a Tailwind Config

```bash
bunx tailwindcss init
```

Configure the content paths in `tailwind.config.js`:

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './routes/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 3. Add the Stylesheet

Create a CSS file with the Tailwind directives:

```css
/* src/styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Import it in your root layout:

```tsx
// routes/_layout.tsx
import '../src/styles/global.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>My App</title>
      </head>
      <body className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
        {children}
      </body>
    </html>
  )
}
```

## Dark Mode

Tailwind supports dark mode out of the box. Configure the strategy in `tailwind.config.js`:

```js
// tailwind.config.js
export default {
  darkMode: 'class', // 'class' | 'media'
  content: ['./src/**/*.{ts,tsx}', './routes/**/*.{ts,tsx}'],
}
```

With `'class'` mode, toggle dark mode by adding a `dark` class to the `<html>` element:

```tsx
// components/ThemeToggle.island.tsx
'use client'

export default function ThemeToggle() {
  const toggle = () => {
    document.documentElement.classList.toggle('dark')
  }

  return <button onClick={toggle}>Toggle Theme</button>
}
```

With `'media'` mode, dark mode follows the user's system preference automatically.

## Custom Theme

Extend the default theme with your own design tokens:

```js
// tailwind.config.js
export default {
  content: ['./src/**/*.{ts,tsx}', './routes/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          500: '#3b82f6',
          900: '#1e3a5f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '128': '32rem',
      },
    },
  },
}
```

Use custom values in your components:

```tsx
<div className="bg-brand-500 text-white font-sans p-128">
  Branded content
</div>
```

## Plugin Options

The `tailwindPlugin` accepts configuration options:

```ts
tailwindPlugin({
  configPath: './tailwind.config.js',  // Path to Tailwind config (default: auto-detect)
  cssPath: './src/styles/global.css',  // Path to CSS entry (default: auto-detect)
})
```

## With PostCSS Plugins

If you need additional PostCSS plugins (autoprefixer, etc.), create a `postcss.config.js`:

```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## API Reference

See the [@ereo/plugin-tailwind API reference](/api/plugins/tailwind) for the full plugin options.
