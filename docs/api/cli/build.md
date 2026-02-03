# build

Builds the application for production.

## Usage

```bash
bun ereo build [options]
```

Or via package.json:

```json
{
  "scripts": {
    "build": "ereo build"
  }
}
```

```bash
bun run build
```

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--outDir` | `-o` | Output directory | `dist` |
| `--minify` | `-m` | Minify output | `true` |
| `--sourcemap` | `-s` | Generate source maps | `false` |

## Examples

### Basic Build

```bash
# Build with defaults
bun ereo build

# Custom output directory
bun ereo build --outDir build

# Include source maps
bun ereo build --sourcemap

# Disable minification (for debugging)
bun ereo build --minify false
```

## Output Structure

```
dist/
├── server/
│   └── index.js         # Server bundle
├── client/
│   ├── index.js         # Client entry
│   ├── islands/         # Island bundles
│   │   ├── Counter.js
│   │   └── SearchBox.js
│   └── chunks/          # Shared chunks
│       ├── react.js
│       └── vendor.js
└── static/
    ├── styles.css       # Compiled CSS
    └── public/          # Static assets
```

## Build Process

1. **Type checking** - Validates TypeScript
2. **Route discovery** - Finds all routes
3. **Server bundle** - Compiles server code
4. **Client bundle** - Compiles client code
5. **Island extraction** - Creates island bundles
6. **Asset processing** - Optimizes static assets
7. **Manifest generation** - Creates asset manifest

## Configuration

Configure build in `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  build: {
    // Deployment target
    target: 'bun', // 'bun' | 'node' | 'cloudflare' | 'deno'

    // Output directory
    outDir: 'dist',

    // Minification
    minify: true,

    // Source maps
    sourcemap: false, // true | false | 'inline' | 'external'

    // Code splitting
    splitting: true,

    // External packages (not bundled)
    external: ['sharp', 'sqlite3']
  }
})
```

## Environment Variables

Build-time environment:

```bash
# Production build
NODE_ENV=production bun ereo build

# Custom environment
NODE_ENV=staging bun ereo build
```

Environment files loaded:

1. `.env`
2. `.env.local`
3. `.env.production`
4. `.env.production.local`

## Static Generation

For SSG routes, pages are pre-rendered:

```ts
// routes/posts/[slug].tsx
export const config = {
  render: 'ssg'
}

export async function getStaticPaths() {
  const posts = await db.posts.findMany()
  return posts.map(post => ({
    params: { slug: post.slug }
  }))
}
```

Build output includes static HTML:

```
dist/
└── static/
    └── posts/
        ├── hello-world.html
        ├── getting-started.html
        └── advanced-guide.html
```

## Programmatic Usage

```ts
import { build } from '@ereo/cli'

await build({
  outDir: 'dist',
  minify: true,
  sourcemap: false
})
```

## Build Analysis

### Bundle Size

After build, check bundle sizes:

```bash
ls -lh dist/client/
```

### Visualization

Generate bundle analysis:

```bash
bun ereo build --analyze
```

Opens interactive bundle visualization in browser.

## Optimization Tips

### Code Splitting

Ereo automatically splits:

- Each route into separate chunks
- Each island into separate bundles
- Shared dependencies into common chunks

### Tree Shaking

Unused exports are removed. Ensure:

- Use ES modules (`import`/`export`)
- Avoid side effects in modules
- Mark packages as side-effect-free in `package.json`

### External Dependencies

For server-only packages:

```ts
// ereo.config.ts
export default defineConfig({
  build: {
    external: ['sharp', 'bcrypt', 'sqlite3']
  }
})
```

## Troubleshooting

### Build Errors

```bash
# Verbose output
DEBUG=ereo:* bun ereo build

# Skip type checking
bun ereo build --skipTypeCheck
```

### Large Bundle Size

1. Check for unnecessary dependencies
2. Use dynamic imports for large modules
3. Analyze bundle with `--analyze`

### Memory Issues

For large projects:

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=8192" bun ereo build
```

## Related

- [dev](/api/cli/dev)
- [start](/api/cli/start)
- [Deployment](/deployment/bun)
