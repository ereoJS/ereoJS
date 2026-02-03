/**
 * @ereo/deploy-vercel - Vercel deployment adapter tests
 */

import { describe, expect, test } from 'bun:test';
import { vercel, generateVercelJson, generateBuildScript } from './index';

describe('vercel', () => {
  test('returns default Node.js configuration', () => {
    const config = vercel();
    expect(config).toEqual({
      build: {
        target: 'node',
      },
    });
  });

  test('returns edge configuration when edge is true', () => {
    const config = vercel({ edge: true });
    expect(config).toEqual({
      build: {
        target: 'edge',
      },
    });
  });

  test('returns node configuration when edge is false', () => {
    const config = vercel({ edge: false });
    expect(config).toEqual({
      build: {
        target: 'node',
      },
    });
  });

  test('handles all config options', () => {
    const config = vercel({
      edge: false,
      regions: ['us-east-1', 'us-west-1'],
      timeout: 30,
      memory: 1024,
      env: { KEY: 'value' },
    });
    // Only build target is returned
    expect(config.build?.target).toBe('node');
  });
});

describe('generateVercelJson', () => {
  test('generates basic vercel.json for Node.js', () => {
    const json = generateVercelJson({});
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
    expect(parsed.builds).toHaveLength(1);
    expect(parsed.builds[0].use).toBe('@vercel/node');
    expect(parsed.builds[0].src).toBe('dist/server.js');
  });

  test('generates edge runtime configuration', () => {
    const json = generateVercelJson({ edge: true });
    const parsed = JSON.parse(json);
    expect(parsed.builds[0].use).toBe('@vercel/edge');
    expect(parsed.functions).toBeDefined();
    expect(parsed.functions['dist/server.js'].runtime).toBe('edge');
  });

  test('includes regions when provided', () => {
    const json = generateVercelJson({
      regions: ['us-east-1', 'eu-west-1'],
    });
    const parsed = JSON.parse(json);
    expect(parsed.regions).toEqual(['us-east-1', 'eu-west-1']);
  });

  test('edge runtime includes regions', () => {
    const json = generateVercelJson({
      edge: true,
      regions: ['sfo1', 'iad1'],
    });
    const parsed = JSON.parse(json);
    expect(parsed.regions).toEqual(['sfo1', 'iad1']);
    expect(parsed.functions['dist/server.js'].regions).toEqual(['sfo1', 'iad1']);
  });

  test('routes catch-all path', () => {
    const json = generateVercelJson({});
    const parsed = JSON.parse(json);
    expect(parsed.routes).toHaveLength(1);
    expect(parsed.routes[0].src).toBe('/(.*)');
    expect(parsed.routes[0].dest).toBe('dist/server.js');
  });

  test('includesFiles is configured', () => {
    const json = generateVercelJson({});
    const parsed = JSON.parse(json);
    expect(parsed.builds[0].config.includeFiles).toContain('dist/**');
  });

  test('valid JSON output', () => {
    const json = generateVercelJson({
      edge: true,
      regions: ['fra1'],
    });
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('generateBuildScript', () => {
  test('generates bash script', () => {
    const script = generateBuildScript();
    expect(script).toContain('#!/bin/bash');
    expect(script).toContain('set -e');
  });

  test('includes build commands', () => {
    const script = generateBuildScript();
    expect(script).toContain('bun install');
    expect(script).toContain('bun run build');
  });

  test('creates dist/public directory', () => {
    const script = generateBuildScript();
    expect(script).toContain('mkdir -p dist/public');
    expect(script).toContain('cp -r public/* dist/public/');
  });

  test('prints messages', () => {
    const script = generateBuildScript();
    expect(script).toContain('Building for Vercel...');
    expect(script).toContain('Build complete!');
  });
});
