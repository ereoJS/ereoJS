import { defineConfig } from '@areo/core';
import tailwind from '@areo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwind(),
  ],
});
