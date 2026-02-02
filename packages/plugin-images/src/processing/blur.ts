/**
 * @areo/plugin-images - Blur Placeholder Generation
 *
 * Generate tiny blur placeholders for images (LQIP - Low Quality Image Placeholders).
 */

import sharp from 'sharp';
import { BLUR_WIDTH } from '../config/defaults';

/**
 * Options for blur placeholder generation.
 */
export interface BlurPlaceholderOptions {
  /** Width of the placeholder (default: 8px) */
  width?: number;
  /** Quality for encoding (default: 10) */
  quality?: number;
  /** Blur sigma (default: 1) */
  sigma?: number;
}

/**
 * Result of blur placeholder generation.
 */
export interface BlurPlaceholderResult {
  /** Base64-encoded data URL */
  dataURL: string;
  /** Width of the placeholder */
  width: number;
  /** Height of the placeholder */
  height: number;
}

/**
 * Generate a blur placeholder for an image.
 *
 * This creates a tiny (default 8px wide) blurred version of the image
 * encoded as a base64 data URL. The browser can display this immediately
 * while the full image loads, providing a smooth loading experience.
 *
 * @param input - Image buffer or file path
 * @param options - Generation options
 * @returns Base64-encoded data URL and dimensions
 */
export async function generateBlurPlaceholder(
  input: Buffer | string,
  options: BlurPlaceholderOptions = {}
): Promise<BlurPlaceholderResult> {
  const { width = BLUR_WIDTH, quality = 10, sigma = 1 } = options;

  // Get original dimensions to calculate aspect ratio
  const metadata = await sharp(input).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  // Calculate height to maintain aspect ratio
  const aspectRatio = metadata.width / metadata.height;
  const height = Math.round(width / aspectRatio);

  // Generate tiny blurred image
  const buffer = await sharp(input)
    .resize(width, height, {
      fit: 'fill',
    })
    .blur(sigma)
    .webp({
      quality,
      alphaQuality: quality,
      smartSubsample: true,
    })
    .toBuffer();

  // Convert to base64 data URL
  const base64 = buffer.toString('base64');
  const dataURL = `data:image/webp;base64,${base64}`;

  return {
    dataURL,
    width,
    height,
  };
}

/**
 * Generate a blur placeholder optimized for CSS background.
 *
 * This version uses even more aggressive compression for minimal size.
 *
 * @param input - Image buffer or file path
 * @returns Base64-encoded data URL
 */
export async function generateCSSBlurPlaceholder(input: Buffer | string): Promise<string> {
  const { dataURL } = await generateBlurPlaceholder(input, {
    width: 4, // Even smaller for CSS
    quality: 5,
    sigma: 2, // More blur
  });

  return dataURL;
}

/**
 * Generate a blur hash string.
 *
 * This is a compact representation that can be decoded client-side
 * without needing the actual image data embedded.
 *
 * Note: This is a simplified implementation. For production,
 * consider using the blurhash library for smaller strings.
 *
 * @param input - Image buffer or file path
 * @returns Blur placeholder result
 */
export async function generateBlurHash(input: Buffer | string): Promise<BlurPlaceholderResult> {
  // Get dimensions
  const metadata = await sharp(input).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  // Generate a 4x3 or 3x4 color grid depending on aspect ratio
  const isLandscape = metadata.width >= metadata.height;
  const gridWidth = isLandscape ? 4 : 3;
  const gridHeight = isLandscape ? 3 : 4;

  // Resize to grid size and get raw pixel data
  const { data, info } = await sharp(input)
    .resize(gridWidth, gridHeight, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Extract colors from the grid
  const colors: string[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    colors.push(rgbToHex(r, g, b));
  }

  // Create an SVG gradient representation
  const svg = createGradientSVG(colors, gridWidth, gridHeight);
  const base64 = Buffer.from(svg).toString('base64');
  const dataURL = `data:image/svg+xml;base64,${base64}`;

  return {
    dataURL,
    width: gridWidth,
    height: gridHeight,
  };
}

/**
 * Convert RGB values to hex color.
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Create an SVG with a gradient based on the color grid.
 */
function createGradientSVG(colors: string[], width: number, height: number): string {
  const cellWidth = 100 / width;
  const cellHeight = 100 / height;

  let rects = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const color = colors[index] || '#888';
      rects += `<rect x="${x * cellWidth}%" y="${y * cellHeight}%" width="${cellWidth + 0.5}%" height="${cellHeight + 0.5}%" fill="${color}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
<filter id="b" color-interpolation-filters="sRGB">
  <feGaussianBlur stdDeviation="1"/>
</filter>
<g filter="url(#b)">${rects}</g>
</svg>`.replace(/\n\s*/g, '');
}

/**
 * Generate a shimmer placeholder SVG.
 *
 * This creates an animated gradient placeholder that shows
 * a shimmer effect while the image loads.
 *
 * @param width - Width of the placeholder
 * @param height - Height of the placeholder
 * @param color - Base color (default: '#f3f4f6')
 * @returns SVG string
 */
export function generateShimmerSVG(
  width: number,
  height: number,
  color: string = '#f3f4f6'
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
<defs>
  <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="${color}">
      <animate attributeName="offset" values="-2;1" dur="1.5s" repeatCount="indefinite"/>
    </stop>
    <stop offset="50%" stop-color="#e5e7eb">
      <animate attributeName="offset" values="-1;2" dur="1.5s" repeatCount="indefinite"/>
    </stop>
    <stop offset="100%" stop-color="${color}">
      <animate attributeName="offset" values="0;3" dur="1.5s" repeatCount="indefinite"/>
    </stop>
  </linearGradient>
</defs>
<rect width="100%" height="100%" fill="url(#shimmer)"/>
</svg>`.replace(/\n\s*/g, '');
}

/**
 * Generate a shimmer placeholder as a data URL.
 */
export function generateShimmerDataURL(
  width: number,
  height: number,
  color?: string
): string {
  const svg = generateShimmerSVG(width, height, color);
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
