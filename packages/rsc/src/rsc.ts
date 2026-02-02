/**
 * @areo/rsc - React Server Components support
 *
 * Implements RSC rendering for the 'rsc' render mode.
 */

import type { RenderConfig } from '@areo/core';

/** RSC render configuration */
export interface RSCConfig {
  /** Enable React Server Components */
  enabled: boolean;
  /** Client reference manifest for bundling */
  clientManifest?: Record<string, unknown>;
  /** Server reference manifest */
  serverManifest?: Record<string, unknown>;
}

/** RSC payload chunk */
export interface RSCChunk {
  /** Chunk ID */
  id: string;
  /** Chunk data */
  data: unknown;
  /** Whether this is the final chunk */
  done: boolean;
}

/**
 * Serialize a server component tree to RSC format.
 * This creates a streamable payload that the client can reconstruct.
 */
export function serializeRSC(
  component: React.ReactElement,
  config?: RSCConfig
): ReadableStream<Uint8Array> {
  // Simplified RSC serialization
  // In production, this would use React's RSC renderer

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      try {
        // Serialize the component tree
        const payload = JSON.stringify({
          type: 'rsc',
          component: serializeComponent(component),
          clientRefs: extractClientReferences(component),
        });

        controller.enqueue(encoder.encode(payload));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Parse an RSC stream back into a component.
 */
export async function parseRSCStream(
  stream: ReadableStream<Uint8Array>
): Promise<unknown> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  const payload = chunks.map((c) => decoder.decode(c)).join('');

  return JSON.parse(payload);
}

/**
 * Check if a component is a server component.
 * Server components are marked with 'use server' or use .server/.rsc extensions.
 */
export function isServerComponent(component: unknown): boolean {
  if (typeof component !== 'function') return false;

  // Check for 'use server' directive
  const code = component.toString();
  return (
    code.includes('"use server"') ||
    code.includes("'use server'") ||
    code.includes('"use rsc"') ||
    code.includes("'use rsc'")
  );
}

/**
 * Check if a component is a client component.
 * Client components have 'use client' directive.
 */
export function isClientComponent(component: unknown): boolean {
  if (typeof component !== 'function') return false;

  const code = component.toString();
  return code.includes('"use client"') || code.includes("'use client'");
}

/**
 * Serialize a component tree for RSC transport.
 * This is a simplified version - real implementation would be more complex.
 */
function serializeComponent(component: React.ReactElement): unknown {
  if (!component) return null;

  const { type, props } = component;

  // Handle server components
  if (typeof type === 'function') {
    if (isClientComponent(type)) {
      return {
        type: 'client-ref',
        id: type.name || 'anonymous',
        props: serializeProps(props),
      };
    }

    // Server component - serialize the result
    return {
      type: 'server-component',
      name: type.name || 'anonymous',
      props: serializeProps(props),
    };
  }

  // Handle intrinsic elements (div, span, etc.)
  return {
    type: 'element',
    tag: type,
    props: serializeProps(props),
  };
}

/**
 * Serialize props for RSC transport.
 */
function serializeProps(props: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!props) return null;

  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (key === 'children') {
      if (Array.isArray(value)) {
        serialized[key] = value.map((child) =>
          typeof child === 'object' && child !== null
            ? serializeComponent(child as React.ReactElement)
            : child
        );
      } else if (typeof value === 'object' && value !== null) {
        serialized[key] = serializeComponent(value as React.ReactElement);
      } else {
        serialized[key] = value;
      }
    } else if (typeof value === 'function') {
      // Functions can't be serialized - mark as client ref
      serialized[key] = { type: 'client-ref', id: key };
    } else if (typeof value === 'object' && value !== null) {
      if (React.isValidElement(value)) {
        serialized[key] = serializeComponent(value as React.ReactElement);
      } else {
        serialized[key] = value;
      }
    } else {
      serialized[key] = value;
    }
  }

  return serialized;
}

/**
 * Extract client component references from a component tree.
 */
function extractClientReferences(component: React.ReactElement): string[] {
  const refs: string[] = [];

  function traverse(element: React.ReactElement) {
    if (!element) return;

    const { type, props } = element;

    if (typeof type === 'function' && isClientComponent(type)) {
      refs.push(type.name || 'anonymous');
    }

    if (props?.children) {
      const children = Array.isArray(props.children)
        ? props.children
        : [props.children];
      children.forEach((child) => {
        if (React.isValidElement(child)) {
          traverse(child as React.ReactElement);
        }
      });
    }
  }

  traverse(component);
  return [...new Set(refs)];
}

// Import React for isValidElement
import * as React from 'react';

/**
 * Render RSC mode configuration.
 */
export function createRSCRenderConfig(config?: RSCConfig): RenderConfig {
  return {
    mode: 'rsc',
    streaming: { enabled: true },
    ...config,
  };
}
