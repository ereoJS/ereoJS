import { getAuth } from '@ereo/auth';

export async function loader({ context }: { context: any }) {
  try {
    const auth = getAuth(context);
    if (auth.isAuthenticated()) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/tasks' },
      });
    }
  } catch {
    // Not authenticated — show landing page
  }
  return {};
}

export default function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-24 sm:py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-transparent to-transparent dark:from-primary-950/20" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6 opacity-0 animate-slide-up">
            Built with EreoJS + SQLite
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 opacity-0 animate-slide-up delay-100">
            Organize your work,{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-purple-500">
              ship faster
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 opacity-0 animate-slide-up delay-200">
            A full-stack task manager showcasing authentication, SQLite database,
            and CRUD operations — all powered by EreoJS and Bun.
          </p>

          <div className="flex flex-wrap gap-4 justify-center opacity-0 animate-slide-up delay-300">
            <a href="/register" className="btn btn-primary text-base px-6 py-3">
              Get Started Free
            </a>
            <a href="/login" className="btn btn-secondary text-base px-6 py-3">
              Sign In
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Email & Password Auth',
                desc: 'Secure authentication with argon2id password hashing, JWT sessions, and protected routes.',
                icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
              },
              {
                title: 'SQLite + WAL Mode',
                desc: 'Production-ready SQLite with Write-Ahead Logging, prepared statements, and automatic migrations.',
                icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
              },
              {
                title: 'Full CRUD Operations',
                desc: 'Create, read, update, and delete tasks with server-side validation and error handling.',
                icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
              },
              {
                title: 'Server-Side Rendering',
                desc: 'Fast initial loads with SSR. Data fetched via loaders, mutations via actions.',
                icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2',
              },
              {
                title: 'File-Based Routing',
                desc: 'Routes map to files. Dynamic segments, layouts, route groups, and error boundaries.',
                icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
              },
              {
                title: 'Production Ready',
                desc: 'Docker support, environment configuration, secure cookies, and proper error handling.',
                icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
              },
            ].map((feature) => (
              <div key={feature.title} className="card hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-primary-100 dark:bg-primary-900/40">
                  <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Preview */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Simple, Powerful Patterns</h2>
            <p className="text-gray-600 dark:text-gray-400">Loaders fetch data. Actions handle mutations. It just works.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl overflow-hidden" style={{ background: '#1e1e2e' }}>
              <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-3 text-xs text-gray-500 font-mono">routes/tasks/index.tsx</span>
              </div>
              <pre className="px-5 py-4 font-mono text-sm text-primary-300 leading-relaxed overflow-x-auto">
{`// Server loader — fetches data
export async function loader({ context }) {
  const auth = getAuth(context);
  const user = auth.getUser();
  const tasks = getTasksByUser(user.id);
  return { tasks };
}

// Component renders with data
export default function Tasks({ loaderData }) {
  return (
    <div>
      {loaderData.tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}`}
              </pre>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: '#1e1e2e' }}>
              <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-3 text-xs text-gray-500 font-mono">routes/tasks/new.tsx</span>
              </div>
              <pre className="px-5 py-4 font-mono text-sm text-primary-300 leading-relaxed overflow-x-auto">
{`// Server action — handles mutations
export async function action({ request, context }) {
  const auth = getAuth(context);
  const user = auth.getUser();
  const form = await request.formData();

  const task = createTask(
    user.id,
    form.get('title'),
    form.get('description'),
    'todo',
    form.get('priority')
  );

  return Response.redirect('/tasks');
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get organized?</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Create your account and start managing tasks in seconds.</p>
        <a href="/register" className="btn btn-primary text-base px-8 py-3">
          Create Free Account
        </a>
      </section>
    </div>
  );
}