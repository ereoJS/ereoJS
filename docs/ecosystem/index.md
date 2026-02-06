# Ecosystem & Integrations

The EreoJS ecosystem includes the core framework packages, official plugins, development tools, and deployment adapters. Everything is designed to work together out of the box while remaining modular enough to use independently. All packages are published under the `@ereo` scope on npm and follow semantic versioning.

## Official Packages

These are the core packages that make up the EreoJS framework. They are installed automatically when you create a new project with `bun create ereo`.

| Package | Description | Status |
|---------|-------------|--------|
| **@ereo/core** | App foundation — `createApp`, `defineConfig`, plugin system, tag-based cache primitives, shared types and interfaces | Stable |
| **@ereo/router** | File-based routing — route matching, dynamic params, layouts, route groups, catch-all routes, route configuration | Stable |
| **@ereo/client** | React integration — `Form`, `Link`, `NavLink`, `useLoaderData`, `useActionData`, `useNavigation`, island hydration runtime | Stable |
| **@ereo/data** | Data layer — `createLoader`, `createAction`, `ActionResult`, `parseRequestBody`, cache tags, revalidation | Stable |
| **@ereo/server** | Bun HTTP server — static file serving, streaming SSR, WebSocket upgrade, adapter interface for deployment targets | Stable |
| **@ereo/state** | Signals-based state management — `signal`, `computed`, `batch`, `atom`, React hooks (`useSignal`, `useComputed`) | Stable |
| **@ereo/forms** | Advanced form management — per-field validation, field arrays, multi-step wizards, async validators, Standard Schema V1 support | Stable |
| **@ereo/rpc** | Type-safe remote procedure calls — compiler plugin generates client stubs from server functions, automatic serialization | Beta |
| **@ereo/cli** | Development tooling — `ereo dev` (hot reload), `ereo build` (production bundle), `ereo start`, project scaffolding | Stable |

All packages are currently at version `0.1.24` and are published as ESM-only modules with full TypeScript declarations.

## Official Plugins

Plugins extend EreoJS with additional functionality. Install them as dependencies and register them in your `ereo.config.ts`.

- **[Tailwind CSS](/ecosystem/plugins/tailwind)** — Zero-config Tailwind setup with automatic content path scanning. Installs Tailwind, PostCSS, and configures content paths to cover your `routes/`, `components/`, and `islands/` directories. Supports Tailwind v3 and v4.

- **[Auth](/ecosystem/plugins/auth)** — Authentication plugin with built-in session management, cookie handling, and OAuth provider integration (GitHub, Google, Discord). Provides middleware for protected routes, session helpers for loaders and actions, and hooks for client-side auth state.

- **[Images](/ecosystem/plugins/images)** — Automatic image optimization at build time and on-demand. Generates responsive `srcset` attributes, converts to modern formats (WebP, AVIF), and serves optimized images through an edge-cached image endpoint. Drop-in `<Image>` component with lazy loading and blur-up placeholders.

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import tailwind from '@ereo/plugin-tailwind'
import auth from '@ereo/plugin-auth'

export default defineConfig({
  plugins: [
    tailwind(),
    auth({
      providers: ['github', 'google'],
      sessionSecret: process.env.SESSION_SECRET,
    }),
  ],
})
```

## Development Tools

Tools and configurations for a productive development workflow.

- **[IDE Setup](/ecosystem/ide-setup)** — Recommended configurations for VS Code (extensions, settings, debug launch configs) and IntelliJ/WebStorm (file type associations, run configurations). Includes ESLint and Prettier configs tuned for EreoJS projects, TypeScript path alias setup, and Tailwind IntelliSense configuration.

- **[CI/CD](/ecosystem/ci-cd)** — Ready-to-use pipeline configurations for GitHub Actions and GitLab CI. Covers installing Bun in CI environments, running tests, building for production, caching `node_modules` and `.ereo/cache`, and deploying to various platforms. Includes example workflows for preview deployments on pull requests.

## Deployment

Deploy EreoJS to any platform that supports Bun. Each guide covers the platform-specific configuration, build commands, environment variables, and production considerations.

- **[Deployment Overview](/ecosystem/deployment/)** — How to choose a deployment target based on your needs (cost, latency, scaling, managed vs. self-hosted). Covers the `ereo build` output structure and what the production server expects.

- **[Bun (Self-Hosted)](/ecosystem/deployment/bun)** — Run EreoJS directly with Bun on your own server. The simplest deployment option — `ereo build && ereo start` behind a reverse proxy (Nginx, Caddy). Covers process management with systemd, health checks, and graceful shutdown.

- **[Docker](/ecosystem/deployment/docker)** — Containerized deployment with an optimized multi-stage Dockerfile. Uses the official `oven/bun` base image. Covers layer caching for fast rebuilds, environment variable injection, and Docker Compose for local development with databases.

- **[Vercel](/ecosystem/deployment/vercel)** — Deploy to Vercel's edge network. Covers the Vercel adapter configuration, edge function limitations, static asset handling, and environment variable setup through the Vercel dashboard.

- **[Cloudflare](/ecosystem/deployment/cloudflare)** — Deploy to Cloudflare Workers or Pages. Covers the Cloudflare adapter, Workers runtime compatibility, KV and D1 database integration, and Wrangler configuration.

- **[Fly.io](/ecosystem/deployment/fly-io)** — Deploy to Fly.io for globally distributed containers. Covers `fly.toml` configuration, multi-region deployment, persistent volumes for SQLite, and auto-scaling settings.

- **[Railway](/ecosystem/deployment/railway)** — One-click deployment on Railway. Covers the Nixpacks build configuration for Bun, environment variable setup, and connecting to Railway-managed PostgreSQL or Redis instances.

## Community Resources

Connect with other EreoJS developers and stay up to date.

- **GitHub** — [github.com/ereojs/ereo](https://github.com/ereojs/ereo) — Source code, issue tracker, and discussions. File bug reports, request features, or contribute pull requests.

- **Discord** — [discord.gg/ereojs](https://discord.gg/ereojs) — Real-time chat with the community and core team. Get help, share what you are building, and discuss framework development.

- **Twitter / X** — [@eraborjs](https://twitter.com/eraborjs) — Release announcements, tips, and ecosystem updates.

## Building Your Own Plugin

EreoJS plugins are functions that hook into the framework lifecycle — they can register middleware, add routes, modify the build pipeline, and inject client-side code. If you want to build a plugin for your team or the community, see the [Plugin Development Guide](/contributing/plugin-development) for the full API reference, lifecycle hooks, and publishing guidelines.

## API Reference

For detailed API documentation on every exported function, type, and configuration option across all packages, see the [API Reference](/api/core/create-app).
