import { defineConfig } from '@ereo/core';
import { createAuthPlugin, credentials } from '@ereo/auth';

const plugins: any[] = [];

// Tailwind CSS — dev/build only
if (process.env.NODE_ENV !== 'production') {
  const { default: tailwind } = await import('@ereo/plugin-tailwind');
  plugins.push(tailwind());
}

// Database & auth helpers
const { findUserByEmail, verifyPassword } = await import('./app/lib/db');

// Authentication plugin — email/password with JWT sessions
plugins.push(
  createAuthPlugin({
    session: {
      strategy: 'jwt',
      secret: process.env.AUTH_SECRET || 'dev-only-please-change-in-production',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    },
    providers: [
      credentials({
        authorize: async (creds: Record<string, unknown>) => {
          const email = creds.email as string;
          const password = creds.password as string;
          if (!email || !password) return null;

          const user = findUserByEmail(email);
          if (!user) return null;

          const valid = await verifyPassword(password, user.password_hash);
          if (!valid) return null;

          return { id: String(user.id), email: user.email, name: user.name };
        },
      }),
    ],
    cookie: {
      name: 'ereo.session',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'bun',
  },
  plugins,
});