/**
 * @areo/cli - Create Command
 *
 * Create a new Areo project.
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

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mAreo\x1b[0m Create Project\n');
  console.log(`  Creating ${projectName} with ${template} template...\n`);

  const projectDir = join(process.cwd(), projectName);

  // Create project structure
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, 'app/routes'), { recursive: true });
  await mkdir(join(projectDir, 'public'), { recursive: true });

  // Generate files based on template
  const files = generateTemplateFiles(template, typescript);

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
  typescript: boolean
): Record<string, string> {
  const ext = typescript ? 'tsx' : 'jsx';
  const files: Record<string, string> = {};

  // package.json
  files['package.json'] = JSON.stringify(
    {
      name: 'areo-app',
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'areo dev',
        build: 'areo build',
        start: 'areo start',
      },
      dependencies: {
        '@areo/core': '^0.1.0',
        '@areo/router': '^0.1.0',
        '@areo/server': '^0.1.0',
        '@areo/client': '^0.1.0',
        '@areo/data': '^0.1.0',
        '@areo/cli': '^0.1.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: typescript
        ? {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            typescript: '^5.4.0',
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
        include: ['app/**/*', 'areo.config.ts'],
      },
      null,
      2
    );
  }

  // Areo config
  files[`areo.config.${typescript ? 'ts' : 'js'}`] = `
import { defineConfig } from '@areo/core';
${template === 'tailwind' ? "import tailwind from '@areo/plugin-tailwind';" : ''}

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'bun',
  },
  plugins: [
    ${template === 'tailwind' ? 'tailwind(),' : ''}
  ],
});
  `.trim();

  // Root layout
  files[`app/routes/_layout.${ext}`] = `
${typescript ? "import type { RouteComponentProps } from '@areo/core';" : ''}

export default function RootLayout({ children }${typescript ? ': RouteComponentProps' : ''}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Areo App</title>
        ${template === 'tailwind' ? '<link rel="stylesheet" href="/__tailwind.css" />' : ''}
      </head>
      <body${template === 'tailwind' ? ' className="min-h-screen bg-white dark:bg-gray-900"' : ''}>
        {children}
      </body>
    </html>
  );
}
  `.trim();

  // Index page
  files[`app/routes/index.${ext}`] = `
${typescript ? "import type { LoaderArgs } from '@areo/core';" : ''}

export async function loader({ request }${typescript ? ': LoaderArgs' : ''}) {
  return {
    message: 'Welcome to Areo!',
    timestamp: new Date().toISOString(),
  };
}

export default function HomePage({ loaderData }${typescript ? ': { loaderData: { message: string; timestamp: string } }' : ''}) {
  return (
    <main${template === 'tailwind' ? ' className="flex flex-col items-center justify-center min-h-screen p-8"' : ''}>
      <h1${template === 'tailwind' ? ' className="text-4xl font-bold text-gray-900 dark:text-white mb-4"' : ''}>
        {loaderData.message}
      </h1>
      <p${template === 'tailwind' ? ' className="text-gray-600 dark:text-gray-400"' : ''}>
        Server time: {loaderData.timestamp}
      </p>
    </main>
  );
}
  `.trim();

  // About page
  files[`app/routes/about.${ext}`] = `
export default function AboutPage() {
  return (
    <main${template === 'tailwind' ? ' className="flex flex-col items-center justify-center min-h-screen p-8"' : ''}>
      <h1${template === 'tailwind' ? ' className="text-4xl font-bold text-gray-900 dark:text-white mb-4"' : ''}>
        About
      </h1>
      <p${template === 'tailwind' ? ' className="text-gray-600 dark:text-gray-400"' : ''}>
        Built with Areo Framework
      </p>
    </main>
  );
}
  `.trim();

  // Tailwind config (if using tailwind template)
  if (template === 'tailwind') {
    files['tailwind.config.js'] = `
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
    `.trim();

    files['app/globals.css'] = `
@tailwind base;
@tailwind components;
@tailwind utilities;
    `.trim();
  }

  // .gitignore
  files['.gitignore'] = `
node_modules
.areo
dist
*.log
.DS_Store
  `.trim();

  return files;
}
