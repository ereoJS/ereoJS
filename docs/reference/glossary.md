# Glossary

Definitions of terms and concepts used throughout the EreoJS documentation.

## A

### Action

A server-side function that handles form submissions and mutations (POST, PUT, DELETE requests). Actions run on the server and can return data to the client. Defined with `createAction` from `@ereo/data` or as a plain `action` function export on a route file. See [Data Loading](/concepts/data-loading).

### ActionResult

The standard response format for actions: `{ success: boolean, data?: T, errors?: Record<string, string[]> }`. Used by `@ereo/forms` to map server errors back to form fields automatically.

## C

### Cache Tag

A string label attached to cached data that enables targeted invalidation. When you call `revalidateTag('posts')`, all cached data tagged with `'posts'` is invalidated. See [Caching](/concepts/caching).

### Catch-All Route

A route file using `[...slug].tsx` syntax that captures all remaining URL segments. The `slug` parameter is an array of strings. See [Routing](/concepts/routing).

### Component Island

See [Island](#island).

## D

### Deferred Data

Data returned from a loader wrapped with `defer()` that streams to the client after the initial HTML is sent. Used with `<Suspense>` and `<Await>` to avoid blocking the page on slow data fetches. See [Data Loading](/concepts/data-loading).

### Dynamic Route

A route file using `[param].tsx` syntax where `param` is replaced by the actual URL segment at runtime. For example, `routes/posts/[id].tsx` matches `/posts/123` with `params.id = '123'`. See [Routing](/concepts/routing).

## E

### Error Boundary

A component that catches errors from its child routes and renders a fallback UI. Defined as `_error.tsx` in a route directory or as an `ErrorBoundary` export from a route file. See [Error Handling](/guides/error-handling).

## H

### Hydration

The process where React attaches event listeners and interactivity to server-rendered HTML on the client. In EreoJS, only island components are hydrated, keeping the JavaScript payload small.

## I

### Island

A component that is hydrated on the client while the rest of the page remains static HTML. Islands are created by using the `.island.tsx` file extension or the `'use client'` directive. See [Islands](/concepts/islands).

## L

### Layout

A `_layout.tsx` file that wraps all routes in its directory and subdirectories with shared UI (navigation, sidebars, etc.). Layouts can have their own loaders and nest within each other. See [Routing](/concepts/routing).

### Loader

A server-side function that fetches data before a route component renders. Loaders receive the request, URL parameters, and app context. Defined with `createLoader` from `@ereo/data` or as a plain `loader` function export. See [Data Loading](/concepts/data-loading).

## M

### Middleware

A function that runs before route handlers to perform tasks like authentication, logging, or request modification. Defined as `_middleware.ts` files in route directories or registered via plugins. See [Middleware](/concepts/middleware).

## P

### Progressive Enhancement

A design approach where features work without client-side JavaScript and are enhanced when JavaScript is available. EreoJS forms submit via standard HTML form submission by default and add client-side behavior when JavaScript loads.

## R

### Rendering Mode

The strategy used to generate HTML for a route. EreoJS supports multiple modes configured per-route:

| Mode | Description |
|------|-------------|
| `ssr` | Server-Side Rendering --- HTML generated on each request |
| `ssg` | Static Site Generation --- HTML generated at build time |
| `csr` | Client-Side Rendering --- Minimal HTML, rendered in the browser |

See [Rendering Modes](/concepts/rendering-modes).

### Revalidation

The process of refreshing cached data. Triggered by `revalidatePath('/path')`, `revalidateTag('tag')`, or automatically after actions. See [Caching](/concepts/caching).

### Route Group

A directory wrapped in parentheses `(groupName)/` that organizes routes without affecting the URL path. Used to apply different layouts to different sections. See [Routing](/concepts/routing).

## S

### Signal

A reactive primitive from `@ereo/state` that holds a value and notifies subscribers when it changes. The core building block for EreoJS state management. API: `signal(value)`, `.get()`, `.set()`, `.subscribe()`. See [State Management](/concepts/state-management).

### SSG (Static Site Generation)

Rendering strategy where HTML is generated at build time. Pages are served as static files with no server computation per request. See [Rendering Modes](/concepts/rendering-modes).

### SSR (Server-Side Rendering)

Rendering strategy where HTML is generated on the server for each request. Provides fresh data and SEO benefits. See [Rendering Modes](/concepts/rendering-modes).

### Streaming SSR

An SSR technique where HTML is sent to the browser in chunks as it becomes available, rather than waiting for the entire page to render. EreoJS uses React Suspense boundaries to define streaming points. See [Streaming Deep Dive](/architecture/streaming-deep-dive).

### Suspense Boundary

A React `<Suspense>` component that shows a fallback UI while its children are loading. Used with deferred data and streaming SSR to progressively reveal content.
