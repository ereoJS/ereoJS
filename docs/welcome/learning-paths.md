# Learning Paths

Guided paths through the EreoJS documentation based on your background and goals.

## Frontend Developer Path

You know React and want to build fullstack applications. This path takes you from familiar React patterns to EreoJS server-side features.

### Step 1: Get Started
- [Prerequisites](/getting-started/prerequisites) --- What you need installed
- [Installation](/getting-started/installation) --- Create your first project
- [Your First App](/getting-started/your-first-app) --- Build a working app

### Step 2: Learn the Core Concepts
- [Routing](/concepts/routing) --- File-based routes, dynamic segments, layouts
- [Data Loading](/concepts/data-loading) --- Loaders and actions
- [Islands](/concepts/islands) --- Selective hydration for interactive components
- [Rendering Modes](/concepts/rendering-modes) --- SSR, SSG, and when to use each

### Step 3: Build Real Features
- [Forms Guide](/guides/forms) --- Client and server form handling
- [Styling Guide](/guides/styling) --- CSS, Tailwind, CSS Modules
- [Error Handling](/guides/error-handling) --- Error boundaries and fallbacks

### Step 4: Go Deeper
- [State Management](/concepts/state-management) --- Signals and stores
- [Caching](/concepts/caching) --- Tag-based cache invalidation
- [Streaming Deep Dive](/architecture/streaming-deep-dive) --- How streaming SSR works

---

## Backend Developer Path

You come from Express, Koa, or another backend framework and want to add a modern frontend. This path focuses on server-side patterns and adding React rendering.

### Step 1: Understand the Framework
- [What is EreoJS?](/welcome/) --- Overview and philosophy
- [Migration from Express](/migration/from-express) --- Map your existing patterns

### Step 2: Learn the Server Side
- [Routing](/concepts/routing) --- File-based routes replace `app.get()`
- [Middleware](/concepts/middleware) --- Request pipeline and context
- [Data Loading](/concepts/data-loading) --- Loaders replace route handlers, actions handle mutations

### Step 3: Add API Routes
- [API Routes](/concepts/routing#api-routes) --- Export GET, POST, PUT, DELETE handlers
- [Database Guide](/guides/database) --- Connect your database
- [Authentication](/guides/authentication) --- Session management and auth flows

### Step 4: Add React Rendering
- [Rendering Modes](/concepts/rendering-modes) --- SSR, SSG, streaming
- [Islands](/concepts/islands) --- Add interactivity without shipping a full SPA
- [Forms Guide](/guides/forms) --- Server-side validation with client-side feedback

### Step 5: Deploy
- [Deployment Overview](/ecosystem/deployment/) --- Choose your platform
- [Docker](/ecosystem/deployment/docker) --- Containerized deployment
- [CI/CD](/ecosystem/ci-cd) --- Automate builds and deploys

---

## Fullstack Developer Path

You want to learn everything EreoJS offers from end to end.

### Step 1: Foundation
- [What is EreoJS?](/welcome/) --- Framework overview
- [Feature Overview](/welcome/feature-overview) --- Complete feature list
- [Installation](/getting-started/installation) --- Set up your environment
- [Your First App](/getting-started/your-first-app) --- Build something

### Step 2: Core Concepts
- [Routing](/concepts/routing) --- The file-based routing system
- [Data Loading](/concepts/data-loading) --- Loaders, actions, and the data pipeline
- [Rendering Modes](/concepts/rendering-modes) --- SSR, SSG, CSR
- [Islands](/concepts/islands) --- Selective hydration
- [Middleware](/concepts/middleware) --- Request pipeline
- [Caching](/concepts/caching) --- Tag-based invalidation
- [State Management](/concepts/state-management) --- Signals and stores

### Step 3: Guides
- [Forms](/guides/forms) --- Simple and advanced form handling
- [Authentication](/guides/authentication) --- Login, sessions, OAuth
- [Database](/guides/database) --- Data access patterns
- [Testing](/guides/testing) --- Test your routes and components
- [Error Handling](/guides/error-handling) --- Boundaries and fallbacks
- [TypeScript](/guides/typescript) --- Type safety patterns

### Step 4: Architecture
- [Why Bun?](/architecture/why-bun) --- Runtime choice and trade-offs
- [Performance](/architecture/performance) --- Optimization strategies
- [Security](/architecture/security) --- CSRF, CSP, and best practices
- [Caching Deep Dive](/architecture/caching-deep-dive) --- Cache layers and strategies
- [Streaming Deep Dive](/architecture/streaming-deep-dive) --- How streaming SSR works

### Step 5: Ecosystem and Deploy
- [Plugins](/guides/plugins) --- Extend EreoJS
- [IDE Setup](/ecosystem/ide-setup) --- Configure your editor
- [CI/CD](/ecosystem/ci-cd) --- Automated pipelines
- [Deployment](/ecosystem/deployment/) --- Ship to production

### Step 6: Reference
- [Cheat Sheet](/reference/cheat-sheet) --- Quick patterns
- [CLI Reference](/reference/cli-reference) --- All commands
- [Config Reference](/reference/config-reference) --- All options
- [Glossary](/reference/glossary) --- Framework terminology
