export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <span className="text-lg">&#x2B21;</span>
            <span>Built with EreoJS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <a href="https://ereojs.github.io/ereoJS/" target="_blank" rel="noopener" className="hover:text-primary-600 transition-colors">
              Docs
            </a>
            <a href="https://github.com/ereoJS/ereoJS" target="_blank" rel="noopener" className="hover:text-primary-600 transition-colors">
              GitHub
            </a>
            <span>&copy; {currentYear}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}