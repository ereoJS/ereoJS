import { defineConfig, env } from '@ereo/core';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'bun',
  },
  // New env validation feature
  env: {
    DATABASE_URL: env.string().required(),
    API_URL: env.url().required(),
    DEBUG: env.boolean().default(false),
    PORT: env.port().default(3000),
    ALLOWED_ORIGINS: env.array(),
    NODE_ENV: env.enum(['development', 'production', 'test'] as const).default('development'),
  },
  plugins: [],
});
