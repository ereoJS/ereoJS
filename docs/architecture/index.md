# Architecture & Design

This section explains the design decisions behind EreoJS and how its internal systems work together. While the [Core Concepts](/concepts/) section teaches you how to use the framework, the architecture section explains why it was built this way. Read this if you want to understand the trade-offs, contribute to the framework, or build custom adapters and plugins.

## Design Philosophy

EreoJS is guided by four principles that inform every API decision in the framework.

### Web Standards First

EreoJS builds on the Web Platform rather than abstracting it away. Every loader receives a standard `Request` object and returns data that becomes a standard `Response`. Forms submit as `FormData`. Query strings are parsed with `URLSearchParams`. Headers are manipulated with the `Headers` API.

This means two things for you as a developer. First, anything you learn while building with EreoJS transfers directly to other tools, platforms, and even raw HTTP handlers. Second, the framework gets faster and more capable for free as Bun and browser engines improve their implementations of these standards. EreoJS does not maintain a parallel universe of custom request/response types — it uses the ones the platform already provides.

### Explicit Over Magic

Many frameworks optimize for the "hello world" demo by hiding complexity behind conventions. EreoJS takes the opposite approach: every behavior that affects your application is visible in your code.

Caching is opt-in. You add `cache` configuration to the routes that need it, with explicit `maxAge`, `tags`, and invalidation. Hydration is explicit. Only components marked with `'use client'` ship JavaScript to the browser — the rest is static HTML. Data loading is visible. Loaders are functions you write, not hidden fetches triggered by naming conventions. This explicitness means more keystrokes upfront but far fewer surprises in production.

### Progressive Enhancement

EreoJS applications work without JavaScript, then enhance with it. Server-rendered HTML is the foundation. Forms submit via standard HTTP POST without any client-side code. When JavaScript loads, EreoJS enhances navigation to client-side transitions, enables optimistic UI updates, and hydrates interactive islands.

This is not just an accessibility concern — it is a performance strategy. Users see content immediately via streamed HTML. Interactive features layer on top without blocking the initial render. If JavaScript fails to load (flaky networks, aggressive ad blockers, older devices), the application still functions.

### Performance by Default

EreoJS makes the fast path the default path. The islands architecture means most of your page ships zero JavaScript. Streaming SSR sends HTML to the browser as it is generated, rather than waiting for all data to resolve. The Bun runtime handles HTTP requests, file I/O, and bundling significantly faster than Node.js-based alternatives.

You do not need to configure code splitting, tree shaking, or lazy loading for the common cases — the framework handles them. Route-based code splitting is automatic. Islands are lazy-hydrated by default. Static assets are hashed and cached. When you do need fine-grained control, the configuration is there, but the defaults are already optimized.

## Architecture Overview

When a request hits your EreoJS application, it flows through a well-defined pipeline:

```
Browser Request
      │
      ▼
┌─────────────┐
│  Bun Server  │  HTTP handling, static assets, WebSocket upgrade
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Router     │  File-based route matching, param extraction
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Middleware  │  Auth, logging, rate limiting, CORS (composable chain)
└──────┬──────┘
       │
       ├──── GET request ────►  Loader  ──► React Render ──► HTML Stream
       │
       └──── POST/PUT/DELETE ► Action  ──► Revalidate ──► Redirect or Re-render
                                                │
                                                ▼
                                          Browser receives
                                          streamed HTML or
                                          JSON response
```

For GET requests, the loader fetches data, the component tree renders with that data, and HTML streams to the browser. For mutations (POST, PUT, DELETE), the action processes the submission, relevant loaders revalidate their data, and the browser receives either a redirect or a re-rendered page.

Cache layers can intercept at multiple points: the edge cache can serve a full response without hitting the server, the data cache can skip database queries for loaders with valid cache entries, and the browser cache can avoid network requests entirely for static assets.

## Package Architecture

EreoJS is organized as a monorepo of focused packages. Each package has a single responsibility and can be used independently where it makes sense.

| Package | Role |
|---------|------|
| **@ereo/core** | App foundation — `createApp`, `defineConfig`, plugin system, tag-based cache primitives, shared types |
| **@ereo/router** | File-based route matching, dynamic params, layouts, route groups, catch-all routes, route config |
| **@ereo/client** | React integration — `Form`, `Link`, `NavLink`, `useLoaderData`, `useActionData`, `useNavigation`, island hydration |
| **@ereo/data** | Data layer — `createLoader`, `createAction`, `ActionResult`, `parseRequestBody`, revalidation |
| **@ereo/server** | Bun HTTP server, static file serving, streaming SSR, WebSocket support, adapter interface |
| **@ereo/state** | Signals-based state management — `signal`, `computed`, `batch`, `atom`, React hooks (`useSignal`) |
| **@ereo/forms** | Advanced form management — per-field signals, validation engine, field arrays, wizards, Standard Schema support |
| **@ereo/rpc** | Type-safe remote procedure calls — compiler plugin generates client stubs from server functions |
| **@ereo/cli** | Development tooling — `ereo dev`, `ereo build`, `ereo start`, project scaffolding |

The dependency graph flows downward: `@ereo/cli` depends on `@ereo/server`, which depends on `@ereo/router` and `@ereo/data`, which depend on `@ereo/core`. The `@ereo/client` package depends on `@ereo/core` and `@ereo/state`. The `@ereo/forms` package depends on `@ereo/state` and can be used standalone outside of EreoJS.

## Deep Dives

Detailed explorations of specific subsystems:

- **[Why Bun?](/architecture/why-bun)** — The rationale for choosing Bun as the runtime, benchmarks against Node.js, trade-offs around ecosystem compatibility, and what Bun enables that Node.js cannot (native TypeScript execution, fast bundling, built-in SQLite).

- **[Caching Deep Dive](/architecture/caching-deep-dive)** — How tag-based invalidation works internally, the three cache layers (edge, data, browser), cache key computation, stale-while-revalidate semantics, and strategies for cache warming and purging.

- **[Streaming Deep Dive](/architecture/streaming-deep-dive)** — How streaming SSR works with React Suspense, the HTML chunking protocol, out-of-order streaming, how islands hydrate after their HTML arrives, and fallback rendering for non-streaming clients.

- **[Performance](/architecture/performance)** — Bundle analysis, route-based code splitting internals, lazy hydration strategies, image optimization pipeline, and production performance tuning.

- **[Custom Adapters](/architecture/custom-adapters)** — The adapter interface for deploying EreoJS to platforms beyond Bun. How to implement request/response translation, static asset serving, and streaming for targets like Cloudflare Workers or AWS Lambda.

- **[Security](/architecture/security)** — The security model covering CSRF protection (automatic double-submit cookies), Content Security Policy headers, input sanitization in actions, and secure session management.

## Framework Comparisons

See how EreoJS compares to other frameworks in philosophy and feature set:

- **[vs Next.js](/architecture/comparisons/vs-nextjs)** — App Router vs. file-based routing, Server Components vs. islands, `getServerSideProps` vs. loaders, and Server Actions vs. actions. Covers the different approaches to caching, data fetching, and client-side interactivity.

- **[vs Remix](/architecture/comparisons/vs-remix)** — The most similar framework. Shared concepts (loaders, actions, Form, error boundaries) and key differences (Bun runtime, islands vs. full hydration, tag-based caching, signals state management).

- **[vs Astro](/architecture/comparisons/vs-astro)** — Both use islands architecture for partial hydration. Differences in server-side data loading, form handling, routing conventions, and the React-first vs. framework-agnostic approach.
