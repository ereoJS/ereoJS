# Blog Tutorial: Routes

In this chapter, we'll create the posts listing page and individual post pages using EreoJS's file-based routing.

## Posts Listing Page

Create `app/routes/posts/index.tsx`:

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
      <h1>All Posts</h1>

      {posts.length === 0 ? (
        <p>No posts yet. <Link href="/posts/new">Write one!</Link></p>
      ) : (
        posts.map((post: any) => (
          <article key={post.id} className="post-card">
            <h2>
              <Link href={`/posts/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="post-meta">
              {new Date(post.created_at).toLocaleDateString()}
            </p>
            <p>{post.excerpt}</p>
            <Link href={`/posts/${post.slug}`}>Read more →</Link>
          </article>
        ))
      )}
    </div>
  )
}
```

## Post Detail Page

Create `app/routes/posts/[slug].tsx` for dynamic routing:

```tsx
// app/routes/posts/[slug].tsx
import { createLoader } from '@ereo/data'
import { Link } from '@ereo/client'
import { getPost, getPostComments } from '../../lib/db'

export const loader = createLoader(async ({ params }) => {
  const post = getPost(params.slug)

  if (!post) {
    throw new Response('Post not found', { status: 404 })
  }

  const comments = getPostComments(post.id)

  return { post, comments }
})

export function meta({ data }) {
  return [
    { title: `${data.post.title} | My Blog` },
    { name: 'description', content: data.post.excerpt }
  ]
}

export default function PostPage({ loaderData }) {
  const { post, comments } = loaderData

  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        <p className="post-meta">
          Published on {new Date(post.created_at).toLocaleDateString()}
        </p>
      </header>

      <div className="post-content">
        {post.content.split('\n').map((paragraph: string, i: number) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <section className="comments">
        <h2>Comments ({comments.length})</h2>

        {comments.length === 0 ? (
          <p>No comments yet. Be the first!</p>
        ) : (
          comments.map((comment: any) => (
            <div key={comment.id} className="comment">
              <strong>{comment.author}</strong>
              <span className="comment-date">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
              <p>{comment.content}</p>
            </div>
          ))
        )}
      </section>

      <Link href="/posts">← Back to all posts</Link>
    </article>
  )
}
```

## Add Comment Styles

Add to `public/styles.css`:

```css
/* Add to public/styles.css */

.post-content {
  margin: 2rem 0;
  line-height: 1.8;
}

.post-content p {
  margin-bottom: 1.5rem;
}

.comments {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.comment {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  border: 1px solid #e5e7eb;
}

.comment strong {
  margin-right: 0.5rem;
}

.comment-date {
  color: #6b7280;
  font-size: 0.875rem;
}

.hero {
  text-align: center;
  padding: 3rem 0;
  margin-bottom: 2rem;
}

.hero p {
  color: #6b7280;
  font-size: 1.25rem;
}
```

## Error Page

Create `app/routes/posts/_error.tsx` to handle errors:

```tsx
// app/routes/posts/_error.tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'
import { Link } from '@ereo/client'

export default function PostsError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="error-page">
        <h1>Post Not Found</h1>
        <p>The post you're looking for doesn't exist.</p>
        <Link href="/posts" className="btn">View All Posts</Link>
      </div>
    )
  }

  return (
    <div className="error-page">
      <h1>Oops!</h1>
      <p>Something went wrong loading this post.</p>
      <Link href="/posts" className="btn">View All Posts</Link>
    </div>
  )
}
```

Add error styles:

```css
/* Add to public/styles.css */

.error-page {
  text-align: center;
  padding: 3rem;
}

.error-page h1 {
  color: #dc2626;
}
```

## Understanding the Routing

Let's review what we've created:

```
app/routes/
├── _layout.tsx         # Root layout (wraps everything)
├── index.tsx           # /
└── posts/
    ├── _error.tsx      # Error boundary for /posts/*
    ├── index.tsx       # /posts
    └── [slug].tsx      # /posts/:slug
```

Key concepts:

1. **Directory structure = URL structure** - `posts/index.tsx` becomes `/posts`
2. **Dynamic segments** - `[slug].tsx` captures any value at that position
3. **Layouts cascade** - `_layout.tsx` wraps all child routes
4. **Error boundaries** - `_error.tsx` catches errors in that route segment

## Testing the Routes

Visit these URLs to test:

- `http://localhost:3000/` - Home page
- `http://localhost:3000/posts` - Posts listing
- `http://localhost:3000/posts/welcome` - Post detail
- `http://localhost:3000/posts/nonexistent` - Error page (404)

## Navigation Flow

Notice how navigation works:

1. **Server renders** the initial page
2. **Client takes over** for subsequent navigation
3. **Prefetching** loads data before you click
4. **No full page reloads** - smooth SPA-like experience

Try hovering over links - watch the network tab to see prefetching in action!

## What We've Done

1. Created a posts listing page
2. Created a dynamic post detail page
3. Used the `params` object to access URL parameters
4. Added error handling for missing posts
5. Learned about file-based routing conventions

## Current File Structure

```
src/
├── lib/
│   └── db.ts
├── routes/
│   ├── _layout.tsx
│   ├── index.tsx
│   └── posts/
│       ├── _error.tsx
│       ├── index.tsx
│       └── [slug].tsx
└── index.ts
```

## Next Step

In the next chapter, we'll add the ability to create new posts using loaders and actions.

[← Previous: Setup](/tutorials/blog-tutorial/01-setup) | [Continue to Chapter 3: Data Loading →](/tutorials/blog-tutorial/03-data-loading)
