# create-ereo

Scaffold a new EreoJS project with a single command. The `create-ereo` package provides a project generator with multiple templates and configuration options.

## Requirements

- **Bun**: Version 1.0 or later is required
- **Operating Systems**: macOS, Linux, Windows (WSL recommended)

> **Note:** `create-ereo` uses Bun-specific APIs (`Bun.write`, `Bun.spawn`) and cannot run directly on Node.js.

## Usage

### Using bunx (Recommended)

```bash
bunx create-ereo my-app
```

### Using npx

```bash
npx create-ereo my-app
```

### Direct Installation

```bash
bun add -g create-ereo
create-ereo my-app
```

## Command-Line Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--template` | `-t` | Template to use | `tailwind` |
| `--no-typescript` | | Use JavaScript instead of TypeScript | `false` |
| `--no-git` | | Skip git initialization | `false` |
| `--no-install` | | Skip dependency installation | `false` |
| `--help` | `-h` | Show help message | |

## Templates

### tailwind (Default)

Full-featured template with Tailwind CSS styling, demonstrating all EreoJS features:

- Tailwind CSS with dark mode support
- Multiple page routes (Home, About, Blog, Contact)
- Dynamic routes with `[slug]` parameters
- Nested layouts
- Form handling with actions
- Islands architecture with interactive components
- Error boundaries

```bash
bunx create-ereo my-app --template tailwind
```

### default

Same as tailwind template - includes all features with Tailwind CSS.

```bash
bunx create-ereo my-app --template default
```

### minimal

Bare-bones template for starting from scratch:

- Basic root layout
- Single index page
- No additional styling
- Minimal dependencies

```bash
bunx create-ereo my-app --template minimal
```

## Template Comparison

| Feature | minimal | default / tailwind |
|---------|---------|-------------------|
| Root Layout | ✅ | ✅ |
| Index Page | ✅ | ✅ |
| TypeScript Config | ✅ | ✅ |
| Blog (dynamic routes) | ❌ | ✅ |
| Contact Form (action) | ❌ | ✅ |
| About Page | ❌ | ✅ |
| Error Boundary (`_error.tsx`) | ❌ | ✅ |
| 404 Page (`_404.tsx`) | ❌ | ✅ |
| Navigation Component | ❌ | ✅ |
| Footer Component | ❌ | ✅ |
| Counter Island | ❌ | ✅ |
| Tailwind CSS | ❌ | ✅ |
| Dark Mode | ❌ | ✅ |
| Path Aliases (`~/`) | ❌ | ✅ |
| `.env.example` | ❌ | ✅ |
| Mock Data Helpers | ❌ | ✅ |
| Type Definitions | ❌ | ✅ |

## Examples

### Basic Project Creation

```bash
# Create with all defaults (TypeScript, Tailwind, git, auto-install)
bunx create-ereo my-app

# Navigate and start development
cd my-app
bun run dev
```

### JavaScript Project

```bash
bunx create-ereo my-app --no-typescript
```

### Minimal Setup

```bash
# Minimal template, skip install (install later manually)
bunx create-ereo my-app --template minimal --no-install
```

### Skip Git Initialization

```bash
bunx create-ereo my-app --no-git
```

## Project Structure

### Tailwind Template

```
my-app/
├── app/
│   ├── components/
│   │   ├── Counter.tsx       # Interactive island component
│   │   ├── Footer.tsx        # Footer component
│   │   ├── Navigation.tsx    # Navigation with mobile menu
│   │   └── PostCard.tsx      # Blog post card component
│   ├── lib/
│   │   ├── data.ts           # Mock data and helpers
│   │   └── types.ts          # TypeScript type definitions
│   ├── routes/
│   │   ├── _layout.tsx       # Root layout (html, head, body)
│   │   ├── _error.tsx        # Global error boundary
│   │   ├── _404.tsx          # Custom 404 page
│   │   ├── index.tsx         # Home page with loader
│   │   ├── about.tsx         # Static about page
│   │   ├── contact.tsx       # Contact form with action
│   │   └── blog/
│   │       ├── _layout.tsx   # Blog section layout
│   │       ├── index.tsx     # Blog listing page
│   │       └── [slug].tsx    # Dynamic blog post page
│   └── styles.css            # Global Tailwind styles
├── public/                   # Static assets
├── ereo.config.ts            # EreoJS configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies and scripts
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore patterns
└── README.md                 # Project documentation
```

### Minimal Template

```
my-app/
├── app/
│   └── routes/
│       ├── _layout.tsx       # Root layout
│       └── index.tsx         # Home page
├── public/                   # Static assets
├── ereo.config.ts            # EreoJS configuration
├── tsconfig.json             # TypeScript configuration (if enabled)
├── package.json              # Dependencies and scripts
└── .gitignore                # Git ignore patterns
```

## Generated Configuration

### ereo.config.ts

The configuration file sets up the server, build options, and plugins:

```ts
import { defineConfig, env } from '@ereo/core';
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
    development: process.env.NODE_ENV !== 'production',
  },
  build: {
    target: 'bun',
  },
  env: {
    NODE_ENV: env.enum(['development', 'production', 'test'] as const).default('development'),
  },
  plugins: [
    tailwind(),
  ],
});
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "ereo dev",
    "build": "ereo build",
    "start": "ereo start",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  }
}
```

### Path Aliases (Tailwind Template)

The tailwind template configures the `~/` path alias for cleaner imports:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./app/*"]
    }
  }
}
```

Usage example:

```tsx
// Before (relative imports)
import { Counter } from '../../../components/Counter'
import { getAllPosts } from '../lib/data'

// After (path aliases)
import { Counter } from '~/components/Counter'
import { getAllPosts } from '~/lib/data'
```

## Dependencies

### Runtime Dependencies

| Package | Description |
|---------|-------------|
| `@ereo/core` | Core framework functionality |
| `@ereo/router` | File-based routing |
| `@ereo/server` | HTTP server with Bun |
| `@ereo/client` | Client-side runtime |
| `@ereo/data` | Data loading and actions |
| `@ereo/cli` | CLI commands |
| `@ereo/runtime-bun` | Bun runtime adapter |
| `@ereo/plugin-tailwind` | Tailwind CSS integration |
| `react` | React library |
| `react-dom` | React DOM renderer |

### Dev Dependencies

| Package | Description |
|---------|-------------|
| `@ereo/testing` | Testing utilities |
| `@ereo/dev-inspector` | Development inspector |
| `@types/bun` | Bun type definitions |
| `@types/react` | React type definitions |
| `@types/react-dom` | React DOM type definitions |
| `typescript` | TypeScript compiler |
| `tailwindcss` | Tailwind CSS |

## Post-Installation Steps

After creating your project:

### 1. Navigate to Project Directory

```bash
cd my-app
```

### 2. Install Dependencies (if skipped)

```bash
bun install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Start Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Explore the Code

- Edit `app/routes/index.tsx` to modify the home page
- Add new routes in `app/routes/`
- Create components in `app/components/`
- Configure the app in `ereo.config.ts`

## Troubleshooting

### Permission Denied

```bash
# On macOS/Linux, ensure Bun is properly installed
curl -fsSL https://bun.sh/install | bash
```

### Directory Already Exists

The generator will not overwrite existing directories. Choose a different name or remove the existing directory:

```bash
rm -rf my-app
bunx create-ereo my-app
```

### Network Issues

If dependency installation fails:

```bash
bunx create-ereo my-app --no-install
cd my-app
bun install --verbose
```

### Template Not Found

Ensure you're using a valid template name:

```bash
bunx create-ereo my-app --template minimal
bunx create-ereo my-app --template default
bunx create-ereo my-app --template tailwind
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success or `--help` displayed |
| `1` | Missing project name argument |

## Related

- [CLI: dev](/api/cli/dev) - Development server
- [CLI: build](/api/cli/build) - Production build
- [CLI: start](/api/cli/start) - Production server
- [CLI: create](/api/cli/create) - Alternative project creation via CLI
- [CLI: deploy](/api/cli/deploy) - Deployment commands
