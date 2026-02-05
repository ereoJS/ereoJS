export default function AboutPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">About /private/tmp/claude-501/-Users-macm1-new-y-combinator-oreo-js/12bee8ec-054b-4bda-88f2-26bc110a7d98/scratchpad/ereo-forms-test</h1>

        <div className="prose dark:prose-invert prose-lg max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            This project was created with EreoJS, a modern React fullstack framework built on Bun.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="card">
              <h3 className="text-xl font-bold mb-3">Features Demonstrated</h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Server-side rendering with loaders
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  File-based routing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Dynamic routes with [slug]
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Nested layouts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Form actions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Islands architecture
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Error boundaries
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Tailwind CSS styling
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold mb-3">Project Structure</h3>
              <pre className="text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto">
{`app/
├── components/
│   ├── Counter.tsx
│   ├── Footer.tsx
│   ├── Navigation.tsx
│   └── PostCard.tsx
├── lib/
│   ├── data.ts
│   └── types.ts
├── routes/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── about.tsx
│   ├── contact.tsx
│   └── blog/
│       ├── _layout.tsx
│       ├── index.tsx
│       └── [slug].tsx
└── styles.css`}
              </pre>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-bold mb-3">Learn More</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Check out the documentation and resources to learn how to build with EreoJS:
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://ereo.dev/docs"
                target="_blank"
                rel="noopener"
                className="btn btn-primary"
              >
                Documentation
              </a>
              <a
                href="https://github.com/ereo-js/ereo"
                target="_blank"
                rel="noopener"
                className="btn btn-secondary"
              >
                GitHub Repository
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}