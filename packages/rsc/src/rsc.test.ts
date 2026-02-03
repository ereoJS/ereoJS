/**
 * @ereo/rsc - Tests for React Server Components
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

describe('serializeRSC error handling', () => {
  it('should handle serialization errors', async () => {
    // Create an object that will throw during JSON.stringify
    const circular: { self?: unknown } = {};
    circular.self = circular;

    const element = {
      type: 'div',
      props: { data: circular },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const reader = stream.getReader();

    await expect(reader.read()).rejects.toThrow();
  });
});

describe('serializeRSC with function components', () => {
  it('should serialize client component as client-ref', async () => {
    function ClientComponent() {
      'use client';
      return null;
    }

    const element = {
      type: ClientComponent,
      props: { foo: 'bar' },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { type: string; id: string; props: { foo: string } };
    };

    expect(result.component.type).toBe('client-ref');
    expect(result.component.id).toBe('ClientComponent');
    expect(result.component.props).toEqual({ foo: 'bar' });
  });

  it('should serialize server component', async () => {
    function ServerComponent() {
      'use server';
      return null;
    }

    const element = {
      type: ServerComponent,
      props: { data: 'test' },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { type: string; name: string; props: { data: string } };
    };

    expect(result.component.type).toBe('server-component');
    expect(result.component.name).toBe('ServerComponent');
    expect(result.component.props).toEqual({ data: 'test' });
  });

  it('should serialize anonymous client component', async () => {
    const ClientComponent = function () {
      'use client';
      return null;
    };
    // Remove name to test anonymous handling
    Object.defineProperty(ClientComponent, 'name', { value: '' });

    const element = {
      type: ClientComponent,
      props: {},
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { type: string; id: string };
    };

    expect(result.component.type).toBe('client-ref');
    expect(result.component.id).toBe('anonymous');
  });

  it('should serialize anonymous server component', async () => {
    const ServerComponent = function () {
      'use server';
      return null;
    };
    Object.defineProperty(ServerComponent, 'name', { value: '' });

    const element = {
      type: ServerComponent,
      props: {},
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { type: string; name: string };
    };

    expect(result.component.type).toBe('server-component');
    expect(result.component.name).toBe('anonymous');
  });
});

describe('serializeRSC with complex props', () => {
  it('should serialize array children', async () => {
    const element = {
      type: 'div',
      props: {
        children: [
          { type: 'span', props: { children: 'first' } },
          { type: 'span', props: { children: 'second' } },
        ],
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { props: { children: unknown[] } };
    };

    expect(Array.isArray(result.component.props.children)).toBe(true);
    expect(result.component.props.children).toHaveLength(2);
  });

  it('should serialize array children with mixed types', async () => {
    const element = {
      type: 'div',
      props: {
        children: [
          'text content',
          { type: 'span', props: { children: 'element' } },
          123,
          null,
        ],
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { props: { children: unknown[] } };
    };

    expect(result.component.props.children[0]).toBe('text content');
    expect(result.component.props.children[2]).toBe(123);
  });

  it('should serialize single object child', async () => {
    const element = {
      type: 'div',
      props: {
        children: { type: 'span', props: { children: 'single' } },
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { props: { children: { type: string; tag: string } } };
    };

    expect(result.component.props.children.type).toBe('element');
    expect(result.component.props.children.tag).toBe('span');
  });

  it('should serialize primitive child', async () => {
    const element = {
      type: 'div',
      props: {
        children: 'text only',
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { props: { children: string } };
    };

    expect(result.component.props.children).toBe('text only');
  });

  it('should serialize function props as client refs', async () => {
    const element = {
      type: 'button',
      props: {
        onClick: () => console.log('clicked'),
        onHover: function handleHover() {},
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: {
        props: { onClick: { type: string; id: string }; onHover: { type: string; id: string } };
      };
    };

    expect(result.component.props.onClick.type).toBe('client-ref');
    expect(result.component.props.onClick.id).toBe('onClick');
    expect(result.component.props.onHover.type).toBe('client-ref');
    expect(result.component.props.onHover.id).toBe('onHover');
  });

  it('should serialize React element props', async () => {
    // Mock React.isValidElement to return true for our test object
    const React = await import('react');
    const originalIsValidElement = React.isValidElement;

    const iconElement = {
      type: 'svg',
      props: { width: 24 },
      $$typeof: Symbol.for('react.element'),
    };

    const element = {
      type: 'button',
      props: {
        icon: iconElement,
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { props: { icon: unknown } };
    };

    // The icon should be serialized (either as element or as-is depending on isValidElement)
    expect(result.component.props.icon).toBeDefined();
  });

  it('should serialize plain object props as-is', async () => {
    const element = {
      type: 'div',
      props: {
        style: { color: 'red', fontSize: 14 },
        data: { nested: { value: 'test' } },
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: {
        props: { style: { color: string; fontSize: number }; data: { nested: { value: string } } };
      };
    };

    expect(result.component.props.style).toEqual({ color: 'red', fontSize: 14 });
    expect(result.component.props.data).toEqual({ nested: { value: 'test' } });
  });

  it('should handle null props', async () => {
    const element = {
      type: 'div',
      props: null,
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = (await parseRSCStream(stream)) as {
      component: { props: null };
    };

    expect(result.component.props).toBeNull();
  });

  it('should handle null component', async () => {
    // Test with null passed directly - this tests the early return in serializeComponent
    const element = {
      type: 'div',
      props: {
        children: [null, undefined],
      },
    };

    const stream = serializeRSC(element as React.ReactElement);
    const result = await parseRSCStream(stream);
    expect(result).toBeDefined();
  });
});

describe('extractClientReferences', () => {
  it('should extract client component refs from tree', async () => {
    function ClientButton() {
      'use client';
      return null;
    }

    // Use React.createElement to create actual React elements that pass isValidElement
    const React = await import('react');
    const element = React.createElement('div', null, React.createElement(ClientButton, null));

    const stream = serializeRSC(element);
    const result = (await parseRSCStream(stream)) as { clientRefs: string[] };

    expect(result.clientRefs).toContain('ClientButton');
  });

  it('should extract anonymous client component refs', async () => {
    const ClientComponent = function () {
      'use client';
      return null;
    };
    Object.defineProperty(ClientComponent, 'name', { value: '' });

    const React = await import('react');
    const element = React.createElement('div', null, React.createElement(ClientComponent, null));

    const stream = serializeRSC(element);
    const result = (await parseRSCStream(stream)) as { clientRefs: string[] };

    expect(result.clientRefs).toContain('anonymous');
  });

  it('should deduplicate client refs', async () => {
    function ClientButton() {
      'use client';
      return null;
    }

    const React = await import('react');
    const element = React.createElement(
      'div',
      null,
      React.createElement(ClientButton, null),
      React.createElement(ClientButton, null)
    );

    const stream = serializeRSC(element);
    const result = (await parseRSCStream(stream)) as { clientRefs: string[] };

    // Should only have one entry for ClientButton
    const clientButtonCount = result.clientRefs.filter((ref) => ref === 'ClientButton').length;
    expect(clientButtonCount).toBe(1);
  });

  it('should handle nested children in extractClientReferences', async () => {
    function ClientButton() {
      'use client';
      return null;
    }

    const React = await import('react');
    const element = React.createElement(
      'div',
      null,
      React.createElement('section', null, React.createElement(ClientButton, null))
    );

    const stream = serializeRSC(element);
    const result = (await parseRSCStream(stream)) as { clientRefs: string[] };

    // Note: The implementation traverses nested children
    expect(result.clientRefs).toContain('ClientButton');
  });
});
