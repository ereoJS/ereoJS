# create-ereo

Scaffold a new EreoJS project with a single command. Creates a fully configured React fullstack application powered by Bun.

## Usage

```bash
bunx create-ereo@latest my-app
```

Or with npm/npx:

```bash
npx create-ereo@latest my-app
```

## Quick Start

```bash
# Create a new project with the default template
bunx create-ereo@latest my-app

# Navigate to the project
cd my-app

# Start the development server
bun run dev

# Open http://localhost:3000
```

## Templates

Choose from multiple starter templates:

```bash
# Tailwind template - full-featured with Tailwind CSS (default)
bunx create-ereo@latest my-app --template tailwind

# Tasks template - full-stack CRUD app with auth + SQLite
bunx create-ereo@latest my-app --template tasks

# Minimal template - bare essentials
bunx create-ereo@latest my-app --template minimal
```

### Template Contents

**Tailwind (default):**
- Complete project structure
- Multiple example routes (Home, Blog, Contact, About)
- Navigation and Footer components
- Interactive Counter island component
- Blog with dynamic routes
- Contact form with actions
- Error boundary and 404 page
- Tailwind CSS with custom theme
- TypeScript with path aliases

**Tasks:**
- Email & password authentication with argon2id hashing
- SQLite database with WAL mode and automatic migrations
- Full CRUD operations for tasks (create, read, update, delete)
- Protected routes with auth middleware
- Dashboard with task stats and status filters
- Server-side validation and error handling
- JWT sessions with secure cookie configuration
- Docker support with SQLite volume persistence
- Tailwind CSS with custom component classes

**Minimal:**
- Basic project structure
- Single route
- TypeScript configuration

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--template` | `-t` | Template to use (minimal, default, tailwind, tasks) |
| `--no-typescript` | | Use JavaScript instead of TypeScript |
| `--no-git` | | Skip git initialization |
| `--no-install` | | Skip package installation |
| `--help` | `-h` | Show help message |

## Examples

```bash
# Create with minimal template
bunx create-ereo@latest my-app -t minimal

# Create without TypeScript
bunx create-ereo@latest my-app --no-typescript

# Create without installing dependencies
bunx create-ereo@latest my-app --no-install

# Create without git initialization
bunx create-ereo@latest my-app --no-git
```

## Project Structure

After creation, your project will have:

```
my-app/
  app/
    components/     # Reusable React components
    lib/            # Utilities and data
    routes/         # File-based routes
    styles.css      # Global styles
  public/           # Static assets
  ereo.config.ts    # EreoJS configuration
  package.json
  tsconfig.json
  tailwind.config.js
```

## Key Features

- Interactive project scaffolding
- Multiple template options
- TypeScript or JavaScript support
- Automatic git initialization
- Automatic dependency installation
- Tailwind CSS integration
- Example routes demonstrating EreoJS features

## Documentation

For full documentation, visit [https://ereo.dev/docs/getting-started](https://ereo.dev/docs/getting-started)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
