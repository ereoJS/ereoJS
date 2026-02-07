# What's New

This page tracks notable changes, new features, and improvements across EreoJS releases.

## v0.1.24

The latest release consolidates the framework's core packages, adds the RPC layer, and brings significant improvements to forms, caching, and developer tooling.

### Core

- **`createApp`** — New application factory for configuring plugins, environment, and middleware in a single entry point.
- **`RequestContext`** — Typed request context that flows through middleware, loaders, and actions. Use `context.get()` and `context.set()` to share data across the request lifecycle.
- **Plugin system** — Register plugins via `createApp({ plugins: [...] })`. Plugins can hook into the build pipeline, add middleware, and extend configuration.
- **Environment handling** — Built-in environment variable loading with type-safe access. Supports `.env`, `.env.local`, and `.env.production` files.
- **Caching layer** — Tag-based and path-based cache invalidation with configurable adapters (memory, Redis, or custom). Supports `maxAge`, `staleWhileRevalidate`, and on-demand revalidation via webhooks.

### Router

- **File-based routing** — Routes are defined by file structure in `routes/`. Supports `index.tsx`, `[param].tsx`, `[[optional]].tsx`, `[...catchAll].tsx`, route groups `(group)/`, layouts `_layout.tsx`, and error boundaries `_error.tsx`.
- **Middleware** — `_middleware.ts` files run before route handlers. Middleware can modify context, redirect, or short-circuit the request.
- **Typed middleware** — Middleware can declare the shape of context it provides, and downstream loaders/actions receive those types automatically.
- **Validation** — Route-level search params and hash params validation via `defineRoute().searchParams(schema)`.

### Client

- **Hooks** — `useLoaderData`, `useActionData`, `useNavigation`, `useRouteError`, `useParams`, `useSearchParams`, and `useLocation` for accessing route state in components.
- **`<Link>` and `<TypedLink>`** — Client-side navigation with prefetch strategies (`none`, `intent`, `render`, `viewport`). `<TypedLink>` enforces valid route paths at the type level.
- **`<Form>`** — Progressive enhancement wrapper around `<form>`. Submits via fetch on the client, falls back to standard form submission without JavaScript.
- **Navigation API** — Programmatic navigation with `navigate()`, `goBack()`, `goForward()`. Supports `replace`, `state`, and `viewTransition` options.
- **Prefetching** — Preload route data and modules before navigation for instant transitions.
- **Islands** — `.island.tsx` files and `'use client'` directive mark components for selective hydration. Hydration strategies: `load`, `idle`, `visible`, `media`, `none`.
- **`ErrorBoundary`** — Export from route files to catch errors inline, or use `_error.tsx` for directory-level error handling.

### Data

- **`defineRoute` builder** — Chain `.loader()`, `.action()`, `.head()`, `.meta()`, `.cache()`, `.searchParams()` with full type inference across the entire chain.
- **Schema adapters** — `ereoSchema()` for Zod alignment with `z.coerce`, `schemaBuilder()` for schema creation without external dependencies, and Standard Schema V1 auto-detection.
- **Loaders** — `createLoader` with shorthand and options forms. Options include `cache`, `transform`, and `onError`.
- **Actions** — `createAction`, `typedAction`, `jsonAction`, and the simple `action()` wrapper. Built-in FormData parsing and validation support.
- **Data pipelines** — `createPipeline` with `dataSource`, `cachedSource`, `optionalSource` for dependency-aware parallel data loading with timing metrics.
- **Cache utilities** — `revalidateTag`, `revalidatePath`, `revalidate`, `onDemandRevalidate`, `createRevalidationHandler` for webhook-triggered invalidation.
- **Revalidation** — `shouldRevalidate` export on routes to control when loaders re-run after navigation.

### State

- **Signals** — `signal(initial)` creates reactive primitives with `.get()`, `.set()`, `.update()`, `.subscribe()`, and `.map()`.
- **Computed signals** — `computed(fn, deps)` for derived values that automatically recompute when dependencies change.
- **Stores** — `atom(initial)` for simple state atoms.
- **React integration** — `useSignal(sig)` hook backed by `useSyncExternalStore` for safe concurrent-mode rendering. `batch(fn)` to group multiple signal updates.

### Forms (`@ereo/forms`)

- **`useForm`** — Core form hook with per-field signal architecture, ES Proxy access (`form.values.user.email`), and derive-don't-configure validation.
- **`useField`** — Single field registration with validation, error handling, and touched/dirty tracking.
- **`useFieldArray`** — Dynamic field arrays with `append`, `prepend`, `remove`, `swap`, `move`, `insert`, and `replace` operations.
- **`useWatch`** — Reactive observation of field values without requiring field registration.
- **`useFormStatus`** — Read-only form state (isSubmitting, isValid, isDirty, errors) for use in child components.
- **Validation** — 20+ built-in validators, async validation with sync-gate-async pattern, cross-field dependencies via `dependsOn`, and `focusOnError` for auto-focusing the first invalid field on submit failure.
- **Schema adapters** — Zod, Valibot, and Standard Schema V1 support for form-level and field-level validation.
- **Components** — `<FormField>`, `<FieldError>`, `<FormErrors>` for declarative form rendering.
- **Multi-step wizards** — Per-step validation with data persistence across steps, back/forward navigation, and step completion tracking.
- **Server actions** — Integration with EreoJS actions for server-side form submission with automatic error mapping from `ActionResult` to field errors.
- **Accessibility** — ARIA attributes, error announcements, and keyboard navigation support built into form components.

### RPC

- **Procedures** — Define typed server functions with `createProcedure`. Supports input validation, middleware, and error handling.
- **Router** — `createRPCRouter` to group procedures into a namespace with shared middleware.
- **Client** — Type-safe RPC client generated from the router definition. Call server procedures like local functions.
- **Middleware** — RPC-specific middleware for authentication, rate limiting, and logging.
- **Hooks** — `useRPC` hook for calling procedures with loading/error states in React components.
- **Plugin** — `rpcPlugin()` registers the RPC handler as an API route automatically.

### Server

- **BunServer** — Production server with configurable host, port, TLS, and shutdown hooks.
- **Middleware** — Server-level middleware for compression, CORS, static files, and request logging.
- **Streaming** — HTML streaming via React's `renderToPipeableStream` with configurable flush strategies.

### CLI

- **`ereo dev`** — Development server with hot module replacement and fast refresh.
- **`ereo build`** — Production build with tree-shaking, code splitting, and multiple output targets.
- **`ereo start`** — Start the production server.
- **`bunx create-ereo@latest`** — Project scaffolding with template selection.
- **`ereo deploy`** — Platform-specific deployment commands for Vercel, Cloudflare, Fly.io, and Railway.
- **`ereo db`** — Database migration and seed commands (works with Drizzle and SurrealDB adapters).

### Database

- **Drizzle adapter** — Integrate Drizzle ORM for SQL databases with migration support via `ereo db`.
- **SurrealDB adapter** — SurrealDB integration for document/graph database workflows.

### Plugins

- **Tailwind CSS** — Zero-config Tailwind integration. Add `tailwindPlugin()` to your config and it handles PostCSS setup automatically.
- **Images** — Automatic image optimization with responsive sizes, format conversion (WebP, AVIF), and lazy loading. Use `<Image>` component or the `imagePlugin()`.
- **Auth** — Session management with cookie-based and server-side sessions. OAuth providers (GitHub, Google) and middleware-based route protection.

## Previous Releases

Earlier releases focused on foundational work: initial router implementation, SSR pipeline, bundler integration, and the core plugin architecture. Detailed changelogs for pre-0.1.24 versions will be added as the project approaches 1.0.

## Versioning Policy

EreoJS follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x.x) — Incompatible API changes. Migration guide provided.
- **MINOR** (0.x.0) — New features that are backwards compatible.
- **PATCH** (0.0.x) — Bug fixes and minor improvements, backwards compatible.

During the `0.x` phase (pre-1.0), minor versions may include breaking changes. These will always be documented in the release notes with upgrade instructions.

## How to Upgrade

To update EreoJS to the latest version:

```bash
bun update @ereo/core @ereo/router @ereo/client @ereo/data @ereo/server @ereo/state @ereo/cli @ereo/forms
```

If you are upgrading across multiple minor versions, check the [Version Upgrade Guide](/migration/version-upgrade) for any breaking changes and the recommended migration steps.

## Contributing

See the [contributing guide](https://github.com/ereo-framework/ereo/blob/main/CONTRIBUTING.md) for how to contribute to EreoJS. Bug reports, feature requests, and pull requests are welcome.
