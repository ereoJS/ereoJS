# Utilities

Path manipulation and deep comparison utilities used internally and available for direct use.

## Import

```ts
import {
  parsePath,
  getPath,
  setPath,
  deepClone,
  deepEqual,
  flattenToPaths,
} from '@ereo/forms'
```

## parsePath

Parses a dot/bracket-notation path string into an array of segments.

```ts
function parsePath(path: string): (string | number)[]
```

```ts
parsePath('user.name')        // ['user', 'name']
parsePath('items.0.title')    // ['items', 0, 'title']
parsePath('data[0].name')     // ['data', 0, 'name']
parsePath('a[0][1].b')        // ['a', 0, 1, 'b']
parsePath('a[b].c')           // ['a', 'b', 'c']
parsePath('')                 // []
```

Numeric segments (including inside brackets) are converted to numbers.

## getPath

Retrieves a value from a nested object by path string.

```ts
function getPath(obj: any, path: string): unknown
```

```ts
const data = { user: { name: 'Alice', tags: ['admin', 'user'] } }

getPath(data, 'user.name')     // 'Alice'
getPath(data, 'user.tags.0')   // 'admin'
getPath(data, 'user.missing')  // undefined
getPath(data, '')               // data (returns the whole object)
```

Returns `undefined` if any segment along the path is nullish.

## setPath

Immutably sets a value at a path, returning a new object. The original is not modified.

```ts
function setPath<T>(obj: T, path: string, value: unknown): T
```

```ts
const data = { user: { name: 'Alice' } }

const updated = setPath(data, 'user.name', 'Bob')
// updated === { user: { name: 'Bob' } }
// data.user.name === 'Alice' (unchanged)

const withArray = setPath({}, 'items.0.title', 'Hello')
// { items: [{ title: 'Hello' }] }
```

### Loop Gotcha

Because `setPath` returns a **new object**, you must reassign when using it in a loop:

```ts
// WRONG -- each call creates a new object, but result is never updated
let result = {}
for (const [key, val] of entries) {
  setPath(result, key, val)  // return value discarded!
}

// CORRECT -- reassign result each iteration
let result = {}
for (const [key, val] of entries) {
  result = setPath(result, key, val)
}
```

## deepClone

Deep-clones a value. Uses `structuredClone` when available, with fallbacks for `Date`, `RegExp`, `Map`, `Set`, arrays, and plain objects.

```ts
function deepClone<T>(obj: T): T
```

```ts
const original = { a: [1, 2], b: new Date(), c: { d: 'e' } }
const cloned = deepClone(original)

cloned.a.push(3)
original.a.length // still 2
```

## deepEqual

Deep comparison of two values. Handles primitives, arrays, plain objects, `Date`, `RegExp`, `Map`, and `Set`.

```ts
function deepEqual(a: unknown, b: unknown): boolean
```

```ts
deepEqual({ a: 1 }, { a: 1 })                              // true
deepEqual([1, 2, 3], [1, 2, 3])                             // true
deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))    // true
deepEqual({ a: 1 }, { a: 2 })                               // false
deepEqual(null, undefined)                                    // false
```

## flattenToPaths

Flattens a nested object into a `Map<string, unknown>` of dot-paths to values. Both leaf values and parent objects/arrays are included.

```ts
function flattenToPaths(obj: any, prefix?: string): Map<string, unknown>
```

```ts
const flat = flattenToPaths({ user: { name: 'Alice', tags: ['a', 'b'] } })
// Map {
//   'user' => { name: 'Alice', tags: ['a', 'b'] },
//   'user.name' => 'Alice',
//   'user.tags' => ['a', 'b'],
//   'user.tags.0' => 'a',
//   'user.tags.1' => 'b',
// }
```

## Related

- [FormStore](/api/forms/form-store) -- uses these utilities internally
- [Types -- PathsOf, PathValue](/api/forms/types) -- type-level path utilities
