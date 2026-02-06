# Migrating from Remix

Remix and EreoJS share many concepts, making migration straightforward.

## Loaders

**Remix:**
```tsx
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'

export async function loader({ params }) {
  const post = await getPost(params.id)
  return json({ post })
}

export default function Post() {
  const { post } = useLoaderData()
  return <h1>{post.title}</h1>
}
```

**EreoJS:**
```tsx
import { createLoader } from '@ereo/data'
import { useLoaderData } from '@ereo/client'

export const loader = createLoader(async ({ params }) => {
  const post = await getPost(params.id)
  return { post }
})

export default function Post() {
  const { post } = useLoaderData()
  return <h1>{post.title}</h1>
}
```

## Actions

**Remix:**
```tsx
import { redirect } from '@remix-run/node'
import { Form } from '@remix-run/react'

export async function action({ request }) {
  const formData = await request.formData()
  await createPost(Object.fromEntries(formData))
  return redirect('/posts')
}

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" />
      <button type="submit">Create</button>
    </Form>
  )
}
```

**EreoJS:**
```tsx
import { createAction, redirect } from '@ereo/data'
import { Form } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await createPost(Object.fromEntries(formData))
  return redirect('/posts')
})

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" />
      <button type="submit">Create</button>
    </Form>
  )
}
```

## useFetcher

**Remix:**
```tsx
import { useFetcher } from '@remix-run/react'

function LikeButton({ postId }) {
  const fetcher = useFetcher()
  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit">Like</button>
    </fetcher.Form>
  )
}
```

**EreoJS:**
```tsx
import { useFetcher } from '@ereo/client'

function LikeButton({ postId }) {
  const fetcher = useFetcher()
  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit">Like</button>
    </fetcher.Form>
  )
}
```

## useNavigation

**Remix:**
```tsx
import { useNavigation } from '@remix-run/react'

function SubmitButton() {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  return <button disabled={isSubmitting}>Submit</button>
}
```

**EreoJS:**
```tsx
import { useNavigation } from '@ereo/client'

function SubmitButton() {
  const navigation = useNavigation()
  // Note: EreoJS uses `status` instead of Remix's `state`
  const isSubmitting = navigation.status === 'submitting'
  return <button disabled={isSubmitting}>Submit</button>
}
```

## Error Boundaries

**Remix:**
```tsx
import { useRouteError, isRouteErrorResponse } from '@remix-run/react'

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return <h1>{error.status}: {error.statusText}</h1>
  }

  return <h1>Something went wrong</h1>
}
```

**EreoJS:**
```tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return <h1>{error.status}: {error.statusText}</h1>
  }

  return <h1>Something went wrong</h1>
}
```

## Meta

**Remix:**
```tsx
export function meta({ data }) {
  return [
    { title: data.post.title },
    { name: 'description', content: data.post.excerpt }
  ]
}
```

**EreoJS:**
```tsx
export function meta({ data }) {
  return [
    { title: data.post.title },
    { name: 'description', content: data.post.excerpt }
  ]
}
```

## Key Differences

| Feature | Remix | EreoJS |
|---------|-------|------|
| Runtime | Node.js (adapters) | Bun (native) |
| Client Interactivity | Full hydration | Islands (selective) |
| Bundler | esbuild | Bun |
| Streaming | Optional | Default |

## Migration Checklist

1. **Install Bun** if not already installed
2. **Create new EreoJS project** and copy routes
3. **Update imports** from `@remix-run/*` to `@ereo/*`
4. **Convert loaders** — remove `json()` wrapper, use `createLoader`
5. **Convert actions** — use `createAction`
6. **Convert client components** to islands
7. **Update navigation** — `state` → `status`
8. **Update configuration** to `ereo.config.ts`
9. **Test all routes** and functionality
10. **Deploy** to Bun-compatible hosting

## Getting Help

- [GitHub Issues](https://github.com/ereo-framework/ereo/issues)
- [Discord Community](https://discord.gg/ereo)
