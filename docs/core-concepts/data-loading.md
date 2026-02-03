# Data Loading

EreoJS provides a unified data loading pattern with loaders and actions. Loaders fetch data for rendering, while actions handle mutations. This pattern works consistently across all rendering modes.

## Loaders

Loaders are async functions that run on the server before rendering a component. They receive request context and return data for the component.

### Basic Loader

```tsx
// routes/posts/index.tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts }
})

export default function Posts({ loaderData }) {
  return (
    <ul>
      {loaderData.posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Loader Arguments

Loaders receive context about the request:

```tsx
export const loader = createLoader(async ({
  request,      // The incoming Request object
  params,       // URL parameters from dynamic segments
  context       // Request context (cookies, headers, etc.)
}) => {
  // Access URL parameters
  const postId = params.id

  // Access query parameters
  const url = new URL(request.url)
  const page = url.searchParams.get('page') || '1'

  // Access cookies
  const sessionId = context.get('session')

  // Access headers
  const auth = request.headers.get('Authorization')

  const post = await db.posts.find(postId)
  return { post }
})
```

### Using Loader Data

Access loader data in components:

```tsx
// Via props
export default function Post({ loaderData }) {
  return <h1>{loaderData.post.title}</h1>
}

// Via hook
import { useLoaderData } from '@ereo/client'

export default function Post() {
  const { post } = useLoaderData()
  return <h1>{post.title}</h1>
}
```

### Typed Loaders

Add type safety to your loaders:

```tsx
import { createLoader } from '@ereo/data'

interface Post {
  id: string
  title: string
  content: string
}

interface PostsParams {
  id: string
}

export const loader = createLoader<{ post: Post }, PostsParams>(
  async ({ params }) => {
    const post = await db.posts.find(params.id)
    if (!post) {
      throw new Response('Not Found', { status: 404 })
    }
    return { post }
  }
)
```

### Error Handling

Throw responses to handle errors:

```tsx
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  if (!post) {
    throw new Response('Post not found', { status: 404 })
  }

  if (!post.published) {
    throw new Response('Post not published', { status: 403 })
  }

  return { post }
})
```

### Redirects

Return redirects from loaders:

```tsx
import { redirect } from '@ereo/data'

export const loader = createLoader(async ({ request }) => {
  const user = await getUser(request)

  if (!user) {
    return redirect('/login')
  }

  if (!user.verified) {
    return redirect('/verify-email')
  }

  return { user }
})
```

## Actions

Actions handle form submissions and mutations. They run when a form is submitted with a POST (or other) method.

### Basic Action

```tsx
// routes/posts/new.tsx
import { createAction, redirect } from '@ereo/data'
import { Form } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get('title')
  const content = formData.get('content')

  const post = await db.posts.create({ title, content })

  return redirect(`/posts/${post.id}`)
})

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </Form>
  )
}
```

### Action Arguments

Actions receive similar context to loaders:

```tsx
export const action = createAction(async ({
  request,      // The incoming Request
  params,       // URL parameters
  context       // Request context
}) => {
  const formData = await request.formData()
  // Process the form...
})
```

### Returning Data

Actions can return data to the component:

```tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email')

  // Validation
  if (!email || !isValidEmail(email)) {
    return {
      error: 'Please enter a valid email',
      values: { email }
    }
  }

  await subscribe(email)
  return { success: true }
})

export default function Subscribe() {
  const actionData = useActionData()

  return (
    <Form method="post">
      <input
        name="email"
        defaultValue={actionData?.values?.email}
      />
      {actionData?.error && (
        <p className="error">{actionData.error}</p>
      )}
      {actionData?.success && (
        <p className="success">Subscribed!</p>
      )}
      <button type="submit">Subscribe</button>
    </Form>
  )
}
```

### Multiple Actions

Handle different actions with an intent field:

```tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'update':
      return handleUpdate(formData)
    case 'delete':
      return handleDelete(formData)
    case 'publish':
      return handlePublish(formData)
    default:
      throw new Response('Invalid intent', { status: 400 })
  }
})

export default function PostEditor({ loaderData }) {
  return (
    <div>
      <Form method="post">
        <input name="title" defaultValue={loaderData.post.title} />
        <button name="intent" value="update">Save</button>
        <button name="intent" value="publish">Publish</button>
      </Form>

      <Form method="post">
        <button name="intent" value="delete">Delete</button>
      </Form>
    </div>
  )
}
```

## Deferred Data

Use `defer` to stream data that isn't immediately needed:

```tsx
import { createLoader, defer } from '@ereo/data'
import { Suspense } from 'react'
import { Await } from '@ereo/client'

export const loader = createLoader(async ({ params }) => {
  // Critical data - awaited before render
  const post = await db.posts.find(params.id)

  // Non-critical data - streamed later
  const comments = defer(db.comments.findByPost(params.id))
  const related = defer(db.posts.findRelated(params.id))

  return { post, comments, related }
})

export default function Post({ loaderData }) {
  const { post, comments, related } = loaderData

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      <Suspense fallback={<p>Loading comments...</p>}>
        <Await resolve={comments}>
          {(data) => (
            <ul>
              {data.map(c => <li key={c.id}>{c.text}</li>)}
            </ul>
          )}
        </Await>
      </Suspense>

      <Suspense fallback={<p>Loading related...</p>}>
        <Await resolve={related}>
          {(posts) => <RelatedPosts posts={posts} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

## Combining Loaders

Combine multiple loaders for complex data requirements:

```tsx
import { combineLoaders } from '@ereo/data'

const userLoader = createLoader(async ({ request }) => {
  const user = await getUser(request)
  return { user }
})

const postsLoader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts }
})

export const loader = combineLoaders(userLoader, postsLoader)
// Returns { user, posts }
```

## Client Loaders

Add client-side data fetching for hydrated components:

```tsx
import { createLoader, clientLoader } from '@ereo/data'

// Server loader
export const loader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts }
})

// Client loader (runs after hydration)
export const clientLoader = clientLoader(async () => {
  // Fetch fresh data on client
  const response = await fetch('/api/posts')
  const posts = await response.json()
  return { posts }
})
```

## Data Revalidation

Revalidate data after mutations:

```tsx
import { revalidatePath, revalidateTag } from '@ereo/data'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create(Object.fromEntries(formData))

  // Revalidate specific path
  await revalidatePath('/posts')

  // Or revalidate by tag
  await revalidateTag('posts')

  return redirect('/posts')
})
```

## Response Helpers

EreoJS provides helpers for common response types:

```tsx
import { json, redirect, error } from '@ereo/data'

// JSON response
return json({ success: true })
return json({ data }, { status: 201 })

// Redirect
return redirect('/posts')
return redirect('/posts', 303)

// Error
return error('Not found', 404)
return error('Unauthorized', 401)
```

## Data Pipeline

For complex data requirements, use the data pipeline:

```tsx
import { createPipeline, dataSource, cachedSource } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const result = await createPipeline({
    sources: {
      post: dataSource('post', () => db.posts.find(params.id)),
      author: dataSource('author', () => db.users.find(post.authorId)),
      comments: cachedSource('comments', () =>
        db.comments.findByPost(params.id),
        300 // 5 min TTL
      )
    },
    parallel: ['post', 'comments'],
    sequential: [['post', 'author']] // author depends on post
  })

  return result.data
})
```

## Best Practices

1. **Keep loaders focused** - One loader per route, combine if needed
2. **Handle errors explicitly** - Throw Response objects with appropriate status codes
3. **Use types** - Type your loader data for better DX
4. **Defer when possible** - Non-critical data should be deferred
5. **Validate in actions** - Always validate form data before processing
6. **Return meaningful data** - Actions should return success/error information
7. **Use redirects** - After successful mutations, redirect to avoid re-submission
