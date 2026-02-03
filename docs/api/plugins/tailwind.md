# Tailwind CSS Plugin

Official Tailwind CSS integration for EreoJS.

## Installation

```bash
bun add @ereo/tailwind tailwindcss
```

## Setup

### 1. Add Plugin

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import tailwind from '@ereo/tailwind'

export default defineConfig({
  plugins: [
    tailwind()
  ]
})
```

### 2. Create Tailwind Config

```bash
bunx tailwindcss init
```

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './src/routes/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/islands/**/*.{ts,tsx}'
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
tailwind({
  // Custom config path
  config: './tailwind.config.js',

  // Custom CSS entry
  css: './src/styles/global.css',

  // Enable JIT mode (default: true)
  jit: true,

  // Minify in production (default: true)
  minify: true
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

## Dark Mode

### Class-Based

```js
// tailwind.config.js
export default {
  darkMode: 'class',
  // ...
}
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

```js
// tailwind.config.js
export default {
  darkMode: 'media',
  // ...
}
```

## Custom Theme

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
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
    @apply btn bg-primary-500 text-white hover:bg-primary-600;
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
export default {
  plugins: [
    require('@tailwindcss/typography')
  ]
}
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
export default {
  plugins: [
    require('@tailwindcss/forms')
  ]
}
```

## Production Optimization

The plugin automatically:
- Purges unused CSS
- Minifies output
- Optimizes for production builds

Manual optimization:

```ts
tailwind({
  minify: process.env.NODE_ENV === 'production'
})
```

## Related

- [Styling Guide](/guides/styling)
- [Plugins](/api/core/plugins)
