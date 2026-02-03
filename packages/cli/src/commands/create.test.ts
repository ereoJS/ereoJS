/**
 * Tests for CLI create command
 *
 * Verifies that:
 * 1. Package.json is generated with proper versioned dependencies (not workspace:*)
 * 2. All required files are generated
 * 3. TypeScript/JavaScript options work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdir, rm, readFile, access } from 'node:fs/promises';
import { create } from './create';

const TEST_DIR = join(import.meta.dir, '__test_projects__');

describe('create command', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory after each test
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('package.json generation', () => {
    it('should generate package.json with versioned dependencies, not workspace:*', async () => {
      const projectName = 'test-versioned-deps';
      const projectDir = join(TEST_DIR, projectName);

      // Change cwd temporarily
      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        await create(projectName, { template: 'minimal', typescript: true });

        const packageJsonPath = join(projectDir, 'package.json');
        const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);

        // Verify no workspace:* references
        const deps = packageJson.dependencies || {};
        for (const [name, version] of Object.entries(deps)) {
          expect(version).not.toContain('workspace:*');
          if (name.startsWith('@ereo/')) {
            expect(version).toMatch(/^\^?\d+\.\d+\.\d+/);
          }
        }

        // Verify specific versions
        expect(deps['@ereo/core']).toBe('^0.1.0');
        expect(deps['@ereo/router']).toBe('^0.1.0');
        expect(deps['@ereo/server']).toBe('^0.1.0');
        expect(deps['@ereo/client']).toBe('^0.1.0');
        expect(deps['@ereo/data']).toBe('^0.1.0');
        expect(deps['@ereo/cli']).toBe('^0.1.0');
        expect(deps['react']).toBe('^18.2.0');
        expect(deps['react-dom']).toBe('^18.2.0');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate TypeScript devDependencies when typescript is true', async () => {
      const projectName = 'test-typescript-deps';
      const projectDir = join(TEST_DIR, projectName);

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        await create(projectName, { template: 'minimal', typescript: true });

        const packageJsonPath = join(projectDir, 'package.json');
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

        expect(packageJson.devDependencies['@types/react']).toBe('^18.2.0');
        expect(packageJson.devDependencies['@types/react-dom']).toBe('^18.2.0');
        expect(packageJson.devDependencies['typescript']).toBe('^5.4.0');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should not include TypeScript devDependencies when typescript is false', async () => {
      const projectName = 'test-javascript-deps';
      const projectDir = join(TEST_DIR, projectName);

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        await create(projectName, { template: 'minimal', typescript: false });

        const packageJsonPath = join(projectDir, 'package.json');
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

        expect(packageJson.devDependencies).toEqual({});
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('file generation', () => {
    it('should create all required project files', async () => {
      const projectName = 'test-file-generation';
      const projectDir = join(TEST_DIR, projectName);

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        await create(projectName, { template: 'default', typescript: true });

        // Check required files exist
        const requiredFiles = [
          'package.json',
          'tsconfig.json',
          'ereo.config.ts',
          'app/routes/_layout.tsx',
          'app/routes/index.tsx',
          'app/routes/about.tsx',
          '.gitignore',
        ];

        for (const file of requiredFiles) {
          const filePath = join(projectDir, file);
          // access() returns undefined on success, but bun test resolves it as null
          // Just check the file exists by verifying no error is thrown
          await access(filePath);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should create JavaScript files when typescript is false', async () => {
      const projectName = 'test-js-files';
      const projectDir = join(TEST_DIR, projectName);

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        await create(projectName, { template: 'default', typescript: false });

        // Check JS files exist (not TSX)
        const jsFiles = [
          'ereo.config.js',
          'app/routes/_layout.jsx',
          'app/routes/index.jsx',
          'app/routes/about.jsx',
        ];

        for (const file of jsFiles) {
          const filePath = join(projectDir, file);
          await access(filePath);
        }

        // tsconfig.json should not exist
        const tsconfigPath = join(projectDir, 'tsconfig.json');
        await expect(access(tsconfigPath)).rejects.toThrow();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should create tailwind files when using tailwind template', async () => {
      const projectName = 'test-tailwind-files';
      const projectDir = join(TEST_DIR, projectName);

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        await create(projectName, { template: 'tailwind', typescript: true });

        // Check tailwind-specific files
        const tailwindFiles = [
          'tailwind.config.js',
          'app/globals.css',
        ];

        for (const file of tailwindFiles) {
          const filePath = join(projectDir, file);
          await access(filePath);
        }

        // Check tailwind.config.js content
        const tailwindConfig = await readFile(join(projectDir, 'tailwind.config.js'), 'utf-8');
        expect(tailwindConfig).toContain("'./app/**/*.{js,ts,jsx,tsx}'");
        expect(tailwindConfig).toContain("darkMode: 'class'");
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
