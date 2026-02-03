# TypeScript

This guide covers TypeScript patterns and best practices in EreoJS.

## Project Setup

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["bun-types"]
  },
  "include": ["src", "*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## Typed Loaders

### Basic Typing

```tsx
import { createLoader } from '@ereo/data'

interface Post {
  id: number
  title: string
  content: string
  createdAt: string
}

interface LoaderData {
  posts: Post[]
  total: number
}

export const loader = createLoader<LoaderData>(async () => {
  const posts = await db.posts.findMany()
  return {
    posts,
    total: posts.length
  }
})
```

### With Params

```tsx
interface PostParams {
  id: string
}

interface PostLoaderData {
  post: Post
  comments: Comment[]
}

export const loader = createLoader<PostLoaderData, PostParams>(
  async ({ params }) => {
    const post = await db.posts.find(params.id)
    if (!post) throw new Response('Not Found', { status: 404 })

    const comments = await db.comments.findByPost(post.id)
    return { post, comments }
  }
)
```

### Extracting Loader Data Type

```tsx
import type { LoaderData } from '@ereo/core'

export const loader = createLoader(async () => {
  return { posts: await getPosts() }
})

// Extract type from loader
type Data = LoaderData<typeof loader>
// { posts: Post[] }

export default function Posts({ loaderData }: { loaderData: Data }) {
  return <PostList posts={loaderData.posts} />
}
```

## Typed Actions

```tsx
import { createAction } from '@ereo/data'

interface ActionResult {
  success: boolean
  error?: string
  post?: Post
}

interface ActionParams {
  id: string
}

export const action = createAction<ActionResult, ActionParams>(
  async ({ request, params }) => {
    const formData = await request.formData()
    const title = formData.get('title') as string

    if (!title) {
      return { success: false, error: 'Title is required' }
    }

    const post = await db.posts.update(params.id, { title })
    return { success: true, post }
  }
)
```

## Typed Route Params

### Generate Route Types

```bash
bun ereo generate-types
```

This creates types based on your route structure:

```ts
// generated/routes.d.ts
declare module '@ereo/routes' {
  interface Routes {
    '/': {}
    '/posts': {}
    '/posts/[id]': { id: string }
    '/posts/[id]/comments/[commentId]': { id: string; commentId: string }
    '/docs/[...slug]': { slug: string[] }
  }
}
```

### Using Route Types

```tsx
import type { RouteParamsFor } from '@ereo/core'

type PostParams = RouteParamsFor<'/posts/[id]'>
// { id: string }

type DocsParams = RouteParamsFor<'/docs/[...slug]'>
// { slug: string[] }
```

## Component Props

### Route Component

```tsx
import type { RouteComponentProps } from '@ereo/core'

interface LoaderData {
  post: Post
}

interface Params {
  id: string
}

export default function PostPage({
  loaderData,
  actionData,
  params,
  searchParams
}: RouteComponentProps<LoaderData, Params>) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <p>ID: {params.id}</p>
    </article>
  )
}
```

### Error Component

```tsx
import type { RouteErrorComponentProps } from '@ereo/core'
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export function ErrorBoundary({ error }: RouteErrorComponentProps) {
  if (isRouteErrorResponse(error)) {
    return <h1>{error.status}: {error.statusText}</h1>
  }
  return <h1>Error: {error.message}</h1>
}
```

## Typed Context

### Extending Context Types

```ts
// types/context.d.ts
import type { User } from './models'

declare module '@ereo/core' {
  interface ContextTypes {
    user: User | null
    session: SessionData
    requestId: string
  }
}
```

### Using Typed Context

```tsx
export const loader = createLoader(async ({ context }) => {
  // Type-safe access
  const user = context.get('user') // User | null
  const session = context.get('session') // SessionData

  if (!user) throw redirect('/login')

  return { user }
})
```

## Middleware Types

```ts
import type { MiddlewareHandler } from '@ereo/router'

const authMiddleware: MiddlewareHandler = async (request, next, context) => {
  const user = await getUser(request)

  if (!user) {
    return Response.redirect('/login')
  }

  context.set('user', user)
  return next()
}
```

## API Route Types

```ts
// routes/api/posts.ts
import type { Post } from '@/types'

interface CreatePostBody {
  title: string
  content: string
}

interface CreatePostResponse {
  success: boolean
  post?: Post
  error?: string
}

export async function POST(request: Request): Promise<Response> {
  const body: CreatePostBody = await request.json()

  if (!body.title) {
    const response: CreatePostResponse = {
      success: false,
      error: 'Title is required'
    }
    return Response.json(response, { status: 400 })
  }

  const post = await createPost(body)
  const response: CreatePostResponse = { success: true, post }

  return Response.json(response, { status: 201 })
}
```

## Utility Types

### Prettify

Flatten intersection types:

```ts
type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

type User = Prettify<BaseUser & { posts: Post[] }>
// Shows all properties inline in IDE
```

### StrictOmit

Safer Omit that errors on invalid keys:

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>

type UserWithoutPassword = StrictOmit<User, 'password'>
// type UserWithoutPassword = StrictOmit<User, 'invalid'> // Error!
```

### NonNullable Fields

```ts
type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

type UserWithEmail = RequiredFields<User, 'email'>
// email is now required
```

## Form Data Types

```tsx
interface ContactFormData {
  name: string
  email: string
  message: string
}

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()

  const data: ContactFormData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    message: formData.get('message') as string
  }

  // Type-safe validation
  const errors: Partial<Record<keyof ContactFormData, string>> = {}

  if (!data.name) errors.name = 'Required'
  if (!data.email) errors.email = 'Required'

  if (Object.keys(errors).length > 0) {
    return { errors, values: data }
  }

  await sendEmail(data)
  return { success: true }
})
```

## Best Practices

1. **Enable strict mode** - Catch more errors at compile time
2. **Use type inference** - Let TypeScript infer when possible
3. **Export types** - Share types between files
4. **Use generics** - For reusable typed functions
5. **Avoid `any`** - Use `unknown` and narrow types
6. **Type external data** - API responses, form data
7. **Generate route types** - Keep params type-safe
