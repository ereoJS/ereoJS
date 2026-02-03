# Schema Adapters

Utilities for aligning validation library types with TypeScript types, solving the common type mismatch problem with coercion.

## Import

```ts
import {
  ereoSchema,
  isEreoSchema,
  schemaBuilder,
  createPaginationParser,
  createSortParser,
  createFilterParser,
  parseBoolean,
  parseStringArray,
  parseDate,
  parseEnum,
} from '@ereo/data'

import type {
  ValidationSchema,
  EreoSchema,
  InferSchemaOutput,
  InferSchemaInput,
  PaginationParams,
  SortParams,
  FilterParams,
} from '@ereo/data'
```

## The Problem

When using Zod with coercion, TypeScript sees a type mismatch:

```ts
// Problem: TypeScript thinks input is string, but output is number
const schema = z.object({
  count: z.coerce.number()
})

// In your loader, TypeScript may incorrectly infer types
export const loader = async ({ searchParams }) => {
  // Is searchParams.count a string or number? Type confusion!
}
```

## ereoSchema

Wrap a Zod (or compatible) schema to properly align input and output types.

### Signature

```ts
function ereoSchema<TOutput>(
  schema: ZodLikeSchema<TOutput>
): EreoSchema<TOutput>
```

### Basic Usage

```ts
import { z } from 'zod'
import { ereoSchema } from '@ereo/data'

// Without ereoSchema - type confusion with coerce
const rawSchema = z.object({
  count: z.coerce.number(),
  active: z.coerce.boolean(),
})

// With ereoSchema - types align correctly
const schema = ereoSchema(z.object({
  count: z.coerce.number(),
  active: z.coerce.boolean(),
}))

// TypeScript correctly sees: { count: number; active: boolean }
```

### With defineRoute

```ts
import { defineRoute, ereoSchema } from '@ereo/data'
import { z } from 'zod'

export const searchParams = ereoSchema(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  sort: z.enum(['newest', 'oldest']).default('newest'),
}))

export const route = defineRoute('/posts')
  .searchParams(searchParams)
  .loader(async ({ searchParams }) => {
    // searchParams.page is number, not string!
    // searchParams.limit is number, not string!
    return db.posts.findMany({
      skip: (searchParams.page - 1) * searchParams.limit,
      take: searchParams.limit,
    })
  })
  .build()
```

### Methods

**parse(data: unknown): TOutput**

Parse and validate input, throwing on error.

```ts
const schema = ereoSchema(z.object({ count: z.coerce.number() }))

schema.parse({ count: '42' }) // { count: 42 }
schema.parse({ count: 'invalid' }) // throws
```

**safeParse(data: unknown): Result**

Parse and validate input, returning a result object.

```ts
const result = schema.safeParse({ count: '42' })

if (result.success) {
  console.log(result.data.count) // 42
} else {
  console.log(result.error.errors) // Validation errors
}
```

## schemaBuilder

Build schemas without Zod dependency using a fluent API.

### Signature

```ts
function schemaBuilder(): SchemaBuilder<{}>
```

### Example

```ts
import { schemaBuilder } from '@ereo/data'

const searchSchema = schemaBuilder()
  .string('q')
  .number('page', { default: 1, min: 1 })
  .number('limit', { default: 10, max: 100 })
  .boolean('includeInactive', { default: false })
  .enum('status', ['active', 'inactive', 'pending'] as const)
  .array('tags')
  .build()

// Use in routes
export const route = defineRoute('/items')
  .searchParams(searchSchema)
  .loader(async ({ searchParams }) => {
    // All types are inferred correctly
  })
  .build()
```

### Builder Methods

**string(key, options?)**

```ts
.string('name', { default: '', optional: true })
```

**number(key, options?)**

```ts
.number('page', { default: 1, min: 1, max: 100 })
```

**boolean(key, options?)**

```ts
.boolean('active', { default: true })
```

**enum(key, values, options?)**

```ts
.enum('status', ['draft', 'published', 'archived'] as const, {
  default: 'draft'
})
```

**array(key, options?)**

```ts
.array('tags', { of: 'string' })
.array('ids', { of: 'number' })
```

## Built-in Parsers

### createPaginationParser

Create a pagination parameter parser with sensible defaults.

```ts
function createPaginationParser(
  options?: PaginationSchemaOptions
): ValidationSchema<unknown, PaginationParams>

interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

interface PaginationSchemaOptions {
  defaultPage?: number    // default: 1
  defaultLimit?: number   // default: 10
  maxLimit?: number       // default: 100
}
```

**Example:**

```ts
import { createPaginationParser } from '@ereo/data'

const paginationSchema = createPaginationParser({
  defaultLimit: 20,
  maxLimit: 50,
})

export const route = defineRoute('/items')
  .searchParams(paginationSchema)
  .loader(async ({ searchParams }) => {
    const { page, limit, offset } = searchParams
    // page defaults to 1, limit capped at 50
  })
  .build()
```

### createSortParser

Create a sort parameter parser with allowed fields.

```ts
function createSortParser<T extends string>(
  allowedFields: T[],
  defaultField?: T,
  defaultOrder?: 'asc' | 'desc'
): ValidationSchema<unknown, SortParams<T>>

interface SortParams<T extends string = string> {
  sortBy?: T
  sortOrder?: 'asc' | 'desc'
}
```

**Example:**

```ts
import { createSortParser } from '@ereo/data'

const sortSchema = createSortParser(
  ['name', 'createdAt', 'updatedAt', 'price'],
  'createdAt',
  'desc'
)

export const route = defineRoute('/products')
  .searchParams(sortSchema)
  .loader(async ({ searchParams }) => {
    const { sortBy, sortOrder } = searchParams
    // sortBy is typed as 'name' | 'createdAt' | 'updatedAt' | 'price'
    // sortOrder is 'asc' | 'desc'
  })
  .build()
```

### createFilterParser

Create a filter parameter parser with allowed values per field.

```ts
function createFilterParser<T extends Record<string, string[]>>(
  allowedFilters: T
): ValidationSchema<unknown, { [K in keyof T]?: T[K][number] | T[K][number][] }>
```

**Example:**

```ts
import { createFilterParser } from '@ereo/data'

const filterSchema = createFilterParser({
  status: ['active', 'inactive', 'pending'],
  category: ['electronics', 'clothing', 'food'],
  color: ['red', 'blue', 'green', 'black', 'white'],
})

export const route = defineRoute('/products')
  .searchParams(filterSchema)
  .loader(async ({ searchParams }) => {
    const { status, category, color } = searchParams
    // status is typed as 'active' | 'inactive' | 'pending' | undefined
    // Handles both single values and arrays
  })
  .build()
```

## Coercion Utilities

Standalone parsing functions for manual use.

### parseBoolean

```ts
function parseBoolean(value: unknown, fallback?: boolean): boolean
```

```ts
parseBoolean('true')      // true
parseBoolean('1')         // true
parseBoolean('yes')       // true
parseBoolean('false')     // false
parseBoolean('0')         // false
parseBoolean('no')        // false
parseBoolean(undefined)   // false
parseBoolean(undefined, true)  // true (custom fallback)
```

### parseStringArray

```ts
function parseStringArray(value: unknown): string[]
```

```ts
parseStringArray(['a', 'b'])     // ['a', 'b']
parseStringArray('a,b,c')        // ['a', 'b', 'c']
parseStringArray('single')       // ['single']
parseStringArray(undefined)      // []
```

### parseDate

```ts
function parseDate(value: unknown, fallback?: Date): Date | undefined
```

```ts
parseDate('2024-01-15')           // Date object
parseDate('invalid')              // undefined
parseDate('invalid', new Date())  // fallback Date
parseDate(new Date())             // same Date object
```

### parseEnum

```ts
function parseEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback?: T
): T | undefined
```

```ts
const status = ['active', 'inactive'] as const

parseEnum('active', status)           // 'active'
parseEnum('invalid', status)          // undefined
parseEnum('invalid', status, 'active') // 'active' (fallback)
```

## Type Utilities

### InferSchemaOutput

Extract the output type from a schema.

```ts
type InferSchemaOutput<T> = ...

// Usage
const schema = ereoSchema(z.object({ count: z.number() }))
type Output = InferSchemaOutput<typeof schema>
// { count: number }
```

### InferSchemaInput

Extract the input type from a schema (before coercion).

```ts
type InferSchemaInput<T> = ...
```

### isEreoSchema

Check if a value is an EreoSchema instance.

```ts
function isEreoSchema<T>(value: unknown): value is EreoSchema<T>
```

## Combining Parsers

Combine multiple parsers for complex search parameters:

```ts
import {
  ereoSchema,
  createPaginationParser,
  createSortParser,
  createFilterParser,
} from '@ereo/data'
import { z } from 'zod'

// Combine parsers manually
const combinedSchema = {
  parse: (data: unknown) => {
    const input = data as Record<string, unknown>
    return {
      ...createPaginationParser().parse(input),
      ...createSortParser(['name', 'createdAt']).parse(input),
      ...createFilterParser({ status: ['active', 'inactive'] }).parse(input),
      q: typeof input.q === 'string' ? input.q : undefined,
    }
  },
  safeParse: (data: unknown) => {
    try {
      return { success: true as const, data: combinedSchema.parse(data) }
    } catch (error) {
      return {
        success: false as const,
        error: { errors: [{ path: [], message: 'Validation failed' }] }
      }
    }
  },
}

// Or use Zod for complex schemas
const searchSchema = ereoSchema(z.object({
  // Pagination
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10).refine(n => n <= 100),

  // Sorting
  sortBy: z.enum(['name', 'createdAt', 'price']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Filtering
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  category: z.string().optional(),

  // Search
  q: z.string().optional(),

  // Date range
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}))
```

## Custom Validators

Create custom validators that work with the schema system:

```ts
import type { ValidationSchema } from '@ereo/data'

// Custom UUID validator
function createUuidParser(): ValidationSchema<unknown, string> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  return {
    parse: (data: unknown): string => {
      const str = String(data)
      if (!uuidRegex.test(str)) {
        throw new Error('Invalid UUID format')
      }
      return str.toLowerCase()
    },
    safeParse: (data: unknown) => {
      try {
        return { success: true, data: createUuidParser().parse(data) }
      } catch (error) {
        return {
          success: false,
          error: {
            errors: [{ path: [], message: 'Invalid UUID format' }]
          }
        }
      }
    }
  }
}

// Custom price range validator
interface PriceRange {
  minPrice?: number
  maxPrice?: number
}

function createPriceRangeParser(): ValidationSchema<unknown, PriceRange> {
  return {
    parse: (data: unknown): PriceRange => {
      const input = data as Record<string, unknown>
      const minPrice = input.minPrice ? Number(input.minPrice) : undefined
      const maxPrice = input.maxPrice ? Number(input.maxPrice) : undefined

      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        throw new Error('minPrice cannot be greater than maxPrice')
      }

      return {
        minPrice: minPrice && !isNaN(minPrice) ? minPrice : undefined,
        maxPrice: maxPrice && !isNaN(maxPrice) ? maxPrice : undefined,
      }
    },
    safeParse: (data: unknown) => {
      try {
        return { success: true, data: createPriceRangeParser().parse(data) }
      } catch (error) {
        return {
          success: false,
          error: {
            errors: [{ path: [], message: error instanceof Error ? error.message : 'Invalid price range' }]
          }
        }
      }
    }
  }
}
```

## Related

- [defineRoute Builder](/api/data/define-route) - Route definitions
- [Type-Safe Routing](/api/core/type-safe-routing) - Overview
- [Typed Navigation](/api/client/typed-navigation) - Navigation
