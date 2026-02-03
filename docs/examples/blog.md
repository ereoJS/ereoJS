# Blog Example

A complete blog application demonstrating EreoJS features.

## Overview

This example showcases:
- File-based routing
- Data loading with loaders
- Form handling with actions
- Authentication
- Islands for interactivity
- Tag-based caching

## Project Structure

```
blog/
├── src/
│   ├── routes/
│   │   ├── _layout.tsx         # Root layout
│   │   ├── index.tsx           # Homepage
│   │   ├── login.tsx           # Login page
│   │   ├── posts/
│   │   │   ├── index.tsx       # Posts list
│   │   │   ├── [slug].tsx      # Single post
│   │   │   ├── new.tsx         # Create post
│   │   │   └── [slug]/
│   │   │       └── edit.tsx    # Edit post
│   │   └── api/
│   │       └── posts.tsx       # API endpoint
│   ├── islands/
│   │   ├── LikeButton.tsx      # Like button island
│   │   └── CommentForm.tsx     # Comment form island
│   ├── components/
│   │   ├── PostCard.tsx        # Post preview card
│   │   └── Header.tsx          # Site header
│   ├── lib/
│   │   ├── db.ts               # Database setup
│   │   └── auth.ts             # Auth utilities
│   └── styles/
│       └── global.css          # Global styles
├── ereo.config.ts
└── package.json
```

## Key Files

### Root Layout

```tsx
// src/routes/_layout.tsx
import '../styles/global.css'
import { Header } from '../components/Header'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Blog</title>
      </head>
      <body className="bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
```

### Homepage

```tsx
// src/routes/index.tsx
import { createLoader } from '@ereo/data'
import { Link } from '@ereo/client'
import { db } from '../lib/db'
import { PostCard } from '../components/PostCard'

export const config = {
  cache: { maxAge: 60, tags: ['posts', 'homepage'] }
}

export const loader = createLoader(async () => {
  const posts = db.query(`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.published = 1
    ORDER BY p.created_at DESC
    LIMIT 10
  `).all()

  return { posts }
})

export default function HomePage({ loaderData }) {
  const { posts } = loaderData

  return (
    <div>
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">Welcome to My Blog</h1>
        <p className="text-gray-600">Thoughts on web development and more</p>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Latest Posts</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

### Single Post

```tsx
// src/routes/posts/[slug].tsx
import { createLoader } from '@ereo/data'
import { db } from '../../lib/db'

export const config = {
  cache: {
    maxAge: 300,
    staleWhileRevalidate: 3600
  }
}

export const loader = createLoader(async ({ params, context }) => {
  const post = db.query(`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.slug = ?
  `).get(params.slug)

  if (!post) {
    throw new Response('Post not found', { status: 404 })
  }

  // Add cache tags for this specific post
  context.cache.addTags([`post-${post.id}`, `author-${post.author_id}`])

  const comments = db.query(`
    SELECT c.*, u.name as author_name
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at DESC
  `).all(post.id)

  return { post, comments }
})

export default function PostPage({ loaderData }) {
  const { post, comments } = loaderData

  return (
    <article className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-gray-600">
          By {post.author_name} · {new Date(post.created_at).toLocaleDateString()}
        </p>
      </header>

      <div className="prose lg:prose-xl" dangerouslySetInnerHTML={{ __html: post.content }} />

      {/* Like Button Island */}
      <div
        data-island="LikeButton"
        data-hydrate="visible"
        data-props={JSON.stringify({ postId: post.id, initialLikes: post.likes })}
      >
        <button className="mt-8 px-4 py-2 border rounded">
          ❤️ {post.likes} likes
        </button>
      </div>

      {/* Comments Section */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Comments ({comments.length})</h2>

        {/* Comment Form Island */}
        <div
          data-island="CommentForm"
          data-hydrate="idle"
          data-props={JSON.stringify({ postId: post.id })}
        >
          <form className="mb-8">
            <textarea className="w-full p-3 border rounded" placeholder="Add a comment..." />
            <button type="submit" className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">
              Post Comment
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="p-4 bg-white rounded shadow">
              <p className="font-medium">{comment.author_name}</p>
              <p className="text-gray-600">{comment.content}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  )
}
```

### Like Button Island

```tsx
// src/islands/LikeButton.tsx
import { useState } from 'react'

export default function LikeButton({ postId, initialLikes }) {
  const [likes, setLikes] = useState(initialLikes)
  const [isLiking, setIsLiking] = useState(false)

  const handleLike = async () => {
    if (isLiking) return

    setIsLiking(true)
    setLikes(l => l + 1)  // Optimistic update

    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
      const data = await res.json()
      setLikes(data.likes)
    } catch {
      setLikes(l => l - 1)  // Revert on error
    } finally {
      setIsLiking(false)
    }
  }

  return (
    <button
      onClick={handleLike}
      disabled={isLiking}
      className="mt-8 px-4 py-2 border rounded hover:bg-gray-100 transition"
    >
      ❤️ {likes} likes
    </button>
  )
}
```

### Create Post

```tsx
// src/routes/posts/new.tsx
import { createLoader, createAction } from '@ereo/data'
import { Form, useActionData } from '@ereo/client'
import { revalidateTags } from '@ereo/data'
import { requireAuth } from '../../lib/auth'
import { db } from '../../lib/db'

export const config = {
  middleware: [requireAuth]
}

export const action = createAction(async ({ request, context }) => {
  const user = context.get('user')
  const formData = await request.formData()

  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const slug = title.toLowerCase().replace(/\s+/g, '-')

  // Validation
  const errors: Record<string, string> = {}
  if (!title) errors.title = 'Title is required'
  if (!content) errors.content = 'Content is required'

  if (Object.keys(errors).length) {
    return { errors }
  }

  // Create post
  db.run(
    'INSERT INTO posts (title, slug, content, author_id) VALUES (?, ?, ?, ?)',
    [title, slug, content, user.id]
  )

  // Invalidate caches
  await revalidateTags(['posts', 'homepage'])

  return Response.redirect(`/posts/${slug}`)
})

export default function NewPostPage() {
  const actionData = useActionData()

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create New Post</h1>

      <Form method="post" className="space-y-6">
        <div>
          <label className="block font-medium mb-2">Title</label>
          <input
            name="title"
            className="w-full px-4 py-2 border rounded"
            required
          />
          {actionData?.errors?.title && (
            <p className="text-red-500 text-sm mt-1">{actionData.errors.title}</p>
          )}
        </div>

        <div>
          <label className="block font-medium mb-2">Content</label>
          <textarea
            name="content"
            rows={10}
            className="w-full px-4 py-2 border rounded"
            required
          />
          {actionData?.errors?.content && (
            <p className="text-red-500 text-sm mt-1">{actionData.errors.content}</p>
          )}
        </div>

        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Publish Post
        </button>
      </Form>
    </div>
  )
}
```

## Running the Example

```bash
# Clone the repository
git clone https://github.com/ereo/ereo.git
cd ereo/packages/examples/blog

# Install dependencies
bun install

# Start development server
bun dev
```

Visit `http://localhost:3000` to see the blog.

## Key Concepts Demonstrated

| Feature | File | Description |
|---------|------|-------------|
| File routing | `routes/` | Automatic route generation |
| Dynamic routes | `posts/[slug].tsx` | Parameter extraction |
| Data loading | `loader` functions | Server-side data fetching |
| Form handling | `action` functions | Server-side form processing |
| Caching | `config.cache` | Tag-based cache invalidation |
| Islands | `islands/` | Selective hydration |
| Authentication | `requireAuth` | Route protection |

## Related

- [Blog Tutorial](/tutorials/blog-tutorial/01-setup)
- [Routing](/core-concepts/routing)
- [Data Loading](/core-concepts/data-loading)
- [Caching](/core-concepts/caching)
