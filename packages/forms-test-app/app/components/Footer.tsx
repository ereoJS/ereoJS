export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
            <span className="text-xl">⬡</span>
            <span>Built with EreoJS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-500">
            <a href="https://github.com/ereo-js/ereo" target="_blank" rel="noopener" className="hover:text-primary-600">
              GitHub
            </a>
            <a href="https://ereo.dev/docs" target="_blank" rel="noopener" className="hover:text-primary-600">
              Documentation
            </a>
            <span>&copy; {currentYear}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}