# Security

Security best practices for EreoJS applications.

## Overview

EreoJS provides security features out of the box, but proper configuration and awareness of security principles is essential.

## HTTPS

Always use HTTPS in production:

```ts
// Redirect HTTP to HTTPS
const httpsRedirect: MiddlewareHandler = async (request, context, next) => {
  const url = new URL(request.url)

  if (url.protocol === 'http:' && process.env.NODE_ENV === 'production') {
    url.protocol = 'https:'
    return Response.redirect(url.toString(), 301)
  }

  return next()
}
```

## Security Headers

Apply security headers to all responses:

```ts
const securityHeaders: MiddlewareHandler = async (request, context, next) => {
  const response = await next()

  const headers = new Headers(response.headers)

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME sniffing
  headers.set('X-Content-Type-Options', 'nosniff')

  // Enable XSS filter
  headers.set('X-XSS-Protection', '1; mode=block')

  // Control referrer information
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Content Security Policy
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; '))

  // Permissions Policy
  headers.set('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()'
  ].join(', '))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
```

## CSRF Protection

Protect forms from Cross-Site Request Forgery:

```ts
// Generate CSRF token
function generateCSRFToken(): string {
  return crypto.randomUUID()
}

// Middleware to add CSRF token
const csrfMiddleware: MiddlewareHandler = async (request, context, next) => {
  // Generate token for GET requests
  if (request.method === 'GET') {
    const token = generateCSRFToken()
    context.set('csrfToken', token)
  }

  // Validate token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const formData = await request.clone().formData()
    const token = formData.get('_csrf')
    const sessionToken = context.get('csrfToken')

    if (!token || token !== sessionToken) {
      return new Response('Invalid CSRF token', { status: 403 })
    }
  }

  return next()
}
```

Use in forms:

```tsx
export default function ContactForm({ loaderData }) {
  return (
    <Form method="post">
      <input type="hidden" name="_csrf" value={loaderData.csrfToken} />
      {/* form fields */}
    </Form>
  )
}
```

## Input Validation

Always validate and sanitize user input:

```ts
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100).regex(/^[a-zA-Z\s]+$/),
  age: z.number().int().min(0).max(150)
})

export const action = createAction(async ({ request }) => {
  const data = await request.json()

  const result = userSchema.safeParse(data)

  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    )
  }

  // Safe to use result.data
})
```

## SQL Injection Prevention

Use parameterized queries:

```ts
// GOOD - parameterized
const user = db.query('SELECT * FROM users WHERE id = ?').get(userId)

// BAD - string interpolation
const user = db.query(`SELECT * FROM users WHERE id = ${userId}`).get()
```

With query builders:

```ts
// GOOD - uses parameters internally
const posts = await db.table('posts')
  .where('author_id', userId)
  .where('status', 'published')
  .all()
```

## XSS Prevention

EreoJS automatically escapes JSX content:

```tsx
// Safe - content is escaped
<p>{userInput}</p>

// Dangerous - avoid unless necessary
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

If you must render HTML, sanitize it:

```ts
import DOMPurify from 'isomorphic-dompurify'

const sanitizedHTML = DOMPurify.sanitize(userContent)
```

## Authentication Security

### Password Hashing

```ts
import bcrypt from 'bcrypt'

// Hash password
const hash = await bcrypt.hash(password, 12)

// Verify password
const valid = await bcrypt.compare(password, hash)
```

### Session Security

```ts
function createSessionCookie(sessionId: string): string {
  return [
    `session=${sessionId}`,
    'Path=/',
    'HttpOnly',          // Not accessible via JavaScript
    'Secure',            // HTTPS only
    'SameSite=Lax',      // CSRF protection
    `Max-Age=${7 * 24 * 60 * 60}`
  ].join('; ')
}
```

### Rate Limiting

```ts
const rateLimits = new Map<string, { count: number; reset: number }>()

const rateLimit: MiddlewareHandler = async (request, context, next) => {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()

  const limit = rateLimits.get(ip)

  if (limit && limit.reset > now && limit.count >= 100) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': '60' }
    })
  }

  if (!limit || limit.reset <= now) {
    rateLimits.set(ip, { count: 1, reset: now + 60000 })
  } else {
    limit.count++
  }

  return next()
}
```

## Environment Variables

Never expose secrets in client code:

```ts
// ereo.config.ts
export default defineConfig({
  env: {
    // Public - sent to client
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,

    // Private - server only
    DATABASE_URL: process.env.DATABASE_URL,
    API_SECRET: process.env.API_SECRET
  }
})
```

Access in code:

```ts
// Server-side only
const dbUrl = process.env.DATABASE_URL

// Client-safe
const apiUrl = process.env.PUBLIC_API_URL
```

## File Upload Security

Validate file uploads:

```ts
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // Check file size
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File too large (max 5MB)' }
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type' }
  }

  // Verify magic bytes
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 4))

  if (!isValidImageSignature(bytes)) {
    return { error: 'Invalid file format' }
  }

  // Generate safe filename
  const ext = file.name.split('.').pop()
  const safeName = `${crypto.randomUUID()}.${ext}`

  // Save file
  await saveFile(safeName, buffer)

  return { url: `/uploads/${safeName}` }
})
```

## Error Handling

Don't expose internal errors to users:

```ts
const errorMiddleware: MiddlewareHandler = async (request, context, next) => {
  try {
    return await next()
  } catch (error) {
    // Log full error server-side
    console.error('Unhandled error:', error)

    // Return generic message to client
    if (process.env.NODE_ENV === 'production') {
      return new Response('An error occurred', { status: 500 })
    }

    // In development, show details
    return new Response(error.message, { status: 500 })
  }
}
```

## Security Checklist

- [ ] HTTPS enabled in production
- [ ] Security headers configured
- [ ] CSRF protection on forms
- [ ] Input validation on all endpoints
- [ ] Parameterized database queries
- [ ] Passwords hashed with bcrypt
- [ ] Session cookies are HttpOnly, Secure, SameSite
- [ ] Rate limiting on sensitive endpoints
- [ ] File uploads validated
- [ ] Error messages don't leak internals
- [ ] Environment variables protected
- [ ] Dependencies up to date

## Related

- [Authentication Guide](/guides/authentication)
- [Environment Variables](/guides/environment-variables)
- [Error Handling](/guides/error-handling)
