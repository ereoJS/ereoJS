# Feature Overview

A comprehensive overview of everything EreoJS provides.

## Routing

| Feature | Description | Learn More |
|---------|-------------|------------|
| File-based routing | Files in `routes/` map to URLs automatically | [Routing](/concepts/routing) |
| Dynamic routes | `[param].tsx` for URL parameters | [Routing](/concepts/routing#dynamic-routes) |
| Catch-all routes | `[...slug].tsx` for wildcard matching | [Routing](/concepts/routing#catch-all-routes) |
| Optional segments | `[[param]].tsx` for optional URL parts | [Routing](/concepts/routing#optional-segments) |
| Route groups | `(group)/` for organization without URL impact | [Routing](/concepts/routing#route-groups) |
| Nested layouts | `_layout.tsx` files that nest automatically | [Routing](/concepts/routing#layouts) |
| Type-safe params | Generated types for route parameters | [Routing](/concepts/routing#type-safe-routes) |
| Route conventions | Complete file naming reference | [Route Conventions](/reference/route-conventions) |

## Data Loading

| Feature | Description | Learn More |
|---------|-------------|------------|
| Loaders | Server-side data fetching before render | [Data Loading](/concepts/data-loading) |
| Actions | Server-side mutation handling (forms, APIs) | [Data Loading](/concepts/data-loading#actions) |
| `defineRoute` builder | Full type inference across loader/action/meta | [Data Loading](/concepts/data-loading#approach-3-defineRoute-builder) |
| Deferred data | Stream non-critical data with `defer()` | [Data Loading](/concepts/data-loading#deferred-data) |
| Combined loaders | Parallel data fetching with `combineLoaders` | [Data Loading](/concepts/data-loading#combining-loaders) |
| Data pipelines | Dependency-aware parallel loading | [Data Loading](/concepts/data-loading#data-pipelines) |
| Client loaders | Browser-side data fetching after hydration | [Data Loading](/concepts/data-loading#client-loaders) |

## Rendering

| Feature | Description | Learn More |
|---------|-------------|------------|
| Server-Side Rendering (SSR) | HTML generated per request | [Rendering Modes](/concepts/rendering-modes) |
| Static Site Generation (SSG) | HTML generated at build time | [Rendering Modes](/concepts/rendering-modes) |
| Client-Side Rendering (CSR) | Browser-only rendering | [Rendering Modes](/concepts/rendering-modes) |
| Streaming SSR | Progressive HTML delivery with Suspense | [Streaming Deep Dive](/architecture/streaming-deep-dive) |
| Per-route configuration | Set rendering mode per route | [Rendering Modes](/concepts/rendering-modes) |

## Islands Architecture

| Feature | Description | Learn More |
|---------|-------------|------------|
| Selective hydration | Only interactive components ship JavaScript | [Islands](/concepts/islands) |
| `.island.tsx` convention | File-based island declaration | [Islands](/concepts/islands) |
| `'use client'` directive | Alternative island declaration | [Islands](/concepts/islands) |
| Hydration strategies | load, idle, visible, media, none | [Config Reference](/reference/config-reference#islands) |

## Caching

| Feature | Description | Learn More |
|---------|-------------|------------|
| Tag-based invalidation | Invalidate cache by semantic tags | [Caching](/concepts/caching) |
| Path-based invalidation | Invalidate cache by URL path | [Caching](/concepts/caching) |
| Edge caching | CDN-layer cache headers | [Caching Deep Dive](/architecture/caching-deep-dive) |
| Stale-while-revalidate | Serve stale data while refreshing | [Caching](/concepts/caching) |
| Webhook revalidation | External trigger for cache invalidation | [Data Loading](/concepts/data-loading#webhook-revalidation-handler) |
| Custom cache adapters | Memory, Redis, or bring your own | [Config Reference](/reference/config-reference#cache) |

## Forms

| Feature | Description | Learn More |
|---------|-------------|------------|
| `<Form>` component | Progressive enhancement for HTML forms | [Forms](/guides/forms-basic) |
| `@ereo/forms` library | Full-featured form management | [Forms](/guides/forms-basic) |
| 20+ validators | Built-in validation rules | [Forms](/guides/forms-basic#3-add-validation) |
| Schema validation | Zod, Valibot, Standard Schema support | [Forms](/guides/forms-basic#schema-validation) |
| Field arrays | Dynamic add/remove/reorder fields | [Forms](/guides/forms-basic#working-with-field-arrays) |
| Multi-step wizards | Per-step validation with persistence | [Forms](/guides/forms-basic#multi-step-wizards) |
| Server error mapping | Automatic server-to-field error binding | [Forms](/guides/forms-basic#server-integration) |

## State Management

| Feature | Description | Learn More |
|---------|-------------|------------|
| Signals | Reactive primitives for state | [State Management](/concepts/state-management) |
| Computed signals | Derived values that auto-update | [State Management](/concepts/state-management) |
| React integration | `useSignal` hook via `useSyncExternalStore` | [State Management](/concepts/state-management) |
| Batched updates | Group multiple signal updates | [State Management](/concepts/state-management) |

## Authentication

| Feature | Description | Learn More |
|---------|-------------|------------|
| Session management | Cookie and server-side sessions | [Auth Plugin](/ecosystem/plugins/auth) |
| OAuth providers | GitHub, Google, and more | [Auth Plugin](/ecosystem/plugins/auth#oauth-providers) |
| Route protection | Middleware-based auth guards | [Authentication Guide](/guides/authentication) |

## Testing

| Feature | Description | Learn More |
|---------|-------------|------------|
| Bun test runner | Built-in, fast test execution | [Testing Guide](/guides/testing) |
| Route testing | Test loaders, actions, and components | [Testing Guide](/guides/testing) |
| Fixture-based tests | Temporary route definitions for testing | [Testing Internals](/contributing/testing-internals) |

## Deployment

| Feature | Description | Learn More |
|---------|-------------|------------|
| Bun (self-hosted) | Direct Bun server deployment | [Bun Deployment](/ecosystem/deployment/bun) |
| Docker | Containerized deployment | [Docker](/ecosystem/deployment/docker) |
| Fly.io | Globally distributed hosting | [Fly.io](/ecosystem/deployment/fly-io) |
| Railway | Managed hosting with auto-deploy | [Railway](/ecosystem/deployment/railway) |
| Vercel | Edge deployment | [Vercel](/ecosystem/deployment/vercel) |
| Cloudflare | Workers/Pages deployment | [Cloudflare](/ecosystem/deployment/cloudflare) |

## CLI

| Feature | Description | Learn More |
|---------|-------------|------------|
| `ereo dev` | Development server with HMR | [CLI Reference](/reference/cli-reference#ereo-dev) |
| `ereo build` | Production build with multiple targets | [CLI Reference](/reference/cli-reference#ereo-build) |
| `ereo start` | Production server | [CLI Reference](/reference/cli-reference#ereo-start) |
| `ereo deploy` | Platform-specific deployment | [CLI Reference](/reference/cli-reference#ereo-deploy) |
| `ereo db` | Database migrations and management | [CLI Reference](/reference/cli-reference#ereo-db) |

## Plugins

| Feature | Description | Learn More |
|---------|-------------|------------|
| Tailwind CSS | Zero-config Tailwind integration | [Tailwind Plugin](/ecosystem/plugins/tailwind) |
| Auth | Authentication and session management | [Auth Plugin](/ecosystem/plugins/auth) |
| Images | Automatic image optimization | [Images Plugin](/ecosystem/plugins/images) |
| Plugin API | Build your own plugins | [Plugin Development](/contributing/plugin-development) |

## Developer Experience

| Feature | Description | Learn More |
|---------|-------------|------------|
| TypeScript-first | Native TS execution, full type safety | [TypeScript Guide](/guides/typescript) |
| Dev inspector | Route and island overlay in development | [Debugging](/troubleshooting/debugging) |
| Hot module replacement | Instant feedback during development | [Config Reference](/reference/config-reference#dev-options) |
| VS Code support | Extensions and configuration | [IDE Setup](/ecosystem/ide-setup) |
