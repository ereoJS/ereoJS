# Getting Started

EreoJS is a React fullstack framework built on Bun. It combines file-based routing, server-side rendering, islands architecture, and simple data patterns to help you build fast, modern web applications. This section walks you through everything from installing Bun to deploying your first app.

<div class="tip custom-block" style="padding-top: 8px">

**New to EreoJS?** Start with the [prerequisites](/getting-started/prerequisites) and then follow the [installation guide](/getting-started/installation).

</div>

## What You'll Build

By the end of the Getting Started guide, you will have a working EreoJS application with:

- A home page with server-rendered content
- A dynamic route that loads data from a loader
- A form that submits to an action with validation
- A layout that wraps multiple pages with shared navigation
- A production build ready to deploy

The [Your First App](/getting-started/your-first-app) tutorial walks through building a task manager that covers all of these pieces.

## Quick Start

```bash
bunx create-ereo my-app
cd my-app
bun dev
```

This scaffolds a new project with a recommended file structure, installs dependencies, and starts the dev server at `http://localhost:3000`. You can open that URL in your browser and start editing files — changes appear instantly via hot module replacement.

## Learning Path

Follow these steps in order for a structured introduction:

1. **[Prerequisites](/getting-started/prerequisites)** — Install Bun (v1.0.0+), verify your system meets the requirements, and set up your editor. This takes about 5 minutes.

2. **[Installation](/getting-started/installation)** — Create a new EreoJS project using `create-ereo`. Choose a starter template and explore the generated files.

3. **[Project Structure](/getting-started/project-structure)** — Understand how files in `routes/`, `islands/`, and `lib/` map to your application's routes, interactive components, and shared logic.

4. **[Your First App](/getting-started/your-first-app)** — Build a task manager step by step. This tutorial covers routing, loaders, actions, forms, layouts, and error handling in a single walkthrough.

5. **[First Deployment](/getting-started/first-deployment)** — Deploy your app to production in under 5 minutes. Covers Bun self-hosting, Docker, and one-click platforms like Fly.io and Railway.

## Already Know React?

If you are comfortable with React and want to jump straight to what makes EreoJS different, here is the shortcut:

1. Read [Routing](/concepts/routing) to understand file-based route mapping
2. Read [Data Loading](/concepts/data-loading) to learn the loader/action pattern
3. Read [Islands](/concepts/islands) to understand selective hydration
4. Skim the [Feature Overview](/welcome/feature-overview) for the full API surface

These four pages cover the core mental model. Everything else — caching, middleware, forms, state, RPC — builds on top of these concepts.

## Coming From Another Framework?

If you are migrating from an existing framework, these guides highlight the key differences and map familiar patterns to their EreoJS equivalents:

- **[From Next.js](/migration/from-nextjs)** — App Router vs file-based routing, Server Components vs islands, `getServerSideProps` vs loaders, and API routes comparison.
- **[From Remix](/migration/from-remix)** — EreoJS shares many patterns with Remix (loaders, actions, `<Form>`). This guide covers the differences in file conventions, caching, and deployment.
- **[From Express/Koa](/migration/from-express)** — Map your Express middleware and route handlers to EreoJS middleware, loaders, and API routes. Covers session management and database integration.

## Core Concepts Preview

EreoJS is built around a few key ideas. Each one has a dedicated deep-dive page in the Concepts section.

**Routing** — Files in the `routes/` directory map directly to URLs. A file at `routes/posts/[id].tsx` handles requests to `/posts/123`. Layouts, route groups, and dynamic segments are all expressed through file naming conventions. No route configuration files needed. [Learn more](/concepts/routing)

**Data Loading** — Every route can export a `loader` (for fetching data) and an `action` (for handling mutations). Loaders run on the server before the component renders, and their return value is passed to the component as `loaderData`. Actions run when forms are submitted. [Learn more](/concepts/data-loading)

**Islands Architecture** — By default, EreoJS sends zero JavaScript for your page components. Only components marked as islands (via `.island.tsx` files or `'use client'`) are hydrated in the browser. This keeps pages fast while still supporting rich interactivity where you need it. [Learn more](/concepts/islands)

**Caching** — Loaders can declare cache settings with semantic tags. After a mutation, you invalidate specific tags and the framework handles revalidation. This gives you explicit, predictable cache control without stale data surprises. [Learn more](/concepts/caching)

**Middleware** — `_middleware.ts` files run before route handlers. Use them for authentication checks, request logging, rate limiting, or setting shared context that loaders and actions can access. [Learn more](/concepts/middleware)

## Tutorials

Once you are comfortable with the basics, these tutorials build progressively more complex applications:

- **[Build a Blog](/tutorials/blog/01-setup)** — Create a full blog with data loading, forms, and styling. Covers loaders, actions, layouts, and tag-based caching.
- **[Build a Dashboard](/tutorials/dashboard/)** — Build an analytics dashboard with authentication, islands for interactive charts, and real-time data updates.

## Need Help?

- **[Troubleshooting](/troubleshooting/)** — Solutions for common setup issues, build errors, and runtime problems.
- **[Debugging](/troubleshooting/debugging)** — Using the dev inspector, reading error messages, and debugging loaders and actions.
- **[GitHub Issues](https://github.com/ereo-framework/ereo/issues)** — Search existing issues or open a new one for bugs and feature requests.
- **[Contributing](/contributing/)** — Want to help improve EreoJS? See the contributing guide for how to get started.
