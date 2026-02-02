import { defineConfig } from '@oreo/core';
import tailwind from '@oreo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwind(),
  ],
});
