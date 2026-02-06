# Quick Reference

This section is designed for quick lookup during active development. Rather than reading end-to-end, use these pages when you need to check a specific term, find a command flag, or copy a common pattern. Bookmark the pages you use most.

## Reference Guides

### [Glossary](/reference/glossary)

Framework-specific terms and concepts defined in one place. Look here when you encounter unfamiliar terminology. Covers key concepts including:

- **Island** -- A client-interactive component within a server-rendered page, hydrated independently.
- **Loader** -- A server-side function that fetches data before a route renders.
- **Action** -- A server-side function that handles form submissions and mutations.
- **Signal** -- A reactive state primitive that notifies subscribers when its value changes.
- **Hydration** -- The process of attaching client-side interactivity to server-rendered HTML.
- **Revalidation** -- Re-running loaders to refresh cached data after a mutation or cache expiry.

### [Cheat Sheet](/reference/cheat-sheet)

Common patterns at a glance, organized by topic. Each entry is a copy-paste-ready code snippet covering:

- Route definition and file naming
- Data loading with loaders and actions
- Cache configuration and tag-based invalidation
- Form creation and validation
- Middleware patterns
- Signal state management in components

Use this page when you know what you want to do but cannot remember the exact syntax.

### [CLI Reference](/reference/cli-reference)

Every `bun ereo` command, flag, and option documented in one page. Includes:

- `bun ereo dev` -- Start the development server with hot reload
- `bun ereo build` -- Create a production build
- `bun ereo deploy` -- Deploy to a supported platform
- `bun ereo generate` -- Scaffold routes, components, and other files
- Global flags like `--port`, `--host`, `--config`, and `--debug`

### [Config Reference](/reference/config-reference)

The complete set of options available in `ereo.config.ts`, organized by category:

- **Server:** port, host, HTTPS, compression, headers
- **Build:** output directory, target, source maps, minification
- **Cache:** default TTL, tag-based invalidation rules, cache storage backend
- **Plugins:** plugin registration and configuration
- **Rendering:** SSR, SSG, islands configuration, streaming options

### [Route Conventions](/reference/route-conventions)

The special file names and directory patterns that EreoJS uses to build your application's routing:

- `_layout.tsx` -- Wrapping layout for a route segment and its children
- `_middleware.ts` -- Request/response middleware for a route segment
- `_error.tsx` -- Error boundary for a route segment
- `[param].tsx` -- Dynamic route segment matching a single path part
- `[...slug].tsx` -- Catch-all route matching one or more path parts
- `(group)/` -- Route group directory for organizing routes without affecting the URL

## When to Use This Section

Not sure which reference page has what you need? Use this guide:

| Question | Go To |
|----------|-------|
| "What does this term mean?" | [Glossary](/reference/glossary) |
| "How do I do X quickly?" | [Cheat Sheet](/reference/cheat-sheet) |
| "What flags does the CLI accept?" | [CLI Reference](/reference/cli-reference) |
| "What options go in the config?" | [Config Reference](/reference/config-reference) |
| "What are the special file names?" | [Route Conventions](/reference/route-conventions) |

## API Reference

For detailed programmatic API documentation -- function signatures, parameter types, return values, and usage examples -- see the [API Reference](/api/core/create-app) section. The API Reference covers every public export from `@ereo/core`, `@ereo/state`, `@ereo/forms`, and `@ereo/data`.

## External Resources

These external documentation sites are useful companions when working with EreoJS:

- **[Bun Documentation](https://bun.sh/docs)** -- Runtime APIs, package manager, bundler, and test runner documentation for the runtime EreoJS is built on.
- **[React Documentation](https://react.dev)** -- Component APIs, hooks, and patterns for the UI library used by EreoJS for rendering.
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)** -- Language features, type system, and configuration reference for the language EreoJS is written in.
- **[MDN Web Docs](https://developer.mozilla.org)** -- Comprehensive reference for Web APIs, HTML, CSS, and JavaScript standards.
