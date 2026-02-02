/**
 * @areo/plugin-images - TypeScript Declarations for Image Imports
 *
 * This file provides type declarations for importing image files.
 * Include this in your project's tsconfig.json:
 *
 * {
 *   "compilerOptions": {
 *     "types": ["@areo/plugin-images/image-types"]
 *   }
 * }
 *
 * Or add a reference in your app:
 * /// <reference types="@areo/plugin-images/image-types" />
 */

import type { StaticImageData } from './components/types';

declare module '*.jpg' {
  const content: StaticImageData;
  export default content;
}

declare module '*.jpeg' {
  const content: StaticImageData;
  export default content;
}

declare module '*.png' {
  const content: StaticImageData;
  export default content;
}

declare module '*.gif' {
  const content: StaticImageData;
  export default content;
}

declare module '*.webp' {
  const content: StaticImageData;
  export default content;
}

declare module '*.avif' {
  const content: StaticImageData;
  export default content;
}

declare module '*.svg' {
  const content: StaticImageData;
  export default content;
}

declare module '*.ico' {
  const content: StaticImageData;
  export default content;
}

declare module '*.bmp' {
  const content: StaticImageData;
  export default content;
}
