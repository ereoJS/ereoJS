/**
 * @ereo/bundler - Island Extraction Plugin
 *
 * Extracts and processes island components for selective hydration.
 */

import type { Plugin } from '@ereo/core';

/**
 * Island metadata.
 */
export interface IslandMeta {
  id: string;
  name: string;
  file: string;
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'none';
  media?: string;
  exports: string[];
}

/**
 * Regex patterns for island detection.
 */
const ISLAND_DIRECTIVE_PATTERN = /client:(load|idle|visible|media)(?:="([^"]+)")?/g;
const COMPONENT_EXPORT_PATTERN = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g;
const USE_CLIENT_PATTERN = /^['"]use client['"]/m;

/**
 * Extract island metadata from file content.
 */
export function extractIslands(
  content: string,
  filePath: string
): IslandMeta[] {
  const islands: IslandMeta[] = [];

  // Check if file has 'use client' directive
  const isClientComponent = USE_CLIENT_PATTERN.test(content);

  if (!isClientComponent) {
    // Also check for island directives
    ISLAND_DIRECTIVE_PATTERN.lastIndex = 0;
    const hasDirectives = ISLAND_DIRECTIVE_PATTERN.test(content);
    if (!hasDirectives) {
      return islands;
    }
  }

  // Extract component names
  const componentNames: string[] = [];
  let match;

  COMPONENT_EXPORT_PATTERN.lastIndex = 0;
  while ((match = COMPONENT_EXPORT_PATTERN.exec(content)) !== null) {
    componentNames.push(match[1]);
  }

  // Create island entry for client components
  if (isClientComponent && componentNames.length > 0) {
    islands.push({
      id: generateIslandId(filePath),
      name: componentNames[0],
      file: filePath,
      strategy: 'load', // Default for 'use client'
      exports: componentNames,
    });
  }

  return islands;
}

/**
 * Generate unique island ID from file path.
 */
function generateIslandId(filePath: string): string {
  return filePath
    .replace(/[\/\\]/g, '_')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Transform JSX to add island markers.
 */
export function transformIslandJSX(code: string): string {
  // Add data attributes to components with hydration directives
  let transformed = code;
  let counter = 0;

  // Simple regex-based transform (a proper implementation would use an AST)
  transformed = transformed.replace(
    /<(\w+)\s+([^>]*client:(load|idle|visible|media)[^>]*)>/g,
    (match, tag, props, strategy) => {
      // Use a deterministic ID based on the component tag and its position in the file.
      // This ensures server and client builds produce identical IDs.
      const id = `island-${tag}-${counter++}`;
      return `<${tag} data-island="${id}" data-strategy="${strategy}" ${props}>`;
    }
  );

  return transformed;
}

/**
 * Generate island manifest.
 */
export function generateIslandManifest(islands: IslandMeta[]): string {
  const manifest: Record<string, Omit<IslandMeta, 'id'>> = {};

  for (const island of islands) {
    manifest[island.id] = {
      name: island.name,
      file: island.file,
      strategy: island.strategy,
      media: island.media,
      exports: island.exports,
    };
  }

  return JSON.stringify(manifest, null, 2);
}

/**
 * Generate island client bundle entry.
 */
export function generateIslandEntry(islands: IslandMeta[]): string {
  const imports: string[] = [];
  const registrations: string[] = [];

  for (const island of islands) {
    const importName = `Island_${island.id}`;
    imports.push(`import ${importName} from '${island.file}';`);
    registrations.push(`  registerIslandComponent('${island.name}', ${importName});`);
  }

  return `
import { registerIslandComponent, initializeIslands } from '@ereo/client';

// Import all islands
${imports.join('\n')}

// Register islands
${registrations.join('\n')}

// Initialize
initializeIslands();
  `.trim();
}

/**
 * Create island extraction plugin.
 */
export function createIslandsPlugin(): Plugin {
  let islands: IslandMeta[] = [];

  return {
    name: 'ereo:islands',

    buildStart() {
      // Clear accumulated islands from previous builds (e.g., in watch/dev mode)
      islands = [];
    },

    transform(code: string, id: string) {
      if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) {
        return null;
      }

      // Extract islands from this file
      const fileIslands = extractIslands(code, id);
      islands.push(...fileIslands);

      // Transform JSX if needed
      if (fileIslands.length > 0) {
        return transformIslandJSX(code);
      }

      return null;
    },

    async buildEnd() {
      if (islands.length === 0) {
        return;
      }

      console.log(`Found ${islands.length} island(s)`);

      // Write manifest
      const manifest = generateIslandManifest(islands);
      await Bun.write('.ereo/islands.json', manifest);

      // Write entry
      const entry = generateIslandEntry(islands);
      await Bun.write('.ereo/islands.entry.ts', entry);
    },
  };
}

/**
 * Get island by component name.
 */
export function findIslandByName(
  islands: IslandMeta[],
  name: string
): IslandMeta | undefined {
  return islands.find((i) => i.name === name);
}

/**
 * Check if a file contains islands.
 */
export function hasIslands(content: string): boolean {
  ISLAND_DIRECTIVE_PATTERN.lastIndex = 0;
  return USE_CLIENT_PATTERN.test(content) || ISLAND_DIRECTIVE_PATTERN.test(content);
}
