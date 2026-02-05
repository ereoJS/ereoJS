#!/usr/bin/env bun
/**
 * create-ereo
 *
 * Scaffold a new EreoJS project.
 * Usage: bunx create-ereo my-app
 */

import { join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

/**
 * Available templates.
 */
type Template = 'minimal' | 'default' | 'tailwind';

/**
 * Create options.
 */
interface CreateOptions {
  template: Template;
  typescript: boolean;
  git: boolean;
  install: boolean;
}

/**
 * Default options.
 */
const defaultOptions: CreateOptions = {
  template: 'tailwind',
  typescript: true,
  git: true,
  install: true,
};

/**
 * Print banner.
 */
function printBanner(): void {
  console.log(`
  \x1b[36m⬡\x1b[0m \x1b[1mCreate EreoJS App\x1b[0m

  A React fullstack framework built on Bun.
`);
}

/**
 * Print help.
 */
function printHelp(): void {
  console.log(`
  \x1b[1mUsage:\x1b[0m
    bunx create-ereo <project-name> [options]

  \x1b[1mOptions:\x1b[0m
    -t, --template <name>   Template to use (minimal, default, tailwind)
    --no-typescript         Use JavaScript instead of TypeScript
    --no-git                Skip git initialization
    --no-install            Skip package installation

  \x1b[1mExamples:\x1b[0m
    bunx create-ereo my-app
    bunx create-ereo my-app --template minimal
    bunx create-ereo my-app --no-typescript
`);
}

/**
 * Parse command line arguments.
 */
function parseArgs(args: string[]): {
  projectName: string | null;
  options: Partial<CreateOptions>;
} {
  const options: Partial<CreateOptions> = {};
  let projectName: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '-t' || arg === '--template') {
      if (i + 1 >= args.length) {
        console.error('  \x1b[31m✗\x1b[0m --template requires a value (minimal, default, tailwind)\n');
        process.exit(1);
      }
      const tmpl = args[++i];
      if (tmpl !== 'minimal' && tmpl !== 'default' && tmpl !== 'tailwind') {
        console.error(`  \x1b[31m✗\x1b[0m Unknown template "${tmpl}". Valid options: minimal, default, tailwind\n`);
        process.exit(1);
      }
      options.template = tmpl;
    } else if (arg === '--no-typescript') {
      options.typescript = false;
    } else if (arg === '--no-git') {
      options.git = false;
    } else if (arg === '--no-install') {
      options.install = false;
    } else if (!arg.startsWith('-') && !projectName) {
      projectName = arg;
    }
  }

  return { projectName, options };
}

/**
 * Generate a minimal project.
 */
async function generateMinimalProject(
  projectDir: string,
  projectName: string,
  typescript: boolean
): Promise<void> {
  const ext = typescript ? 'tsx' : 'jsx';

  // Create directories
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, 'app/routes'), { recursive: true });
  await mkdir(join(projectDir, 'public'), { recursive: true });

  // package.json
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'ereo dev',
      build: 'ereo build',
      start: 'ereo start',
    },
    dependencies: {
      '@ereo/core': '^0.1.7',
      '@ereo/router': '^0.1.7',
      '@ereo/server': '^0.1.7',
      '@ereo/client': '^0.1.7',
      '@ereo/data': '^0.1.7',
      '@ereo/cli': '^0.1.7',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: typescript
      ? {
          '@types/bun': '^1.1.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          typescript: '^5.4.0',
        }
      : {},
  };

  await Bun.write(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // ereo.config
  const ereoConfig = `
import { defineConfig } from '@ereo/core';

export default defineConfig({
  server: {
    port: 3000,
  },
});
`.trim();

  await Bun.write(join(projectDir, `ereo.config.${typescript ? 'ts' : 'js'}`), ereoConfig);

  // Root layout
  const layout = `
export default function RootLayout({ children }${typescript ? ': { children: React.ReactNode }' : ''}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${projectName}</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/_layout.${ext}`), layout);

  // Index page
  const indexPage = `
export default function HomePage() {
  return (
    <main>
      <h1>Welcome to EreoJS!</h1>
      <p>Edit app/routes/index.${ext} to get started.</p>
    </main>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/index.${ext}`), indexPage);

  // TypeScript config
  if (typescript) {
    const tsconfig = {
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        types: ['bun-types'],
      },
      include: ['app/**/*', '*.config.ts'],
    };

    await Bun.write(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  }

  // .gitignore
  await Bun.write(
    join(projectDir, '.gitignore'),
    'node_modules\n.ereo\ndist\n*.log\n.DS_Store\n.env\n.env.local'
  );
}

/**
 * Generate the full tailwind project with all features.
 */
async function generateTailwindProject(
  projectDir: string,
  projectName: string,
  typescript: boolean
): Promise<void> {
  const ext = typescript ? 'tsx' : 'jsx';
  const ts = typescript;

  // Create all directories
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, 'app/routes/blog'), { recursive: true });
  await mkdir(join(projectDir, 'app/components'), { recursive: true });
  await mkdir(join(projectDir, 'app/lib'), { recursive: true });
  await mkdir(join(projectDir, 'public'), { recursive: true });

  // ============================================================================
  // package.json
  // ============================================================================
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'ereo dev',
      build: 'ereo build',
      start: 'ereo start',
      test: 'bun test',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@ereo/core': '^0.1.7',
      '@ereo/router': '^0.1.7',
      '@ereo/server': '^0.1.7',
      '@ereo/client': '^0.1.7',
      '@ereo/data': '^0.1.7',
      '@ereo/cli': '^0.1.7',
      '@ereo/runtime-bun': '^0.1.7',
      '@ereo/plugin-tailwind': '^0.1.7',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@ereo/testing': '^0.1.7',
      '@ereo/dev-inspector': '^0.1.7',
      ...(ts
        ? {
            '@types/bun': '^1.1.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.4.0',
          }
        : {}),
      tailwindcss: '^3.4.0',
    },
  };

  await Bun.write(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // ============================================================================
  // ereo.config.ts
  // ============================================================================
  const ereoConfig = `
import { defineConfig, env } from '@ereo/core';
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
    // Enable development features
    development: process.env.NODE_ENV !== 'production',
  },
  build: {
    target: 'bun',
  },
  // Environment variable validation
  env: {
    NODE_ENV: env.enum(['development', 'production', 'test'] as const).default('development'),
    // Add your environment variables here:
    // DATABASE_URL: env.string().required(),
    // API_KEY: env.string(),
  },
  plugins: [
    tailwind(),
  ],
});
`.trim();

  await Bun.write(join(projectDir, `ereo.config.${ts ? 'ts' : 'js'}`), ereoConfig);

  // ============================================================================
  // TypeScript config
  // ============================================================================
  if (ts) {
    const tsconfig = {
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        types: ['bun-types'],
        paths: {
          '~/*': ['./app/*'],
        },
      },
      include: ['app/**/*', '*.config.ts'],
    };

    await Bun.write(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  }

  // ============================================================================
  // Tailwind config
  // ============================================================================
  const tailwindConfig = `
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
`.trim();

  await Bun.write(join(projectDir, 'tailwind.config.js'), tailwindConfig);

  // ============================================================================
  // Global styles
  // ============================================================================
  const styles = `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply antialiased;
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
  }
  .btn-primary {
    @apply bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500;
  }
  .btn-secondary {
    @apply bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600;
  }
  .input {
    @apply w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600;
  }
  .card {
    @apply bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6;
  }
}
`.trim();

  await Bun.write(join(projectDir, 'app/styles.css'), styles);

  // ============================================================================
  // Types (TypeScript only)
  // ============================================================================
  if (ts) {
    const types = `
/**
 * Shared types for the application.
 */

export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  readTime: string;
  tags: string[];
}

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
`.trim();

    await Bun.write(join(projectDir, 'app/lib/types.ts'), types);
  }

  // ============================================================================
  // Mock data
  // ============================================================================
  const mockData = `
${ts ? "import type { Post } from './types';\n" : ''}
/**
 * Mock blog posts data.
 * In a real app, this would come from a database or CMS.
 */
export const posts${ts ? ': Post[]' : ''} = [
  {
    slug: 'getting-started-with-ereo',
    title: 'Getting Started with EreoJS',
    excerpt: 'Learn how to build modern web applications with EreoJS, the React fullstack framework powered by Bun.',
    content: \`
# Getting Started with EreoJS

EreoJS is a modern React fullstack framework that runs on Bun, offering exceptional performance and developer experience.

## Key Features

- **Server-Side Rendering**: Fast initial page loads with SSR
- **File-Based Routing**: Intuitive routing with automatic code splitting
- **Data Loading**: Simple and powerful data fetching with loaders
- **Actions**: Handle form submissions and mutations easily
- **Islands Architecture**: Selective hydration for optimal performance

## Quick Start

\\\`\\\`\\\`bash
bunx create-ereo my-app
cd my-app
bun run dev
\\\`\\\`\\\`

You're now ready to build amazing applications!
    \`.trim(),
    author: 'EreoJS Team',
    date: '2024-01-15',
    readTime: '5 min read',
    tags: ['ereo', 'react', 'tutorial'],
  },
  {
    slug: 'understanding-loaders-and-actions',
    title: 'Understanding Loaders and Actions',
    excerpt: 'Deep dive into EreoJS\\'s data loading and mutation patterns for building robust applications.',
    content: \`
# Understanding Loaders and Actions

Loaders and actions are the core data primitives in EreoJS.

## Loaders

Loaders run on the server before rendering and provide data to your components:

\\\`\\\`\\\`typescript
export async function loader({ params }) {
  const user = await db.user.findUnique({
    where: { id: params.id }
  });
  return { user };
}
\\\`\\\`\\\`

## Actions

Actions handle form submissions and mutations:

\\\`\\\`\\\`typescript
export async function action({ request }) {
  const formData = await request.formData();
  await db.user.create({
    data: Object.fromEntries(formData)
  });
  return { success: true };
}
\\\`\\\`\\\`
    \`.trim(),
    author: 'EreoJS Team',
    date: '2024-01-20',
    readTime: '8 min read',
    tags: ['ereo', 'data', 'tutorial'],
  },
  {
    slug: 'styling-with-tailwind',
    title: 'Styling with Tailwind CSS',
    excerpt: 'How to use Tailwind CSS effectively in your EreoJS applications for beautiful, responsive designs.',
    content: \`
# Styling with Tailwind CSS

EreoJS comes with first-class Tailwind CSS support out of the box.

## Setup

The Tailwind plugin is already configured when you create a new project:

\\\`\\\`\\\`typescript
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  plugins: [tailwind()],
});
\\\`\\\`\\\`

## Usage

Just use Tailwind classes in your components:

\\\`\\\`\\\`tsx
export default function Button({ children }) {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      {children}
    </button>
  );
}
\\\`\\\`\\\`
    \`.trim(),
    author: 'EreoJS Team',
    date: '2024-01-25',
    readTime: '4 min read',
    tags: ['ereo', 'tailwind', 'css'],
  },
];

/**
 * Get all posts.
 */
export function getAllPosts()${ts ? ': Post[]' : ''} {
  return posts;
}

/**
 * Get a single post by slug.
 */
export function getPostBySlug(slug${ts ? ': string' : ''})${ts ? ': Post | undefined' : ''} {
  return posts.find((post) => post.slug === slug);
}

/**
 * Simulate API delay for demo purposes.
 */
export async function simulateDelay(ms${ts ? ': number' : ''} = 100)${ts ? ': Promise<void>' : ''} {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
`.trim();

  await Bun.write(join(projectDir, `app/lib/data.${ts ? 'ts' : 'js'}`), mockData);

  // ============================================================================
  // Components: Navigation
  // ============================================================================
  const navigation = `
'use client';

import { useState } from 'react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About' },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-2">
            <span className="text-2xl">⬡</span>
            <span className="font-bold text-xl">EreoJS</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-800">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block py-2 text-gray-600 dark:text-gray-300 hover:text-primary-600"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/components/Navigation.${ext}`), navigation);

  // ============================================================================
  // Components: Counter (Interactive Island)
  // ============================================================================
  const counter = `
'use client';

import { useState } from 'react';

${ts ? 'interface CounterProps {\n  initialCount?: number;\n}\n' : ''}
/**
 * Interactive counter component.
 * This demonstrates client-side interactivity with EreoJS's islands architecture.
 * The 'use client' directive marks this component for hydration.
 */
export function Counter({ initialCount = 0 }${ts ? ': CounterProps' : ''}) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => setCount((c) => c - 1)}
        className="btn btn-secondary w-10 h-10 flex items-center justify-center text-xl"
        aria-label="Decrease count"
      >
        -
      </button>
      <span className="text-2xl font-bold w-12 text-center">{count}</span>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="btn btn-primary w-10 h-10 flex items-center justify-center text-xl"
        aria-label="Increase count"
      >
        +
      </button>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/components/Counter.${ext}`), counter);

  // ============================================================================
  // Components: Footer
  // ============================================================================
  const footer = `
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
            <span className="text-xl">⬡</span>
            <span>Built with EreoJS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <a href="https://github.com/ereo-js/ereo" target="_blank" rel="noopener" className="hover:text-primary-600">
              GitHub
            </a>
            <a href="https://ereo.dev/docs" target="_blank" rel="noopener" className="hover:text-primary-600">
              Documentation
            </a>
            <span>&copy; {currentYear}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/components/Footer.${ext}`), footer);

  // ============================================================================
  // Components: PostCard
  // ============================================================================
  const postCard = `
${ts ? "import type { Post } from '~/lib/types';\n" : ''}
${ts ? 'interface PostCardProps {\n  post: Post;\n}\n' : ''}
export function PostCard({ post }${ts ? ': PostCardProps' : ''}) {
  return (
    <article className="card hover:shadow-xl transition-shadow">
      <div className="flex flex-wrap gap-2 mb-3">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
      <h2 className="text-xl font-bold mb-2">
        <a href={\`/blog/\${post.slug}\`} className="hover:text-primary-600 transition-colors">
          {post.title}
        </a>
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{post.excerpt}</p>
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
        <span>{post.author}</span>
        <div className="flex items-center gap-3">
          <span>{post.date}</span>
          <span>{post.readTime}</span>
        </div>
      </div>
    </article>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/components/PostCard.${ext}`), postCard);

  // ============================================================================
  // Root Layout
  // ============================================================================
  const rootLayout = `
import { Navigation } from '~/components/Navigation';
import { Footer } from '~/components/Footer';

${ts ? 'interface RootLayoutProps {\n  children: React.ReactNode;\n}\n' : ''}
export default function RootLayout({ children }${ts ? ': RootLayoutProps' : ''}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="A modern web application built with EreoJS" />
        <title>${projectName}</title>
        <link rel="stylesheet" href="/app/styles.css" />
      </head>
      <body className="min-h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <Navigation />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/_layout.${ext}`), rootLayout);

  // ============================================================================
  // Home Page
  // ============================================================================
  const homePage = `
import { Counter } from '~/components/Counter';
import { getAllPosts, simulateDelay } from '~/lib/data';

/**
 * Loader function - runs on the server before rendering.
 * Fetches data and passes it to the component.
 */
export async function loader() {
  await simulateDelay(50);

  const posts = getAllPosts();
  const featuredPost = posts[0];

  return {
    featuredPost,
    stats: {
      posts: posts.length,
      serverTime: new Date().toLocaleTimeString(),
    },
  };
}

${ts ? `interface HomePageProps {
  loaderData: {
    featuredPost: {
      slug: string;
      title: string;
      excerpt: string;
    };
    stats: {
      posts: number;
      serverTime: string;
    };
  };
}\n` : ''}
export default function HomePage({ loaderData }${ts ? ': HomePageProps' : ''}) {
  const { featuredPost, stats } = loaderData;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary-500 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Welcome to EreoJS
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-primary-100">
            A React fullstack framework built on Bun.
            <br />
            Fast, simple, and powerful.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/blog" className="btn bg-white text-primary-600 hover:bg-primary-50">
              Read the Blog
            </a>
            <a
              href="https://github.com/ereo-js/ereo"
              target="_blank"
              rel="noopener"
              className="btn border-2 border-white text-white hover:bg-white/10"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why EreoJS?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-2">Blazing Fast</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Built on Bun for exceptional performance. Server-side rendering with streaming support.
              </p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-2">Simple Data Loading</h3>
              <p className="text-gray-600 dark:text-gray-400">
                One pattern for data fetching. Loaders and actions make it easy to build dynamic apps.
              </p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🏝️</div>
              <h3 className="text-xl font-bold mb-2">Islands Architecture</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Selective hydration means smaller bundles and faster interactivity where it matters.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Interactive Islands</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            This counter component is an "island" - only this part of the page is hydrated with JavaScript.
          </p>
          <div className="flex justify-center">
            <Counter initialCount={0} />
          </div>
        </div>
      </section>

      {/* Server Data Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <h2 className="text-2xl font-bold mb-6">Server-Side Data</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This data was loaded on the server using a loader function:
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Blog Posts</div>
                <div className="text-3xl font-bold">{stats.posts}</div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rendered At</div>
                <div className="text-3xl font-bold">{stats.serverTime}</div>
              </div>
            </div>
            {featuredPost && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Featured Post</div>
                <h3 className="text-xl font-bold mb-2">
                  <a href={\`/blog/\${featuredPost.slug}\`} className="hover:text-primary-600">
                    {featuredPost.title}
                  </a>
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{featuredPost.excerpt}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/index.${ext}`), homePage);

  // ============================================================================
  // Blog Layout
  // ============================================================================
  const blogLayout = `
${ts ? 'interface BlogLayoutProps {\n  children: React.ReactNode;\n}\n' : ''}
export default function BlogLayout({ children }${ts ? ': BlogLayoutProps' : ''}) {
  return (
    <div className="min-h-screen">
      {/* Blog Header */}
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Blog</h1>
          <p className="text-primary-100">Tutorials, guides, and updates from the EreoJS team</p>
        </div>
      </div>

      {/* Blog Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {children}
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/blog/_layout.${ext}`), blogLayout);

  // ============================================================================
  // Blog Index
  // ============================================================================
  const blogIndex = `
import { PostCard } from '~/components/PostCard';
import { getAllPosts, simulateDelay } from '~/lib/data';

/**
 * Loader for the blog index page.
 */
export async function loader() {
  await simulateDelay(50);
  const posts = getAllPosts();
  return { posts };
}

${ts ? `interface BlogIndexProps {
  loaderData: {
    posts: Array<{
      slug: string;
      title: string;
      excerpt: string;
      author: string;
      date: string;
      readTime: string;
      tags: string[];
    }>;
  };
}\n` : ''}
export default function BlogIndex({ loaderData }${ts ? ': BlogIndexProps' : ''}) {
  const { posts } = loaderData;

  return (
    <div>
      <div className="grid gap-6">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/blog/index.${ext}`), blogIndex);

  // ============================================================================
  // Blog Post Page (Dynamic Route)
  // ============================================================================
  const blogPost = `
import { getPostBySlug, simulateDelay } from '~/lib/data';

/**
 * Loader for individual blog posts.
 * The [slug] in the filename creates a dynamic route parameter.
 */
export async function loader({ params }${ts ? ': { params: { slug: string } }' : ''}) {
  await simulateDelay(50);

  const post = getPostBySlug(params.slug);

  if (!post) {
    throw new Response('Post not found', { status: 404 });
  }

  return { post };
}

${ts ? `interface BlogPostProps {
  loaderData: {
    post: {
      slug: string;
      title: string;
      content: string;
      author: string;
      date: string;
      readTime: string;
      tags: string[];
    };
  };
}\n` : ''}
export default function BlogPost({ loaderData }${ts ? ': BlogPostProps' : ''}) {
  const { post } = loaderData;

  return (
    <article>
      {/* Post Header */}
      <header className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-sm font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
          <span>{post.author}</span>
          <span>&bull;</span>
          <span>{post.date}</span>
          <span>&bull;</span>
          <span>{post.readTime}</span>
        </div>
      </header>

      {/* Post Content */}
      <div className="prose dark:prose-invert prose-lg max-w-none">
        {/* In a real app, you'd use a markdown renderer here */}
        <div className="whitespace-pre-wrap font-serif leading-relaxed">
          {post.content}
        </div>
      </div>

      {/* Back Link */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <a href="/blog" className="text-primary-600 hover:underline">
          &larr; Back to all posts
        </a>
      </div>
    </article>
  );
}

/**
 * Error boundary for this route.
 * Shown when the loader throws an error (e.g., post not found).
 */
export function ErrorBoundary({ error }${ts ? ': { error: Error }' : ''}) {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold mb-4">Post Not Found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        The blog post you're looking for doesn't exist.
      </p>
      <a href="/blog" className="btn btn-primary">
        Back to Blog
      </a>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/blog/[slug].${ext}`), blogPost);

  // ============================================================================
  // Contact Page with Form Action
  // ============================================================================
  const contactPage = `
'use client';

import { useState } from 'react';

/**
 * Action handler for the contact form.
 * Runs on the server when the form is submitted.
 */
export async function action({ request }${ts ? ': { request: Request }' : ''}) {
  const formData = await request.formData();

  const name = formData.get('name')${ts ? ' as string' : ''};
  const email = formData.get('email')${ts ? ' as string' : ''};
  const message = formData.get('message')${ts ? ' as string' : ''};

  // Validate the form data
  const errors${ts ? ': Record<string, string>' : ''} = {};

  if (!name || name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!email || !email.includes('@')) {
    errors.email = 'Please enter a valid email address';
  }
  if (!message || message.length < 10) {
    errors.message = 'Message must be at least 10 characters';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // In a real app, you would:
  // - Save to database
  // - Send email notification
  // - etc.

  console.log('Contact form submission:', { name, email, message });

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 500));

  return { success: true, message: 'Thank you for your message! We\\'ll get back to you soon.' };
}

${ts ? `interface ContactPageProps {
  actionData?: {
    success: boolean;
    message?: string;
    errors?: Record<string, string>;
  };
}\n` : ''}
export default function ContactPage({ actionData }${ts ? ': ContactPageProps' : ''}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e${ts ? ': React.FormEvent<HTMLFormElement>' : ''}) => {
    setIsSubmitting(true);
    // Form will be handled by the action
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Have a question or feedback? We'd love to hear from you.
        </p>

        {actionData?.success ? (
          <div className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-800 dark:text-green-200">{actionData.message}</p>
            </div>
          </div>
        ) : (
          <form method="POST" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="input"
                placeholder="Your name"
              />
              {actionData?.errors?.name && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="input"
                placeholder="you@example.com"
              />
              {actionData?.errors?.email && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="input"
                placeholder="Your message..."
              />
              {actionData?.errors?.message && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/contact.${ext}`), contactPage);

  // ============================================================================
  // About Page
  // ============================================================================
  const aboutPage = `
export default function AboutPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">About ${projectName}</h1>

        <div className="prose dark:prose-invert prose-lg max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            This project was created with EreoJS, a modern React fullstack framework built on Bun.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="card">
              <h3 className="text-xl font-bold mb-3">Features Demonstrated</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Server-side rendering with loaders
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  File-based routing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Dynamic routes with [slug]
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Nested layouts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Form actions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Islands architecture
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Error boundaries
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Tailwind CSS styling
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold mb-3">Project Structure</h3>
              <pre className="text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto">
{\`app/
├── components/
│   ├── Counter.tsx
│   ├── Footer.tsx
│   ├── Navigation.tsx
│   └── PostCard.tsx
├── lib/
│   ├── data.ts
│   └── types.ts
├── routes/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── about.tsx
│   ├── contact.tsx
│   └── blog/
│       ├── _layout.tsx
│       ├── index.tsx
│       └── [slug].tsx
└── styles.css\`}
              </pre>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-bold mb-3">Learn More</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Check out the documentation and resources to learn how to build with EreoJS:
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://ereo.dev/docs"
                target="_blank"
                rel="noopener"
                className="btn btn-primary"
              >
                Documentation
              </a>
              <a
                href="https://github.com/ereo-js/ereo"
                target="_blank"
                rel="noopener"
                className="btn btn-secondary"
              >
                GitHub Repository
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/about.${ext}`), aboutPage);

  // ============================================================================
  // Error Page
  // ============================================================================
  const errorPage = `
${ts ? 'interface ErrorPageProps {\n  error: Error;\n}\n' : ''}
/**
 * Global error boundary.
 * This catches any unhandled errors in the app.
 */
export default function ErrorPage({ error }${ts ? ': ErrorPageProps' : ''}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-6xl mb-4">😵</div>
        <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <a href="/" className="btn btn-primary">
          Go Home
        </a>
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/_error.${ext}`), errorPage);

  // ============================================================================
  // 404 Page
  // ============================================================================
  const notFoundPage = `
/**
 * Custom 404 page.
 * Shown when no route matches the URL.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</div>
        <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a href="/" className="btn btn-primary">
          Go Home
        </a>
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/_404.${ext}`), notFoundPage);

  // ============================================================================
  // .gitignore
  // ============================================================================
  await Bun.write(
    join(projectDir, '.gitignore'),
    `node_modules
.ereo
dist
*.log
.DS_Store
.env
.env.local
.env.*.local`
  );

  // ============================================================================
  // .env.example
  // ============================================================================
  await Bun.write(
    join(projectDir, '.env.example'),
    `# Environment Variables
# Copy this file to .env and fill in your values

# Node environment
NODE_ENV=development

# Server port (optional, defaults to 3000)
# PORT=3000

# Database URL (if using database)
# DATABASE_URL=

# API keys (if needed)
# API_KEY=`
  );

  // ============================================================================
  // README
  // ============================================================================
  const readme = `# ${projectName}

A modern web application built with [EreoJS](https://github.com/ereo-js/ereo) - a React fullstack framework powered by Bun.

## Features

This project demonstrates:

- **Server-Side Rendering** - Fast initial loads with SSR
- **File-Based Routing** - Intuitive \`app/routes\` structure
- **Data Loading** - Server loaders for data fetching
- **Form Actions** - Handle mutations with actions
- **Dynamic Routes** - \`[slug]\` parameters
- **Nested Layouts** - Shared layouts per route segment
- **Islands Architecture** - Selective hydration for interactivity
- **Error Boundaries** - Graceful error handling
- **Tailwind CSS** - Utility-first styling

## Getting Started

\`\`\`bash
# Install dependencies
bun install

# Start development server
bun run dev

# Open http://localhost:3000
\`\`\`

## Project Structure

\`\`\`
app/
├── components/          # Reusable React components
│   ├── Counter.tsx      # Interactive island example
│   ├── Footer.tsx
│   ├── Navigation.tsx
│   └── PostCard.tsx
├── lib/                 # Shared utilities and data
│   ├── data.ts          # Mock data and helpers
│   └── types.ts         # TypeScript types
├── routes/              # File-based routes
│   ├── _layout.tsx      # Root layout
│   ├── _error.tsx       # Error boundary
│   ├── _404.tsx         # Not found page
│   ├── index.tsx        # Home page (/)
│   ├── about.tsx        # About page (/about)
│   ├── contact.tsx      # Contact form (/contact)
│   └── blog/
│       ├── _layout.tsx  # Blog layout
│       ├── index.tsx    # Blog list (/blog)
│       └── [slug].tsx   # Blog post (/blog/:slug)
└── styles.css           # Global styles with Tailwind
\`\`\`

## Scripts

- \`bun run dev\` - Start development server
- \`bun run build\` - Build for production
- \`bun run start\` - Start production server
- \`bun test\` - Run tests
- \`bun run typecheck\` - TypeScript type checking

## Learn More

- [EreoJS Documentation](https://ereo.dev/docs)
- [Bun Documentation](https://bun.sh/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
`;

  await Bun.write(join(projectDir, 'README.md'), readme);
}

/**
 * Generate project files.
 */
async function generateProject(
  projectDir: string,
  projectName: string,
  options: CreateOptions
): Promise<void> {
  const { template, typescript } = options;

  if (template === 'minimal') {
    await generateMinimalProject(projectDir, projectName, typescript);
  } else {
    // Both 'default' and 'tailwind' use the full template
    await generateTailwindProject(projectDir, projectName, typescript);
  }
}

/**
 * Initialize git repository.
 */
async function initGit(projectDir: string): Promise<void> {
  try {
    const proc = Bun.spawn(['git', 'init'], {
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
  } catch {
    console.log('  \x1b[33m!\x1b[0m Git initialization skipped');
  }
}

/**
 * Install dependencies.
 */
async function installDeps(projectDir: string): Promise<void> {
  console.log('\n  Installing dependencies...\n');

  const proc = Bun.spawn(['bun', 'install'], {
    cwd: projectDir,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await proc.exited;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  printBanner();

  const args = process.argv.slice(2);
  const { projectName, options } = parseArgs(args);

  if (!projectName) {
    console.error('  \x1b[31m✗\x1b[0m Please provide a project name\n');
    printHelp();
    process.exit(1);
  }

  // Validate project name
  if (/[<>:"|?*]/.test(projectName) || projectName.startsWith('.')) {
    console.error('  \x1b[31m✗\x1b[0m Invalid project name. Avoid special characters and leading dots.\n');
    process.exit(1);
  }

  const finalOptions: CreateOptions = { ...defaultOptions, ...options };
  const projectDir = resolve(process.cwd(), projectName);

  // Prevent path traversal
  if (!projectDir.startsWith(process.cwd())) {
    console.error('  \x1b[31m✗\x1b[0m Invalid project name: path traversal detected.\n');
    process.exit(1);
  }

  console.log(`  Creating \x1b[36m${projectName}\x1b[0m...\n`);
  console.log(`  Template: ${finalOptions.template}`);
  console.log(`  TypeScript: ${finalOptions.typescript ? 'Yes' : 'No'}\n`);

  // Generate project
  await generateProject(projectDir, projectName, finalOptions);
  console.log('  \x1b[32m✓\x1b[0m Project files created');

  // Initialize git
  if (finalOptions.git) {
    await initGit(projectDir);
    console.log('  \x1b[32m✓\x1b[0m Git initialized');
  }

  // Install dependencies
  if (finalOptions.install) {
    await installDeps(projectDir);
  }

  console.log(`
  \x1b[32m✓\x1b[0m Done! Your project is ready.

  Next steps:

    \x1b[36mcd ${projectName}\x1b[0m
    ${!finalOptions.install ? '\x1b[36mbun install\x1b[0m\n    ' : ''}\x1b[36mbun run dev\x1b[0m

  Open http://localhost:3000 to see your app.

  Happy coding!
`);
}

main().catch(console.error);
