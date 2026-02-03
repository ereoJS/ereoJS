/**
 * @ereo/cli - Create Command
 *
 * Create a new Ereo project with all essential features demonstrated.
 */

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

/**
 * Create command options.
 */
export interface CreateOptions {
  template?: 'minimal' | 'default' | 'tailwind';
  typescript?: boolean;
}

/**
 * Run the create command.
 */
export async function create(
  projectName: string,
  options: CreateOptions = {}
): Promise<void> {
  const template = options.template || 'tailwind';
  const typescript = options.typescript !== false;

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mEreo\x1b[0m Create Project\n');
  console.log(`  Creating ${projectName} with ${template} template...\n`);

  const projectDir = join(process.cwd(), projectName);

  // Create project structure
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, 'app/routes'), { recursive: true });
  await mkdir(join(projectDir, 'app/components'), { recursive: true });
  await mkdir(join(projectDir, 'app/middleware'), { recursive: true });
  await mkdir(join(projectDir, 'public'), { recursive: true });

  // Generate files based on template
  const files = generateTemplateFiles(template, typescript, projectName);

  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(projectDir, path);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await Bun.write(fullPath, content);
    console.log(`  \x1b[32m+\x1b[0m ${path}`);
  }

  console.log('\n  \x1b[32m✓\x1b[0m Project created successfully!\n');
  console.log('  Next steps:\n');
  console.log(`    cd ${projectName}`);
  console.log('    bun install');
  console.log('    bun run dev\n');
}

/**
 * Generate template files.
 */
function generateTemplateFiles(
  template: string,
  typescript: boolean,
  projectName: string
): Record<string, string> {
  const ext = typescript ? 'tsx' : 'jsx';
  const files: Record<string, string> = {};

  // package.json - includes all necessary dependencies
  const dependencies: Record<string, string> = {
    '@ereo/core': '^0.1.0',
    '@ereo/router': '^0.1.0',
    '@ereo/server': '^0.1.0',
    '@ereo/client': '^0.1.0',
    '@ereo/data': '^0.1.0',
    '@ereo/cli': '^0.1.0',
    'react': '^18.2.0',
    'react-dom': '^18.2.0',
  };

  // Add plugin-tailwind when using tailwind template
  if (template === 'tailwind') {
    dependencies['@ereo/plugin-tailwind'] = '^0.1.0';
  }

  files['package.json'] = JSON.stringify(
    {
      name: projectName,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'ereo dev',
        build: 'ereo build',
        start: 'ereo start',
      },
      dependencies,
      devDependencies: typescript
        ? {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            'typescript': '^5.4.0',
          }
        : {},
    },
    null,
    2
  );

  // TypeScript config
  if (typescript) {
    files['tsconfig.json'] = JSON.stringify(
      {
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
        include: ['app/**/*', 'ereo.config.ts'],
      },
      null,
      2
    );
  }

  // Ereo config
  files[`ereo.config.${typescript ? 'ts' : 'js'}`] = generateEreoConfig(template);

  // Environment variables example
  files['.env'] = generateEnvFile();
  files['.env.example'] = generateEnvFile();

  // Root layout with proper types and Link component
  files[`app/routes/_layout.${ext}`] = generateRootLayout(template, typescript);

  // Client entry point for hydration
  files[`app/entry.client.${ext}`] = generateClientEntry(typescript);

  // Index page with loader, meta, and cache control
  files[`app/routes/index.${ext}`] = generateIndexPage(template, typescript);

  // About page - simple static page
  files[`app/routes/about.${ext}`] = generateAboutPage(template, typescript);

  // Contact page with Form and Action example
  files[`app/routes/contact.${ext}`] = generateContactPage(template, typescript);

  // Counter component - Islands architecture example
  files[`app/components/Counter.${ext}`] = generateCounterComponent(template, typescript);

  // Middleware example
  files[`app/middleware/logger.${typescript ? 'ts' : 'js'}`] = generateLoggerMiddleware(typescript);

  // Error boundary example
  files[`app/routes/_error.${ext}`] = generateErrorBoundary(template, typescript);

  // Tailwind-specific files
  if (template === 'tailwind') {
    files['tailwind.config.js'] = generateTailwindConfig();
    files['app/globals.css'] = generateGlobalCSS();
  }

  // .gitignore
  files['.gitignore'] = generateGitignore();

  return files;
}

/**
 * Generate ereo.config.ts
 */
function generateEreoConfig(template: string): string {
  const tailwindImport = template === 'tailwind'
    ? "import tailwind from '@ereo/plugin-tailwind';\n"
    : '';
  const tailwindPlugin = template === 'tailwind' ? '    tailwind(),' : '';

  return `import { defineConfig } from '@ereo/core';
${tailwindImport}
export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'bun',
  },
  plugins: [
${tailwindPlugin}
  ],
});
`.trim();
}

/**
 * Generate .env file
 */
function generateEnvFile(): string {
  return `# Environment Variables
# Prefix with EREO_PUBLIC_ to expose to the client

# Server-only (never sent to browser)
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET=your-secret-key

# Public (available in client code)
EREO_PUBLIC_APP_NAME=Ereo App
EREO_PUBLIC_API_URL=http://localhost:3000/api
`.trim();
}

/**
 * Generate root layout with proper types
 * Uses <a> tags for SSR compatibility - client-side navigation is handled by the client runtime
 */
function generateRootLayout(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { ReactNode } from 'react';`
    : '';

  const propsType = typescript ? ': { children: ReactNode }' : '';

  const tailwindStyles = template === 'tailwind';
  const navClasses = tailwindStyles
    ? ' className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700"'
    : '';
  const linkClasses = tailwindStyles
    ? ' className="text-blue-600 hover:text-blue-800 dark:text-blue-400"'
    : '';
  const bodyClasses = tailwindStyles
    ? ' className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white"'
    : '';
  const stylesheet = tailwindStyles
    ? '\n        <link rel="stylesheet" href="/app/globals.css" />'
    : '';

  return `${imports}

export default function RootLayout({ children }${propsType}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />${stylesheet}
      </head>
      <body${bodyClasses}>
        <nav${navClasses}>
          <a href="/"${linkClasses}>Home</a>
          <a href="/about"${linkClasses}>About</a>
          <a href="/contact"${linkClasses}>Contact</a>
        </nav>
        {children}
        {/* Client-side hydration script */}
        <script type="module" src="/app/entry.client.tsx" />
      </body>
    </html>
  );
}
`.trim();
}

/**
 * Generate client entry point for hydration
 */
function generateClientEntry(typescript: boolean): string {
  return `/**
 * Client Entry Point
 *
 * This file initializes the client-side runtime:
 * - Hydrates island components
 * - Sets up client-side navigation
 * - Enables link prefetching
 */
import { initClient } from '@ereo/client';

// Initialize the Ereo client runtime
initClient();

// You can also manually hydrate specific islands:
// import { hydrateIslands } from '@ereo/client';
// hydrateIslands();
`.trim();
}

/**
 * Generate index page with loader, meta, and cache control
 */
function generateIndexPage(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { LoaderArgs, MetaArgs, RouteComponentProps } from '@ereo/core';
import { Counter } from '../components/Counter';`
    : `import { Counter } from '../components/Counter';`;

  const loaderType = typescript ? ': LoaderArgs' : '';
  const loaderDataType = `{ message: string; timestamp: string; visitors: number }`;
  const propsType = typescript ? `: RouteComponentProps<${loaderDataType}>` : '';
  const metaType = typescript ? `: MetaArgs<${loaderDataType}>` : '';

  const tailwindStyles = template === 'tailwind';
  const mainClasses = tailwindStyles
    ? ' className="flex flex-col items-center justify-center min-h-[80vh] p-8"'
    : '';
  const h1Classes = tailwindStyles
    ? ' className="text-4xl font-bold mb-4"'
    : '';
  const pClasses = tailwindStyles
    ? ' className="text-gray-600 dark:text-gray-400 mb-2"'
    : '';
  const sectionClasses = tailwindStyles
    ? ' className="mt-8 p-6 border border-gray-200 dark:border-gray-700 rounded-lg"'
    : '';
  const h2Classes = tailwindStyles
    ? ' className="text-xl font-semibold mb-4"'
    : '';

  return `${imports}

/**
 * Loader - Server-side data fetching
 *
 * Runs on the server for every request. Use context.cache
 * for explicit cache control with tagged invalidation.
 */
export async function loader({ request, params, context }${loaderType}) {
  // Set cache headers - explicit and visible
  context.cache.set({
    maxAge: 60,                    // Cache for 60 seconds
    staleWhileRevalidate: 300,     // Serve stale while revalidating for 5 min
    tags: ['homepage', 'content'], // Tags for invalidation
  });

  // Access environment variables
  const appName = context.env.EREO_PUBLIC_APP_NAME || 'Ereo App';

  return {
    message: \`Welcome to \${appName}!\`,
    timestamp: new Date().toISOString(),
    visitors: Math.floor(Math.random() * 1000),
  };
}

/**
 * Meta - Dynamic SEO metadata
 *
 * Generate meta tags based on loader data.
 */
export function meta({ data }${metaType}) {
  return [
    { title: data.message },
    { name: 'description', content: 'A blazing fast React framework built on Bun' },
    { property: 'og:title', content: data.message },
  ];
}

/**
 * Page Component
 *
 * Receives loaderData from the loader function.
 * Uses RouteComponentProps<T> for type-safe data access.
 */
export default function HomePage({ loaderData }${propsType}) {
  return (
    <main${mainClasses}>
      <h1${h1Classes}>
        {loaderData.message}
      </h1>
      <p${pClasses}>
        Server time: {loaderData.timestamp}
      </p>
      <p${pClasses}>
        Today's visitors: {loaderData.visitors}
      </p>

      {/* Islands Architecture Example */}
      <section${sectionClasses}>
        <h2${h2Classes}>Interactive Island</h2>
        <p${pClasses}>
          This counter is an "island" - only this component hydrates on the client.
          The rest of the page stays static HTML with zero JavaScript.
        </p>
        {/* client:load hydrates immediately */}
        <Counter client:load initialCount={0} />
      </section>
    </main>
  );
}
`.trim();
}

/**
 * Generate about page - simple static page
 */
function generateAboutPage(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { MetaFunction } from '@ereo/core';`
    : '';

  const tailwindStyles = template === 'tailwind';
  const mainClasses = tailwindStyles
    ? ' className="flex flex-col items-center justify-center min-h-[80vh] p-8"'
    : '';
  const h1Classes = tailwindStyles
    ? ' className="text-4xl font-bold mb-4"'
    : '';
  const pClasses = tailwindStyles
    ? ' className="text-gray-600 dark:text-gray-400 max-w-2xl text-center"'
    : '';
  const ulClasses = tailwindStyles
    ? ' className="mt-6 space-y-2 text-left"'
    : '';
  const liClasses = tailwindStyles
    ? ' className="flex items-center gap-2"'
    : '';

  const metaExport = typescript
    ? `
/**
 * Static meta tags for this page
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'About - Ereo App' },
    { name: 'description', content: 'Learn about the Ereo framework' },
  ];
};
`
    : `
/**
 * Static meta tags for this page
 */
export function meta() {
  return [
    { title: 'About - Ereo App' },
    { name: 'description', content: 'Learn about the Ereo framework' },
  ];
}
`;

  return `${imports}
${metaExport}
/**
 * About Page - Static content (no loader needed)
 *
 * Pages without loaders are rendered as static HTML.
 */
export default function AboutPage() {
  return (
    <main${mainClasses}>
      <h1${h1Classes}>
        About Ereo
      </h1>
      <p${pClasses}>
        Ereo is a React fullstack framework built on Bun, designed for
        simplicity and performance. It features islands architecture for
        minimal JavaScript and explicit caching for predictable behavior.
      </p>
      <ul${ulClasses}>
        <li${liClasses}>
          <span>5-6x faster than Node.js</span>
        </li>
        <li${liClasses}>
          <span>Islands architecture for minimal JS</span>
        </li>
        <li${liClasses}>
          <span>One unified loader pattern</span>
        </li>
        <li${liClasses}>
          <span>Explicit tagged cache invalidation</span>
        </li>
      </ul>
    </main>
  );
}
`.trim();
}

/**
 * Generate contact page with Form and Action
 */
function generateContactPage(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { ActionArgs, LoaderArgs, RouteComponentProps } from '@ereo/core';
import { json } from '@ereo/data';`
    : `import { json } from '@ereo/data';`;

  const loaderType = typescript ? ': LoaderArgs' : '';
  const actionType = typescript ? ': ActionArgs' : '';
  const propsType = typescript ? ': RouteComponentProps<{ csrfToken: string }>' : '';

  const tailwindStyles = template === 'tailwind';
  const mainClasses = tailwindStyles
    ? ' className="flex flex-col items-center justify-center min-h-[80vh] p-8"'
    : '';
  const h1Classes = tailwindStyles
    ? ' className="text-4xl font-bold mb-4"'
    : '';
  const formClasses = tailwindStyles
    ? ' className="w-full max-w-md space-y-4"'
    : '';
  const labelClasses = tailwindStyles
    ? ' className="block text-sm font-medium mb-1"'
    : '';
  const inputClasses = tailwindStyles
    ? ' className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"'
    : '';
  const textareaClasses = tailwindStyles
    ? ' className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 h-32"'
    : '';
  const buttonClasses = tailwindStyles
    ? ' className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"'
    : '';

  return `${imports}

/**
 * Loader - Provide CSRF token for form security
 */
export async function loader({ context }${loaderType}) {
  return {
    csrfToken: crypto.randomUUID(),
  };
}

/**
 * Action - Handle form submission
 *
 * Actions handle POST/PUT/DELETE requests.
 * Use json() for responses, redirect() for redirects.
 */
export async function action({ request, context }${actionType}) {
  const formData = await request.formData();

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  // Validate
  const errors: Record<string, string> = {};
  if (!name || name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!email || !email.includes('@')) {
    errors.email = 'Please enter a valid email';
  }
  if (!message || message.length < 10) {
    errors.message = 'Message must be at least 10 characters';
  }

  if (Object.keys(errors).length > 0) {
    return json({ success: false, errors }, { status: 400 });
  }

  // Process the submission (e.g., send email, save to DB)
  console.log('Contact form submitted:', { name, email, message });

  // Return success or redirect
  return json({ success: true, message: 'Thank you for your message!' });
}

/**
 * Contact Page with Form
 *
 * This is a simple SSR-compatible form.
 * For enhanced client-side features (loading states, error display),
 * use an island component with the Form/useActionData hooks from @ereo/client.
 */
export default function ContactPage({ loaderData }${propsType}) {
  return (
    <main${mainClasses}>
      <h1${h1Classes}>Contact Us</h1>

      <form method="post"${formClasses}>
        <input type="hidden" name="csrf" value={loaderData.csrfToken} />

        <div>
          <label htmlFor="name"${labelClasses}>Name</label>
          <input
            type="text"
            id="name"
            name="name"
            required${inputClasses}
          />
        </div>

        <div>
          <label htmlFor="email"${labelClasses}>Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required${inputClasses}
          />
        </div>

        <div>
          <label htmlFor="message"${labelClasses}>Message</label>
          <textarea
            id="message"
            name="message"
            required${textareaClasses}
          />
        </div>

        <button type="submit"${buttonClasses}>
          Send Message
        </button>
      </form>
    </main>
  );
}
`.trim();
}

/**
 * Generate Counter component - Islands example
 */
function generateCounterComponent(template: string, typescript: boolean): string {
  const propsType = typescript ? ': { initialCount?: number }' : '';

  const tailwindStyles = template === 'tailwind';
  const containerClasses = tailwindStyles
    ? ' className="flex items-center gap-4 mt-4"'
    : '';
  const buttonClasses = tailwindStyles
    ? ' className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"'
    : '';
  const countClasses = tailwindStyles
    ? ' className="text-2xl font-bold min-w-[3ch] text-center"'
    : '';

  return `'use client';
/**
 * Counter Component - Island Example
 *
 * This component demonstrates the islands architecture.
 * Only components with 'use client' directive hydrate on the client.
 *
 * Hydration strategies:
 * - client:load   - Hydrate immediately on page load
 * - client:idle   - Hydrate when browser is idle
 * - client:visible - Hydrate when element is visible (IntersectionObserver)
 * - client:media  - Hydrate when media query matches
 *
 * Usage:
 *   <Counter client:load initialCount={0} />
 *   <Counter client:visible initialCount={5} />
 */
import { useState } from 'react';

export function Counter({ initialCount = 0 }${propsType}) {
  const [count, setCount] = useState(initialCount);

  return (
    <div${containerClasses}>
      <button onClick={() => setCount(c => c - 1)}${buttonClasses}>
        -
      </button>
      <span${countClasses}>{count}</span>
      <button onClick={() => setCount(c => c + 1)}${buttonClasses}>
        +
      </button>
    </div>
  );
}
`.trim();
}

/**
 * Generate logger middleware example
 */
function generateLoggerMiddleware(typescript: boolean): string {
  const imports = typescript
    ? `import type { MiddlewareHandler } from '@ereo/core';`
    : '';
  const typeAnnotation = typescript ? ': MiddlewareHandler' : '';

  return `${imports}
/**
 * Logger Middleware
 *
 * Logs request information and timing.
 *
 * Register in ereo.config.ts or use the route config:
 *
 * export const config = {
 *   middleware: ['logger'],
 * };
 */
export const logger${typeAnnotation} = async (request, context, next) => {
  const start = Date.now();
  const url = new URL(request.url);

  console.log(\`--> \${request.method} \${url.pathname}\`);

  // Call next middleware/handler
  const response = await next();

  const duration = Date.now() - start;
  console.log(\`<-- \${request.method} \${url.pathname} \${response.status} \${duration}ms\`);

  return response;
};

export default logger;
`.trim();
}

/**
 * Generate error boundary page
 */
function generateErrorBoundary(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { RouteErrorComponentProps } from '@ereo/core';`
    : '';

  const propsType = typescript ? ': RouteErrorComponentProps' : '';

  const tailwindStyles = template === 'tailwind';
  const mainClasses = tailwindStyles
    ? ' className="flex flex-col items-center justify-center min-h-[80vh] p-8"'
    : '';
  const h1Classes = tailwindStyles
    ? ' className="text-4xl font-bold text-red-600 mb-4"'
    : '';
  const pClasses = tailwindStyles
    ? ' className="text-gray-600 dark:text-gray-400 mb-4"'
    : '';
  const preClasses = tailwindStyles
    ? ' className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-auto max-w-2xl text-sm"'
    : '';
  const linkClasses = tailwindStyles
    ? ' className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block"'
    : '';

  return `${imports}

/**
 * Error Boundary Page
 *
 * This component renders when an error occurs in a route.
 * It receives the error and route params.
 *
 * File naming:
 * - _error.tsx  - Catches errors in current route and children
 * - error.tsx   - Same as above (alternative naming)
 *
 * The error boundary closest to the error will be used.
 */
export default function ErrorBoundary({ error, params }${propsType}) {
  return (
    <main${mainClasses}>
      <h1${h1Classes}>Something went wrong</h1>
      <p${pClasses}>
        We're sorry, but an error occurred while processing your request.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <pre${preClasses}>
          <code>{error.message}</code>
          {error.stack && (
            <>
              {'\\n\\n'}
              {error.stack}
            </>
          )}
        </pre>
      )}

      <a href="/"${linkClasses}>
        Go back home
      </a>
    </main>
  );
}
`.trim();
}

/**
 * Generate Tailwind config
 */
function generateTailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Add your custom theme extensions here
    },
  },
  plugins: [],
};
`.trim();
}

/**
 * Generate global CSS
 */
function generateGlobalCSS(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom global styles */
@layer base {
  html {
    @apply antialiased;
  }

  body {
    @apply bg-white dark:bg-gray-900 text-gray-900 dark:text-white;
  }
}

@layer components {
  /* Add reusable component styles here */
}

@layer utilities {
  /* Add custom utilities here */
}
`.trim();
}

/**
 * Generate .gitignore
 */
function generateGitignore(): string {
  return `# Dependencies
node_modules

# Build output
.ereo
dist

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode
.idea
*.swp
*.swo

# Bun
bun.lockb
`.trim();
}
