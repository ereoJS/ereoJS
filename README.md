<p align="center">
  <img src="docs/public/logo.svg" alt="EreoJS" width="120" height="120" />
</p>

<h1 align="center">EreoJS</h1>

<p align="center">
  <strong>The React fullstack framework built on Bun.</strong><br/>
  Fast builds. Fast server. Fast pages. No compromises.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ereo/cli"><img src="https://img.shields.io/npm/v/@ereo/cli?label=version&color=blue" alt="npm version" /></a>
  <a href="https://github.com/ereoJS/ereoJS/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="Bun" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/UI-React_18-61dafb" alt="React 18" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/types-TypeScript-3178c6" alt="TypeScript" /></a>
</p>

<p align="center">
  <a href="https://ereojs.github.io/ereoJS/">Documentation</a> &middot;
  <a href="https://ereojs.github.io/ereoJS/getting-started/">Getting Started</a> &middot;
  <a href="https://ereojs.github.io/ereoJS/tutorials/blog/01-setup">Tutorials</a> &middot;
  <a href="https://ereojs.github.io/ereoJS/api/core/create-app">API Reference</a> &middot;
  <a href="https://github.com/ereoJS/ereoJS/issues">Issues</a>
</p>

---

## Why EreoJS?

Most React frameworks make you choose: great DX _or_ great performance. Server components _or_ simplicity. Type safety _or_ fast iteration.

EreoJS doesn't ask you to choose. It's a fullstack React framework built from the ground up for Bun, giving you **5-6x faster builds and server starts** than Node-based frameworks, with an API surface that's small enough to learn in an afternoon.

```bash
bunx create-ereo@latest my-app
cd my-app
bun dev
```

That's it. No configuration. No decisions. A running fullstack app in under 10 seconds.

---

## What you get

### File-based routing that stays out of your way

Drop files into `app/routes/`. They become pages. No router config, no boilerplate.

```
app/routes/
  _layout.tsx          ->  wraps all pages
  index.tsx            ->  /
  about.tsx            ->  /about
  posts/[id].tsx       ->  /posts/:id
  docs/[...slug].tsx   ->  /docs/* (catch-all)
  (auth)/login.tsx     ->  /login (grouped, no URL segment)
```

Dynamic params, catch-all routes, optional segments, route groups, nested layouts -- all from the file structure.

### One data pattern for everything

Load data with `loader`. Mutate with `action`. Works on the server, streams to the client.

```tsx
// app/routes/posts/[id].tsx
import { createLoader, createAction } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})

export const action = createAction(async ({ request }) => {
  const form = await request.formData()
  await db.posts.update(form.get('id'), { title: form.get('title') })
  return { success: true }
})

export default function Post({ loaderData }) {
  return <h1>{loaderData.post.title}</h1>
}
```

No `getServerSideProps`. No `use server` directives. No mental model split between server and client. One pattern, everywhere.

### Islands architecture -- ship less JavaScript

Only interactive components get hydrated. Everything else is static HTML with zero client JS.

```tsx
// Static by default -- no JavaScript shipped
export default function BlogPost({ loaderData }) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>      {/* Static HTML */}
      <p>{loaderData.post.content}</p>       {/* Static HTML */}
      <LikeButton id={loaderData.post.id} /> {/* Hydrated island */}
    </article>
  )
}
```

```tsx
// app/components/LikeButton.tsx
'use client'

import { useState } from 'react'

export function LikeButton({ id }) {
  const [liked, setLiked] = useState(false)
  return <button onClick={() => setLiked(!liked)}>{liked ? '♥' : '♡'}</button>
}
```

The result: pages that load fast because they _are_ fast. Not fast-with-asterisks.

### Type-safe from route to response

Routes, params, loaders, actions, links, navigation -- all fully typed. Catch route typos at build time, not in production.

```tsx
import { TypedLink, useTypedNavigate } from '@ereo/client'

// Compile error if route doesn't exist or params are wrong
<TypedLink to="/posts/[id]" params={{ id: '123' }}>Read post</TypedLink>

const navigate = useTypedNavigate()
navigate('/dashboard') // Autocomplete for all your routes
```

### Streaming SSR with React Suspense

Stream HTML to the browser progressively. Users see content immediately while slower data resolves in the background.

```tsx
import { createLoader, defer } from '@ereo/data'
import { Await } from '@ereo/client'
import { Suspense } from 'react'

export const loader = createLoader(async ({ params }) => {
  return {
    post: await db.posts.find(params.id),            // Blocks render
    comments: defer(db.comments.findMany(params.id)), // Streams in later
  }
})

export default function Post({ loaderData }) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <Suspense fallback={<p>Loading comments...</p>}>
        <Await resolve={loaderData.comments}>
          {(comments) => comments.map(c => <Comment key={c.id} {...c} />)}
        </Await>
      </Suspense>
    </article>
  )
}
```

### Tag-based caching you actually control

No implicit caching. No "how do I invalidate this?" You tag data. You invalidate tags. Done.

```tsx
export const config = {
  cache: { maxAge: 3600, tags: ['posts'] }
}

export const loader = createLoader(async ({ params }) => {
  return { post: await db.posts.find(params.id) }
})

// After a mutation, invalidate by tag
export const action = createAction(async ({ request }) => {
  await db.posts.create(/* ... */)
  await revalidateTag('posts')
  return redirect('/posts')
})
```

---

## The full picture

EreoJS is not just a router with SSR bolted on. It's a complete platform for building production web applications:

| Capability | Package | What it does |
|:---|:---|:---|
| **Routing** | `@ereo/router` | File-based routes, dynamic params, layouts, middleware |
| **Data** | `@ereo/data` | Loaders, actions, caching, revalidation, streaming |
| **Client** | `@ereo/client` | Navigation, prefetching, islands, forms, error boundaries |
| **Server** | `@ereo/server` | Bun HTTP server, streaming SSR, static files, middleware |
| **State** | `@ereo/state` | Fine-grained signals, stores, computed values, React hooks |
| **Forms** | `@ereo/forms` | Per-field validation, async rules, wizards, schema adapters |
| **RPC** | `@ereo/rpc` | Type-safe procedures, middleware, subscriptions |
| **Database** | `@ereo/db` | Drizzle ORM adapter, SurrealDB, connection pooling |
| **Auth** | `@ereo/auth` | Credentials, OAuth (GitHub, Google, Discord), RBAC |
| **Tracing** | `@ereo/trace` | Full-stack observability, 11 instrumentors, DevTools UI |
| **CLI** | `@ereo/cli` | Dev server, builds, deployments, DB migrations |
| **Deploy** | `@ereo/deploy-*` | Vercel and Cloudflare adapters, Docker/Fly.io/Railway guides |

Every piece is designed to work together, but each package is independent and tree-shakeable.

---

## Type-safe RPC -- like tRPC, built in

Define server procedures. Call them from the client with full type inference. No code generation step.

```ts
// api/router.ts
import { procedure, createRouter } from '@ereo/rpc'
import { z } from 'zod'

const publicProcedure = procedure
const authedProcedure = procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new RPCError('UNAUTHORIZED')
  return next({ ...ctx, user: ctx.user })
})

export const api = createRouter({
  posts: {
    list: publicProcedure.query(async () => {
      return db.posts.findMany()
    }),
    create: authedProcedure.mutation(
      z.object({ title: z.string().min(1), content: z.string() }),
      async ({ input }) => db.posts.create(input)
    ),
  },
})
```

```tsx
// Client -- fully typed, zero codegen
import { useQuery } from '@ereo/rpc/client'

function Posts() {
  const { data: posts, isLoading } = useQuery(api.posts.list)
  if (isLoading) return <p>Loading...</p>
  return posts.map(p => <h2 key={p.id}>{p.title}</h2>)
}
```

---

## Forms that scale from simple to complex

Start with progressive HTML forms. Graduate to client-validated, signal-powered forms when you need them.

**Simple -- works without JavaScript:**

```tsx
import { Form, useActionData } from '@ereo/client'

export default function Contact() {
  const result = useActionData()
  return (
    <Form method="post">
      <input name="email" type="email" required />
      <button type="submit">Subscribe</button>
      {result?.success && <p>Subscribed!</p>}
    </Form>
  )
}
```

**Advanced -- per-field signals, async validation, schema adapters:**

```tsx
import { useForm, useField } from '@ereo/forms'

function SignupForm() {
  const form = useForm({
    defaultValues: { email: '', username: '' },
    validators: {
      email: [required(), email()],
      username: [required(), minLength(3), async (value) => {
        const taken = await checkUsername(value)
        return taken ? 'Username taken' : null
      }],
    },
    onSubmit: async (values) => await createAccount(values),
  })

  const emailField = useField(form, 'email')
  const usernameField = useField(form, 'username')

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <input {...emailField.inputProps} placeholder="Email" />
      <input {...usernameField.inputProps} placeholder="Username" />
      <button type="submit">Create Account</button>
    </form>
  )
}
```

Sync validators gate async ones -- async validators only fire if all sync rules pass first. No wasted API calls.

---

## Signals -- reactive state without the ceremony

Fine-grained reactivity inspired by Solid.js, with first-class React hooks.

```tsx
import { signal, computed, batch } from '@ereo/state'
import { useSignal } from '@ereo/state'

const count = signal(0)
const doubled = computed(() => count.get() * 2, [count])

function Counter() {
  const value = useSignal(count)
  const double = useSignal(doubled)

  return (
    <div>
      <p>{value} (doubled: {double})</p>
      <button onClick={() => count.update(n => n + 1)}>+</button>
    </div>
  )
}
```

---

## Built-in observability

See exactly what your app is doing -- across all layers -- in development.

```bash
ereo dev --trace
```

Full-stack tracing covers routing, data loading, form validation, RPC calls, database queries, hydration, and more. View traces in the built-in DevTools UI at `/__ereo/traces`, or in the CLI.

In production, the tracer compiles to a **616-byte no-op** that tree-shakes completely.

---

## Deploy anywhere

```bash
# Self-hosted with Bun
ereo build && ereo start

# Vercel
ereo deploy vercel --prod

# Cloudflare
ereo deploy cloudflare --prod

# Docker
docker build -t my-app . && docker run -p 3000:3000 my-app
```

Adapters for Vercel and Cloudflare Workers/Pages, plus deployment guides for Docker, Fly.io, and Railway.

---

## Framework comparison

| | EreoJS | Next.js | Remix | Astro |
|:---|:---:|:---:|:---:|:---:|
| **Runtime** | Bun | Node | Node/Bun | Node |
| **Bundler** | Bun (native) | Webpack/Turbopack | esbuild | Vite |
| **Islands** | Built-in | Manual | Manual | Built-in |
| **Data loading** | Loaders/Actions | Server Components | Loaders/Actions | Frontmatter |
| **Caching** | Tag-based | ISR/fetch cache | Manual | Manual |
| **Forms** | Progressive + Signals | Client-only | Progressive | Client-only |
| **RPC** | Built-in | External (tRPC) | External | External |
| **Type-safe routes** | Built-in | External | External | External |
| **Observability** | Built-in tracer | External | External | External |
| **State management** | Signals (built-in) | External (Zustand, etc) | External | External |

---

## Project structure

```
my-app/
  app/
    routes/              # File-based routes
      _layout.tsx        # Root layout
      index.tsx          # Home page
      posts/
        index.tsx        # /posts
        [id].tsx         # /posts/:id
    components/          # Shared components
    lib/                 # Utilities
  public/                # Static assets
  ereo.config.ts         # Framework configuration
  package.json
  tsconfig.json
```

---

## CLI

```bash
ereo dev                           # Start dev server with HMR
ereo build                         # Production build
ereo start                         # Start production server
ereo create my-app --template      # Scaffold a new project
ereo deploy vercel --prod          # Deploy

ereo db:migrate                    # Run database migrations
ereo db:generate --name add_users  # Generate migration file
ereo db:studio                     # Open Drizzle Studio
ereo db:seed                       # Seed database
```

---

## Requirements

- [Bun](https://bun.sh) >= 1.0.0
- React >= 18.0.0
- TypeScript >= 5.4.0

---

## Contributing

We welcome contributions. See the [Contributing Guide](https://ereojs.github.io/ereoJS/contributing/) for development setup, architecture overview, and testing instructions.

```bash
git clone https://github.com/ereoJS/ereoJS.git
cd ereoJS
bun install
bun test
```

---

## License

MIT &copy; [Ereo Contributors](https://github.com/ereoJS/ereoJS/graphs/contributors)
