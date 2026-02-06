# Migrating from Express / Koa

A guide for moving from Express or Koa to EreoJS. This covers route mapping, middleware conversion, adding React rendering, and integrating your existing database layer.

## Overview

Express and Koa are backend frameworks. EreoJS is a fullstack framework that combines server-side routing, data loading, and React rendering. The migration path involves:

1. Mapping Express routes to EreoJS file-based routes
2. Converting middleware
3. Adding React components for rendering
4. Keeping your existing database and business logic

## Route Mapping

### Express Routes to File Routes

Express routes defined in code become files in the `routes/` directory:

**Express:**

```ts
// Express
app.get('/', (req, res) => {
  res.send('Home')
})

app.get('/about', (req, res) => {
  res.send('About')
})

app.get('/posts/:id', (req, res) => {
  const post = getPost(req.params.id)
  res.json(post)
})
```

**EreoJS:**

```tsx
// routes/index.tsx
export default function Home() {
  return <h1>Home</h1>
}
```

```tsx
// routes/about.tsx
export default function About() {
  return <h1>About</h1>
}
```

```tsx
// routes/posts/[id].tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const post = await getPost(params.id)
  return { post }
})

export default function Post({ loaderData }) {
  return <h1>{loaderData.post.title}</h1>
}
```

### API-Only Routes

For routes that return JSON without rendering HTML, export HTTP method handlers:

**Express:**

```ts
app.get('/api/users', async (req, res) => {
  const users = await db.users.findMany()
  res.json({ users })
})

app.post('/api/users', async (req, res) => {
  const user = await db.users.create(req.body)
  res.status(201).json(user)
})
```

**EreoJS:**

```ts
// routes/api/users.ts
export async function GET({ request }) {
  const users = await db.users.findMany()
  return Response.json({ users })
}

export async function POST({ request }) {
  const body = await request.json()
  const user = await db.users.create(body)
  return Response.json(user, { status: 201 })
}
```

Key difference: EreoJS uses the Web API `Request` and `Response` objects instead of Express's `req`/`res`.

## Middleware Conversion

### Express Middleware to EreoJS Middleware

**Express:**

```ts
function authMiddleware(req, res, next) {
  const token = req.headers.authorization
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  req.user = verifyToken(token)
  next()
}

app.use('/dashboard', authMiddleware)
```

**EreoJS:**

```ts
// routes/dashboard/_middleware.ts
import type { MiddlewareHandler } from '@ereo/core'

export const middleware: MiddlewareHandler = async (request, context, next) => {
  const token = request.headers.get('authorization')

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = verifyToken(token)
  context.set('user', user)

  return next()
}
```

Key differences:
- `request` is a standard `Request` object (use `.headers.get()` instead of `.headers.authorization`)
- Shared data goes on `context` instead of mutating `req`
- Return a `Response` instead of calling `res.status().json()`
- Call `next()` and return its result instead of calling `next()` void

### CORS

**Express:**

```ts
app.use(cors({ origin: 'https://example.com' }))
```

**EreoJS:**

```ts
// routes/_middleware.ts
export const middleware: MiddlewareHandler = async (request, context, next) => {
  const response = await next()

  response.headers.set('Access-Control-Allow-Origin', 'https://example.com')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  return response
}
```

## Adding React Rendering

The main upgrade from Express to EreoJS is adding server-rendered React views. Replace your template engine with React components:

**Express (EJS/Pug):**

```ts
app.get('/posts/:id', async (req, res) => {
  const post = await getPost(req.params.id)
  res.render('post', { post })
})
```

**EreoJS:**

```tsx
// routes/posts/[id].tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const post = await getPost(params.id)
  if (!post) throw new Response('Not found', { status: 404 })
  return { post }
})

export default function Post({ loaderData }) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <div>{loaderData.post.content}</div>
    </article>
  )
}
```

The loader replaces your Express route handler's data fetching. The React component replaces your template.

## Database Integration

Your existing database layer works as-is. EreoJS does not dictate a database or ORM:

```tsx
// Use your existing database code directly in loaders
import { db } from '../lib/database' // Your existing code

export const loader = createLoader(async ({ params }) => {
  const user = await db.users.findUnique({ where: { id: params.id } })
  return { user }
})
```

Whether you use Prisma, Drizzle, Knex, raw SQL, or any other database library, it works the same way inside loaders and actions.

## Session Handling

Replace Express session middleware with `@ereo/plugin-auth`:

**Express:**

```ts
app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: false,
}))
```

**EreoJS:**

```ts
// ereo.config.ts
import { authPlugin } from '@ereo/plugin-auth'

export default defineConfig({
  plugins: [
    authPlugin({
      session: {
        secret: process.env.SESSION_SECRET,
        maxAge: 60 * 60 * 24 * 7,
      },
    }),
  ],
})
```

Access the session in loaders and middleware via `context.getSession()`. See the [Auth Plugin guide](/ecosystem/plugins/auth) for details.

## Migration Strategy

1. **Start a new EreoJS project** alongside your Express app
2. **Copy your database layer** (`lib/`, `models/`, etc.) into the EreoJS project
3. **Migrate API routes first** --- these are the most direct translation
4. **Add React components** for pages that were using templates
5. **Convert middleware** one at a time
6. **Run both apps in parallel** during the transition, proxying traffic as needed
7. **Switch over** when all routes are migrated and tested
