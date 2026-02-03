/**
 * @ereo/plugin-images - Plugin Implementation
 *
 * Core plugin that integrates image optimization into the EreoJS framework.
 */

import { join, relative, extname, dirname, basename } from 'node:path';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Plugin, PluginContext, DevServer } from '@ereo/core';
import type { ImagePluginConfig, StaticImageData } from './components/types';
import { validateConfig } from './config/schema';
import { SUPPORTED_INPUT_FORMATS, IMAGE_PATH_PREFIX, CACHE_DIR } from './config/defaults';
import { createImageProcessor, type ImageProcessor } from './processing/processor';
import { createBuildOptimizer, type BuildOptimizer } from './build/optimizer';
import { createManifestManager, type ImageManifestManager } from './build/manifest';
import { imageMiddleware } from './runtime/middleware';

/**
 * Virtual module prefix for image imports.
 */
const VIRTUAL_PREFIX = '\0ereo-image:';

/**
 * Image plugin state.
 */
interface PluginState {
  root: string;
  mode: 'development' | 'production';
  config: Required<ImagePluginConfig>;
  processor: ImageProcessor;
  manifest: ImageManifestManager;
  optimizer?: BuildOptimizer;
  processedImages: Map<string, StaticImageData>;
}

/**
 * Create the image optimization plugin.
 *
 * @param options - Plugin configuration
 * @returns EreoJS plugin
 *
 * @example
 * import images from '@ereo/plugin-images';
 *
 * export default defineConfig({
 *   plugins: [
 *     images({
 *       formats: { webp: true, avif: true },
 *       quality: 80,
 *     }),
 *   ],
 * });
 */
export function imagesPlugin(options: ImagePluginConfig = {}): Plugin {
  const config = validateConfig(options);
  let state: PluginState | null = null;

  return {
    name: 'ereo:images',

    async setup(context: PluginContext) {
      const { root, mode } = context;

      // Initialize processor
      const processor = createImageProcessor(config);

      // Initialize manifest
      const outDir = join(root, config.cacheDir || CACHE_DIR);
      const manifest = createManifestManager(outDir);
      await manifest.load();

      // Store state
      state = {
        root,
        mode,
        config,
        processor,
        manifest,
        processedImages: new Map(),
      };

      console.log(`  @ereo/plugin-images initialized (${mode} mode)`);
    },

    resolveId(id: string) {
      if (!state) return null;

      // Handle image imports
      const ext = extname(id).slice(1).toLowerCase();
      if (SUPPORTED_INPUT_FORMATS.includes(ext)) {
        // Check if the file exists
        const isAbsolute = id.startsWith('/') || id.startsWith(state.root);
        const fullPath = isAbsolute ? id : join(state.root, id);

        // Return a virtual module ID
        return `${VIRTUAL_PREFIX}${fullPath}`;
      }

      return null;
    },

    async load(id: string) {
      if (!state) return null;

      // Handle virtual image modules
      if (!id.startsWith(VIRTUAL_PREFIX)) {
        return null;
      }

      const imagePath = id.slice(VIRTUAL_PREFIX.length);

      try {
        // Check if already processed
        let imageData = state.processedImages.get(imagePath);

        if (!imageData) {
          // Process the image
          const buffer = await readFile(imagePath);
          const metadata = await state.processor.getMetadata(buffer);

          // Generate blur placeholder and dominant color
          let blurDataURL: string | undefined;
          let dominantColor: string | undefined;

          if (state.config.generateBlurPlaceholder) {
            try {
              const blur = await state.processor.generateBlur(buffer);
              blurDataURL = blur.dataURL;
            } catch {
              // Ignore blur generation errors
            }
          }

          if (state.config.extractDominantColor) {
            try {
              const colors = await state.processor.extractColor(buffer);
              dominantColor = colors.dominant;
            } catch {
              // Ignore color extraction errors
            }
          }

          // Calculate relative path from root for the src
          const relativePath = relative(state.root, imagePath);
          const publicPath = relativePath.startsWith('public/')
            ? `/${relativePath.slice('public/'.length)}`
            : `/${relativePath}`;

          imageData = {
            src: publicPath,
            width: metadata.width,
            height: metadata.height,
            blurDataURL,
            dominantColor,
            type: `image/${metadata.format}`,
          };

          state.processedImages.set(imagePath, imageData);
        }

        // Return as a JavaScript module
        return `export default ${JSON.stringify(imageData, null, 2)};`;
      } catch (error) {
        console.error(`Failed to process image: ${imagePath}`, error);
        return null;
      }
    },

    async transform(code: string, id: string) {
      // No code transformation needed for now
      // Could be extended to handle CSS background-image optimization
      return null;
    },

    async configureServer(server: DevServer) {
      if (!state) return;

      // Add image optimization middleware
      server.middlewares.push(
        imageMiddleware({
          root: state.root,
          config: state.config,
          cache: true,
          cacheDir: state.config.cacheDir,
        })
      );

      console.log(`  Image optimization endpoint: ${state.config.path || IMAGE_PATH_PREFIX}`);
    },

    async buildStart() {
      if (!state) return;

      // In production, run the build optimizer
      if (state.mode === 'production') {
        const outDir = join(state.root, '.ereo', 'public');

        state.optimizer = createBuildOptimizer({
          root: state.root,
          outDir,
          config: state.config,
          scanDirs: ['public', 'app/assets', 'assets'],
          onProgress: (current, total, file) => {
            process.stdout.write(`\r  Processing images: ${current}/${total} - ${file}`);
          },
        });

        const result = await state.optimizer.run();

        // Clear progress line
        process.stdout.write('\r' + ' '.repeat(80) + '\r');

        console.log(`  Processed ${result.processed} images (${result.skipped} skipped)`);
        console.log(`  Generated ${result.variants} variants (${formatBytes(result.totalSize)})`);

        if (result.errors.length > 0) {
          console.warn(`  ${result.errors.length} errors during image processing`);
          result.errors.forEach(({ file, error }) => {
            console.warn(`    - ${file}: ${error}`);
          });
        }
      }
    },

    async buildEnd() {
      if (!state) return;

      // Save manifest
      await state.manifest.save();

      // Log summary
      const imageCount = state.processedImages.size;
      if (imageCount > 0) {
        console.log(`  ${imageCount} images with metadata generated`);
      }
    },
  };
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default imagesPlugin;
