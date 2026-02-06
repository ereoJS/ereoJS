# API Routes

Build REST APIs using EreoJS file-based routing. Any file in the `routes/` directory can export HTTP method handlers to serve JSON responses instead of rendering components.

## HTTP Method Exports

Export functions named after HTTP methods. Each receives the standard route arguments:

```ts
// routes/api/posts.ts
import type { LoaderArgs, ActionArgs } from '@ereo/core'

export async function GET({ request, params, context }: LoaderArgs) {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const posts = await db.posts.findMany({ skip: (page - 1) * 20, take: 20 })
  return Response.json({ posts, page })
}

export async function POST({ request }: ActionArgs) {
  const body = await request.json()
  const post = await db.posts.create({ data: body })
  return Response.json(post, { status: 201 })
}

export async function PUT({ request }: ActionArgs) {
  const body = await request.json()
  const post = await db.posts.update({ where: { id: body.id }, data: body })
  return Response.json(post)
}

export async function DELETE({ request }: ActionArgs) {
  const { id } = await request.json()
  await db.posts.delete({ where: { id } })
  return Response.json({ success: true })
}
```

Each function maps directly to the corresponding HTTP method. If a client sends a `PATCH` request, export a `PATCH` function. Any unsupported method returns a 405 response automatically.

## Request Parsing

### JSON Body

```ts
export async function POST({ request }: ActionArgs) {
  const body = await request.json()
  // body is typed as unknown — validate before use
  return Response.json({ received: body })
}
```

### FormData

```ts
export async function POST({ request }: ActionArgs) {
  const formData = await request.formData()
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  return Response.json({ name, email })
}
```

### URL Search Params

```ts
export async function GET({ request }: LoaderArgs) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q') || ''
  const results = await search(query)
  return Response.json({ results })
}
```

### Using @ereo/data Utilities

For more advanced parsing with type coercion and nested objects:

```ts
import { formDataToObject, parseRequestBody } from '@ereo/data'

export async function POST({ request }: ActionArgs) {
  // Auto-detects JSON, FormData, or text
  const body = await parseRequestBody(request)
  return Response.json(body)
}
```

## Dynamic API Routes

Use the same dynamic segments as page routes:

```ts
// routes/api/posts/[id].ts
export async function GET({ params }: LoaderArgs) {
  const post = await db.posts.find(params.id)
  if (!post) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return Response.json(post)
}

export async function PUT({ request, params }: ActionArgs) {
  const body = await request.json()
  const post = await db.posts.update({
    where: { id: params.id },
    data: body,
  })
  return Response.json(post)
}

export async function DELETE({ params }: ActionArgs) {
  await db.posts.delete({ where: { id: params.id } })
  return new Response(null, { status: 204 })
}
```

## Typed API Routes

Add TypeScript generics for request and response types:

```ts
// routes/api/users.ts
import { typedAction } from '@ereo/data'
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
})

export const POST = typedAction({
  schema: CreateUserSchema,
  handler: async ({ body }) => {
    // body is inferred as { name: string; email: string; role: 'user' | 'admin' }
    const user = await db.users.create({ data: body })
    return { id: user.id }
  },
})
```

## Error Handling

Return appropriate HTTP status codes and structured error responses:

```ts
export async function POST({ request }: ActionArgs) {
  try {
    const body = await request.json()

    if (!body.title) {
      return Response.json(
        { error: 'Validation failed', fields: { title: 'Title is required' } },
        { status: 400 }
      )
    }

    const post = await db.posts.create({ data: body })
    return Response.json(post, { status: 201 })
  } catch (error) {
    console.error('Failed to create post:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Middleware for API Routes

Apply middleware to API routes using `_middleware.ts` files:

```ts
// routes/api/_middleware.ts
import type { MiddlewareHandler } from '@ereo/core'

export const middleware: MiddlewareHandler = async (request, context, next) => {
  // Authenticate API requests
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await verifyToken(token)
  if (!user) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  context.set('user', user)
  return next()
}
```

The middleware applies to all routes within the `routes/api/` directory. See [Routing](/concepts/routing) for details on middleware placement and scoping.

## CORS Setup

Add CORS headers for cross-origin API access:

```ts
// routes/api/_middleware.ts
import type { MiddlewareHandler } from '@ereo/core'

const ALLOWED_ORIGINS = ['https://app.example.com', 'http://localhost:5173']

export const middleware: MiddlewareHandler = async (request, context, next) => {
  const origin = request.headers.get('Origin')

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin!) ? origin! : '',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const response = await next()

  // Add CORS headers to all responses
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }

  return response
}
```

## Related

- [Routing](/concepts/routing) — File-based routing conventions
- [Data Loading](/concepts/data-loading) — Loaders, actions, and the three definition approaches
- [Actions API](/api/data/actions) — Full action API reference
- [Middleware](/concepts/middleware) — Middleware patterns
