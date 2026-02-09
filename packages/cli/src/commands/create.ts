/**
 * @ereo/cli - Create Command
 *
 * Create a new EreoJS project with all essential features demonstrated.
 */

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

/**
 * Create command options.
 */
export interface CreateOptions {
  template?: 'minimal' | 'default' | 'tailwind';
  typescript?: boolean;
  /** CLI version — used as the @ereo/* dependency version in generated projects. */
  version?: string;
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
  const files = generateTemplateFiles(template, typescript, projectName, options.version);

  // Sort files for consistent output
  const sortedPaths = Object.keys(files).sort();

  for (const path of sortedPaths) {
    const content = files[path];
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
  projectName: string,
  version?: string
): Record<string, string> {
  const ext = typescript ? 'tsx' : 'jsx';
  const files: Record<string, string> = {};

  // package.json - includes all necessary dependencies
  const ereoVersion = version ? `^${version}` : '^0.1.0';
  const dependencies: Record<string, string> = {
    '@ereo/core': ereoVersion,
    '@ereo/router': ereoVersion,
    '@ereo/server': ereoVersion,
    '@ereo/client': ereoVersion,
    '@ereo/data': ereoVersion,
    '@ereo/cli': ereoVersion,
    'react': '^18.2.0',
    'react-dom': '^18.2.0',
  };

  // Add plugin-tailwind when using tailwind template
  if (template === 'tailwind') {
    dependencies['@ereo/plugin-tailwind'] = ereoVersion;
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

  // EreoJS config
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

  // Dynamic route example - blog post
  files[`app/routes/blog/[slug].${ext}`] = generateDynamicRoute(template, typescript);

  // Blog index
  files[`app/routes/blog/index.${ext}`] = generateBlogIndex(template, typescript);

  // API route example
  files[`app/routes/api/health.${typescript ? 'ts' : 'js'}`] = generateApiRoute(typescript);

  // Tailwind-specific files
  if (template === 'tailwind') {
    files['tailwind.config.js'] = generateTailwindConfig();
    files['app/globals.css'] = generateGlobalCSS();
  }

  // .gitignore
  files['.gitignore'] = generateGitignore();

  // Docker support
  files['Dockerfile'] = generateDockerfile();
  files['.dockerignore'] = generateDockerignore();

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
EREO_PUBLIC_APP_NAME=EreoJS App
EREO_PUBLIC_API_URL=http://localhost:3000/api
`.trim();
}

/**
 * Generate root layout with proper types
 * Uses Link component from @ereo/client for client-side navigation
 */
function generateRootLayout(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { ReactNode } from 'react';
import { Link } from '@ereo/client';`
    : `import { Link } from '@ereo/client';`;

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
    ? '\n        <link rel="stylesheet" href="/__tailwind.css" />'
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
          <Link to="/"${linkClasses}>Home</Link>
          <Link to="/about"${linkClasses}>About</Link>
          <Link to="/blog"${linkClasses}>Blog</Link>
          <Link to="/contact"${linkClasses}>Contact</Link>
        </nav>
        {children}
        {/* Client-side hydration script - bundled by EreoJS */}
        <script type="module" src="/@ereo/client-entry.js" />
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

// Initialize the EreoJS client runtime
initClient();

// You can also manually hydrate specific islands:
// import { hydrateIslands } from '@ereo/client';
// hydrateIslands();
`.trim();
}

/**
 * Generate index page with loader, meta, cache control, and route config
 */
function generateIndexPage(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { LoaderArgs, MetaArgs, RouteConfig } from '@ereo/core';
import { Counter } from '../components/Counter';`
    : `import { Counter } from '../components/Counter';`;

  const loaderType = typescript ? ': LoaderArgs' : '';
  const loaderDataType = `{ message: string; timestamp: string; visitors: number }`;
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

  const configType = typescript ? ': RouteConfig' : '';

  return `${imports}

/**
 * Route Configuration
 *
 * Export a config object to configure middleware, caching,
 * rendering mode, and other route-level settings.
 */
export const config${configType} = {
  // Apply middleware to this route
  middleware: ['logger'],
  // Cache configuration
  cache: {
    edge: {
      maxAge: 60,
      staleWhileRevalidate: 300,
    },
    data: {
      tags: ['homepage', 'content'],
    },
  },
};

/**
 * Loader - Server-side data fetching
 *
 * Runs on the server for every request. Use context.cache
 * for explicit cache control with tagged invalidation.
 */
export async function loader({ request, params, context }${loaderType}) {
  // Access environment variables
  const appName = context.env.EREO_PUBLIC_APP_NAME || 'EreoJS App';

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
 * For client components, use useLoaderData() hook from @ereo/client.
 */
export default function HomePage({ loaderData }${typescript ? `: { loaderData: ${loaderDataType} }` : ''}) {
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
    { title: 'About - EreoJS App' },
    { name: 'description', content: 'Learn about the EreoJS framework' },
  ];
};
`
    : `
/**
 * Static meta tags for this page
 */
export function meta() {
  return [
    { title: 'About - EreoJS App' },
    { name: 'description', content: 'Learn about the EreoJS framework' },
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
        About EreoJS
      </h1>
      <p${pClasses}>
        EreoJS is a React fullstack framework built on Bun, designed for
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
    ? `import type { ActionArgs, LoaderArgs, RouteConfig } from '@ereo/core';
import { json } from '@ereo/data';
import { Form, useActionData, useNavigation } from '@ereo/client';`
    : `import { json } from '@ereo/data';
import { Form, useActionData, useNavigation } from '@ereo/client';`;

  const loaderType = typescript ? ': LoaderArgs' : '';
  const actionType = typescript ? ': ActionArgs' : '';
  const propsType = typescript ? ': { loaderData: { csrfToken: string } }' : '';
  const actionDataType = typescript ? `
interface ActionData {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
}` : '';

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

  const errorClasses = tailwindStyles
    ? ' className="text-red-600 dark:text-red-400 text-sm mt-1"'
    : '';
  const successClasses = tailwindStyles
    ? ' className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-4 rounded-md mb-4"'
    : '';

  return `${imports}
${actionDataType}

/**
 * Route Configuration
 */
export const config${typescript ? ': RouteConfig' : ''} = {
  // Progressive enhancement - form works without JS
  progressive: {
    forms: {
      fallback: 'server',
    },
  },
};

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
export async function action({ request, context }${actionType})${typescript ? ': Promise<Response>' : ''} {
  const formData = await request.formData();

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  // Validate
  const errors${typescript ? ': Record<string, string>' : ''} = {};
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
 * Contact Page with Enhanced Form
 *
 * Uses the Form component from @ereo/client for:
 * - Automatic loading states
 * - Client-side validation feedback
 * - Progressive enhancement (works without JS)
 *
 * The useActionData hook provides access to the action response.
 * The useNavigation hook provides loading state.
 */
export default function ContactPage({ loaderData }${propsType}) {
  // Get action response data (available after form submission)
  const actionData = useActionData${typescript ? '<ActionData>' : ''}();
  // Get navigation state for loading indicator
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main${mainClasses}>
      <h1${h1Classes}>Contact Us</h1>

      {actionData?.success && (
        <div${successClasses}>
          {actionData.message}
        </div>
      )}

      <Form method="post"${formClasses}>
        <input type="hidden" name="csrf" value={loaderData.csrfToken} />

        <div>
          <label htmlFor="name"${labelClasses}>Name</label>
          <input
            type="text"
            id="name"
            name="name"
            required${inputClasses}
            aria-invalid={actionData?.errors?.name ? 'true' : undefined}
          />
          {actionData?.errors?.name && (
            <p${errorClasses}>{actionData.errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="email"${labelClasses}>Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required${inputClasses}
            aria-invalid={actionData?.errors?.email ? 'true' : undefined}
          />
          {actionData?.errors?.email && (
            <p${errorClasses}>{actionData.errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="message"${labelClasses}>Message</label>
          <textarea
            id="message"
            name="message"
            required${textareaClasses}
            aria-invalid={actionData?.errors?.message ? 'true' : undefined}
          />
          {actionData?.errors?.message && (
            <p${errorClasses}>{actionData.errors.message}</p>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}${buttonClasses}>
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </Form>
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
    ? `import type { RouteErrorComponentProps } from '@ereo/core';
import { Link } from '@ereo/client';
import { isRouteErrorResponse } from '@ereo/client';`
    : `import { Link } from '@ereo/client';
import { isRouteErrorResponse } from '@ereo/client';`;

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
  const statusClasses = tailwindStyles
    ? ' className="text-6xl font-bold text-gray-300 dark:text-gray-600 mb-4"'
    : '';

  return `${imports}

/**
 * Error Boundary Page
 *
 * This component renders when an error occurs in a route.
 * It receives the error and route params.
 *
 * Error types:
 * - Response errors (404, 500, etc.) - thrown via \`throw new Response()\`
 * - JavaScript errors - unexpected exceptions
 *
 * File naming:
 * - _error.tsx  - Catches errors in current route and children
 * - error.tsx   - Same as above (alternative naming)
 *
 * The error boundary closest to the error will be used.
 */
export default function ErrorBoundary({ error, params }${propsType}) {
  // Check if this is a Response error (e.g., 404)
  if (isRouteErrorResponse(error)) {
    return (
      <main${mainClasses}>
        <div${statusClasses}>{error.status}</div>
        <h1${h1Classes}>
          {error.status === 404 ? 'Page Not Found' : 'Error'}
        </h1>
        <p${pClasses}>
          {error.status === 404
            ? "The page you're looking for doesn't exist."
            : error.statusText || 'An error occurred.'}
        </p>
        <Link to="/"${linkClasses}>
          Go back home
        </Link>
      </main>
    );
  }

  // JavaScript/runtime error
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

      <Link to="/"${linkClasses}>
        Go back home
      </Link>
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

/**
 * Generate dynamic route example - blog/[slug].tsx
 */
function generateDynamicRoute(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { LoaderArgs, MetaArgs, RouteConfig } from '@ereo/core';
import { Link } from '@ereo/client';`
    : `import { Link } from '@ereo/client';`;

  const loaderType = typescript ? ': LoaderArgs' : '';
  const configType = typescript ? ': RouteConfig' : '';
  const postType = typescript ? `
interface Post {
  slug: string;
  title: string;
  content: string;
  author: string;
  publishedAt: string;
}` : '';
  const metaType = typescript ? ': MetaArgs<Post>' : '';
  const propsType = typescript ? ': { loaderData: Post }' : '';

  const tailwindStyles = template === 'tailwind';
  const articleClasses = tailwindStyles
    ? ' className="max-w-3xl mx-auto p-8"'
    : '';
  const backLinkClasses = tailwindStyles
    ? ' className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-6 inline-block"'
    : '';
  const h1Classes = tailwindStyles
    ? ' className="text-4xl font-bold mb-4"'
    : '';
  const metaClasses = tailwindStyles
    ? ' className="text-gray-500 dark:text-gray-400 mb-8"'
    : '';
  const contentClasses = tailwindStyles
    ? ' className="prose dark:prose-invert max-w-none"'
    : '';

  return `${imports}
${postType}

/**
 * Route Configuration for dynamic routes
 *
 * Cache by slug parameter for efficient CDN caching.
 */
export const config${configType} = {
  cache: {
    edge: {
      maxAge: 3600,
      staleWhileRevalidate: 86400,
    },
    data: {
      // Dynamic tags based on the slug parameter
      tags: (params) => ['blog', \`post:\${params.slug}\`],
    },
  },
};

/**
 * Loader - Fetch blog post by slug
 *
 * The slug parameter comes from the [slug] in the filename.
 * Access via params.slug.
 */
export async function loader({ params, context }${loaderType})${typescript ? ': Promise<Post>' : ''} {
  const { slug } = params;

  // In a real app, fetch from database or CMS
  // Example: const post = await db.posts.findBySlug(slug);

  // Mock data for demonstration
  const posts${typescript ? ': Record<string, Post>' : ''} = {
    'hello-world': {
      slug: 'hello-world',
      title: 'Hello World',
      content: 'This is the first blog post using EreoJS framework. It demonstrates dynamic routing with [slug] parameters.',
      author: 'EreoJS Team',
      publishedAt: '2024-01-15',
    },
    'getting-started': {
      slug: 'getting-started',
      title: 'Getting Started with EreoJS',
      content: 'Learn how to build blazing fast applications with EreoJS and Bun. This guide covers loaders, actions, and islands architecture.',
      author: 'EreoJS Team',
      publishedAt: '2024-01-20',
    },
  };

  const post = posts[slug${typescript ? ' as string' : ''}];

  if (!post) {
    throw new Response('Post not found', { status: 404 });
  }

  return post;
}

/**
 * Meta - Generate SEO tags from post data
 */
export function meta({ data }${metaType}) {
  return [
    { title: \`\${data.title} - Blog\` },
    { name: 'description', content: data.content.slice(0, 160) },
    { property: 'og:title', content: data.title },
    { property: 'og:type', content: 'article' },
    { property: 'article:author', content: data.author },
    { property: 'article:published_time', content: data.publishedAt },
  ];
}

/**
 * Blog Post Page
 */
export default function BlogPost({ loaderData: post }${propsType}) {
  return (
    <article${articleClasses}>
      <Link to="/blog"${backLinkClasses}>
        ← Back to Blog
      </Link>

      <h1${h1Classes}>{post.title}</h1>

      <div${metaClasses}>
        By {post.author} • {new Date(post.publishedAt).toLocaleDateString()}
      </div>

      <div${contentClasses}>
        <p>{post.content}</p>
      </div>
    </article>
  );
}
`.trim();
}

/**
 * Generate blog index page
 */
function generateBlogIndex(template: string, typescript: boolean): string {
  const imports = typescript
    ? `import type { LoaderArgs, MetaArgs } from '@ereo/core';
import { Link } from '@ereo/client';`
    : `import { Link } from '@ereo/client';`;

  const loaderType = typescript ? ': LoaderArgs' : '';
  const postType = typescript ? `
interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
}` : '';
  const metaType = typescript ? ': MetaArgs<PostSummary[]>' : '';
  const propsType = typescript ? ': { loaderData: PostSummary[] }' : '';

  const tailwindStyles = template === 'tailwind';
  const mainClasses = tailwindStyles
    ? ' className="max-w-3xl mx-auto p-8"'
    : '';
  const h1Classes = tailwindStyles
    ? ' className="text-4xl font-bold mb-8"'
    : '';
  const listClasses = tailwindStyles
    ? ' className="space-y-6"'
    : '';
  const cardClasses = tailwindStyles
    ? ' className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"'
    : '';
  const titleClasses = tailwindStyles
    ? ' className="text-xl font-semibold text-blue-600 dark:text-blue-400 hover:underline"'
    : '';
  const dateClasses = tailwindStyles
    ? ' className="text-sm text-gray-500 dark:text-gray-400 mt-1"'
    : '';
  const excerptClasses = tailwindStyles
    ? ' className="text-gray-600 dark:text-gray-300 mt-2"'
    : '';

  return `${imports}
${postType}

/**
 * Meta - Blog listing page
 */
export function meta() {
  return [
    { title: 'Blog - EreoJS App' },
    { name: 'description', content: 'Read our latest blog posts' },
  ];
}

/**
 * Loader - Fetch all blog posts
 */
export async function loader({ context }${loaderType})${typescript ? ': Promise<PostSummary[]>' : ''} {
  // Set cache for the listing page
  context.cache.set({
    maxAge: 300,
    tags: ['blog', 'blog-list'],
  });

  // In a real app, fetch from database
  // Example: const posts = await db.posts.findMany({ orderBy: { publishedAt: 'desc' } });

  return [
    {
      slug: 'getting-started',
      title: 'Getting Started with EreoJS',
      excerpt: 'Learn how to build blazing fast applications with EreoJS and Bun.',
      publishedAt: '2024-01-20',
    },
    {
      slug: 'hello-world',
      title: 'Hello World',
      excerpt: 'This is the first blog post using EreoJS framework.',
      publishedAt: '2024-01-15',
    },
  ];
}

/**
 * Blog Index Page
 */
export default function BlogIndex({ loaderData: posts }${propsType}) {
  return (
    <main${mainClasses}>
      <h1${h1Classes}>Blog</h1>

      <ul${listClasses}>
        {posts.map((post) => (
          <li key={post.slug}${cardClasses}>
            <Link to={\`/blog/\${post.slug}\`}${titleClasses}>
              {post.title}
            </Link>
            <p${dateClasses}>
              {new Date(post.publishedAt).toLocaleDateString()}
            </p>
            <p${excerptClasses}>{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
`.trim();
}

/**
 * Generate API route example
 */
function generateApiRoute(typescript: boolean): string {
  const typeAnnotations = typescript
    ? `
interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
}
`
    : '';

  const loaderType = typescript ? ': LoaderArgs' : '';
  const returnType = typescript ? ': Promise<Response>' : '';

  return `/**
 * API Route Example - /api/health
 *
 * API routes return Response objects directly.
 * They don't render React components.
 *
 * Common patterns:
 * - GET  /api/health     -> Health check
 * - GET  /api/users      -> List users
 * - POST /api/users      -> Create user
 * - GET  /api/users/[id] -> Get user by ID
 */
import type { LoaderArgs, ActionArgs } from '@ereo/core';
import { json } from '@ereo/data';
${typeAnnotations}
const startTime = Date.now();

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancers.
 */
export async function loader({ request, context }${loaderType})${returnType} {
  const health${typescript ? ': HealthResponse' : ''} = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return json(health, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * POST /api/health
 *
 * Example of handling POST requests in API routes.
 * Use this pattern for webhooks, form submissions, etc.
 */
export async function action({ request, context }${typescript ? ': ActionArgs' : ''})${returnType} {
  // Only allow POST
  if (request.method !== 'POST') {
    return json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  // Parse request body
  const body = await request.json().catch(() => ({}));

  // Example: Log the health check ping
  console.log('Health check ping received:', body);

  return json({ received: true, timestamp: new Date().toISOString() });
}
`.trim();
}

/**
 * Generate Dockerfile for multi-stage build
 */
function generateDockerfile(): string {
  return `# ---- Build Stage ----
FROM oven/bun:1 AS build

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source files
COPY app/ ./app/
COPY public/ ./public/
COPY ereo.config.ts tsconfig.json ./

# Build for production
RUN bun run build

# ---- Production Stage ----
FROM oven/bun:1-slim

WORKDIR /app

# Copy package manifests and install production deps only
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy source (needed by ereo start for route discovery)
COPY app/ ./app/
COPY ereo.config.ts ./

# Copy build output from build stage
COPY --from=build /app/.ereo ./.ereo

# Expose port
EXPOSE 3000

# Run production server
CMD ["bun", "run", "start"]
`.trim();
}

/**
 * Generate .dockerignore
 */
function generateDockerignore(): string {
  return `node_modules
.ereo
.env
.env.local
.env.*.local
*.log
.DS_Store
.git
.gitignore
`.trim();
}
