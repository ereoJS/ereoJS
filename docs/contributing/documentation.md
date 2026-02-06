# Documentation Guide

How the EreoJS documentation is built, how to run it locally, and how to contribute.

## How the Docs Work

The documentation site is built with [VitePress](https://vitepress.dev). Source files are Markdown (`.md`) located in the `docs/` directory at the repository root.

## Running Locally

```bash
# From the repository root
bun run docs:dev
```

This starts a local server at `http://localhost:5173` with hot reloading. Any edits to `.md` files are reflected in the browser immediately.

To build the docs for production:

```bash
bun run docs:build
```

The output is generated in `docs/.vitepress/dist/`.

## File Structure

```
docs/
  index.md                    # Landing page
  getting-started/            # Installation, first app, project structure
  concepts/                   # Core concepts (routing, data loading, etc.)
  guides/                     # How-to guides (forms, auth, styling, etc.)
  tutorials/                  # Step-by-step tutorials
  api/                        # API reference docs
  architecture/               # Design philosophy, deep dives, comparisons
  ecosystem/                  # Plugins, IDE setup, CI/CD, deployment
  reference/                  # Glossary, cheat sheet, CLI, config
  troubleshooting/            # Common errors, debugging, FAQ
  contributing/               # Development setup, architecture, testing
  migration/                  # Migration guides from other frameworks
  welcome/                    # Feature overview, learning paths, changelog
  .vitepress/
    config.ts                 # VitePress configuration and sidebar
    theme/                    # Custom theme overrides
  public/                     # Static assets (images, favicons)
```

## Writing Style

Follow these conventions when writing documentation:

- **Use active voice** --- "EreoJS uses file-based routing" not "File-based routing is used by EreoJS"
- **Be direct** --- Start sentences with the action: "Create a file" not "You should create a file"
- **Use second person sparingly** --- Prefer imperative ("Run `bun dev`") over "You can run `bun dev`"
- **Code examples first** --- Show the code, then explain it
- **One concept per section** --- Each `##` heading should cover a single topic
- **Link to related pages** --- Use internal links like `[Routing](/concepts/routing)` to connect topics

## Adding API Docs

API reference pages document individual functions, hooks, and types. Follow this pattern:

```md
# functionName

Brief one-line description.

## Signature

\`\`\`ts
function functionName(arg: Type): ReturnType
\`\`\`

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `arg` | `Type` | What it does |

## Returns

Description of the return value.

## Example

\`\`\`tsx
import { functionName } from '@ereo/package'
// Usage example
\`\`\`
```

## Submitting Documentation PRs

1. Fork the repository and create a branch
2. Make edits in the `docs/` directory
3. Run `bun run docs:dev` to preview your changes
4. Verify all internal links work (VitePress reports broken links during build)
5. Submit a pull request with `docs:` prefix in the commit message

```bash
git commit -m "docs: add caching examples to data loading guide"
```

Common PR types:

- **Fix typos or errors** --- Small corrections to existing pages
- **Add examples** --- Code examples that demonstrate real use cases
- **New guides** --- How-to content for specific tasks
- **API docs** --- Reference documentation for package exports
