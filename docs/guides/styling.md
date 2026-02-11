# Styling

This guide covers styling approaches in EreoJS.

## Tailwind CSS

The recommended approach for EreoJS applications.

### Using the Plugin (Recommended)

The easiest way to add Tailwind CSS is with `@ereo/plugin-tailwind`. This is what `create-ereo` uses by default:

```bash
bun add -D @ereo/plugin-tailwind tailwindcss
```

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import tailwind from '@ereo/plugin-tailwind'

export default defineConfig({
  plugins: [tailwind()],
})
```

The plugin handles PostCSS processing and serves `/__tailwind.css` automatically. No `postcss.config.js` needed.

### Manual Setup

If you prefer to configure Tailwind yourself without the plugin:

```bash
bun add tailwindcss postcss autoprefixer
bunx tailwindcss init -p
```

### Configuration

Create or customize `tailwind.config.js`:

```js
// tailwind.config.js
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        }
      }
    }
  },
  plugins: []
}
```

### Entry CSS

```css
/* app/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn {
    @apply px-4 py-2 bg-brand-600 text-white rounded-lg
           hover:bg-brand-700 transition-colors;
  }
}
```

### Usage

```tsx
export default function Button({ children }) {
  return (
    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
      {children}
    </button>
  )
}
```

## CSS Modules

Scoped CSS without runtime overhead.

### Setup

CSS Modules work out of the box with `.module.css` extension.

### Usage

```css
/* components/Button.module.css */
.button {
  padding: 0.5rem 1rem;
  background: #2563eb;
  color: white;
  border-radius: 0.5rem;
}

.button:hover {
  background: #1d4ed8;
}

.primary {
  background: #2563eb;
}

.secondary {
  background: #6b7280;
}
```

```tsx
// components/Button.tsx
import styles from './Button.module.css'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
}

export function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  )
}
```

## Global CSS

For base styles and CSS resets.

```css
/* public/global.css */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

body {
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}
```

```tsx
// routes/_layout.tsx
export default function Layout({ children }) {
  return (
    <html>
      <head>
        <link rel="stylesheet" href="/global.css" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## CSS-in-JS with vanilla-extract

Type-safe styling with zero runtime.

### Setup

```bash
bun add @vanilla-extract/css
```

### Usage

```ts
// components/Button.css.ts
import { style, styleVariants } from '@vanilla-extract/css'

export const button = style({
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.2s'
})

export const variants = styleVariants({
  primary: {
    backgroundColor: '#2563eb',
    color: 'white',
    ':hover': {
      backgroundColor: '#1d4ed8'
    }
  },
  secondary: {
    backgroundColor: '#6b7280',
    color: 'white',
    ':hover': {
      backgroundColor: '#4b5563'
    }
  }
})
```

```tsx
// components/Button.tsx
import { button, variants } from './Button.css'

export function Button({ variant = 'primary', children }) {
  return (
    <button className={`${button} ${variants[variant]}`}>
      {children}
    </button>
  )
}
```

## Component Patterns

### Utility-First Classes

```tsx
function Card({ children }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      {children}
    </div>
  )
}
```

### Conditional Classes

```tsx
function Button({ variant, disabled, children }) {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-colors'

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  }

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : ''

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses}`}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
```

### With clsx Utility

```bash
bun add clsx
```

```tsx
import clsx from 'clsx'

function Button({ variant, size, disabled, children }) {
  return (
    <button
      className={clsx(
        'rounded-lg font-medium transition-colors',
        {
          'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
          'bg-gray-200 text-gray-800 hover:bg-gray-300': variant === 'secondary',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
          'opacity-50 cursor-not-allowed': disabled
        }
      )}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
```

## Dark Mode

### With Tailwind

```js
// tailwind.config.js
export default {
  darkMode: 'class', // or 'media'
  // ...
}
```

```tsx
function ThemeToggle() {
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark')
  }

  return (
    <button onClick={toggleTheme}>
      Toggle Theme
    </button>
  )
}

function Card({ children }) {
  return (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      {children}
    </div>
  )
}
```

### Theme Island

```tsx
// islands/ThemeToggle.tsx
import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    setTheme(stored || preferred)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <button
      onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
```

## Responsive Design

```tsx
function Navigation() {
  return (
    <nav className="flex flex-col md:flex-row md:items-center gap-4">
      <a href="/" className="text-lg font-bold">Logo</a>
      <div className="hidden md:flex gap-4">
        <a href="/about">About</a>
        <a href="/blog">Blog</a>
      </div>
      <button className="md:hidden">Menu</button>
    </nav>
  )
}
```

## Animation

```css
/* With Tailwind */
@layer utilities {
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

```tsx
function Toast({ message }) {
  return (
    <div className="animate-fade-in fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg">
      {message}
    </div>
  )
}
```

## Best Practices

1. **Use utility-first** - Faster development, smaller bundles
2. **Extract components** - Don't repeat long class strings
3. **Use design tokens** - Consistent colors, spacing, typography
4. **Purge unused CSS** - Keep production bundles small
5. **Mobile-first** - Start with mobile, add breakpoints
6. **Avoid !important** - Use specificity correctly
7. **Test responsively** - Check all breakpoints
