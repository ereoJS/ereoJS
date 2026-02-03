# React Fullstack Framework Architecture Plan

A new React-based fullstack web framework built on Bun that prioritizes simplicity, performance, and developer experience.

> **Note**: Framework name TBD (placeholder: `bun-framework` or `@framework/*`)

## Design Decisions

- **Runtime**: Bun-first with adapters for Cloudflare/Node/Deno
- **Architecture**: Modular monorepo - separate packages, user picks what they need
- **Styling**: Tailwind CSS as default (zero-config integration)

## Key Differentiators from Next.js/Remix

| Feature | Next.js | Remix | This Framework |
|---------|---------|-------|----------------|
| Data Fetching | 4+ confusing patterns | loader/action | **Single `loader` pattern** |
| Hydration | Full app | Full app | **Islands (selective)** |
| Runtime | Node.js | Node.js | **Bun-first (5-6x faster)** |
| Caching | Hidden ISR magic | Manual | **Explicit, tagged** |
| Type Safety | Partial | Partial | **End-to-end** |
| HMR Speed | ~200-400ms | ~100ms | **Sub-100ms target** |
| Config | Complex | Moderate | **Zero-config default** |

---

## Project Structure (Modular Monorepo)

```
packages/
├── core/                        # @framework/core - Main framework
│   ├── src/
│   │   ├── app.ts               # Application container
│   │   ├── context.ts           # Request context (Web Standards)
│   │   ├── plugin.ts            # Plugin system interface
│   │   └── types.ts             # Core type definitions
│   └── package.json
│
├── router/                      # @framework/router - File-based routing
│   ├── src/
│   │   ├── file-router.ts       # Route discovery
│   │   ├── route-tree.ts        # Route tree structure
│   │   ├── matcher.ts           # URL pattern matching
│   │   └── types.ts             # Route types
│   └── package.json
│
├── server/                      # @framework/server - Bun HTTP server
│   ├── src/
│   │   ├── bun-server.ts        # Bun.serve() wrapper
│   │   ├── middleware.ts        # Middleware chain
│   │   ├── streaming.ts         # React streaming
│   │   └── static.ts            # Static file serving
│   └── package.json
│
├── client/                      # @framework/client - Client runtime
│   ├── src/
│   │   ├── islands.ts           # Island hydration logic
│   │   ├── hydration.ts         # Hydration directives
│   │   ├── navigation.ts        # Client-side navigation
│   │   └── prefetch.ts          # Link prefetching
│   └── package.json
│
├── data/                        # @framework/data - Data layer
│   ├── src/
│   │   ├── loader.ts            # Unified data fetching
│   │   ├── action.ts            # Mutations
│   │   ├── cache.ts             # Explicit caching
│   │   └── revalidate.ts        # Cache invalidation
│   └── package.json
│
├── bundler/                     # @framework/bundler - Build system
│   ├── src/
│   │   ├── dev/                 # HMR, error overlay
│   │   ├── prod/                # Production builds
│   │   └── plugins/             # Route types, island extraction
│   └── package.json
│
├── cli/                         # @framework/cli - CLI commands
│   ├── src/
│   │   └── commands/            # create, dev, build, start
│   └── package.json
│
├── create-app/                  # create-[framework] - Scaffolding
│   ├── templates/
│   │   ├── minimal/
│   │   ├── default/
│   │   └── tailwind/            # Default with Tailwind
│   └── package.json
│
├── runtime-bun/                 # @framework/runtime-bun (default)
├── runtime-cloudflare/          # @framework/runtime-cloudflare
├── runtime-node/                # @framework/runtime-node
│
├── plugin-tailwind/             # @framework/plugin-tailwind
├── plugin-auth/                 # @framework/plugin-auth (optional)
├── plugin-db/                   # @framework/plugin-db (optional)
│
├── examples/
│   ├── minimal/
│   ├── blog/
│   └── dashboard/
│
└── docs/
```

---

## Implementation Phases

### Phase 1: Core Foundation
**Package:** `packages/core/`
**Files to create:**
- `packages/core/src/app.ts` - Application container
- `packages/core/src/context.ts` - Request context (Web Standards)
- `packages/core/src/plugin.ts` - Plugin system interface
- `packages/core/src/types.ts` - Core type definitions
- `packages/core/package.json` - Package configuration

### Phase 2: Routing System
**Package:** `packages/router/`
**Files to create:**
- `packages/router/src/file-router.ts` - File-based route discovery
- `packages/router/src/route-tree.ts` - Route tree structure
- `packages/router/src/matcher.ts` - URL pattern matching
- `packages/router/src/types.ts` - Route type definitions
- `packages/router/package.json`

**Routing conventions:**
```
app/routes/
├── _layout.tsx           # Root layout
├── index.tsx             # /
├── about.tsx             # /about
├── blog/
│   ├── _layout.tsx       # Nested layout
│   ├── index.tsx         # /blog
│   ├── [slug].tsx        # /blog/:slug
│   └── [...catchAll].tsx # /blog/*
└── (marketing)/          # Route group (no URL segment)
    └── pricing.tsx       # /pricing
```

### Phase 3: Data Layer (Single Mental Model)
**Package:** `packages/data/`
**Files to create:**
- `packages/data/src/loader.ts` - Unified data fetching
- `packages/data/src/action.ts` - Mutations
- `packages/data/src/cache.ts` - Explicit caching with tags
- `packages/data/src/revalidate.ts` - Cache invalidation
- `packages/data/package.json`

**Key API - One pattern, not four:**
```typescript
// Every route has ONE loader (server-only)
export const loader = async ({ params, request, context }: LoaderArgs) => {
  const post = await db.post.findUnique({ where: { slug: params.slug } });

  // Explicit caching - you see what's happening
  context.cache.set({
    maxAge: 60,
    staleWhileRevalidate: 300,
    tags: [`post:${params.slug}`],
  });

  return { post };
};

// Mutations via actions
export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  return { success: true };
};
```

### Phase 4: Server Runtime
**Package:** `packages/server/`
**Files to create:**
- `packages/server/src/bun-server.ts` - Bun HTTP server
- `packages/server/src/middleware.ts` - Middleware chain (Hono-inspired)
- `packages/server/src/streaming.ts` - React streaming support
- `packages/server/src/static.ts` - Static file serving
- `packages/server/package.json`

**Leverages Bun's performance:**
```typescript
Bun.serve({
  port: 3000,
  async fetch(request: Request): Promise<Response> {
    // Web Standards Request/Response
    // 5-6x faster than Node.js
  },
});
```

### Phase 5: Islands Architecture (Selective Hydration)
**Package:** `packages/client/`
**Files to create:**
- `packages/client/src/islands.ts` - Island hydration logic
- `packages/client/src/hydration.ts` - Hydration directives
- `packages/client/src/navigation.ts` - Client-side navigation
- `packages/client/src/prefetch.ts` - Link prefetching
- `packages/client/package.json`

**Hydration directives (inspired by Astro):**
```tsx
export default function Page({ data }) {
  return (
    <div>
      <Header />                           {/* Static - no JS */}
      <SearchBar client:load />            {/* Hydrate immediately */}
      <Comments client:visible />          {/* Hydrate when visible */}
      <Chart client:idle />                {/* Hydrate when idle */}
      <MobileMenu client:media="(max-width: 768px)" />
      <Footer />                           {/* Static - no JS */}
    </div>
  );
}
```

### Phase 6: Build System
**Package:** `packages/bundler/`
**Files to create:**
- `packages/bundler/src/dev/hmr.ts` - Hot module replacement
- `packages/bundler/src/dev/error-overlay.ts` - Dev error display
- `packages/bundler/src/prod/build.ts` - Production builds
- `packages/bundler/src/plugins/types.ts` - Type generation
- `packages/bundler/src/plugins/islands.ts` - Island extraction
- `packages/bundler/src/plugins/tailwind.ts` - Tailwind integration
- `packages/bundler/package.json`

### Phase 7: CLI
**Package:** `packages/cli/`
**Files to create:**
- `packages/cli/src/commands/create.ts` - Project scaffolding
- `packages/cli/src/commands/dev.ts` - Dev server
- `packages/cli/src/commands/build.ts` - Production build
- `packages/cli/src/commands/start.ts` - Production server
- `packages/cli/src/index.ts` - CLI entry point
- `packages/cli/package.json`

**CLI commands:**
```bash
bunx create-[framework] my-app   # Create new project
bun run dev                       # Start dev server
bun run build                     # Build for production
bun run start                     # Start production server
```

### Phase 8: Tailwind Plugin
**Package:** `packages/plugin-tailwind/`
**Files to create:**
- `packages/plugin-tailwind/src/index.ts` - Plugin entry
- `packages/plugin-tailwind/src/preset.ts` - Framework-specific Tailwind preset
- `packages/plugin-tailwind/package.json`

**Zero-config Tailwind integration:**
```typescript
// Automatically detected and configured
// No tailwind.config.js needed for basic usage
// Content paths auto-detected from routes
```

### Phase 9: Type Safety System
**Files to create:**
- `packages/bundler/src/plugins/types.ts` - Route type generation
- `packages/core/src/inference.ts` - Loader/action inference

**End-to-end type safety:**
```typescript
// Auto-generated types
declare module 'ereo/routes' {
  export interface Routes {
    '/blog/[slug]': {
      params: { slug: string };
      loader: { post: Post };
    };
  }
}

// Type-safe links (compile-time error if wrong)
<Link to="/blog/[slug]" params={{ slug: 'hello' }}>Read</Link>

// Type-safe data access
const { post } = useLoaderData<'/blog/[slug]'>(); // post is typed
```

---

## Configuration (Zero-Config Default)

```typescript
// framework.config.ts (optional - everything has sensible defaults)
import { defineConfig } from '@framework/core';
import tailwind from '@framework/plugin-tailwind';

export default defineConfig({
  server: { port: 3000 },
  build: { target: 'bun' }, // 'bun' | 'cloudflare' | 'node'
  plugins: [
    tailwind(), // Included by default in templates
  ],
});
```

**Default Template includes:**
- Tailwind CSS pre-configured
- TypeScript enabled
- Bun runtime
- Islands architecture enabled

---

## Security Considerations

- Strict serialization for RSC (address CVE-2025-55182)
- Server/client boundary type enforcement
- Built-in security headers middleware
- No unsafe deserialization

---

## Verification Plan

1. **Unit Tests**: Each package has tests via Bun's test runner
   ```bash
   bun test packages/ereo
   bun test packages/ereo-cli
   bun test packages/ereo-bundler
   ```

2. **Integration Test**: Create example app and verify:
   - Routing works (static, dynamic, catch-all)
   - Loaders fetch data correctly
   - Islands hydrate selectively
   - HMR updates in < 100ms
   - Production build succeeds

3. **Performance Benchmarks**:
   - HTTP requests/sec vs Express/Fastify
   - HMR latency measurement
   - Build time comparison

---

## Implementation Order

1. **packages/core/** - App container, context, plugin system
2. **packages/router/** - File-based routing
3. **packages/data/** - Loader/action/cache
4. **packages/server/** - Bun HTTP server
5. **packages/client/** - Islands hydration
6. **packages/bundler/** - Build system with Tailwind support
7. **packages/cli/** - CLI commands
8. **packages/plugin-tailwind/** - Tailwind CSS integration
9. **packages/runtime-bun/** - Bun runtime adapter
10. **packages/create-app/** - Project templates (with Tailwind default)
11. **packages/examples/** - Example applications
12. **docs/** - Documentation

## Monorepo Setup

```bash
# Root package.json with workspaces
{
  "name": "framework-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "bun run --filter @framework/cli dev",
    "build": "bun run --filter '*' build",
    "test": "bun test"
  }
}
```
