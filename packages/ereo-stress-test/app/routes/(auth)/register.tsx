import { getAuth } from '@ereo/auth';
import { emailExists, createUser, hashPassword } from '~/lib/db';

export async function loader({ context }: { context: any }) {
  try {
    const auth = getAuth(context);
    if (auth.isAuthenticated()) {
      return new Response(null, { status: 302, headers: { Location: '/tasks' } });
    }
  } catch {}
  return {};
}

export async function action({ request, context }: { request: Request; context: any }) {
  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const email = (formData.get('email') as string || '').trim().toLowerCase();
  const password = formData.get('password') as string || '';
  const confirmPassword = formData.get('confirmPassword') as string || '';

  // Validate
  const errors: Record<string, string> = {};
  if (!name || name.length < 2) errors.name = 'Name must be at least 2 characters';
  if (!email || !email.includes('@')) errors.email = 'Please enter a valid email';
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  // Check if email already exists
  if (emailExists(email)) {
    return { success: false, errors: { email: 'An account with this email already exists' } };
  }

  // Create user
  const passwordHash = await hashPassword(password);
  createUser(email, name, passwordHash);

  // Sign in the new user
  try {
    const auth = getAuth(context);
    await auth.signIn('credentials', { email, password });

    return new Response(null, {
      status: 303,
      headers: {
        Location: '/tasks',
        'Set-Cookie': auth.getCookieHeader() || '',
      },
    });
  } catch {
    // Account created but auto-login failed — redirect to login
    return new Response(null, { status: 303, headers: { Location: '/login' } });
  }
}

interface RegisterPageProps {
  actionData?: {
    success: boolean;
    errors?: Record<string, string>;
  };
}

export default function RegisterPage({ actionData }: RegisterPageProps) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Create your account</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Start organizing your tasks today
          </p>
        </div>

        <div className="card">
          <form method="POST" className="space-y-4">
            <div>
              <label htmlFor="name" className="label">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                required
                autoComplete="name"
                className="input"
                placeholder="Your name"
              />
              {actionData?.errors?.name && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
              {actionData?.errors?.email && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoComplete="new-password"
                minLength={8}
                className="input"
                placeholder="At least 8 characters"
              />
              {actionData?.errors?.password && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                autoComplete="new-password"
                className="input"
                placeholder="Repeat your password"
              />
              {actionData?.errors?.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-2.5"
            >
              Create account
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="text-primary-600 hover:underline font-medium">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}