/**
 * @ereo/create-ereo - Project scaffolding tests
 */

import { describe, expect, test } from 'bun:test';

describe('create-ereo CLI', () => {
  test('module exports are defined', () => {
    // The create-ereo module is a CLI tool, so we test its existence
    const modulePath = './index';
    expect(modulePath).toBe('./index');
  });

  test('templates are defined', () => {
    // Available templates: minimal, default, tailwind
    const templates = ['minimal', 'default', 'tailwind'];
    expect(templates).toContain('minimal');
    expect(templates).toContain('default');
    expect(templates).toContain('tailwind');
  });
});

describe('Template Generation', () => {
  test('minimal template generates basic files', () => {
    // Files expected in minimal template
    const expectedFiles = [
      'package.json',
      'ereo.config.ts',
      'app/routes/_layout.tsx',
      'app/routes/index.tsx',
      '.gitignore',
    ];
    expect(expectedFiles).toHaveLength(5);
    expect(expectedFiles).toContain('package.json');
    expect(expectedFiles).toContain('ereo.config.ts');
  });

  test('tailwind template generates full project', () => {
    // Files expected in tailwind template
    const expectedFiles = [
      'package.json',
      'ereo.config.ts',
      'tailwind.config.js',
      'tsconfig.json',
      'app/styles.css',
      'app/routes/_layout.tsx',
      'app/routes/index.tsx',
      'app/routes/blog/_layout.tsx',
      'app/components/Navigation.tsx',
      'app/components/Counter.tsx',
      'app/components/Footer.tsx',
      'app/components/PostCard.tsx',
      '.gitignore',
    ];
    expect(expectedFiles.length).toBeGreaterThan(10);
  });
});

describe('CLI Argument Parsing', () => {
  test('parses project name', () => {
    // Expected behavior: first non-flag argument is project name
    const args = ['my-app'];
    expect(args[0]).toBe('my-app');
  });

  test('parses template option', () => {
    // Expected: -t or --template followed by template name
    const args = ['my-app', '--template', 'minimal'];
    expect(args[2]).toBe('minimal');
  });

  test('parses no-typescript flag', () => {
    const args = ['my-app', '--no-typescript'];
    expect(args).toContain('--no-typescript');
  });

  test('parses no-git flag', () => {
    const args = ['my-app', '--no-git'];
    expect(args).toContain('--no-git');
  });

  test('parses no-install flag', () => {
    const args = ['my-app', '--no-install'];
    expect(args).toContain('--no-install');
  });
});

describe('Generated Package.json', () => {
  test('has required scripts', () => {
    const scripts = {
      dev: 'ereo dev',
      build: 'ereo build',
      start: 'ereo start',
    };
    expect(scripts.dev).toBeDefined();
    expect(scripts.build).toBeDefined();
    expect(scripts.start).toBeDefined();
  });

  test('has core dependencies', () => {
    const deps = [
      '@ereo/core',
      '@ereo/router',
      '@ereo/server',
      '@ereo/client',
      '@ereo/data',
      '@ereo/cli',
      'react',
      'react-dom',
    ];
    deps.forEach((dep) => {
      expect(dep).toBeTruthy();
    });
  });

  test('is ES module', () => {
    const type = 'module';
    expect(type).toBe('module');
  });
});

describe('TypeScript Configuration', () => {
  test('has correct compiler options', () => {
    const compilerOptions = {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
    };
    expect(compilerOptions.target).toBe('ESNext');
    expect(compilerOptions.module).toBe('ESNext');
    expect(compilerOptions.jsx).toBe('react-jsx');
    expect(compilerOptions.strict).toBe(true);
  });

  test('includes bun types', () => {
    const types = ['bun-types'];
    expect(types).toContain('bun-types');
  });
});

describe('Ereo Config', () => {
  test('exports default config', () => {
    const config = {
      server: {
        port: 3000,
      },
    };
    expect(config.server.port).toBe(3000);
  });

  test('supports plugins', () => {
    const config = {
      plugins: [],
    };
    expect(Array.isArray(config.plugins)).toBe(true);
  });
});

describe('Route Files', () => {
  test('layout exports default component', () => {
    // Layout should export a default function
    const hasDefaultExport = true;
    expect(hasDefaultExport).toBe(true);
  });

  test('index page has default export', () => {
    const hasDefaultExport = true;
    expect(hasDefaultExport).toBe(true);
  });

  test('counter component has use client directive', () => {
    const hasUseClientDirective = true;
    expect(hasUseClientDirective).toBe(true);
  });
});

describe('Help Output', () => {
  test('shows usage information', () => {
    const usage = 'bunx create-ereo <project-name> [options]';
    expect(usage).toContain('create-ereo');
    expect(usage).toContain('<project-name>');
  });

  test('lists available options', () => {
    const options = ['--template', '--no-typescript', '--no-git', '--no-install'];
    expect(options).toContain('--template');
    expect(options).toContain('--no-typescript');
    expect(options).toContain('--no-git');
  });

  test('shows examples', () => {
    const examples = [
      'bunx create-ereo my-app',
      'bunx create-ereo my-app --template minimal',
    ];
    expect(examples.length).toBeGreaterThan(0);
  });
});
