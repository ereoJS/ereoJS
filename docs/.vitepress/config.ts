import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ereo',
  description: 'A React fullstack framework built on Bun',
  base: '/ereoJS/',
  ignoreDeadLinks: [/^https?:\/\/localhost/],

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#646cff' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Ereo - React Fullstack Framework' }],
    ['meta', { property: 'og:description', content: 'Build fast, modern web applications with React and Bun' }],
  ],

  // Rewrites for backward compatibility with old URLs
  rewrites: {
    'core-concepts/:path*': 'concepts/:path*',
    'advanced/caching-strategies': 'architecture/caching-deep-dive',
    'advanced/streaming': 'architecture/streaming-deep-dive',
    'advanced/optimization': 'architecture/performance',
    'advanced/custom-adapters': 'architecture/custom-adapters',
    'advanced/security': 'architecture/security',
    'comparisons/:path*': 'architecture/comparisons/:path*',
    'deployment/:path*': 'ecosystem/deployment/:path*',
    'changelog': 'welcome/whats-new',
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Learn', link: '/getting-started/' },
      { text: 'Guides', link: '/guides/' },
      { text: 'API', link: '/api/core/create-app' },
      {
        text: 'More',
        items: [
          { text: 'Architecture', link: '/architecture/' },
          { text: 'Migration', link: '/migration/' },
          { text: 'Ecosystem', link: '/ecosystem/' },
          { text: 'Troubleshooting', link: '/troubleshooting/' },
          { text: 'Contributing', link: '/contributing/' },
          { text: 'Reference', link: '/reference/' },
        ]
      },
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/ereoJS/ereoJS' },
          { text: "What's New", link: '/welcome/whats-new' }
        ]
      }
    ],

    sidebar: {
      '/welcome/': [
        {
          text: 'Welcome',
          items: [
            { text: 'What is EreoJS?', link: '/welcome/' },
            { text: "What's New", link: '/welcome/whats-new' },
            { text: 'Feature Overview', link: '/welcome/feature-overview' },
            { text: 'Learning Paths', link: '/welcome/learning-paths' },
          ]
        }
      ],
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/' },
            { text: 'Prerequisites', link: '/getting-started/prerequisites' },
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Project Structure', link: '/getting-started/project-structure' },
            { text: 'Your First App', link: '/getting-started/your-first-app' },
            { text: 'First Deployment', link: '/getting-started/first-deployment' },
          ]
        },
        {
          text: 'Tutorials',
          items: [
            { text: 'Overview', link: '/tutorials/' },
            { text: 'Build a Blog', link: '/tutorials/blog/01-setup' },
            { text: 'Build a Dashboard', link: '/tutorials/dashboard/' },
          ]
        }
      ],
      '/tutorials/': [
        {
          text: 'Tutorials',
          items: [
            { text: 'Overview', link: '/tutorials/' },
          ]
        },
        {
          text: 'Build a Blog',
          items: [
            { text: '1. Setup', link: '/tutorials/blog/01-setup' },
            { text: '2. Routes', link: '/tutorials/blog/02-routes' },
            { text: '3. Data Loading', link: '/tutorials/blog/03-data-loading' },
            { text: '4. Forms', link: '/tutorials/blog/04-forms' },
            { text: '5. Styling', link: '/tutorials/blog/05-styling' },
            { text: '6. Deployment', link: '/tutorials/blog/06-deployment' },
          ]
        },
        {
          text: 'Build a Dashboard',
          items: [
            { text: 'Overview', link: '/tutorials/dashboard/' },
            { text: '1. Setup', link: '/tutorials/dashboard/01-setup' },
            { text: '2. Authentication', link: '/tutorials/dashboard/02-authentication' },
            { text: '3. Islands', link: '/tutorials/dashboard/03-islands' },
            { text: '4. Analytics', link: '/tutorials/dashboard/04-analytics' },
            { text: '5. Deployment', link: '/tutorials/dashboard/05-deployment' },
          ]
        }
      ],
      '/concepts/': [
        {
          text: 'Core Concepts',
          items: [
            { text: 'Overview', link: '/concepts/' },
            { text: 'Routing', link: '/concepts/routing' },
            { text: 'Data Loading', link: '/concepts/data-loading' },
            { text: 'Rendering Modes', link: '/concepts/rendering-modes' },
            { text: 'Islands Architecture', link: '/concepts/islands' },
            { text: 'Caching', link: '/concepts/caching' },
            { text: 'Middleware', link: '/concepts/middleware' },
            { text: 'State Management', link: '/concepts/state-management' },
            { text: 'Forms', link: '/concepts/forms' },
            { text: 'Type Safety', link: '/concepts/type-safety' },
          ]
        }
      ],
      '/guides/': [
        {
          text: 'Practical Guides',
          items: [
            { text: 'Overview', link: '/guides/' },
          ]
        },
        {
          text: 'Data & APIs',
          items: [
            { text: 'Database Integration', link: '/guides/database' },
            { text: 'API Routes', link: '/guides/api-routes' },
            { text: 'RPC', link: '/guides/rpc' },
            { text: 'Real-Time', link: '/guides/real-time' },
            { text: 'File Uploads', link: '/guides/file-uploads' },
          ]
        },
        {
          text: 'Auth & Security',
          items: [
            { text: 'Authentication', link: '/guides/authentication' },
          ]
        },
        {
          text: 'UI & Forms',
          items: [
            { text: 'Forms (Basic)', link: '/guides/forms-basic' },
            { text: 'Forms (Advanced)', link: '/guides/forms-advanced' },
            { text: 'Styling', link: '/guides/styling' },
            { text: 'SEO', link: '/guides/seo' },
            { text: 'Internationalization', link: '/guides/internationalization' },
          ]
        },
        {
          text: 'Development',
          items: [
            { text: 'Error Handling', link: '/guides/error-handling' },
            { text: 'Testing', link: '/guides/testing' },
            { text: 'TypeScript', link: '/guides/typescript' },
            { text: 'Environment Variables', link: '/guides/environment-variables' },
            { text: 'Plugins', link: '/guides/plugins' },
          ]
        }
      ],
      '/architecture/': [
        {
          text: 'Architecture & Design',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Why Bun?', link: '/architecture/why-bun' },
            { text: 'Caching Deep Dive', link: '/architecture/caching-deep-dive' },
            { text: 'Streaming Deep Dive', link: '/architecture/streaming-deep-dive' },
            { text: 'Performance', link: '/architecture/performance' },
            { text: 'Custom Adapters', link: '/architecture/custom-adapters' },
            { text: 'Security', link: '/architecture/security' },
          ]
        },
        {
          text: 'Framework Comparisons',
          items: [
            { text: 'vs Next.js', link: '/architecture/comparisons/vs-nextjs' },
            { text: 'vs Remix', link: '/architecture/comparisons/vs-remix' },
            { text: 'vs Astro', link: '/architecture/comparisons/vs-astro' },
          ]
        }
      ],
      '/migration/': [
        {
          text: 'Migration Guides',
          items: [
            { text: 'Overview', link: '/migration/' },
            { text: 'From Next.js', link: '/migration/from-nextjs' },
            { text: 'From Remix', link: '/migration/from-remix' },
            { text: 'From Express/Koa', link: '/migration/from-express' },
            { text: 'Version Upgrade', link: '/migration/version-upgrade' },
          ]
        }
      ],
      '/ecosystem/': [
        {
          text: 'Ecosystem & Integrations',
          items: [
            { text: 'Overview', link: '/ecosystem/' },
            { text: 'IDE Setup', link: '/ecosystem/ide-setup' },
            { text: 'CI/CD', link: '/ecosystem/ci-cd' },
          ]
        },
        {
          text: 'Plugins',
          items: [
            { text: 'Tailwind CSS', link: '/ecosystem/plugins/tailwind' },
            { text: 'Auth', link: '/ecosystem/plugins/auth' },
            { text: 'Images', link: '/ecosystem/plugins/images' },
          ]
        },
        {
          text: 'Deployment',
          items: [
            { text: 'Overview', link: '/ecosystem/deployment/' },
            { text: 'Bun', link: '/ecosystem/deployment/bun' },
            { text: 'Vercel', link: '/ecosystem/deployment/vercel' },
            { text: 'Cloudflare', link: '/ecosystem/deployment/cloudflare' },
            { text: 'Docker', link: '/ecosystem/deployment/docker' },
            { text: 'Fly.io', link: '/ecosystem/deployment/fly-io' },
            { text: 'Railway', link: '/ecosystem/deployment/railway' },
          ]
        }
      ],
      '/troubleshooting/': [
        {
          text: 'Troubleshooting & FAQ',
          items: [
            { text: 'Overview', link: '/troubleshooting/' },
            { text: 'Common Errors', link: '/troubleshooting/common-errors' },
            { text: 'Debugging', link: '/troubleshooting/debugging' },
            { text: 'Known Issues', link: '/troubleshooting/known-issues' },
          ]
        },
        {
          text: 'FAQ',
          items: [
            { text: 'Routing', link: '/troubleshooting/faq-routing' },
            { text: 'Data Loading', link: '/troubleshooting/faq-data' },
            { text: 'Deployment', link: '/troubleshooting/faq-deployment' },
            { text: 'Forms', link: '/troubleshooting/faq-forms' },
          ]
        }
      ],
      '/contributing/': [
        {
          text: 'Contributing',
          items: [
            { text: 'Overview', link: '/contributing/' },
            { text: 'Development Setup', link: '/contributing/development-setup' },
            { text: 'Code Architecture', link: '/contributing/code-architecture' },
            { text: 'Plugin Development', link: '/contributing/plugin-development' },
            { text: 'Testing Internals', link: '/contributing/testing-internals' },
            { text: 'Documentation', link: '/contributing/documentation' },
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Quick Reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'Glossary', link: '/reference/glossary' },
            { text: 'Cheat Sheet', link: '/reference/cheat-sheet' },
            { text: 'CLI Reference', link: '/reference/cli-reference' },
            { text: 'Config Reference', link: '/reference/config-reference' },
            { text: 'Route Conventions', link: '/reference/route-conventions' },
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Minimal', link: '/examples/minimal' },
            { text: 'Blog', link: '/examples/blog' },
          ]
        }
      ],
      '/api/': [
        {
          text: '@ereo/core',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/core/' },
            { text: 'createApp', link: '/api/core/create-app' },
            { text: 'RequestContext', link: '/api/core/context' },
            { text: 'Plugins', link: '/api/core/plugins' },
            { text: 'Cache', link: '/api/core/cache' },
            { text: 'Environment', link: '/api/core/env' },
            { text: 'Types', link: '/api/core/types' },
            { text: 'Type-Safe Routing', link: '/api/core/type-safe-routing' }
          ]
        },
        {
          text: '@ereo/router',
          collapsed: false,
          items: [
            { text: 'FileRouter', link: '/api/router/file-router' },
            { text: 'Route Config', link: '/api/router/route-config' },
            { text: 'Route Tree', link: '/api/router/route-tree' },
            { text: 'Route Matching', link: '/api/router/matching' },
            { text: 'Middleware', link: '/api/router/middleware' },
            { text: 'Typed Middleware', link: '/api/router/typed-middleware' },
            { text: 'Validation', link: '/api/router/validation' },
            { text: 'Validators', link: '/api/router/validators' }
          ]
        },
        {
          text: '@ereo/router-conventions',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/api/router-conventions/' }
          ]
        },
        {
          text: '@ereo/client',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/client/' },
            { text: 'Hooks', link: '/api/client/hooks' },
            { text: 'Link', link: '/api/client/link' },
            { text: 'TypedLink', link: '/api/client/typed-link' },
            { text: 'Form', link: '/api/client/form' },
            { text: 'Navigation', link: '/api/client/navigation' },
            { text: 'Typed Navigation', link: '/api/client/typed-navigation' },
            { text: 'Prefetch', link: '/api/client/prefetch' },
            { text: 'Islands', link: '/api/client/islands' },
            { text: 'Error Boundary', link: '/api/client/error-boundary' }
          ]
        },
        {
          text: '@ereo/client-sdk',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/api/client-sdk/' }
          ]
        },
        {
          text: '@ereo/data',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/data/' },
            { text: 'defineRoute', link: '/api/data/define-route' },
            { text: 'Schema Adapters', link: '/api/data/schema-adapters' },
            { text: 'Loaders', link: '/api/data/loaders' },
            { text: 'Actions', link: '/api/data/actions' },
            { text: 'Pipeline', link: '/api/data/pipeline' },
            { text: 'Cache', link: '/api/data/cache' },
            { text: 'Revalidation', link: '/api/data/revalidation' }
          ]
        },
        {
          text: '@ereo/server',
          collapsed: false,
          items: [
            { text: 'BunServer', link: '/api/server/bun-server' },
            { text: 'Middleware', link: '/api/server/middleware' },
            { text: 'Streaming', link: '/api/server/streaming' }
          ]
        },
        {
          text: '@ereo/state',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/state/' },
            { text: 'Signals', link: '/api/state/signals' },
            { text: 'Stores', link: '/api/state/stores' }
          ]
        },
        {
          text: '@ereo/forms',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/forms/' },
            { text: 'useForm', link: '/api/forms/use-form' },
            { text: 'useField', link: '/api/forms/use-field' },
            { text: 'useFieldArray', link: '/api/forms/use-field-array' },
            { text: 'useWatch', link: '/api/forms/use-watch' },
            { text: 'useFormStatus', link: '/api/forms/use-form-status' },
            { text: 'FormStore', link: '/api/forms/form-store' },
            { text: 'Validation', link: '/api/forms/validation' },
            { text: 'Schema Adapters', link: '/api/forms/schema-adapters' },
            { text: 'Components', link: '/api/forms/components' },
            { text: 'Context', link: '/api/forms/context' },
            { text: 'Wizard', link: '/api/forms/wizard' },
            { text: 'Server Actions', link: '/api/forms/server-actions' },
            { text: 'Accessibility', link: '/api/forms/accessibility' },
            { text: 'Composition', link: '/api/forms/composition' },
            { text: 'Utilities', link: '/api/forms/utilities' },
            { text: 'Types', link: '/api/forms/types' },
          ]
        },
        {
          text: '@ereo/rpc',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/rpc/' },
            { text: 'Procedure Builder', link: '/api/rpc/procedure' },
            { text: 'Router', link: '/api/rpc/router' },
            { text: 'Client', link: '/api/rpc/client' },
            { text: 'Middleware', link: '/api/rpc/middleware' },
            { text: 'React Hooks', link: '/api/rpc/hooks' },
            { text: 'Plugin', link: '/api/rpc/plugin' },
            { text: 'Context Bridge', link: '/api/rpc/context-bridge' },
            { text: 'Types', link: '/api/rpc/types' },
            { text: 'Protocol', link: '/api/rpc/protocol' }
          ]
        },
        {
          text: '@ereo/bundler',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/api/bundler/' }
          ]
        },
        {
          text: '@ereo/runtime-bun',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/api/runtime-bun/' }
          ]
        },
        {
          text: '@ereo/testing',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/api/testing/' }
          ]
        },
        {
          text: '@ereo/cli',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/cli/' },
            { text: 'dev', link: '/api/cli/dev' },
            { text: 'build', link: '/api/cli/build' },
            { text: 'start', link: '/api/cli/start' },
            { text: 'create', link: '/api/cli/create' },
            { text: 'deploy', link: '/api/cli/deploy' },
            { text: 'db', link: '/api/cli/db' }
          ]
        },
        {
          text: 'create-ereo',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/api/create-ereo/' }
          ]
        },
        {
          text: '@ereo/db',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/db/' },
            { text: 'Drizzle Adapter', link: '/api/db/drizzle' },
            { text: 'SurrealDB Adapter', link: '/api/db/surrealdb' }
          ]
        },
        {
          text: 'Deployment',
          collapsed: true,
          items: [
            { text: 'Vercel', link: '/api/deploy/vercel' },
            { text: 'Cloudflare', link: '/api/deploy/cloudflare' }
          ]
        },
        {
          text: '@ereo/trace',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/trace/' },
            { text: 'Tracer & Span', link: '/api/trace/tracer' },
            { text: 'Instrumentors', link: '/api/trace/instrumentors' },
            { text: 'CLI Reporter', link: '/api/trace/cli-reporter' },
            { text: 'Viewer & Transport', link: '/api/trace/viewer' },
            { text: 'Client Tracing', link: '/api/trace/client' },
            { text: 'Configuration', link: '/api/trace/configuration' },
          ]
        },
        {
          text: '@ereo/dev-inspector',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/api/dev-inspector/' }
          ]
        },
        {
          text: 'Plugins',
          collapsed: false,
          items: [
            { text: 'Tailwind', link: '/api/plugins/tailwind' },
            { text: 'Images', link: '/api/plugins/images' },
            { text: 'Auth', link: '/api/plugins/auth' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ereoJS/ereoJS' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Ereo Contributors'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/ereoJS/ereoJS/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
