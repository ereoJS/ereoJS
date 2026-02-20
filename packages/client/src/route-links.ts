/**
 * @ereo/client - Route Links Manager
 *
 * Manages per-route link elements (<link>) in the document <head>.
 * When navigating between routes, old route links are removed and
 * new ones are injected, ensuring each route gets its own CSS/assets.
 */

import type { LinkDescriptor } from '@ereo/core';

/** Marker attribute to identify Ereo-managed link elements */
const EREO_LINK_ATTR = 'data-ereo-link';

/** Currently active route link elements */
let activeLinks: HTMLLinkElement[] = [];

/**
 * Render link descriptors as HTML string (for SSR).
 * Used when the server needs to inject links into a layout component.
 */
export function renderLinkTags(links: LinkDescriptor[]): string {
  return links
    .map((link) => {
      const attrs = Object.entries(link)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
        .join(' ');
      return `<link ${attrs} ${EREO_LINK_ATTR}>`;
    })
    .join('\n');
}

/**
 * Update the document <head> with new route link descriptors.
 * Removes previous route links and adds new ones.
 *
 * This is called during client-side navigation after receiving
 * the JSON response with link descriptors.
 */
export function updateRouteLinks(links: LinkDescriptor[]): void {
  if (typeof document === 'undefined') return;

  // Remove previous route links
  removeRouteLinks();

  // Add new links
  const head = document.head;
  const newLinks: HTMLLinkElement[] = [];

  for (const descriptor of links) {
    const link = document.createElement('link');

    for (const [key, value] of Object.entries(descriptor)) {
      if (value !== undefined) {
        link.setAttribute(key, String(value));
      }
    }

    link.setAttribute(EREO_LINK_ATTR, '');
    head.appendChild(link);
    newLinks.push(link);
  }

  activeLinks = newLinks;
}

/**
 * Remove all Ereo-managed route links from <head>.
 */
export function removeRouteLinks(): void {
  if (typeof document === 'undefined') return;

  for (const link of activeLinks) {
    link.parentNode?.removeChild(link);
  }
  activeLinks = [];
}

/**
 * Get the currently active route link descriptors count.
 */
export function getActiveLinksCount(): number {
  return activeLinks.length;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
