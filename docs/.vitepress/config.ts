import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ereo',
  description: 'A React fullstack framework built on Bun',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#646cff' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Ereo - React Fullstack Framework' }],
    ['meta', { property: 'og:description', content: 'Build fast, modern web applications with React and Bun' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/getting-started/' },
      { text: 'API', link: '/api/core/create-app' },
      { text: 'Examples', link: '/examples/minimal' },
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/ereo-framework/ereo' },
          { text: 'Changelog', link: '/changelog' }
        ]
      }
    ],

    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/' },
            { text: 'Project Structure', link: '/getting-started/project-structure' },
            { text: 'Your First App', link: '/getting-started/your-first-app' },
            { text: 'Migrating from Other Frameworks', link: '/getting-started/migrating' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Overview', link: '/core-concepts/' },
            { text: 'Routing', link: '/core-concepts/routing' },
            { text: 'Data Loading', link: '/core-concepts/data-loading' },
            { text: 'Rendering Modes', link: '/core-concepts/rendering-modes' },
            { text: 'Islands Architecture', link: '/core-concepts/islands' },
            { text: 'Caching', link: '/core-concepts/caching' },
            { text: 'Middleware', link: '/core-concepts/middleware' }
          ]
        },
        {
          text: 'Tutorials',
          items: [
            { text: 'Overview', link: '/tutorials/' },
            { text: 'Build a Blog', link: '/tutorials/blog-tutorial/01-setup' },
            { text: 'Build a Dashboard', link: '/tutorials/dashboard-tutorial/' }
          ]
        },
        {
          text: 'Guides',
          items: [
            { text: 'Authentication', link: '/guides/authentication' },
            { text: 'Database Integration', link: '/guides/database' },
            { text: 'Testing', link: '/guides/testing' },
            { text: 'Styling', link: '/guides/styling' },
            { text: 'Forms', link: '/guides/forms' },
            { text: 'Error Handling', link: '/guides/error-handling' },
            { text: 'Environment Variables', link: '/guides/environment-variables' },
            { text: 'TypeScript', link: '/guides/typescript' },
            { text: 'Plugins', link: '/guides/plugins' }
          ]
        },
        {
          text: 'Comparisons',
          items: [
            { text: 'vs Next.js', link: '/comparisons/vs-nextjs' },
            { text: 'vs Remix', link: '/comparisons/vs-remix' },
            { text: 'vs Astro', link: '/comparisons/vs-astro' }
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Caching Strategies', link: '/advanced/caching-strategies' },
            { text: 'Streaming SSR', link: '/advanced/streaming' },
            { text: 'Performance Optimization', link: '/advanced/optimization' },
            { text: 'Custom Adapters', link: '/advanced/custom-adapters' },
            { text: 'Security', link: '/advanced/security' }
          ]
        },
        {
          text: 'Deployment',
          items: [
            { text: 'Bun', link: '/deployment/bun' },
            { text: 'Vercel', link: '/deployment/vercel' },
            { text: 'Cloudflare', link: '/deployment/cloudflare' },
            { text: 'Docker', link: '/deployment/docker' }
          ]
        },
        {
          text: 'Examples',
          items: [
            { text: 'Minimal', link: '/examples/minimal' },
            { text: 'Blog', link: '/examples/blog' }
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
            { text: 'Auth', link: '/api/plugins/auth' },
            { text: 'Database (deprecated)', link: '/api/plugins/db' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ereo-framework/ereo' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Ereo Contributors'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/ereo-framework/ereo/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
