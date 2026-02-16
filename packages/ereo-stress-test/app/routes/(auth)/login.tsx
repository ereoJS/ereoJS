import { getAuth } from '@ereo/auth';

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
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const errors: Record<string, string> = {};
  if (!email) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

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
    return { success: false, errors: { form: 'Invalid email or password' } };
  }
}

interface LoginPageProps {
  actionData?: {
    success: boolean;
    errors?: Record<string, string>;
  };
}

export default function LoginPage({ actionData }: LoginPageProps) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sign in to manage your tasks
          </p>
        </div>

        <div className="card">
          {actionData?.errors?.form && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{actionData.errors.form}</p>
            </div>
          )}

          <form method="POST" className="space-y-4">
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
                autoComplete="current-password"
                className="input"
                placeholder="Your password"
              />
              {actionData?.errors?.password && (
                <p className="mt-1 text-sm text-red-600">{actionData.errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-2.5"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <a href="/register" className="text-primary-600 hover:underline font-medium">
              Create one
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}