# Practical Guides

These guides are task-focused how-to's for building real features with EreoJS. Unlike the [Core Concepts](/concepts/) section (which explains how things work and why), guides walk you through specific tasks step by step. Each guide assumes you have a working EreoJS project and basic familiarity with the framework. If you are new to EreoJS, start with the [Getting Started](/getting-started/) tutorial first.

## Prerequisites

Before diving into these guides, make sure you have:

- A working EreoJS project (run `bun create ereo my-app` if you need one)
- Bun installed (v1.0 or later)
- Basic familiarity with React and TypeScript

Each guide includes complete, runnable code examples. You can follow along in your own project or use the [examples repository](/examples/) as a starting point.

## Data & APIs

Build data layers, APIs, and real-time features for your application.

- **[Database Integration](/guides/database)** — Connect to PostgreSQL, SQLite, or SurrealDB using Drizzle ORM. Covers connection setup, schema definitions, migrations, and query patterns inside loaders and actions.

- **[API Routes](/guides/api-routes)** — Build REST APIs using file-based routing. Covers HTTP method exports (`GET`, `POST`, `PUT`, `DELETE`), request parsing, response formatting, CORS configuration, and versioning strategies.

- **[RPC](/guides/rpc)** — Call server functions directly from the client with full type safety using `@ereo/rpc`. No manual fetch calls or API routes needed — the compiler generates the bridge for you.

- **[Server Functions](/guides/server-functions)** — Create server functions with declarative rate limiting, authentication, CORS, and caching using `server$` and `createServerBlock`. Group related operations with shared config and per-function overrides.

- **[Real-Time](/guides/real-time)** — Implement live updates with WebSocket connections and Server-Sent Events (SSE). Covers pub/sub patterns, presence indicators, live dashboards, and reconnection handling.

- **[File Uploads](/guides/file-uploads)** — Handle single and multi-file uploads with streaming. Covers multipart form data, progress tracking, file validation, cloud storage integration (S3, R2), and image processing.

## Auth & Security

Protect your application and manage user identity.

- **[Authentication](/guides/authentication)** — Implement session-based authentication from scratch, integrate OAuth providers (GitHub, Google, Discord), protect routes with middleware, manage user sessions with cookies, and handle role-based access control. Covers both server-rendered auth flows and client-side auth state.

## UI & Forms

Build user interfaces, handle form submissions, and optimize the user experience.

- **[Forms (Basic)](/guides/forms-basic)** — Handle form submissions with the built-in `Form` component from `@ereo/client`. Covers progressive enhancement (forms work without JavaScript), action functions for processing submissions, validation with `ActionResult`, displaying field errors, and optimistic UI updates.

- **[Forms (Advanced)](/guides/forms-advanced)** — Build complex forms with `@ereo/forms` for client-side validation, field arrays (dynamic add/remove rows), multi-step wizards, dependent field validation, async validators (e.g. checking username availability), and schema integration with Zod or Standard Schema.

- **[Styling](/guides/styling)** — Configure CSS tooling for your EreoJS project. Covers Tailwind CSS (zero-config plugin), CSS Modules (scoped class names), vanilla-extract (type-safe CSS-in-TypeScript), and global stylesheets. Includes tips for co-locating styles with components and optimizing CSS for production.

- **[SEO](/guides/seo)** — Optimize your application for search engines. Covers the `meta` export for page titles and Open Graph tags, generating XML sitemaps, adding structured data (JSON-LD), managing canonical URLs, and configuring `robots.txt`.

- **[Internationalization](/guides/internationalization)** — Add multi-language support to your application. Covers locale detection from headers and URLs, translation file organization, server-side locale resolution in loaders, client-side language switching, and right-to-left (RTL) layout support.

## Development

Tooling, testing, and patterns for a productive development workflow.

- **[Error Handling](/guides/error-handling)** — Handle errors gracefully at every layer. Covers `_error.tsx` error boundaries, `useRouteError` for distinguishing HTTP errors from runtime exceptions, action error responses with `ActionResult`, global error logging, and displaying user-friendly error pages.

- **[Testing](/guides/testing)** — Write reliable tests for your EreoJS application. Covers unit testing loaders and actions, integration testing routes with the test client, testing island components with React Testing Library, mocking context and database calls, and end-to-end testing strategies.

- **[TypeScript](/guides/typescript)** — Get the most out of TypeScript in EreoJS. Covers typed loaders and actions with `LoaderFunction<T>`, typed route params with `RouteParamsFor`, generated route types with the types plugin, typed context values, and configuring `tsconfig.json` for path aliases.

- **[Environment Variables](/guides/environment-variables)** — Manage configuration across environments. Covers `.env` file loading, type-safe env access with validation, separating server-only vs. public variables, and configuring secrets for production deployments.

- **[Plugins](/guides/plugins)** — Extend EreoJS with the plugin system. Covers using official plugins (Tailwind, Auth, Images), installing community plugins, and creating your own plugins with lifecycle hooks, middleware injection, and route generation.

## Not Sure Where to Start?

Pick the guide that matches what you are building:

::: tip Building a CRUD app?
Start with [Database Integration](/guides/database) to set up your data layer, then [Forms (Basic)](/guides/forms-basic) to handle create and edit flows. Add [Authentication](/guides/authentication) when you need to protect routes.
:::

::: tip Building an API?
Start with [API Routes](/guides/api-routes) for REST endpoints. If your API consumers are also EreoJS apps (or any TypeScript client), consider [RPC](/guides/rpc) for type-safe server calls with zero boilerplate. For quick server operations with built-in rate limiting and auth, try [Server Functions](/guides/server-functions).
:::

::: tip Building a content site?
Start with [SEO](/guides/seo) for meta tags and sitemaps, [Styling](/guides/styling) for your design system, and [Internationalization](/guides/internationalization) if you need multi-language support.
:::

::: tip Need real-time features?
The [Real-Time](/guides/real-time) guide covers WebSockets and SSE for live dashboards, chat, notifications, and collaborative editing.
:::

::: tip Adding a dashboard or admin panel?
Start with [Authentication](/guides/authentication) for login and protected routes, then [Database Integration](/guides/database) for data access. Use [Forms (Advanced)](/guides/forms-advanced) for complex admin forms with validation and field arrays.
:::

## Foundational Knowledge

These guides assume you understand EreoJS concepts like routing, loaders, actions, and islands. If anything is unfamiliar, read the [Core Concepts](/concepts/) section first — it explains the "why" behind the patterns used in these guides.

## Contributing a Guide

Have a pattern or integration that would help other developers? We welcome community-contributed guides. See the [Contributing Guide](/contributing/) for how to submit a new guide via pull request.
