interface NavigationProps {
  user?: { name: string; email: string } | null;
}

export function Navigation({ user }: NavigationProps) {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href={user ? '/tasks' : '/'} className="flex items-center gap-2 group">
            <svg width="28" height="28" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:scale-110">
              <path d="M40 8L72 24V56L40 72L8 56V24L40 8Z" stroke="url(#nav-grad)" strokeWidth="3" fill="none" />
              <path d="M40 28L52 34V46L40 52L28 46V34L40 28Z" fill="url(#nav-grad)" />
              <defs>
                <linearGradient id="nav-grad" x1="8" y1="8" x2="72" y2="72">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-bold text-xl">ereo-stress-test</span>
          </a>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <a href="/tasks" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors">
                  Tasks
                </a>
                <a href="/tasks/new" className="btn btn-primary btn-sm">
                  New Task
                </a>
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-medium text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{user.name}</span>
                  </button>
                  <div className="absolute right-0 mt-0 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    <form method="POST" action="/logout">
                      <button
                        type="submit"
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors">
                  Sign in
                </a>
                <a href="/register" className="btn btn-primary btn-sm">
                  Get Started
                </a>
              </>
            )}
          </div>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-3">
            {user ? (
              <>
                <a href="/tasks/new" className="btn btn-primary btn-sm">New</a>
                <form method="POST" action="/logout">
                  <button type="submit" className="text-sm text-red-600 hover:text-red-700">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 transition-colors">
                  Sign in
                </a>
                <a href="/register" className="btn btn-primary btn-sm">
                  Get Started
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}