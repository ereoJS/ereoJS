# Parameter Validators

Validate route params and search params with type-safe schemas.

## Import

```ts
import {
  // Built-in validators
  validators,

  // Validation functions
  validateParams,
  safeValidateParams,
  validateSearchParams,
  createRouteValidator,

  // Error class
  ParamValidationError
} from '@ereo/router'
```

## Built-in Validators

### validators.string()

Validate string parameters with optional constraints.

```ts
validators.string(options?: {
  min?: number    // Minimum length
  max?: number    // Maximum length
  regex?: RegExp  // Pattern to match
})
```

```ts
const schema = {
  slug: validators.string({ min: 1, max: 100 }),
  username: validators.string({ regex: /^[a-z0-9_]+$/ })
}
```

### validators.number()

Validate numeric parameters.

```ts
validators.number(options?: {
  min?: number      // Minimum value
  max?: number      // Maximum value
  integer?: boolean // Must be integer
})
```

```ts
const schema = {
  price: validators.number({ min: 0, max: 10000 }),
  rating: validators.number({ min: 1, max: 5, integer: true })
}
```

### validators.int()

Convenience validator for integers.

```ts
validators.int(options?: {
  min?: number
  max?: number
})
```

```ts
const schema = {
  id: validators.int({ min: 1 }),
  page: validators.int({ min: 1, max: 1000 })
}
```

### validators.boolean()

Validate boolean parameters. Accepts 'true', 'false', '1', '0', 'yes', 'no'.

```ts
validators.boolean()
```

```ts
const schema = {
  active: validators.boolean(),
  featured: validators.boolean()
}
```

### validators.enum()

Validate against a set of allowed values.

```ts
validators.enum<T extends string>(values: T[])
```

```ts
type Status = 'draft' | 'published' | 'archived'

const schema = {
  status: validators.enum<Status>(['draft', 'published', 'archived']),
  sort: validators.enum(['date', 'title', 'views'])
}
```

### validators.array()

Validate arrays of values.

```ts
validators.array<T>(itemValidator: { parse: (value: string) => T })
```

```ts
const schema = {
  tags: validators.array(validators.string()),
  ids: validators.array(validators.int({ min: 1 }))
}
```

### validators.optional()

Wrap a validator to make it optional.

```ts
validators.optional<T>(validator: { parse: (value: string) => T })
```

```ts
const schema = {
  id: validators.int({ min: 1 }),
  page: validators.optional(validators.int({ min: 1 }))
}

// params.page is T | undefined
```

### validators.default()

Wrap a validator with a default value.

```ts
validators.default<T>(
  validator: { parse: (value: string) => T },
  defaultValue: T
)
```

```ts
const schema = {
  page: validators.default(validators.int({ min: 1 }), 1),
  limit: validators.default(validators.int({ min: 1, max: 100 }), 20)
}

// page defaults to 1 if not provided
// limit defaults to 20 if not provided
```

## validateParams

Validate route parameters against a schema. Throws on validation failure.

```ts
function validateParams<T extends ParamValidationSchema>(
  params: RouteParams,
  schema: T
): { [K in keyof T]: ReturnType<T[K]['parse']> }
```

```ts
const schema = {
  slug: validators.string({ regex: /^[a-z0-9-]+$/ }),
  id: validators.int({ min: 1 })
}

export const loader = createLoader(async ({ params }) => {
  const validated = validateParams(params, schema)
  // validated.slug is string
  // validated.id is number

  const post = await db.posts.find({
    slug: validated.slug,
    userId: validated.id
  })

  return { post }
})
```

## safeValidateParams

Validate parameters without throwing. Returns a result object.

```ts
interface ValidationResult<T> {
  valid: boolean
  data?: T
  errors?: ParamValidationError[]
}

function safeValidateParams<T extends ParamValidationSchema>(
  params: RouteParams,
  schema: T
): ValidationResult<{ [K in keyof T]: ReturnType<T[K]['parse']> }>
```

```ts
const schema = {
  id: validators.int({ min: 1 })
}

export const loader = createLoader(async ({ params }) => {
  const result = safeValidateParams(params, schema)

  if (!result.valid) {
    return Response.json(
      { error: 'Invalid parameters', details: result.errors },
      { status: 400 }
    )
  }

  const post = await db.posts.find(result.data.id)
  return { post }
})
```

## validateSearchParams

Validate URL search parameters against a schema.

```ts
function validateSearchParams<T extends SearchParamValidationSchema>(
  searchParams: URLSearchParams | string | Record<string, string | string[]>,
  schema: T
): Record<string, unknown>
```

```ts
const schema = {
  page: validators.default(validators.int({ min: 1 }), 1),
  limit: validators.default(validators.int({ min: 1, max: 100 }), 20),
  sort: validators.optional(validators.enum(['date', 'title', 'views'])),
  tags: validators.array(validators.string())
}

export const loader = createLoader(async ({ request }) => {
  const url = new URL(request.url)
  const query = validateSearchParams(url.searchParams, schema)

  const posts = await db.posts.find({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    tags: query.tags
  })

  return { posts }
})
```

## createRouteValidator

Create a combined validator for both params and search params.

```ts
function createRouteValidator<
  P extends ParamValidationSchema,
  S extends SearchParamValidationSchema
>(options: {
  params?: P
  searchParams?: S
}): {
  validate: (params: RouteParams, searchParams: URLSearchParams | string) => {
    params: ValidatedParams
    searchParams: ValidatedSearchParams
  }
  safeValidate: (params: RouteParams, searchParams: URLSearchParams | string) => {
    valid: true
    data: { params: ValidatedParams, searchParams: ValidatedSearchParams }
  } | {
    valid: false
    error: ParamValidationError
  }
}
```

```ts
const postValidator = createRouteValidator({
  params: {
    slug: validators.string({ regex: /^[a-z0-9-]+$/ })
  },
  searchParams: {
    format: validators.optional(validators.enum(['html', 'json', 'rss']))
  }
})

export const loader = createLoader(async ({ params, request }) => {
  const url = new URL(request.url)
  const result = postValidator.safeValidate(params, url.searchParams)

  if (!result.valid) {
    return Response.json({ error: result.error.message }, { status: 400 })
  }

  const { params: validParams, searchParams: validQuery } = result.data

  const post = await db.posts.findBySlug(validParams.slug)

  if (validQuery.format === 'json') {
    return Response.json(post)
  }

  return { post }
})
```

## ParamValidationError

Error class for validation failures.

```ts
class ParamValidationError extends Error {
  field: string    // The field that failed validation
  value: unknown   // The value that was invalid

  constructor(message: string, field: string, value: unknown)
}
```

```ts
try {
  const validated = validateParams(params, schema)
} catch (error) {
  if (error instanceof ParamValidationError) {
    console.log('Field:', error.field)    // 'id'
    console.log('Value:', error.value)    // 'abc'
    console.log('Message:', error.message) // 'Value must be a number'
  }
}
```

## Complete Example

```ts
import {
  validators,
  validateParams,
  safeValidateParams,
  validateSearchParams,
  createRouteValidator,
  ParamValidationError
} from '@ereo/router'

// Define schemas
const postParamsSchema = {
  slug: validators.string({ min: 1, max: 200, regex: /^[a-z0-9-]+$/ })
}

const postQuerySchema = {
  page: validators.default(validators.int({ min: 1 }), 1),
  limit: validators.default(validators.int({ min: 1, max: 50 }), 10),
  sort: validators.optional(validators.enum(['newest', 'oldest', 'popular'])),
  tags: validators.array(validators.string({ max: 50 })),
  featured: validators.optional(validators.boolean())
}

// Create combined validator
const postValidator = createRouteValidator({
  params: postParamsSchema,
  searchParams: postQuerySchema
})

// Use in loader
export const loader = createLoader(async ({ params, request }) => {
  const url = new URL(request.url)

  // Option 1: Using combined validator with safe validation
  const result = postValidator.safeValidate(params, url.searchParams)

  if (!result.valid) {
    return Response.json({
      error: 'Validation failed',
      field: result.error.field,
      message: result.error.message
    }, { status: 400 })
  }

  const { params: p, searchParams: q } = result.data

  // All values are properly typed
  const posts = await db.posts.find({
    category: p.slug,
    page: q.page,        // number (defaults to 1)
    limit: q.limit,      // number (defaults to 10)
    sort: q.sort,        // 'newest' | 'oldest' | 'popular' | undefined
    tags: q.tags,        // string[]
    featured: q.featured // boolean | undefined
  })

  return { posts, pagination: { page: q.page, limit: q.limit } }
})

// Option 2: Using separate validators with error handling
export const loader2 = createLoader(async ({ params, request }) => {
  try {
    const validated = validateParams(params, postParamsSchema)
    const url = new URL(request.url)
    const query = validateSearchParams(url.searchParams, postQuerySchema)

    const posts = await db.posts.find({
      category: validated.slug,
      ...query
    })

    return { posts }
  } catch (error) {
    if (error instanceof ParamValidationError) {
      throw new Response(`Invalid ${error.field}: ${error.message}`, {
        status: 400
      })
    }
    throw error
  }
})
```

## Custom Validators

Create custom validators that follow the parse interface.

```ts
// Custom UUID validator
const uuidValidator = {
  parse: (value: string | string[] | undefined): string => {
    if (value === undefined) {
      throw new ParamValidationError('UUID is required', 'value', value)
    }
    const str = Array.isArray(value) ? value[0] : value
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(str)) {
      throw new ParamValidationError('Invalid UUID format', 'value', str)
    }
    return str
  }
}

// Custom date validator
const dateValidator = {
  parse: (value: string | string[] | undefined): Date => {
    if (value === undefined) {
      throw new ParamValidationError('Date is required', 'value', value)
    }
    const str = Array.isArray(value) ? value[0] : value
    const date = new Date(str)

    if (isNaN(date.getTime())) {
      throw new ParamValidationError('Invalid date format', 'value', str)
    }
    return date
  }
}

// Use custom validators
const schema = {
  id: uuidValidator,
  createdAfter: validators.optional(dateValidator)
}
```

## Related

- [Route Matching](./matching.md)
- [File Router](./file-router.md)
- [Routing Concepts](/concepts/routing)
