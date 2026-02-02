#!/usr/bin/env bun
/**
 * create-areo
 *
 * Scaffold a new Areo project.
 * Usage: bunx create-areo my-app
 */

import { join, resolve } from 'node:path';
import { mkdir, copyFile, readdir } from 'node:fs/promises';

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
  \x1b[36m⬡\x1b[0m \x1b[1mCreate Areo App\x1b[0m

  A React fullstack framework built on Bun.
`);
}

/**
 * Print help.
 */
function printHelp(): void {
  console.log(`
  \x1b[1mUsage:\x1b[0m
    bunx create-areo <project-name> [options]

  \x1b[1mOptions:\x1b[0m
    -t, --template <name>   Template to use (minimal, default, tailwind)
    --no-typescript         Use JavaScript instead of TypeScript
    --no-git                Skip git initialization
    --no-install            Skip package installation

  \x1b[1mExamples:\x1b[0m
    bunx create-areo my-app
    bunx create-areo my-app --template minimal
    bunx create-areo my-app --no-typescript
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
      options.template = args[++i] as Template;
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
 * Generate project files.
 */
async function generateProject(
  projectDir: string,
  projectName: string,
  options: CreateOptions
): Promise<void> {
  const { template, typescript } = options;
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
      ...(template === 'tailwind' ? { '@areo/plugin-tailwind': '^0.1.0' } : {}),
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: typescript
      ? {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          typescript: '^5.4.0',
          ...(template === 'tailwind' ? { tailwindcss: '^3.4.0' } : {}),
        }
      : template === 'tailwind'
        ? { tailwindcss: '^3.4.0' }
        : {},
  };

  await Bun.write(
    join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

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

    await Bun.write(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
  }

  // Areo config
  const areoConfig = `
import { defineConfig } from '@areo/core';
${template === 'tailwind' ? "import tailwind from '@areo/plugin-tailwind';" : ''}

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    ${template === 'tailwind' ? 'tailwind(),' : ''}
  ],
});
`.trim();

  await Bun.write(join(projectDir, `areo.config.${typescript ? 'ts' : 'js'}`), areoConfig);

  // Root layout
  const layout = `
export default function RootLayout({ children }${typescript ? ': { children: React.ReactNode }' : ''}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${projectName}</title>
        ${template === 'tailwind' ? '<link rel="stylesheet" href="/app/styles.css" />' : ''}
      </head>
      <body${template === 'tailwind' ? ' className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"' : ''}>
        {children}
      </body>
    </html>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/_layout.${ext}`), layout);

  // Index page
  const indexPage = `
export async function loader() {
  return {
    message: 'Welcome to Areo!',
    time: new Date().toLocaleTimeString(),
  };
}

export default function HomePage({ loaderData }${typescript ? ': { loaderData: { message: string; time: string } }' : ''}) {
  return (
    <main${template === 'tailwind' ? ' className="min-h-screen flex flex-col items-center justify-center p-8"' : ''}>
      <div${template === 'tailwind' ? ' className="text-center"' : ''}>
        <h1${template === 'tailwind' ? ' className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"' : ''}>
          {loaderData.message}
        </h1>
        <p${template === 'tailwind' ? ' className="text-gray-600 dark:text-gray-400 mb-8"' : ''}>
          Server rendered at {loaderData.time}
        </p>
        <div${template === 'tailwind' ? ' className="flex gap-4 justify-center"' : ''}>
          <a
            href="/about"
            ${template === 'tailwind' ? 'className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"' : ''}
          >
            Learn More
          </a>
          <a
            href="https://github.com/areo-js/areo"
            target="_blank"
            ${template === 'tailwind' ? 'className="px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"' : ''}
          >
            GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/index.${ext}`), indexPage);

  // About page
  const aboutPage = `
export default function AboutPage() {
  return (
    <main${template === 'tailwind' ? ' className="min-h-screen flex flex-col items-center justify-center p-8"' : ''}>
      <h1${template === 'tailwind' ? ' className="text-4xl font-bold mb-4"' : ''}>About</h1>
      <p${template === 'tailwind' ? ' className="text-gray-600 dark:text-gray-400 max-w-md text-center"' : ''}>
        Built with Areo - a React fullstack framework powered by Bun.
      </p>
      <a
        href="/"
        ${template === 'tailwind' ? 'className="mt-8 text-blue-500 hover:underline"' : ''}
      >
        ← Back home
      </a>
    </main>
  );
}
`.trim();

  await Bun.write(join(projectDir, `app/routes/about.${ext}`), aboutPage);

  // Tailwind files
  if (template === 'tailwind') {
    const tailwindConfig = `
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

    await Bun.write(join(projectDir, 'tailwind.config.js'), tailwindConfig);

    const styles = `
@tailwind base;
@tailwind components;
@tailwind utilities;
`.trim();

    await Bun.write(join(projectDir, 'app/styles.css'), styles);
  }

  // .gitignore
  const gitignore = `
node_modules
.areo
dist
*.log
.DS_Store
.env
.env.local
`.trim();

  await Bun.write(join(projectDir, '.gitignore'), gitignore);

  // README
  const readme = `
# ${projectName}

A [Areo](https://github.com/areo-js/areo) project.

## Development

\`\`\`bash
bun install
bun run dev
\`\`\`

## Production

\`\`\`bash
bun run build
bun run start
\`\`\`

## Learn More

- [Areo Documentation](https://areo.dev/docs)
- [Bun Documentation](https://bun.sh/docs)
`.trim();

  await Bun.write(join(projectDir, 'README.md'), readme);
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

  const finalOptions: CreateOptions = { ...defaultOptions, ...options };
  const projectDir = resolve(process.cwd(), projectName);

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

  Happy coding! 🎉
`);
}

main().catch(console.error);
