import { defineConfig, env } from '@ereo/core';
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
    // Enable development features
    development: process.env.NODE_ENV !== 'production',
  },
  build: {
    target: 'bun',
  },
  // Environment variable validation
  env: {
    NODE_ENV: env.enum(['development', 'production', 'test'] as const).default('development'),
    // Add your environment variables here:
    // DATABASE_URL: env.string().required(),
    // API_KEY: env.string(),
  },
  plugins: [
    tailwind(),
  ],
});