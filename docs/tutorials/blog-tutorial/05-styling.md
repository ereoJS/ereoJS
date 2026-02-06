# Blog Tutorial: Styling

In this chapter, we'll enhance our blog's appearance using Tailwind CSS.

## Install Tailwind CSS

```bash
bun add tailwindcss postcss autoprefixer
bunx tailwindcss init -p
```

## Configure Tailwind

Update `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## Create Tailwind Entry

Replace `public/styles.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn {
    @apply inline-flex items-center justify-center px-4 py-2
           bg-blue-600 text-white font-medium rounded-lg
           hover:bg-blue-700 focus:outline-none focus:ring-2
           focus:ring-blue-500 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors;
  }

  .btn-secondary {
    @apply bg-gray-600 hover:bg-gray-700 focus:ring-gray-500;
  }

  .btn-danger {
    @apply bg-red-600 hover:bg-red-700 focus:ring-red-500;
  }

  .input {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-blue-500
           focus:border-transparent
           disabled:bg-gray-100 disabled:cursor-not-allowed;
  }

  .label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }

  .error-text {
    @apply text-sm text-red-600 mt-1;
  }

  .card {
    @apply bg-white rounded-lg border border-gray-200 p-6
           hover:shadow-md transition-shadow;
  }
}
```

## Update Layout

Update `app/routes/_layout.tsx`:

```tsx
// app/routes/_layout.tsx
import { Link, NavLink } from '@ereo/client'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Blog</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <nav className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600">
              My Blog
            </Link>

            <div className="flex items-center gap-6">
              <NavLink
                href="/"
                end
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`
                }
              >
                Home
              </NavLink>
              <NavLink
                href="/posts"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`
                }
              >
                Posts
              </NavLink>
              <Link href="/posts/new" className="btn text-sm">
                Write Post
              </Link>
            </div>
          </nav>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-gray-200 mt-16">
          <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500 text-sm">
            Built with EreoJS
          </div>
        </footer>
      </body>
    </html>
  )
}
```

## Update Home Page

```tsx
// app/routes/index.tsx
import { createLoader } from '@ereo/data'
import { Link } from '@ereo/client'
import { getPosts } from '../lib/db'

export const loader = createLoader(async () => {
  const posts = getPosts().slice(0, 3)
  return { posts }
})

export default function Home({ loaderData }) {
  const { posts } = loaderData

  return (
    <div>
      {/* Hero */}
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to My Blog
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Thoughts on web development, React, and building modern applications
          with EreoJS.
        </p>
      </section>

      {/* Recent Posts */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Posts</h2>
          <Link href="/posts" className="text-blue-600 hover:text-blue-800 font-medium">
            View all →
          </Link>
        </div>

        <div className="space-y-4">
          {posts.map((post: any) => (
            <article key={post.id} className="card">
              <Link href={`/posts/${post.slug}`}>
                <h3 className="text-xl font-semibold text-gray-900 hover:text-blue-600 mb-2">
                  {post.title}
                </h3>
              </Link>
              <p className="text-sm text-gray-500 mb-3">
                {new Date(post.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-gray-600">
                {post.excerpt}
              </p>
            </article>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No posts yet.</p>
            <Link href="/posts/new" className="text-blue-600 hover:underline">
              Write your first post →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
```

## Update Posts List

```tsx
// app/routes/posts/index.tsx
import { createLoader } from '@ereo/data'
import { Link } from '@ereo/client'
import { getPosts } from '../../lib/db'

export const loader = createLoader(async () => {
  const posts = getPosts()
  return { posts }
})

export default function Posts({ loaderData }) {
  const { posts } = loaderData

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Posts</h1>
        <Link href="/posts/new" className="btn">
          New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-5xl mb-4">📝</div>
          <p className="text-gray-500 mb-4">No posts yet.</p>
          <Link href="/posts/new" className="btn">
            Write your first post
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <article key={post.id} className="card group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Link href={`/posts/${post.slug}`}>
                    <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                      {post.title}
                    </h2>
                  </Link>
                  <p className="text-sm text-gray-500 mb-2">
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    {post.likes > 0 && (
                      <span className="ml-3">❤️ {post.likes}</span>
                    )}
                  </p>
                  <p className="text-gray-600">{post.excerpt}</p>
                </div>
                <Link
                  href={`/posts/${post.slug}`}
                  className="text-blue-600 hover:text-blue-800 font-medium ml-4 shrink-0"
                >
                  Read →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Update Post Detail

```tsx
// Update the post detail page with Tailwind classes
// app/routes/posts/[slug].tsx

export default function PostPage({ loaderData }) {
  const { post, comments } = loaderData
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.status === 'submitting'

  return (
    <article className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-gray-500">
          <time>
            {new Date(post.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </time>
          <span>·</span>
          <Link
            href={`/posts/${post.slug}/edit`}
            className="text-blue-600 hover:text-blue-800"
          >
            Edit
          </Link>
        </div>
      </header>

      <div className="prose prose-lg max-w-none mb-12">
        {post.content.split('\n').map((paragraph: string, i: number) => (
          <p key={i} className="mb-4 text-gray-700 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Like Button */}
      <div className="mb-12">
        <LikeButton postId={post.id} initialLikes={post.likes || 0} />
      </div>

      {/* Comments Section */}
      <section className="border-t border-gray-200 pt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Comments ({comments.length})
        </h2>

        {/* Comment Form */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Leave a Comment</h3>

          {actionData?.success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
              Comment posted successfully!
            </div>
          )}

          <Form method="post" className="space-y-4">
            <div>
              <label htmlFor="author" className="label">Name</label>
              <input
                type="text"
                id="author"
                name="author"
                className="input"
                defaultValue={actionData?.success ? '' : actionData?.values?.author}
                disabled={isSubmitting}
                required
              />
              {actionData?.errors?.author && (
                <p className="error-text">{actionData.errors.author}</p>
              )}
            </div>

            <div>
              <label htmlFor="content" className="label">Comment</label>
              <textarea
                id="content"
                name="content"
                rows={4}
                className="input"
                defaultValue={actionData?.success ? '' : actionData?.values?.content}
                disabled={isSubmitting}
                required
              />
              {actionData?.errors?.content && (
                <p className="error-text">{actionData.errors.content}</p>
              )}
            </div>

            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </Form>
        </div>

        {/* Comments List */}
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No comments yet. Be the first!
          </p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment: any) => (
              <div key={comment.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{comment.author}</span>
                  <time className="text-sm text-gray-500">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </time>
                </div>
                <p className="text-gray-700">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 pt-8 border-t border-gray-200">
        <Link href="/posts" className="text-blue-600 hover:text-blue-800 font-medium">
          ← Back to all posts
        </Link>
      </div>
    </article>
  )
}
```

## Build CSS

Add a build script to your `package.json`:

```json
{
  "scripts": {
    "dev": "ereo dev",
    "build": "tailwindcss -i ./public/styles.css -o ./public/styles.css --minify && ereo build"
  }
}
```

## What We've Done

1. Installed and configured Tailwind CSS
2. Created reusable component classes
3. Updated all pages with modern styling
4. Added responsive design
5. Improved visual hierarchy

## Next Step

In the final chapter, we'll deploy our blog to production.

[← Previous: Forms](/tutorials/blog-tutorial/04-forms) | [Continue to Chapter 6: Deployment →](/tutorials/blog-tutorial/06-deployment)
