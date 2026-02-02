/**
 * @oreo/rsc - Tests for React Server Components
 */

import { describe, it, expect } from 'bun:test';
import {
  serializeRSC,
  parseRSCStream,
  isServerComponent,
  isClientComponent,
  createRSCRenderConfig,
} from './rsc';

describe('serializeRSC', () => {
  it('should serialize a simple component', async () => {
    // Create a mock React element
    const element = {
      type: 'div',
      props: { children: 'Hello' },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = await parseRSCStream(stream);

    expect(result).toHaveProperty('type', 'rsc');
    expect(result).toHaveProperty('component');
    expect(result).toHaveProperty('clientRefs');
  });

  it('should return a readable stream', () => {
    const element = { type: 'div', props: {} };
    const stream = serializeRSC(element as React.ReactElement);

    expect(stream).toBeInstanceOf(ReadableStream);
  });
});

describe('parseRSCStream', () => {
  it('should parse a serialized stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"test": true}'));
        controller.close();
      },
    });

    const result = await parseRSCStream(stream);
    expect(result).toEqual({ test: true });
  });

  it('should handle multiple chunks', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"part": 1'));
        controller.enqueue(encoder.encode(', "part": 2}'));
        controller.close();
      },
    });

    const result = await parseRSCStream(stream);
    expect(result).toEqual({ part: 2 });
  });
});

describe('isServerComponent', () => {
  it('should return true for "use server" directive', () => {
    function serverComponent() {
      'use server';
      return null;
    }
    expect(isServerComponent(serverComponent)).toBe(true);
  });

  it('should return true for "use rsc" directive', () => {
    function rscComponent() {
      'use rsc';
      return null;
    }
    expect(isServerComponent(rscComponent)).toBe(true);
  });

  it('should return false for client component', () => {
    function clientComponent() {
      'use client';
      return null;
    }
    expect(isServerComponent(clientComponent)).toBe(false);
  });

  it('should return false for regular function', () => {
    function regularComponent() {
      return null;
    }
    expect(isServerComponent(regularComponent)).toBe(false);
  });

  it('should return false for non-functions', () => {
    expect(isServerComponent(null)).toBe(false);
    expect(isServerComponent(undefined)).toBe(false);
    expect(isServerComponent('string')).toBe(false);
    expect(isServerComponent(123)).toBe(false);
  });
});

describe('isClientComponent', () => {
  it('should return true for "use client" directive', () => {
    function clientComponent() {
      'use client';
      return null;
    }
    expect(isClientComponent(clientComponent)).toBe(true);
  });

  it('should return false for server component', () => {
    function serverComponent() {
      'use server';
      return null;
    }
    expect(isClientComponent(serverComponent)).toBe(false);
  });

  it('should return false for regular function', () => {
    function regularComponent() {
      return null;
    }
    expect(isClientComponent(regularComponent)).toBe(false);
  });

  it('should return false for non-functions', () => {
    expect(isClientComponent(null)).toBe(false);
    expect(isClientComponent(undefined)).toBe(false);
  });
});

describe('createRSCRenderConfig', () => {
  it('should create RSC render config', () => {
    const config = createRSCRenderConfig();

    expect(config.mode).toBe('rsc');
    expect(config.streaming?.enabled).toBe(true);
  });

  it('should merge custom config', () => {
    const config = createRSCRenderConfig({
      enabled: true,
      clientManifest: { 'Component.tsx': 'client' },
    });

    expect(config.mode).toBe('rsc');
    expect(config.enabled).toBe(true);
    expect(config.clientManifest).toEqual({ 'Component.tsx': 'client' });
  });
});
