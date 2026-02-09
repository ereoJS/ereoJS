#!/usr/bin/env bun
/**
 * create-ereo
 *
 * Scaffold a new EreoJS project.
 * Usage: bunx create-ereo@latest my-app
 */

import { join, resolve, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

/**
 * Read the CLI's own version to use as the @ereo/* dependency version.
 * All @ereo packages are published at the same version.
 */
const pkgJsonPath = join(dirname(import.meta.dir), 'package.json');
const LOCAL_VERSION: string = (await Bun.file(pkgJsonPath).json()).version;
const EREO_VERSION = `^${LOCAL_VERSION}`;

/**
 * Check npm registry for the latest version and warn if outdated.
 * Runs with a short timeout so it never blocks project creation.
 */
async function checkForUpdates(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://registry.npmjs.org/create-ereo/latest', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return;

    const { version: latest } = (await res.json()) as { version: string };

    if (latest && latest !== LOCAL_VERSION) {
      console.log(
        `  \x1b[33m⚠\x1b[0m  You are running \x1b[1mcreate-ereo@${LOCAL_VERSION}\x1b[0m.`
      );
      console.log(
        `     The latest version is \x1b[1m\x1b[32m${latest}\x1b[0m. Update with:\n`
      );
      console.log(
        `     \x1b[36mbunx create-ereo@latest ${process.argv[2] ?? '<project-name>'}\x1b[0m\n`
      );
    }
  } catch {
    // Network errors, timeouts, etc. — silently continue
  }
}

/**
 * Available templates.
 */
type Template = 'minimal' | 'default' | 'tailwind' | 'tasks';

/**
 * Create options.
 */
interface CreateOptions {
  template: Template;
  typescript: boolean;
  git: boolean;
  install: boolean;
  trace: boolean;
}

/**
 * Default options.
 */
const defaultOptions: CreateOptions = {
  template: 'tailwind',
  typescript: true,
  git: true,
  install: true,
  trace: false,
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
    bunx create-ereo@latest <project-name> [options]

  \x1b[1mOptions:\x1b[0m
    -t, --template <name>   Template to use (minimal, default, tailwind, tasks)
    --no-typescript         Use JavaScript instead of TypeScript
    --no-git                Skip git initialization
    --no-install            Skip package installation
    --trace                 Include @ereo/trace for full-stack observability

  \x1b[1mTemplates:\x1b[0m
    tailwind (default)  Landing page with blog, Tailwind CSS styling
    minimal             Bare-bones starting point
    tasks               Full-stack CRUD app with auth + SQLite database

  \x1b[1mExamples:\x1b[0m
    bunx create-ereo@latest my-app
    bunx create-ereo@latest my-app --template tasks
    bunx create-ereo@latest my-app --template minimal
    bunx create-ereo@latest my-app --no-typescript
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
      if (tmpl !== 'minimal' && tmpl !== 'default' && tmpl !== 'tailwind' && tmpl !== 'tasks') {
        console.error(`  \x1b[31m✗\x1b[0m Unknown template "${tmpl}". Valid options: minimal, default, tailwind, tasks\n`);
        process.exit(1);
      }
      options.template = tmpl;
    } else if (arg === '--no-typescript') {
      options.typescript = false;
    } else if (arg === '--no-git') {
      options.git = false;
    } else if (arg === '--no-install') {
      options.install = false;
    } else if (arg === '--trace') {
      options.trace = true;
    } else if (!arg.startsWith('-') && !projectName) {
      projectName = arg;
    }
  }

  return { projectName, options };
}

/**
 * Generate an optimized multi-stage Dockerfile for production.
 */
function generateDockerfile(_typescript: boolean): string {
  return `# ---- Stage 1: Install all deps + build ----
FROM oven/bun:1-slim AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --ignore-scripts
COPY . .
RUN bun run build

# ---- Stage 2: Production dependencies only ----
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production --ignore-scripts

# ---- Stage 3: Production image ----
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S -g 1001 ereo && \\
    adduser -S -u 1001 -G ereo -H ereo

# Copy production node_modules
COPY --from=deps --chown=ereo:ereo /app/node_modules ./node_modules

# Copy build output and runtime files
COPY --from=builder --chown=ereo:ereo /app/.ereo        ./.ereo
COPY --from=builder --chown=ereo:ereo /app/app          ./app
COPY --from=builder --chown=ereo:ereo /app/public       ./public
COPY --from=builder --chown=ereo:ereo /app/package.json ./
COPY --from=builder --chown=ereo:ereo /app/ereo.config.* ./
COPY --from=builder --chown=ereo:ereo /app/tsconfig.*    ./

USER ereo

EXPOSE 3000

CMD ["bun", "run", "start"]
`;
}

/**
 * Generate a .dockerignore to keep the build context small.
 */
function generateDockerignore(): string {
  return `node_modules
dist
.ereo
.git
.gitignore
.env
.env.*
!.env.example
Dockerfile
*.log
*.md
.DS_Store
.vscode
.idea
coverage
*.tgz
`;
}

/**
 * Generate a minimal project.
 */
async function generateMinimalProject(
  projectDir: string,
  projectName: string,
  typescript: boolean,
  trace: boolean = false
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
      dev: trace ? 'ereo dev --trace' : 'ereo dev',
      build: 'ereo build',
      start: 'ereo start',
    },
    dependencies: {
      '@ereo/core': EREO_VERSION,
      '@ereo/router': EREO_VERSION,
      '@ereo/server': EREO_VERSION,
      '@ereo/client': EREO_VERSION,
      '@ereo/data': EREO_VERSION,
      '@ereo/cli': EREO_VERSION,
      '@ereo/runtime-bun': EREO_VERSION,
      ...(trace ? { '@ereo/trace': EREO_VERSION } : {}),
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@ereo/bundler': EREO_VERSION,
      ...(typescript
        ? {
            '@types/bun': '^1.1.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.4.0',
          }
        : {}),
    },
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
        <style dangerouslySetInnerHTML={{ __html: \`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --brand-500: #6366f1;
            --brand-600: #4f46e5;
            --brand-400: #818cf8;
            --purple-500: #8b5cf6;
            --violet-500: #a855f7;
            --bg: #ffffff;
            --bg-soft: #f8fafc;
            --bg-card: #ffffff;
            --text: #0f172a;
            --text-soft: #64748b;
            --border: #e2e8f0;
            --code-bg: #1e1e2e;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0f172a;
              --bg-soft: #1e293b;
              --bg-card: #1e293b;
              --text: #f1f5f9;
              --text-soft: #94a3b8;
              --border: #334155;
              --code-bg: #0f172a;
            }
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; position: relative; overflow: hidden; }
          .hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%); pointer-events: none; }
          .hero-logo { animation: float 4s ease-in-out infinite; margin-bottom: 2rem; }
          .gradient-text { background: linear-gradient(135deg, var(--brand-500), var(--purple-500), var(--violet-500)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; background-size: 200% 200%; animation: gradientShift 6s ease infinite; }
          .hero h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 1rem; animation: fadeInUp 0.6s ease both; }
          .hero p { font-size: 1.25rem; color: var(--text-soft); max-width: 540px; margin-bottom: 2rem; animation: fadeInUp 0.6s ease 0.15s both; }
          .btn-group { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; animation: fadeInUp 0.6s ease 0.3s both; }
          .cta-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: 600; font-size: 0.95rem; text-decoration: none; transition: all 0.2s; }
          .cta-btn-primary { background: var(--brand-500); color: white; }
          .cta-btn-primary:hover { background: var(--brand-600); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }
          .cta-btn-secondary { border: 2px solid var(--border); color: var(--text); background: transparent; }
          .cta-btn-secondary:hover { border-color: var(--brand-500); color: var(--brand-500); }
          .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; max-width: 72rem; margin: 0 auto; padding: 5rem 2rem; }
          .feature-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; transition: all 0.25s; }
          .feature-card:hover { border-color: var(--brand-400); transform: translateY(-4px); box-shadow: 0 12px 32px rgba(99,102,241,0.1); }
          .feature-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); }
          .feature-card h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; }
          .feature-card p { color: var(--text-soft); font-size: 0.925rem; }
          .code-window { background: var(--code-bg); border-radius: 1rem; overflow: hidden; max-width: 540px; margin: 0 auto; text-align: left; animation: fadeInUp 0.6s ease 0.45s both; }
          .code-header { display: flex; align-items: center; gap: 6px; padding: 0.875rem 1.25rem; background: rgba(255,255,255,0.05); }
          .code-dot { width: 12px; height: 12px; border-radius: 50%; }
          .code-dot-r { background: #ff5f57; }
          .code-dot-y { background: #febc2e; }
          .code-dot-g { background: #28c840; }
          .code-body { padding: 1.25rem; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; font-size: 0.875rem; color: #a5b4fc; line-height: 1.8; }
          .code-body .prompt { color: #6ee7b7; }
          .quickstart-section { background: var(--bg-soft); padding: 5rem 2rem; text-align: center; }
          .quickstart-section h2 { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
          .quickstart-section .subtitle { color: var(--text-soft); margin-bottom: 2rem; }
          .site-footer { text-align: center; padding: 3rem 2rem; color: var(--text-soft); font-size: 0.875rem; border-top: 1px solid var(--border); }
          .site-footer a { color: var(--brand-500); text-decoration: none; }
          .site-footer a:hover { text-decoration: underline; }
        \` }} />
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
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero-logo">
          <svg width="72" height="72" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M40 8L72 24V56L40 72L8 56V24L40 8Z" stroke="url(#logo-grad)" strokeWidth="3" fill="none" />
            <path d="M40 20L60 30V50L40 60L20 50V30L40 20Z" fill="url(#logo-grad)" opacity="0.15" />
            <path d="M40 28L52 34V46L40 52L28 46V34L40 28Z" fill="url(#logo-grad)" />
            <defs>
              <linearGradient id="logo-grad" x1="8" y1="8" x2="72" y2="72">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1><span className="gradient-text">EreoJS</span></h1>
        <p>A React fullstack framework built on Bun. Fast server-side rendering, file-based routing, and islands architecture.</p>
        <div className="btn-group">
          <a href="https://ereojs.github.io/ereoJS/" className="cta-btn cta-btn-primary">Get Started</a>
          <a href="https://github.com/ereoJS/ereoJS" className="cta-btn cta-btn-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <h3>Bun-Powered</h3>
          <p>Built on Bun for blazing-fast startup, builds, and runtime performance.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          </div>
          <h3>File Routing</h3>
          <p>Intuitive file-based routing with nested layouts and dynamic segments.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <h3>Server-Side Rendering</h3>
          <p>Stream HTML from the server for fast, SEO-friendly initial page loads.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
          </div>
          <h3>Islands Architecture</h3>
          <p>Selective hydration — only interactive parts ship JavaScript to the client.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <h3>Loaders &amp; Actions</h3>
          <p>Server-side data loading and form handling with simple async functions.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          </div>
          <h3>TypeScript First</h3>
          <p>Full type safety out of the box with zero-config TypeScript support.</p>
        </div>
      </div>

      {/* Quick Start */}
      <section className="quickstart-section">
        <h2>Get Started in Seconds</h2>
        <p className="subtitle">One command to scaffold your project.</p>
        <div className="code-window">
          <div className="code-header">
            <span className="code-dot code-dot-r" />
            <span className="code-dot code-dot-y" />
            <span className="code-dot code-dot-g" />
          </div>
          <div className="code-body">
            <div><span className="prompt">$</span> bunx create-ereo@latest my-app</div>
            <div><span className="prompt">$</span> cd my-app</div>
            <div><span className="prompt">$</span> bun run dev</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <p>Built with EreoJS &mdash; <a href="https://ereojs.github.io/ereoJS/">Docs</a> &middot; <a href="https://github.com/ereoJS/ereoJS">GitHub</a></p>
      </footer>
    </>
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
        baseUrl: '.',
        paths: {
          '~/*': ['./app/*'],
          '@/*': ['./app/*'],
        },
      },
      include: ['app/**/*', '*.config.ts'],
    };

    await Bun.write(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  } else {
    const jsconfig = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '~/*': ['./app/*'],
          '@/*': ['./app/*'],
        },
      },
      include: ['app/**/*'],
    };

    await Bun.write(join(projectDir, 'jsconfig.json'), JSON.stringify(jsconfig, null, 2));
  }

  // .gitignore
  await Bun.write(
    join(projectDir, '.gitignore'),
    'node_modules\n.ereo\ndist\n*.log\n.DS_Store\n.env\n.env.local'
  );

  // Dockerfile
  await Bun.write(join(projectDir, 'Dockerfile'), generateDockerfile(typescript));

  // .dockerignore
  await Bun.write(join(projectDir, '.dockerignore'), generateDockerignore());
}

/**
 * Generate the full tailwind project with all features.
 */
async function generateTailwindProject(
  projectDir: string,
  projectName: string,
  typescript: boolean,
  trace: boolean = false
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
      dev: trace ? 'ereo dev --trace' : 'ereo dev',
      build: 'ereo build',
      start: 'ereo start',
      test: 'bun test',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@ereo/core': EREO_VERSION,
      '@ereo/router': EREO_VERSION,
      '@ereo/server': EREO_VERSION,
      '@ereo/client': EREO_VERSION,
      '@ereo/data': EREO_VERSION,
      '@ereo/cli': EREO_VERSION,
      '@ereo/runtime-bun': EREO_VERSION,
      ...(trace ? { '@ereo/trace': EREO_VERSION } : {}),
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@ereo/bundler': EREO_VERSION,
      '@ereo/testing': EREO_VERSION,
      '@ereo/dev-inspector': EREO_VERSION,
      '@ereo/plugin-tailwind': EREO_VERSION,
      tailwindcss: '^3.4.0',
      ...(ts
        ? {
            '@types/bun': '^1.1.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.4.0',
          }
        : {}),
    },
  };

  await Bun.write(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // ============================================================================
  // ereo.config.ts
  // ============================================================================
  const ereoConfig = `
import { defineConfig } from '@ereo/core';

const plugins = [];

// Tailwind is a dev/build dependency — skip in production
if (process.env.NODE_ENV !== 'production') {
  const { default: tailwind } = await import('@ereo/plugin-tailwind');
  plugins.push(tailwind());
}

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'bun',
  },
  plugins,
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
        baseUrl: '.',
        paths: {
          '~/*': ['./app/*'],
          '@/*': ['./app/*'],
        },
      },
      include: ['app/**/*', '*.config.ts'],
    };

    await Bun.write(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  } else {
    const jsconfig = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '~/*': ['./app/*'],
          '@/*': ['./app/*'],
        },
      },
      include: ['app/**/*'],
    };

    await Bun.write(join(projectDir, 'jsconfig.json'), JSON.stringify(jsconfig, null, 2));
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
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.6s ease forwards',
        'float': 'float 4s ease-in-out infinite',
        'gradient': 'gradientShift 6s ease infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
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
    @apply antialiased font-sans;
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2;
  }
  .btn-primary {
    @apply bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 hover:-translate-y-0.5 hover:shadow-lg;
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
  .gradient-text {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-primary-500 via-purple-500 to-violet-500;
    background-size: 200% 200%;
    animation: gradientShift 6s ease infinite;
  }
  .code-window {
    @apply rounded-xl overflow-hidden;
    background: #1e1e2e;
  }
  .code-window-header {
    @apply flex items-center gap-1.5 px-4 py-3;
    background: rgba(255, 255, 255, 0.05);
  }
  .code-window-dot {
    @apply w-3 h-3 rounded-full;
  }
  .glow {
    box-shadow: 0 0 40px rgba(99, 102, 241, 0.15), 0 0 80px rgba(99, 102, 241, 0.05);
  }
}

@layer utilities {
  .delay-100 { animation-delay: 100ms; }
  .delay-200 { animation-delay: 200ms; }
  .delay-300 { animation-delay: 300ms; }
  .delay-400 { animation-delay: 400ms; }
  .delay-500 { animation-delay: 500ms; }
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

  const tracingBlogPost = trace ? `
  {
    slug: 'full-stack-tracing',
    title: 'Full-Stack Tracing with @ereo/trace',
    excerpt: 'See every request from HTTP to database in a beautiful timeline. Zero-config observability for your EreoJS app.',
    content: \`
# Full-Stack Tracing with @ereo/trace

EreoJS includes built-in full-stack observability that traces every request across all 11 framework layers.

## Enabling Tracing

Tracing is already configured in this project! Run \\\`bun run dev\\\` and open http://localhost:3000/__ereo/traces to see the trace viewer.

## What Gets Traced

- **Request lifecycle** — HTTP method, path, status, total duration
- **Route matching** — Which route patterns matched, layout chains
- **Data loading** — Loader execution time, cache hits/misses
- **Form actions** — Validation, processing, error counts
- **Database queries** — SQL statements, row counts, duration

## CLI Output

The CLI reporter shows a live tree view of every request:

\\\`\\\`\\\`
  GET    /blog  200  42.1ms
  |-- routing       1.2ms   matched /blog
  |-- data         38.4ms
  |   |-- posts    35.1ms  db query
  \\\\\\\`-- render       2.5ms
\\\`\\\`\\\`

## Production

For production, alias \\\`@ereo/trace\\\` to \\\`@ereo/trace/noop\\\` — a 592-byte no-op that tree-shakes to zero runtime cost.
    \`.trim(),
    author: 'EreoJS Team',
    date: '2024-02-01',
    readTime: '3 min read',
    tags: ['ereo', 'tracing', 'devtools'],
  },` : '';

  const mockData = `
${ts ? "import type { Post } from '~/lib/types';\n" : ''}
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
bunx create-ereo@latest my-app
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
  },${tracingBlogPost}
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
 * Simulate API delay for demo purposes.${trace ? '\n * When tracing is enabled, these delays create visible spans in the trace viewer.' : ''}
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
const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About' },
];

export function Navigation() {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-2 group">
            <svg width="28" height="28" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:scale-110">
              <path d="M40 8L72 24V56L40 72L8 56V24L40 8Z" stroke="url(#nav-grad)" strokeWidth="3" fill="none" />
              <path d="M40 28L52 34V46L40 52L28 46V34L40 28Z" fill="url(#nav-grad)" />
              <defs>
                <linearGradient id="nav-grad" x1="8" y1="8" x2="72" y2="72">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
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

          {/* Mobile Navigation - uses native <details> for JS-free toggle */}
          <details className="md:hidden relative">
            <summary className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </details>
        </div>
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
            <a href="https://github.com/ereoJS/ereoJS" target="_blank" rel="noopener" className="hover:text-primary-600">
              GitHub
            </a>
            <a href="https://ereojs.github.io/ereoJS/" target="_blank" rel="noopener" className="hover:text-primary-600">
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
        <link rel="stylesheet" href="/__tailwind.css" />
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
  // Client Entry Point
  // ============================================================================
  const clientEntry = `
/**
 * Client Entry Point
 *
 * This file initializes the client-side runtime:
 * - Hydrates island components marked with 'use client'
 * - Sets up client-side navigation
 * - Enables link prefetching
 */
import { initClient } from '@ereo/client';

// Initialize the EreoJS client runtime
initClient();
`.trim();

  await Bun.write(join(projectDir, `app/entry.client.${ext}`), clientEntry);

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
    <div>
      {/* Hero */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-transparent to-transparent dark:from-primary-950/30 dark:via-transparent dark:to-transparent" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Logo */}
          <div className="animate-float mb-8 opacity-0 animate-fade-in">
            <svg width="72" height="72" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M40 8L72 24V56L40 72L8 56V24L40 8Z" stroke="url(#hero-grad)" strokeWidth="3" fill="none" />
              <path d="M40 20L60 30V50L40 60L20 50V30L40 20Z" fill="url(#hero-grad)" opacity="0.15" />
              <path d="M40 28L52 34V46L40 52L28 46V34L40 28Z" fill="url(#hero-grad)" />
              <defs>
                <linearGradient id="hero-grad" x1="8" y1="8" x2="72" y2="72">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Version Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6 opacity-0 animate-slide-up">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow" />
            v${EREO_VERSION.slice(1)}
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 opacity-0 animate-slide-up delay-100">
            Build Faster with <span className="gradient-text">EreoJS</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 opacity-0 animate-slide-up delay-200">
            A React fullstack framework built on Bun. Server-side rendering, file-based routing, and islands architecture out of the box.
          </p>

          {/* Terminal Preview */}
          <div className="code-window glow max-w-md mx-auto text-left opacity-0 animate-slide-up delay-300">
            <div className="code-window-header">
              <span className="code-window-dot bg-red-500" />
              <span className="code-window-dot bg-yellow-500" />
              <span className="code-window-dot bg-green-500" />
            </div>
            <div className="px-5 py-4 font-mono text-sm text-primary-300 leading-relaxed">
              <div><span className="text-emerald-400">$</span> bunx create-ereo@latest my-app</div>
              <div><span className="text-emerald-400">$</span> cd my-app</div>
              <div><span className="text-emerald-400">$</span> bun run dev</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mt-10 opacity-0 animate-slide-up delay-400">
            <a href="https://ereojs.github.io/ereoJS/" className="btn btn-primary text-base px-6 py-3">
              Get Started
            </a>
            <a href="/blog" className="btn btn-secondary text-base px-6 py-3">
              Read the Blog
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              EreoJS combines the best of React with Bun's performance to deliver a complete fullstack framework.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'bolt', title: 'Bun-Powered', desc: 'Lightning-fast startup, builds, and runtime. 10x faster than Node.js for common operations.' },
              { icon: 'folder', title: 'File Routing', desc: 'Intuitive file-based routing with nested layouts, dynamic segments, and automatic code splitting.' },
              { icon: 'server', title: 'Server-Side Rendering', desc: 'Stream HTML from the server for fast initial loads with full SEO support.' },
              { icon: 'island', title: 'Islands Architecture', desc: 'Selective hydration means only interactive parts ship JavaScript to the client.' },
              { icon: 'data', title: 'Loaders & Actions', desc: 'Simple async functions for server-side data loading and form handling.' },
              { icon: 'ts', title: 'TypeScript First', desc: 'Full type safety with zero-config TypeScript. Types flow from server to client.' },
            ].map((feature) => (
              <div key={feature.title} className="group card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-transparent hover:border-primary-200 dark:hover:border-primary-800">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-primary-100 to-purple-100 dark:from-primary-900/40 dark:to-purple-900/40 group-hover:from-primary-200 group-hover:to-purple-200 dark:group-hover:from-primary-900/60 dark:group-hover:to-purple-900/60 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {feature.icon === 'bolt' && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
                    {feature.icon === 'folder' && <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />}
                    {feature.icon === 'server' && <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>}
                    {feature.icon === 'island' && <><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></>}
                    {feature.icon === 'data' && <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>}
                    {feature.icon === 'ts' && <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>}
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Showcase */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, Powerful APIs</h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Loaders fetch data. Actions handle mutations. It's that simple.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="code-window">
              <div className="code-window-header">
                <span className="code-window-dot bg-red-500" />
                <span className="code-window-dot bg-yellow-500" />
                <span className="code-window-dot bg-green-500" />
                <span className="ml-3 text-xs text-gray-500 font-mono">routes/users.tsx</span>
              </div>
              <pre className="px-5 py-4 font-mono text-sm text-primary-300 leading-relaxed overflow-x-auto">
{\`// Data runs on the server
export async function loader() {
  const users = await db.user.findMany();
  return { users };
}

// Component renders on server + client
export default function Users({ loaderData }) {
  return (
    <ul>
      {loaderData.users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}\`}
              </pre>
            </div>
            <div className="code-window">
              <div className="code-window-header">
                <span className="code-window-dot bg-red-500" />
                <span className="code-window-dot bg-yellow-500" />
                <span className="code-window-dot bg-green-500" />
                <span className="ml-3 text-xs text-gray-500 font-mono">routes/contact.tsx</span>
              </div>
              <pre className="px-5 py-4 font-mono text-sm text-primary-300 leading-relaxed overflow-x-auto">
{\`// Actions handle form submissions
export async function action({ request }) {
  const form = await request.formData();
  await db.message.create({
    data: {
      name: form.get('name'),
      email: form.get('email'),
      body: form.get('message'),
    }
  });
  return { success: true };
}\`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card text-center border border-gray-200 dark:border-gray-700">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-medium mb-6">
              Interactive Island
            </div>
            <h2 className="text-3xl font-bold mb-3">Islands Architecture</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              This counter is an island — it's the only part of this page that ships JavaScript. The rest is pure HTML from the server.
            </p>
            <div className="flex justify-center">
              <Counter client:load initialCount={0} />
            </div>
          </div>
        </div>
      </section>

      {/* Server Data */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="card border border-gray-200 dark:border-gray-700">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-6">
              Server Loader Data
            </div>
            <h2 className="text-2xl font-bold mb-2">Loaded at Build Time</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This data was fetched on the server via a loader function — zero client-side fetching.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Blog Posts</div>
                <div className="text-4xl font-extrabold">{stats.posts}</div>
              </div>
              <div className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rendered At</div>
                <div className="text-4xl font-extrabold font-mono">{stats.serverTime}</div>
              </div>
            </div>
            {featuredPost && (
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Featured Post</div>
                <h3 className="text-xl font-bold mb-2">
                  <a href={\`/blog/\${featuredPost.slug}\`} className="hover:text-primary-600 transition-colors">
                    {featuredPost.title}
                  </a>
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{featuredPost.excerpt}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 px-4 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Build?</h2>
        <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">Get started with a single command.</p>
        <div className="code-window glow max-w-sm mx-auto mb-8">
          <div className="code-window-header">
            <span className="code-window-dot bg-red-500" />
            <span className="code-window-dot bg-yellow-500" />
            <span className="code-window-dot bg-green-500" />
          </div>
          <div className="px-5 py-3 font-mono text-sm text-primary-300">
            <span className="text-emerald-400">$</span> bunx create-ereo@latest my-app
          </div>
        </div>
        <div className="flex flex-wrap gap-4 justify-center">
          <a href="https://ereojs.github.io/ereoJS/" className="btn btn-primary text-base px-6 py-3">Documentation</a>
          <a href="https://github.com/ereoJS/ereoJS" target="_blank" rel="noopener" className="btn btn-secondary text-base px-6 py-3">GitHub</a>
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
${ts ? "import type { Post } from '~/lib/types';\n" : ''}
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
    posts: Post[];
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
/**
 * Action handler for the contact form.
 * Runs on the server when the form is submitted via POST.
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
          <form method="POST" className="space-y-6">
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
              className="btn btn-primary w-full"
            >
              Send Message
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
                </li>${trace ? `
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Full-stack tracing &amp; observability
                </li>` : ''}
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
                href="https://ereojs.github.io/ereoJS/"
                target="_blank"
                rel="noopener"
                className="btn btn-primary"
              >
                Documentation
              </a>
              <a
                href="https://github.com/ereoJS/ereoJS"
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
  // Dockerfile
  // ============================================================================
  await Bun.write(join(projectDir, 'Dockerfile'), generateDockerfile(typescript));

  // ============================================================================
  // .dockerignore
  // ============================================================================
  await Bun.write(join(projectDir, '.dockerignore'), generateDockerignore());

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

A modern web application built with [EreoJS](https://github.com/ereoJS/ereoJS) - a React fullstack framework powered by Bun.

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
- **Tailwind CSS** - Utility-first styling${trace ? `
- **Full-Stack Tracing** - Request-level observability with \`@ereo/trace\`` : ''}

## Getting Started

\`\`\`bash
# Install dependencies
bun install

# Start development server${trace ? ' (tracing enabled by default)' : ''}
bun run dev

# Open http://localhost:3000${trace ? `
# Open http://localhost:3000/__ereo/traces for the trace viewer` : ''}
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

${trace ? `## Tracing

This project includes \`@ereo/trace\` for full-stack observability.

- **CLI Reporter** — Live tree view in your terminal for every request
- **Trace Viewer** — Open http://localhost:3000/__ereo/traces for a timeline UI
- **11 Layers** — Traces request, routing, data, forms, signals, RPC, database, auth, islands, build, and errors

For production, alias \`@ereo/trace\` to \`@ereo/trace/noop\` in your bundler for zero runtime cost (592 bytes).

` : ''}## Learn More

- [EreoJS Documentation](https://ereojs.github.io/ereoJS/)
- [Bun Documentation](https://bun.sh/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
`;

  await Bun.write(join(projectDir, 'README.md'), readme);
}

/**
 * Generate a full-stack tasks CRUD project with authentication and SQLite.
 */
async function generateTasksProject(
  projectDir: string,
  projectName: string,
  typescript: boolean,
  trace: boolean = false
): Promise<void> {
  const ext = typescript ? 'tsx' : 'jsx';
  const ts = typescript;

  // Create all directories
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, 'app/routes/(auth)'), { recursive: true });
  await mkdir(join(projectDir, 'app/routes/tasks'), { recursive: true });
  await mkdir(join(projectDir, 'app/components'), { recursive: true });
  await mkdir(join(projectDir, 'app/lib'), { recursive: true });
  await mkdir(join(projectDir, 'public'), { recursive: true });
  await mkdir(join(projectDir, 'data'), { recursive: true });

  // ============================================================================
  // package.json
  // ============================================================================
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: trace ? 'ereo dev --trace' : 'ereo dev',
      build: 'ereo build',
      start: 'ereo start',
      test: 'bun test',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@ereo/core': EREO_VERSION,
      '@ereo/router': EREO_VERSION,
      '@ereo/server': EREO_VERSION,
      '@ereo/client': EREO_VERSION,
      '@ereo/data': EREO_VERSION,
      '@ereo/cli': EREO_VERSION,
      '@ereo/auth': EREO_VERSION,
      '@ereo/runtime-bun': EREO_VERSION,
      ...(trace ? { '@ereo/trace': EREO_VERSION } : {}),
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@ereo/bundler': EREO_VERSION,
      '@ereo/testing': EREO_VERSION,
      '@ereo/dev-inspector': EREO_VERSION,
      '@ereo/plugin-tailwind': EREO_VERSION,
      tailwindcss: '^3.4.0',
      ...(ts
        ? {
            '@types/bun': '^1.1.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.4.0',
          }
        : {}),
    },
  };

  await Bun.write(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // ============================================================================
  // ereo.config.ts
  // ============================================================================
  const ereoConfig = `
import { defineConfig } from '@ereo/core';
import { createAuthPlugin, credentials } from '@ereo/auth';

const plugins${ts ? ': any[]' : ''} = [];

// Tailwind CSS — dev/build only
if (process.env.NODE_ENV !== 'production') {
  const { default: tailwind } = await import('@ereo/plugin-tailwind');
  plugins.push(tailwind());
}

// Database & auth helpers
const { findUserByEmail, verifyPassword } = await import('./app/lib/db${ts ? '' : '.js'}');

// Authentication plugin — email/password with JWT sessions
plugins.push(
  createAuthPlugin({
    session: {
      strategy: 'jwt',
      secret: process.env.AUTH_SECRET || 'dev-only-please-change-in-production',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    },
    providers: [
      credentials({
        authorize: async (creds${ts ? ': Record<string, unknown>' : ''}) => {
          const email = creds.email as string;
          const password = creds.password as string;
          if (!email || !password) return null;

          const user = findUserByEmail(email);
          if (!user) return null;

          const valid = await verifyPassword(password, user.password_hash);
          if (!valid) return null;

          return { id: String(user.id), email: user.email, name: user.name };
        },
      }),
    ],
    cookie: {
      name: 'ereo.session',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'bun',
  },
  plugins,
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
        baseUrl: '.',
        paths: {
          '~/*': ['./app/*'],
          '@/*': ['./app/*'],
        },
      },
      include: ['app/**/*', '*.config.ts'],
    };

    await Bun.write(join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  } else {
    const jsconfig = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '~/*': ['./app/*'],
          '@/*': ['./app/*'],
        },
      },
      include: ['app/**/*'],
    };

    await Bun.write(join(projectDir, 'jsconfig.json'), JSON.stringify(jsconfig, null, 2));
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
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.6s ease forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
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
    @apply antialiased font-sans;
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center gap-2;
  }
  .btn-primary {
    @apply bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500;
  }
  .btn-secondary {
    @apply bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600;
  }
  .btn-danger {
    @apply bg-red-600 text-white hover:bg-red-700 focus:ring-red-500;
  }
  .btn-ghost {
    @apply bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 focus:ring-gray-500;
  }
  .btn-sm {
    @apply px-3 py-1.5 text-sm;
  }
  .input {
    @apply w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white;
  }
  .label {
    @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5;
  }
  .card {
    @apply bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6;
  }
  .badge {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
  }
}

@layer utilities {
  .delay-100 { animation-delay: 100ms; }
  .delay-200 { animation-delay: 200ms; }
  .delay-300 { animation-delay: 300ms; }
}
`.trim();

  await Bun.write(join(projectDir, 'app/styles.css'), styles);

  // ============================================================================
  // Database module — SQLite with migrations
  // ============================================================================
  const dbModule = `
import { Database } from 'bun:sqlite';
import { join } from 'node:path';

${ts ? `export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface TaskStats {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}\n` : ''}
/**
 * SQLite database with production-ready configuration.
 *
 * The database file is stored in the /data directory so it can be
 * easily mounted as a Docker volume for persistence.
 */
const DB_PATH = join(import.meta.dir, '../../data/app.db');

const db = new Database(DB_PATH, { create: true });

// Production-ready PRAGMA settings
db.exec('PRAGMA journal_mode = WAL');        // Better concurrent reads
db.exec('PRAGMA synchronous = NORMAL');      // Safe with WAL, much faster
db.exec('PRAGMA foreign_keys = ON');         // Enforce referential integrity
db.exec('PRAGMA cache_size = -64000');       // ~64MB cache
db.exec('PRAGMA busy_timeout = 5000');       // Wait 5s on lock contention

// ── Schema migrations ────────────────────────────────────────────────
db.exec(\`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE NOT NULL,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'todo'
                        CHECK (status IN ('todo', 'in_progress', 'done')),
    priority    TEXT    NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
\`);

// ── User operations ──────────────────────────────────────────────────

export function findUserByEmail(email${ts ? ': string' : ''})${ts ? ': User | null' : ''} {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email)${ts ? ' as User | null' : ''};
}

export function findUserById(id${ts ? ': number' : ''})${ts ? ': User | null' : ''} {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id)${ts ? ' as User | null' : ''};
}

export function createUser(email${ts ? ': string' : ''}, name${ts ? ': string' : ''}, passwordHash${ts ? ': string' : ''})${ts ? ': User' : ''} {
  return db.prepare(
    'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING *'
  ).get(email, name, passwordHash)${ts ? ' as User' : ''};
}

export function emailExists(email${ts ? ': string' : ''})${ts ? ': boolean' : ''} {
  const row = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  return row !== null;
}

// ── Task operations ──────────────────────────────────────────────────

export function getTasksByUser(
  userId${ts ? ': number' : ''},
  status${ts ? '?: string' : ''}
)${ts ? ': Task[]' : ''} {
  if (status && status !== 'all') {
    return db.prepare(
      \`SELECT * FROM tasks WHERE user_id = ? AND status = ?
       ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
       created_at DESC\`
    ).all(userId, status)${ts ? ' as Task[]' : ''};
  }
  return db.prepare(
    \`SELECT * FROM tasks WHERE user_id = ?
     ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
     created_at DESC\`
  ).all(userId)${ts ? ' as Task[]' : ''};
}

export function getTaskById(id${ts ? ': number' : ''}, userId${ts ? ': number' : ''})${ts ? ': Task | null' : ''} {
  return db.prepare(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
  ).get(id, userId)${ts ? ' as Task | null' : ''};
}

export function createTask(
  userId${ts ? ': number' : ''},
  title${ts ? ': string' : ''},
  description${ts ? ': string' : ''},
  status${ts ? ': string' : ''},
  priority${ts ? ': string' : ''}
)${ts ? ': Task' : ''} {
  return db.prepare(
    'INSERT INTO tasks (user_id, title, description, status, priority) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).get(userId, title, description, status, priority)${ts ? ' as Task' : ''};
}

export function updateTask(
  id${ts ? ': number' : ''},
  userId${ts ? ': number' : ''},
  title${ts ? ': string' : ''},
  description${ts ? ': string' : ''},
  status${ts ? ': string' : ''},
  priority${ts ? ': string' : ''}
)${ts ? ': Task | null' : ''} {
  return db.prepare(
    "UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ? RETURNING *"
  ).get(title, description, status, priority, id, userId)${ts ? ' as Task | null' : ''};
}

export function deleteTask(id${ts ? ': number' : ''}, userId${ts ? ': number' : ''})${ts ? ': boolean' : ''} {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

export function getTaskStats(userId${ts ? ': number' : ''})${ts ? ': TaskStats' : ''} {
  const rows = db.prepare(
    'SELECT status, COUNT(*) as count FROM tasks WHERE user_id = ? GROUP BY status'
  ).all(userId)${ts ? ' as { status: string; count: number }[]' : ''};

  const stats${ts ? ': TaskStats' : ''} = { todo: 0, in_progress: 0, done: 0, total: 0 };
  for (const row of rows) {
    stats[row.status${ts ? ' as keyof TaskStats' : ''}] = row.count;
    stats.total += row.count;
  }
  return stats;
}

// ── Password hashing — Bun built-in argon2id ─────────────────────────

export async function hashPassword(password${ts ? ': string' : ''})${ts ? ': Promise<string>' : ''} {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export async function verifyPassword(password${ts ? ': string' : ''}, hash${ts ? ': string' : ''})${ts ? ': Promise<boolean>' : ''} {
  return Bun.password.verify(password, hash);
}

export default db;
`.trim();

  await Bun.write(join(projectDir, `app/lib/db.${ts ? 'ts' : 'js'}`), dbModule);

  // ============================================================================
  // Types (TypeScript only)
  // ============================================================================
  if (ts) {
    const types = `
/**
 * Shared types for the application.
 */

export type { User, Task, TaskStats } from '~/lib/db';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}
`.trim();

    await Bun.write(join(projectDir, 'app/lib/types.ts'), types);
  }

  // ============================================================================
  // Component: Navigation (auth-aware)
  // ============================================================================
  const navigation = `
${ts ? `interface NavigationProps {
  user?: { name: string; email: string } | null;
}\n` : ''}
export function Navigation({ user }${ts ? ': NavigationProps' : ''}) {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href={user ? '/tasks' : '/'} className="flex items-center gap-2 group">
            <svg width="28" height="28" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:scale-110">
              <path d="M40 8L72 24V56L40 72L8 56V24L40 8Z" stroke="url(#nav-grad)" strokeWidth="3" fill="none" />
              <path d="M40 28L52 34V46L40 52L28 46V34L40 28Z" fill="url(#nav-grad)" />
              <defs>
                <linearGradient id="nav-grad" x1="8" y1="8" x2="72" y2="72">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-bold text-xl">${projectName}</span>
          </a>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <a href="/tasks" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors">
                  Tasks
                </a>
                <a href="/tasks/new" className="btn btn-primary btn-sm">
                  New Task
                </a>
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-medium text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{user.name}</span>
                  </button>
                  <div className="absolute right-0 mt-0 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    <form method="POST" action="/logout">
                      <button
                        type="submit"
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors">
                  Sign in
                </a>
                <a href="/register" className="btn btn-primary btn-sm">
                  Get Started
                </a>
              </>
            )}
          </div>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-3">
            {user ? (
              <>
                <a href="/tasks/new" className="btn btn-primary btn-sm">New</a>
                <form method="POST" action="/logout">
                  <button type="submit" className="text-sm text-red-600 hover:text-red-700">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors">
                  Sign in
                </a>
                <a href="/register" className="btn btn-primary btn-sm">
                  Get Started
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/components/Navigation.${ext}`), navigation);

  // ============================================================================
  // Component: Footer
  // ============================================================================
  const footer = `
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <span className="text-lg">&#x2B21;</span>
            <span>Built with EreoJS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <a href="https://ereojs.github.io/ereoJS/" target="_blank" rel="noopener" className="hover:text-primary-600 transition-colors">
              Docs
            </a>
            <a href="https://github.com/ereoJS/ereoJS" target="_blank" rel="noopener" className="hover:text-primary-600 transition-colors">
              GitHub
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
  // Component: TaskCard
  // ============================================================================
  const taskCard = `
${ts ? `interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    created_at: string;
    updated_at: string;
  };
}\n` : ''}
const statusConfig${ts ? ': Record<string, { label: string; color: string }>' : ''} = {
  todo: { label: 'To Do', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  done: { label: 'Done', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
};

const priorityConfig${ts ? ': Record<string, { label: string; color: string; icon: string }>' : ''} = {
  high: { label: 'High', color: 'text-red-600 dark:text-red-400', icon: '!!!' },
  medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', icon: '!!' },
  low: { label: 'Low', color: 'text-gray-400 dark:text-gray-500', icon: '!' },
};

export function TaskCard({ task }${ts ? ': TaskCardProps' : ''}) {
  const status = statusConfig[task.status] || statusConfig.todo;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;

  return (
    <a
      href={\`/tasks/\${task.id}\`}
      className="card hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all group block"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={\`badge \${status.color}\`}>{status.label}</span>
            <span className={\`text-xs font-mono font-bold \${priority.color}\`}>
              {priority.icon}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
        {task.updated_at !== task.created_at && (
          <span>Updated {new Date(task.updated_at).toLocaleDateString()}</span>
        )}
      </div>
    </a>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/components/TaskCard.${ext}`), taskCard);

  // ============================================================================
  // Root Layout
  // ============================================================================
  const rootLayout = `
import { Navigation } from '~/components/Navigation';
import { Footer } from '~/components/Footer';
import { getAuth } from '@ereo/auth';

${ts ? 'interface RootLayoutProps {\n  children: React.ReactNode;\n  context: any;\n}\n' : ''}
export async function loader({ context }${ts ? ': { context: any }' : ''}) {
  let user = null;
  try {
    const auth = getAuth(context);
    if (auth.isAuthenticated()) {
      user = auth.getUser();
    }
  } catch {
    // Not authenticated
  }
  return { user };
}

export default function RootLayout({ children, loaderData }${ts ? ': RootLayoutProps & { loaderData: { user: any } }' : ''}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="${projectName} — A task management app built with EreoJS" />
        <title>${projectName}</title>
        <link rel="stylesheet" href="/__tailwind.css" />
      </head>
      <body className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
        <Navigation user={loaderData?.user} />
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
  // Landing Page
  // ============================================================================
  const indexPage = `
import { getAuth } from '@ereo/auth';

export async function loader({ context }${ts ? ': { context: any }' : ''}) {
  try {
    const auth = getAuth(context);
    if (auth.isAuthenticated()) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/tasks' },
      });
    }
  } catch {
    // Not authenticated — show landing page
  }
  return {};
}

export default function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-24 sm:py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-transparent to-transparent dark:from-primary-950/20" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6 opacity-0 animate-slide-up">
            Built with EreoJS + SQLite
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 opacity-0 animate-slide-up delay-100">
            Organize your work,{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-purple-500">
              ship faster
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 opacity-0 animate-slide-up delay-200">
            A full-stack task manager showcasing authentication, SQLite database,
            and CRUD operations — all powered by EreoJS and Bun.
          </p>

          <div className="flex flex-wrap gap-4 justify-center opacity-0 animate-slide-up delay-300">
            <a href="/register" className="btn btn-primary text-base px-6 py-3">
              Get Started Free
            </a>
            <a href="/login" className="btn btn-secondary text-base px-6 py-3">
              Sign In
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Email & Password Auth',
                desc: 'Secure authentication with argon2id password hashing, JWT sessions, and protected routes.',
                icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
              },
              {
                title: 'SQLite + WAL Mode',
                desc: 'Production-ready SQLite with Write-Ahead Logging, prepared statements, and automatic migrations.',
                icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
              },
              {
                title: 'Full CRUD Operations',
                desc: 'Create, read, update, and delete tasks with server-side validation and error handling.',
                icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
              },
              {
                title: 'Server-Side Rendering',
                desc: 'Fast initial loads with SSR. Data fetched via loaders, mutations via actions.',
                icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2',
              },
              {
                title: 'File-Based Routing',
                desc: 'Routes map to files. Dynamic segments, layouts, route groups, and error boundaries.',
                icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
              },
              {
                title: 'Production Ready',
                desc: 'Docker support, environment configuration, secure cookies, and proper error handling.',
                icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
              },
            ].map((feature) => (
              <div key={feature.title} className="card hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-primary-100 dark:bg-primary-900/40">
                  <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Preview */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Simple, Powerful Patterns</h2>
            <p className="text-gray-600 dark:text-gray-400">Loaders fetch data. Actions handle mutations. It just works.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl overflow-hidden" style={{ background: '#1e1e2e' }}>
              <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-3 text-xs text-gray-500 font-mono">routes/tasks/index.tsx</span>
              </div>
              <pre className="px-5 py-4 font-mono text-sm text-primary-300 leading-relaxed overflow-x-auto">
{\`// Server loader — fetches data
export async function loader({ context }) {
  const auth = getAuth(context);
  const user = auth.getUser();
  const tasks = getTasksByUser(user.id);
  return { tasks };
}

// Component renders with data
export default function Tasks({ loaderData }) {
  return (
    <div>
      {loaderData.tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}\`}
              </pre>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: '#1e1e2e' }}>
              <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-3 text-xs text-gray-500 font-mono">routes/tasks/new.tsx</span>
              </div>
              <pre className="px-5 py-4 font-mono text-sm text-primary-300 leading-relaxed overflow-x-auto">
{\`// Server action — handles mutations
export async function action({ request, context }) {
  const auth = getAuth(context);
  const user = auth.getUser();
  const form = await request.formData();

  const task = createTask(
    user.id,
    form.get('title'),
    form.get('description'),
    'todo',
    form.get('priority')
  );

  return Response.redirect('/tasks');
}\`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get organized?</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Create your account and start managing tasks in seconds.</p>
        <a href="/register" className="btn btn-primary text-base px-8 py-3">
          Create Free Account
        </a>
      </section>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/index.${ext}`), indexPage);

  // ============================================================================
  // Login Page
  // ============================================================================
  const loginPage = `
import { getAuth } from '@ereo/auth';

export async function loader({ context }${ts ? ': { context: any }' : ''}) {
  try {
    const auth = getAuth(context);
    if (auth.isAuthenticated()) {
      return new Response(null, { status: 302, headers: { Location: '/tasks' } });
    }
  } catch {}
  return {};
}

export async function action({ request, context }${ts ? ': { request: Request; context: any }' : ''}) {
  const formData = await request.formData();
  const email = formData.get('email')${ts ? ' as string' : ''};
  const password = formData.get('password')${ts ? ' as string' : ''};

  const errors${ts ? ': Record<string, string>' : ''} = {};
  if (!email) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  try {
    const auth = getAuth(context);
    await auth.signIn('credentials', { email, password });

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/tasks',
        'Set-Cookie': auth.getCookieHeader() || '',
      },
    });
  } catch {
    return { success: false, errors: { form: 'Invalid email or password' } };
  }
}

${ts ? `interface LoginPageProps {
  actionData?: {
    success: boolean;
    errors?: Record<string, string>;
  };
}\n` : ''}
export default function LoginPage({ actionData }${ts ? ': LoginPageProps' : ''}) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sign in to manage your tasks
          </p>
        </div>

        <div className="card">
          {actionData?.errors?.form && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{actionData.errors.form}</p>
            </div>
          )}

          <form method="POST" className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
              {actionData?.errors?.email && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="current-password"
                className="input"
                placeholder="Your password"
              />
              {actionData?.errors?.password && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-2.5"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <a href="/register" className="text-primary-600 hover:underline font-medium">
              Create one
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/(auth)/login.${ext}`), loginPage);

  // ============================================================================
  // Register Page
  // ============================================================================
  const registerPage = `
import { getAuth } from '@ereo/auth';
import { emailExists, createUser, hashPassword } from '~/lib/db';

export async function loader({ context }${ts ? ': { context: any }' : ''}) {
  try {
    const auth = getAuth(context);
    if (auth.isAuthenticated()) {
      return new Response(null, { status: 302, headers: { Location: '/tasks' } });
    }
  } catch {}
  return {};
}

export async function action({ request, context }${ts ? ': { request: Request; context: any }' : ''}) {
  const formData = await request.formData();
  const name = (formData.get('name')${ts ? ' as string' : ''} || '').trim();
  const email = (formData.get('email')${ts ? ' as string' : ''} || '').trim().toLowerCase();
  const password = formData.get('password')${ts ? ' as string' : ''} || '';
  const confirmPassword = formData.get('confirmPassword')${ts ? ' as string' : ''} || '';

  // Validate
  const errors${ts ? ': Record<string, string>' : ''} = {};
  if (!name || name.length < 2) errors.name = 'Name must be at least 2 characters';
  if (!email || !email.includes('@')) errors.email = 'Please enter a valid email';
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // Check if email already exists
  if (emailExists(email)) {
    return { success: false, errors: { email: 'An account with this email already exists' } };
  }

  // Create user
  const passwordHash = await hashPassword(password);
  createUser(email, name, passwordHash);

  // Sign in the new user
  try {
    const auth = getAuth(context);
    await auth.signIn('credentials', { email, password });

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/tasks',
        'Set-Cookie': auth.getCookieHeader() || '',
      },
    });
  } catch {
    // Account created but auto-login failed — redirect to login
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
}

${ts ? `interface RegisterPageProps {
  actionData?: {
    success: boolean;
    errors?: Record<string, string>;
  };
}\n` : ''}
export default function RegisterPage({ actionData }${ts ? ': RegisterPageProps' : ''}) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Create your account</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Start organizing your tasks today
          </p>
        </div>

        <div className="card">
          <form method="POST" className="space-y-4">
            <div>
              <label htmlFor="name" className="label">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                required
                autoComplete="name"
                className="input"
                placeholder="Your name"
              />
              {actionData?.errors?.name && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
              {actionData?.errors?.email && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="new-password"
                minLength={8}
                className="input"
                placeholder="At least 8 characters"
              />
              {actionData?.errors?.password && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                autoComplete="new-password"
                className="input"
                placeholder="Repeat your password"
              />
              {actionData?.errors?.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-2.5"
            >
              Create account
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="text-primary-600 hover:underline font-medium">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/(auth)/register.${ext}`), registerPage);

  // ============================================================================
  // Logout Action Route
  // ============================================================================
  const logoutRoute = `
import { getAuth } from '@ereo/auth';

export async function action({ context }${ts ? ': { context: any }' : ''}) {
  try {
    const auth = getAuth(context);
    await auth.signOut();
  } catch {
    // Already signed out
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/' },
  });
}

export default function LogoutPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <p className="text-gray-500">Signing out...</p>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/logout.${ext}`), logoutRoute);

  // ============================================================================
  // Tasks List Page
  // ============================================================================
  const tasksIndex = `
import { getAuth, requireAuth } from '@ereo/auth';
import { getTasksByUser, getTaskStats } from '~/lib/db';
import { TaskCard } from '~/components/TaskCard';

export const config = { ...requireAuth({ redirect: '/login' }) };

export async function loader({ request, context }${ts ? ': { request: Request; context: any }' : ''}) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  const user = auth.getUser()${ts ? '!' : ''};
  const userId = Number(user.id);

  // Read filter from URL search params
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';

  const tasks = getTasksByUser(userId, status);
  const stats = getTaskStats(userId);

  return { tasks, stats, currentFilter: status };
}

${ts ? `interface TasksPageProps {
  loaderData: {
    tasks: Array<{
      id: number;
      title: string;
      description: string;
      status: 'todo' | 'in_progress' | 'done';
      priority: 'low' | 'medium' | 'high';
      created_at: string;
      updated_at: string;
    }>;
    stats: { todo: number; in_progress: number; done: number; total: number };
    currentFilter: string;
  };
}\n` : ''}
export default function TasksPage({ loaderData }${ts ? ': TasksPageProps' : ''}) {
  const { tasks, stats, currentFilter } = loaderData;

  const filters = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'todo', label: 'To Do', count: stats.todo },
    { value: 'in_progress', label: 'In Progress', count: stats.in_progress },
    { value: 'done', label: 'Done', count: stats.done },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {stats.total === 0
              ? 'No tasks yet. Create your first one!'
              : \`\${stats.total} task\${stats.total === 1 ? '' : 's'} total, \${stats.done} completed\`}
          </p>
        </div>
        <a href="/tasks/new" className="btn btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </a>
      </div>

      {/* Stats Cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
            <div className="text-3xl font-bold mt-1">{stats.total}</div>
          </div>
          <div className="card py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">To Do</div>
            <div className="text-3xl font-bold mt-1 text-gray-600 dark:text-gray-300">{stats.todo}</div>
          </div>
          <div className="card py-4">
            <div className="text-sm text-blue-500">In Progress</div>
            <div className="text-3xl font-bold mt-1 text-blue-600 dark:text-blue-400">{stats.in_progress}</div>
          </div>
          <div className="card py-4">
            <div className="text-sm text-green-500">Done</div>
            <div className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">{stats.done}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {stats.total > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <a
              key={filter.value}
              href={\`/tasks\${filter.value === 'all' ? '' : \`?status=\${filter.value}\`}\`}
              className={\`btn btn-sm whitespace-nowrap \${
                currentFilter === filter.value
                  ? 'btn-primary'
                  : 'btn-ghost'
              }\`}
            >
              {filter.label}
              <span className={\`ml-1.5 px-1.5 py-0.5 rounded-full text-xs \${
                currentFilter === filter.value
                  ? 'bg-white/20'
                  : 'bg-gray-200 dark:bg-gray-700'
              }\`}>
                {filter.count}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Task List */}
      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : stats.total > 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No tasks match the current filter.</p>
          <a href="/tasks" className="btn btn-secondary btn-sm">Clear filter</a>
        </div>
      ) : (
        <div className="card text-center py-16">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h2 className="text-xl font-semibold mb-2">No tasks yet</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first task to get started.</p>
          <a href="/tasks/new" className="btn btn-primary">
            Create your first task
          </a>
        </div>
      )}
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/tasks/index.${ext}`), tasksIndex);

  // ============================================================================
  // New Task Page
  // ============================================================================
  const newTaskPage = `
import { getAuth, requireAuth } from '@ereo/auth';
import { createTask } from '~/lib/db';

export const config = { ...requireAuth({ redirect: '/login' }) };

export async function action({ request, context }${ts ? ': { request: Request; context: any }' : ''}) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  const user = auth.getUser()${ts ? '!' : ''};
  const userId = Number(user.id);

  const formData = await request.formData();
  const title = (formData.get('title')${ts ? ' as string' : ''} || '').trim();
  const description = (formData.get('description')${ts ? ' as string' : ''} || '').trim();
  const priority = formData.get('priority')${ts ? ' as string' : ''} || 'medium';

  // Validate
  const errors${ts ? ': Record<string, string>' : ''} = {};
  if (!title || title.length < 1) errors.title = 'Title is required';
  if (title.length > 200) errors.title = 'Title must be under 200 characters';
  if (!['low', 'medium', 'high'].includes(priority)) errors.priority = 'Invalid priority';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  createTask(userId, title, description, 'todo', priority);

  return new Response(null, {
    status: 302,
    headers: { Location: '/tasks' },
  });
}

${ts ? `interface NewTaskPageProps {
  actionData?: {
    success: boolean;
    errors?: Record<string, string>;
  };
}\n` : ''}
export default function NewTaskPage({ actionData }${ts ? ': NewTaskPageProps' : ''}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <a href="/tasks" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
          &larr; Back to tasks
        </a>
        <h1 className="text-3xl font-bold mt-2">New Task</h1>
      </div>

      <div className="card">
        <form method="POST" className="space-y-5">
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              required
              maxLength={200}
              className="input"
              placeholder="What needs to be done?"
              autoFocus
            />
            {actionData?.errors?.title && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="input"
              placeholder="Add more details about this task..."
            />
          </div>

          <div>
            <label htmlFor="priority" className="label">Priority</label>
            <select id="priority" name="priority" className="input" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {actionData?.errors?.priority && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.priority}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="btn btn-primary"
            >
              Create Task
            </button>
            <a href="/tasks" className="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/tasks/new.${ext}`), newTaskPage);

  // ============================================================================
  // Task Detail / Edit Page (Dynamic Route)
  // ============================================================================
  const taskDetailPage = `
import { getAuth, requireAuth } from '@ereo/auth';
import { getTaskById, updateTask, deleteTask } from '~/lib/db';

export const config = { ...requireAuth({ redirect: '/login' }) };

export async function loader({ params, context }${ts ? ': { params: { id: string }; context: any }' : ''}) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  const user = auth.getUser()${ts ? '!' : ''};
  const userId = Number(user.id);

  const task = getTaskById(Number(params.id), userId);

  if (!task) {
    throw new Response('Task not found', { status: 404 });
  }

  return { task };
}

export async function action({ request, params, context }${ts ? ': { request: Request; params: { id: string }; context: any }' : ''}) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  const user = auth.getUser()${ts ? '!' : ''};
  const userId = Number(user.id);
  const taskId = Number(params.id);

  const formData = await request.formData();
  const intent = formData.get('_intent')${ts ? ' as string' : ''};

  // Handle delete
  if (intent === 'delete') {
    deleteTask(taskId, userId);
    return new Response(null, {
      status: 302,
      headers: { Location: '/tasks' },
    });
  }

  // Handle status quick-toggle
  if (intent === 'toggle-status') {
    const task = getTaskById(taskId, userId);
    if (!task) throw new Response('Task not found', { status: 404 });

    const nextStatus${ts ? ': Record<string, string>' : ''} = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };

    updateTask(taskId, userId, task.title, task.description, nextStatus[task.status] || 'todo', task.priority);
    return new Response(null, {
      status: 302,
      headers: { Location: \`/tasks/\${taskId}\` },
    });
  }

  // Handle update
  const title = (formData.get('title')${ts ? ' as string' : ''} || '').trim();
  const description = (formData.get('description')${ts ? ' as string' : ''} || '').trim();
  const status = formData.get('status')${ts ? ' as string' : ''} || 'todo';
  const priority = formData.get('priority')${ts ? ' as string' : ''} || 'medium';

  const errors${ts ? ': Record<string, string>' : ''} = {};
  if (!title || title.length < 1) errors.title = 'Title is required';
  if (title.length > 200) errors.title = 'Title must be under 200 characters';
  if (!['todo', 'in_progress', 'done'].includes(status)) errors.status = 'Invalid status';
  if (!['low', 'medium', 'high'].includes(priority)) errors.priority = 'Invalid priority';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const updated = updateTask(taskId, userId, title, description, status, priority);

  if (!updated) {
    return { success: false, errors: { form: 'Task not found' } };
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/tasks' },
  });
}

${ts ? `interface TaskDetailProps {
  loaderData: {
    task: {
      id: number;
      title: string;
      description: string;
      status: 'todo' | 'in_progress' | 'done';
      priority: 'low' | 'medium' | 'high';
      created_at: string;
      updated_at: string;
    };
  };
  actionData?: {
    success: boolean;
    message?: string;
    errors?: Record<string, string>;
  };
}\n` : ''}
export default function TaskDetailPage({ loaderData, actionData }${ts ? ': TaskDetailProps' : ''}) {
  const { task } = loaderData;

  const statusLabels${ts ? ': Record<string, string>' : ''} = {
    todo: 'To Do',
    in_progress: 'In Progress',
    done: 'Done',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <a href="/tasks" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
            &larr; Back to tasks
          </a>
          <h1 className="text-3xl font-bold mt-2">Edit Task</h1>
        </div>

        {/* Quick status toggle */}
        <form method="POST">
          <input type="hidden" name="_intent" value="toggle-status" />
          <button type="submit" className="btn btn-secondary btn-sm">
            Move to {statusLabels[task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo']}
          </button>
        </form>
      </div>

      {actionData?.errors?.form && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{actionData.errors.form}</p>
        </div>
      )}

      <div className="card">
        <form method="POST" className="space-y-5">
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              required
              maxLength={200}
              className="input"
              defaultValue={task.title}
            />
            {actionData?.errors?.title && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="input"
              defaultValue={task.description}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="label">Status</label>
              <select id="status" name="status" className="input" defaultValue={task.status}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="label">Priority</label>
              <select id="priority" name="priority" className="input" defaultValue={task.priority}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500">
            Created {new Date(task.created_at).toLocaleString()}
            {task.updated_at !== task.created_at && (
              <> &bull; Updated {new Date(task.updated_at).toLocaleString()}</>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="btn btn-primary"
            >
              Save Changes
            </button>
            <a href="/tasks" className="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>

      {/* Delete section - pure form, no client JS needed */}
      <div className="mt-6 card border-red-200 dark:border-red-800">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Permanently delete this task. This action cannot be undone.
        </p>
        <form method="POST">
          <input type="hidden" name="_intent" value="delete" />
          <button type="submit" className="btn btn-danger btn-sm">
            Delete Task
          </button>
        </form>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }${ts ? ': { error: Error }' : ''}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">Task Not Found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        This task doesn't exist or you don't have access to it.
      </p>
      <a href="/tasks" className="btn btn-primary">
        Back to Tasks
      </a>
    </div>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/tasks/[id].${ext}`), taskDetailPage);

  // ============================================================================
  // Error Page
  // ============================================================================
  const errorPage = `
${ts ? 'interface ErrorPageProps {\n  error: Error;\n}\n' : ''}
export default function ErrorPage({ error }${ts ? ': ErrorPageProps' : ''}) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="text-center">
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
export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</div>
        <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist.
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
.env.*.local
data/*.db
data/*.db-wal
data/*.db-shm`
  );

  // ============================================================================
  // .env.example
  // ============================================================================
  await Bun.write(
    join(projectDir, '.env.example'),
    `# Environment Variables
# Copy this file to .env and update the values

# Node environment
NODE_ENV=development

# Server port (optional, defaults to 3000)
# PORT=3000

# Auth secret — REQUIRED for production!
# Generate one with: openssl rand -base64 32
AUTH_SECRET=change-me-in-production`
  );

  // ============================================================================
  // .env (local dev with defaults)
  // ============================================================================
  await Bun.write(
    join(projectDir, '.env'),
    `NODE_ENV=development
AUTH_SECRET=dev-secret-not-for-production`
  );

  // ============================================================================
  // data/.gitkeep (ensure data dir is tracked)
  // ============================================================================
  await Bun.write(join(projectDir, 'data/.gitkeep'), '');

  // ============================================================================
  // Dockerfile (with SQLite volume)
  // ============================================================================
  const dockerfile = `# ---- Stage 1: Install all deps + build ----
FROM oven/bun:1-slim AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --ignore-scripts
COPY . .
RUN bun run build

# ---- Stage 2: Production dependencies only ----
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production --ignore-scripts

# ---- Stage 3: Production image ----
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S -g 1001 ereo && \\
    adduser -S -u 1001 -G ereo -H ereo

# Copy production node_modules
COPY --from=deps --chown=ereo:ereo /app/node_modules ./node_modules

# Copy build output and runtime files
COPY --from=builder --chown=ereo:ereo /app/.ereo        ./.ereo
COPY --from=builder --chown=ereo:ereo /app/app          ./app
COPY --from=builder --chown=ereo:ereo /app/public       ./public
COPY --from=builder --chown=ereo:ereo /app/package.json ./
COPY --from=builder --chown=ereo:ereo /app/ereo.config.* ./
COPY --from=builder --chown=ereo:ereo /app/tsconfig.*    ./

# Create data directory for SQLite with proper permissions
RUN mkdir -p /app/data && chown -R ereo:ereo /app/data

USER ereo

# Mount a volume for persistent SQLite data
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["bun", "run", "start"]
`;

  await Bun.write(join(projectDir, 'Dockerfile'), dockerfile);

  // ============================================================================
  // .dockerignore
  // ============================================================================
  await Bun.write(join(projectDir, '.dockerignore'), generateDockerignore());

  // ============================================================================
  // README
  // ============================================================================
  const readme = `# ${projectName}

A full-stack task management app built with [EreoJS](https://github.com/ereoJS/ereoJS) — a React fullstack framework powered by Bun.

## Features

- **Email & Password Authentication** — Secure sign up/sign in with argon2id hashing and JWT sessions
- **SQLite Database** — Production-ready with WAL mode, foreign keys, and automatic migrations
- **Full CRUD** — Create, read, update, and delete tasks with server-side validation
- **Server-Side Rendering** — Fast initial loads with data fetched via loaders
- **File-Based Routing** — Routes map to files with layouts, dynamic segments, and error boundaries
- **Protected Routes** — Auth middleware redirects unauthenticated users to login
- **Tailwind CSS** — Utility-first styling with dark mode support
- **Docker Ready** — Multi-stage Dockerfile with SQLite volume persistence${trace ? `
- **Full-Stack Tracing** — Request-level observability with \`@ereo/trace\`` : ''}

## Getting Started

\`\`\`bash
# Install dependencies
bun install

# Start development server${trace ? ' (tracing enabled)' : ''}
bun run dev

# Open http://localhost:3000
\`\`\`

Create an account at http://localhost:3000/register and start managing tasks!

## Project Structure

\`\`\`
app/
├── components/
│   ├── Navigation.tsx    # Auth-aware navigation
│   ├── Footer.tsx
│   └── TaskCard.tsx      # Task list item
├── lib/
│   ├── db.ts             # SQLite database, schema & queries${ts ? `
│   └── types.ts          # Shared TypeScript types` : ''}
├── routes/
│   ├── _layout.tsx       # Root layout with auth context
│   ├── _error.tsx        # Error boundary
│   ├── _404.tsx          # Not found page
│   ├── index.tsx         # Landing page
│   ├── logout.tsx        # Logout action
│   ├── (auth)/
│   │   ├── login.tsx     # Sign in
│   │   └── register.tsx  # Sign up
│   └── tasks/
│       ├── index.tsx     # Task list with filters
│       ├── new.tsx       # Create task form
│       └── [id].tsx      # View/edit/delete task
└── styles.css            # Tailwind directives
data/
└── app.db                # SQLite database (auto-created)
\`\`\`

## Scripts

- \`bun run dev\` — Start development server
- \`bun run build\` — Build for production
- \`bun run start\` — Start production server
- \`bun test\` — Run tests
- \`bun run typecheck\` — TypeScript type checking

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| \`AUTH_SECRET\` | **Yes** (production) | dev secret | JWT signing secret |
| \`NODE_ENV\` | No | development | Environment |
| \`PORT\` | No | 3000 | Server port |

Generate a production secret:

\`\`\`bash
openssl rand -base64 32
\`\`\`

## Docker

\`\`\`bash
# Build image
docker build -t ${projectName} .

# Run with persistent SQLite data
docker run -p 3000:3000 -v ${projectName}-data:/app/data -e AUTH_SECRET=your-secret ${projectName}
\`\`\`

${trace ? `## Tracing

This project includes \`@ereo/trace\` for full-stack observability.

- **CLI Reporter** — Live tree view in your terminal
- **Trace Viewer** — http://localhost:3000/__ereo/traces
- **Production** — Alias \`@ereo/trace\` to \`@ereo/trace/noop\` (592 bytes, zero cost)

` : ''}## Learn More

- [EreoJS Documentation](https://ereojs.github.io/ereoJS/)
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
  const { template, typescript, trace } = options;

  if (template === 'minimal') {
    await generateMinimalProject(projectDir, projectName, typescript, trace);
  } else if (template === 'tasks') {
    await generateTasksProject(projectDir, projectName, typescript, trace);
  } else {
    // Both 'default' and 'tailwind' use the full template
    await generateTailwindProject(projectDir, projectName, typescript, trace);
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
  await checkForUpdates();

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
  console.log(`  TypeScript: ${finalOptions.typescript ? 'Yes' : 'No'}`);
  console.log(`  Tracing: ${finalOptions.trace ? 'Yes' : 'No'}\n`);

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

  Open http://localhost:3000 to see your app.${finalOptions.trace ? '\n  Open http://localhost:3000/__ereo/traces for the trace viewer.' : ''}

  Happy coding!
`);
}

main().catch(console.error);
