# @ereo/router-conventions

File-based routing conventions for the EreoJS framework. Automatically configure routes based on filename patterns, enabling intuitive and powerful file-based routing.

## Installation

```bash
bun add @ereo/router-conventions
```

## Quick Start

```typescript
import { parseConvention, applyConventionConfig } from '@ereo/router-conventions';

// Parse a filename to extract convention info
const info = parseConvention('blog/[slug].ssg.tsx');
// => { basePath: 'blog/[slug]', renderMode: 'ssg', isApi: false, ... }

// Apply convention-based configuration to a route
const config = applyConventionConfig('blog/[slug].ssg.tsx');
// => { render: { mode: 'ssg', prerender: { enabled: true } }, ... }
```

## Convention Patterns

Use filename suffixes to configure route behavior:

| Pattern | Description |
|---------|-------------|
| `*.ssg.tsx` | Static Site Generation (pre-rendered at build time) |
| `*.server.tsx` | Server-side only (no client JavaScript) |
| `*.client.tsx` | Client-side rendering only |
| `*.api.tsx` | API endpoint (JSON response) |
| `*.rsc.tsx` | React Server Component |
| `_islands/*.tsx` | Auto-extracted island components |
| `_layout.tsx` | Nested layout wrapper |

## Examples

```
app/routes/
  index.tsx              # SSR (default)
  about.server.tsx       # Server-only, no hydration
  blog/
    index.tsx            # SSR blog list
    [slug].ssg.tsx       # Static blog posts
  api/
    posts.api.tsx        # JSON API endpoint
  _islands/
    Counter.tsx          # Auto-hydrated island
```

## API

### `parseConvention(filename)`

Parse a filename to extract convention information.

```typescript
const info = parseConvention('posts/[id].ssg.tsx');
// {
//   basePath: 'posts/[id]',
//   renderMode: 'ssg',
//   isApi: false,
//   isIsland: false,
//   isLayout: false,
//   filename: 'posts/[id].ssg.tsx',
//   extension: '.tsx'
// }
```

### `applyConventionConfig(routePath, explicitConfig?)`

Apply convention-based configuration, merging with explicit config.

### `hasConvention(filename)`

Check if a filename uses any convention pattern.

### `stripConvention(routePath)`

Remove convention suffix from a route path for URL generation.

## Key Features

- Automatic render mode detection from filenames
- Support for SSG, SSR, CSR, API, and RSC modes
- Island component detection
- Layout file recognition
- Seamless integration with EreoJS router

## Documentation

For full documentation, visit [https://ereo.dev/docs/router-conventions](https://ereo.dev/docs/router-conventions)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
