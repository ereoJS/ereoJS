/**
 * @areo/plugin-images - Dominant Color Extraction
 *
 * Extract dominant colors from images using k-means clustering.
 */

import sharp from 'sharp';

/**
 * RGB color representation.
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Color extraction result.
 */
export interface ColorExtractionResult {
  /** Primary dominant color */
  dominant: string;
  /** Palette of dominant colors */
  palette: string[];
  /** Primary color as RGB object */
  dominantRGB: RGBColor;
  /** Whether the image has significant transparency */
  hasTransparency: boolean;
}

/**
 * Options for color extraction.
 */
export interface ColorExtractionOptions {
  /** Number of colors to extract (default: 5) */
  colorCount?: number;
  /** Sample size for analysis (default: 64) */
  sampleSize?: number;
  /** Minimum saturation for "colorful" detection (default: 0.1) */
  minSaturation?: number;
  /** Transparency threshold (default: 0.5) */
  transparencyThreshold?: number;
}

/**
 * Extract dominant colors from an image using k-means clustering.
 *
 * @param input - Image buffer or file path
 * @param options - Extraction options
 * @returns Dominant color and palette
 */
export async function extractDominantColor(
  input: Buffer | string,
  options: ColorExtractionOptions = {}
): Promise<ColorExtractionResult> {
  const {
    colorCount = 5,
    sampleSize = 64,
    minSaturation = 0.1,
    transparencyThreshold = 0.5,
  } = options;

  // Resize to sample size and get raw pixel data
  const { data, info } = await sharp(input)
    .resize(sampleSize, sampleSize, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Extract pixel colors
  const pixels: RGBColor[] = [];
  let transparentPixels = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a < 128) {
      transparentPixels++;
      continue;
    }

    pixels.push({ r, g, b });
  }

  const hasTransparency = transparentPixels / totalPixels > transparencyThreshold;

  // If mostly transparent, return a default color
  if (pixels.length < 10) {
    return {
      dominant: 'rgb(128, 128, 128)',
      palette: ['rgb(128, 128, 128)'],
      dominantRGB: { r: 128, g: 128, b: 128 },
      hasTransparency: true,
    };
  }

  // Run k-means clustering
  const clusters = kMeansClustering(pixels, colorCount);

  // Sort by cluster size (most common first)
  clusters.sort((a, b) => b.count - a.count);

  // Convert to CSS colors
  const palette = clusters.map(({ centroid }) =>
    `rgb(${Math.round(centroid.r)}, ${Math.round(centroid.g)}, ${Math.round(centroid.b)})`
  );

  // Pick the most vibrant color from the top clusters as dominant
  let dominantIndex = 0;
  let maxVibrancy = 0;

  for (let i = 0; i < Math.min(3, clusters.length); i++) {
    const { centroid } = clusters[i];
    const vibrancy = getColorVibrancy(centroid);

    if (vibrancy > maxVibrancy && getSaturation(centroid) >= minSaturation) {
      maxVibrancy = vibrancy;
      dominantIndex = i;
    }
  }

  const dominantRGB = {
    r: Math.round(clusters[dominantIndex].centroid.r),
    g: Math.round(clusters[dominantIndex].centroid.g),
    b: Math.round(clusters[dominantIndex].centroid.b),
  };

  return {
    dominant: `rgb(${dominantRGB.r}, ${dominantRGB.g}, ${dominantRGB.b})`,
    palette,
    dominantRGB,
    hasTransparency,
  };
}

/**
 * K-means clustering for color extraction.
 */
interface Cluster {
  centroid: RGBColor;
  count: number;
}

function kMeansClustering(pixels: RGBColor[], k: number, iterations = 10): Cluster[] {
  // Initialize centroids using k-means++ method
  const centroids = initializeCentroids(pixels, k);

  for (let iter = 0; iter < iterations; iter++) {
    // Assign pixels to nearest centroid
    const assignments = new Array(k).fill(null).map(() => [] as RGBColor[]);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let nearestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = i;
        }
      }

      assignments[nearestCluster].push(pixel);
    }

    // Update centroids
    for (let i = 0; i < centroids.length; i++) {
      if (assignments[i].length > 0) {
        centroids[i] = calculateCentroid(assignments[i]);
      }
    }
  }

  // Count pixels per cluster
  const counts = new Array(k).fill(0);
  for (const pixel of pixels) {
    let minDist = Infinity;
    let nearestCluster = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = colorDistance(pixel, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        nearestCluster = i;
      }
    }

    counts[nearestCluster]++;
  }

  return centroids.map((centroid, i) => ({
    centroid,
    count: counts[i],
  }));
}

/**
 * Initialize centroids using k-means++ method.
 */
function initializeCentroids(pixels: RGBColor[], k: number): RGBColor[] {
  const centroids: RGBColor[] = [];

  // Pick first centroid randomly
  centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);

  // Pick remaining centroids with probability proportional to distance squared
  for (let i = 1; i < k; i++) {
    const distances = pixels.map((pixel) => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = colorDistance(pixel, centroid);
        if (dist < minDist) {
          minDist = dist;
        }
      }
      return minDist * minDist;
    });

    const totalDistance = distances.reduce((sum, d) => sum + d, 0);
    let threshold = Math.random() * totalDistance;

    for (let j = 0; j < pixels.length; j++) {
      threshold -= distances[j];
      if (threshold <= 0) {
        centroids.push(pixels[j]);
        break;
      }
    }
  }

  return centroids;
}

/**
 * Calculate the centroid (average) of a set of colors.
 */
function calculateCentroid(colors: RGBColor[]): RGBColor {
  const sum = colors.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b,
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: sum.r / colors.length,
    g: sum.g / colors.length,
    b: sum.b / colors.length,
  };
}

/**
 * Calculate Euclidean distance between two colors.
 */
function colorDistance(c1: RGBColor, c2: RGBColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Get color vibrancy (combination of saturation and lightness).
 */
function getColorVibrancy(color: RGBColor): number {
  const { r, g, b } = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const s = getSaturation(color);

  // Prefer colors that are neither too light nor too dark
  const lightnessScore = 1 - Math.abs(l - 0.5) * 2;

  return s * lightnessScore;
}

/**
 * Get color saturation (0-1).
 */
function getSaturation(color: RGBColor): number {
  const { r, g, b } = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === min) {
    return 0;
  }

  const l = (max + min) / 2;
  return l > 127.5
    ? (max - min) / (510 - max - min)
    : (max - min) / (max + min);
}

/**
 * Convert RGB to hex color.
 */
export function rgbToHex(color: RGBColor): string {
  const { r, g, b } = color;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Convert hex to RGB color.
 */
export function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Get a contrasting text color (black or white) for a background.
 */
export function getContrastColor(background: RGBColor): string {
  // Calculate relative luminance
  const luminance = (0.299 * background.r + 0.587 * background.g + 0.114 * background.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
