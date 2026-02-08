# Route Validation

Validate route parameters and request data.

## Parameter Validation

### With Zod

```ts
import { createLoader } from '@ereo/data'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.coerce.number().int().positive()
})

export const loader = createLoader(async ({ params }) => {
  const result = paramsSchema.safeParse(params)

  if (!result.success) {
    throw new Response('Invalid ID', { status: 400 })
  }

  const user = await db.users.find(result.data.id)

  if (!user) {
    throw new Response('User not found', { status: 404 })
  }

  return { user }
})
```

### Custom Validation

```ts
export const loader = createLoader(async ({ params }) => {
  const id = parseInt(params.id)

  if (isNaN(id) || id <= 0) {
    throw new Response('Invalid ID format', { status: 400 })
  }

  return { user: await db.users.find(id) }
})
```

## Query String Validation

```ts
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['date', 'title', 'views']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc')
})

export const loader = createLoader(async ({ request }) => {
  const url = new URL(request.url)
  const query = Object.fromEntries(url.searchParams)

  const result = querySchema.safeParse(query)

  if (!result.success) {
    return {
      posts: [],
      error: 'Invalid query parameters'
    }
  }

  const { page, limit, sort, order } = result.data

  return {
    posts: await db.posts.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sort]: order }
    })
  }
})
```

## Request Body Validation

### JSON Body

```ts
import { createAction } from '@ereo/data'
import { z } from 'zod'

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  published: z.boolean().default(false),
  tags: z.array(z.string()).default([])
})

export const action = createAction(async ({ request }) => {
  const body = await request.json()
  const result = createPostSchema.safeParse(body)

  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const post = await db.posts.create(result.data)
  return Response.json(post, { status: 201 })
})
```

### Form Data

```ts
const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(5000)
})

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const data = Object.fromEntries(formData)

  const result = contactSchema.safeParse(data)

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors
    }
  }

  await sendEmail(result.data)
  return { success: true }
})
```

## Validation Middleware

Create reusable validation middleware:

```ts
// middleware/validate.ts
import { z } from 'zod'
import type { MiddlewareHandler } from '@ereo/core'

export function validateParams<T extends z.ZodType>(
  schema: T
): MiddlewareHandler {
  return async (request, context, next) => {
    const params = context.get('params')
    const result = schema.safeParse(params)

    if (!result.success) {
      return new Response('Invalid parameters', { status: 400 })
    }

    context.set('validatedParams', result.data)
    return next()
  }
}

export function validateQuery<T extends z.ZodType>(
  schema: T
): MiddlewareHandler {
  return async (request, context, next) => {
    const url = new URL(request.url)
    const query = Object.fromEntries(url.searchParams)
    const result = schema.safeParse(query)

    if (!result.success) {
      return new Response('Invalid query parameters', { status: 400 })
    }

    context.set('validatedQuery', result.data)
    return next()
  }
}
```

Use in routes:

```ts
import { validateParams, validateQuery } from '../middleware/validate'
import { z } from 'zod'

export const config = {
  middleware: [
    validateParams(z.object({ id: z.coerce.number() })),
    validateQuery(z.object({ include: z.string().optional() }))
  ]
}

export const loader = createLoader(async ({ context }) => {
  const { id } = context.get('validatedParams')
  const { include } = context.get('validatedQuery')

  return { user: await db.users.find(id, { include }) }
})
```

## File Upload Validation

```ts
const uploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 5 * 1024 * 1024,
    'File must be less than 5MB'
  ).refine(
    (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    'File must be JPEG, PNG, or WebP'
  )
})

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get('file')

  const result = uploadSchema.safeParse({ file })

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors.file?.[0] }
  }

  const url = await uploadFile(result.data.file)
  return { url }
})
```

## Validation Helpers

### Type-Safe Errors

```ts
type FieldErrors<T> = Partial<Record<keyof T, string[]>>

function validate<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: FieldErrors<T> } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return {
    success: false,
    errors: result.error.flatten().fieldErrors as FieldErrors<T>
  }
}
```

### Displaying Errors

```tsx
export default function ContactForm() {
  const actionData = useActionData()

  return (
    <Form method="post">
      <div>
        <input name="email" type="email" />
        {actionData?.errors?.email && (
          <p className="text-red-500 text-sm">
            {actionData.errors.email[0]}
          </p>
        )}
      </div>
      <button type="submit">Submit</button>
    </Form>
  )
}
```

## Related

- [Actions](/api/data/actions)
- [Forms Guide](/guides/forms-basic)
- [Error Handling](/guides/error-handling)
