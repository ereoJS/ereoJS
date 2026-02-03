import { defineConfig } from '@ereo/core';
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwind(),
  ],
});
