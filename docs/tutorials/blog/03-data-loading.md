# Blog Tutorial: Data Loading

In this chapter, we'll add the ability to create new posts using actions and handle form submissions.

> **Note on approach:** This tutorial uses `createLoader` and `createAction` with the shorthand form (passing a function directly). This is one of several valid ways to define loaders and actions in EreoJS. See [Data Loading](/concepts/data-loading) for a comparison of all approaches.

## Create Post Page

Create `app/routes/posts/new.tsx`:

```tsx
// app/routes/posts/new.tsx
import { createAction, redirect } from '@ereo/data'
import { Form, useActionData, useNavigation } from '@ereo/client'
import { createPost } from '../../lib/db'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const excerpt = formData.get('excerpt') as string

  // Validation
  const errors: Record<string, string> = {}

  if (!title || title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters'
  }

  if (!content || content.trim().length < 10) {
    errors.content = 'Content must be at least 10 characters'
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: { title, content, excerpt }
    }
  }

  // Create the post
  const slug = slugify(title)

  try {
    createPost({
      title: title.trim(),
      slug,
      content: content.trim(),
      excerpt: excerpt?.trim() || content.trim().slice(0, 160)
    })

    return redirect(`/posts/${slug}`)
  } catch (error) {
    return {
      errors: { form: 'Failed to create post. The slug might already exist.' },
      values: { title, content, excerpt }
    }
  }
})

export default function NewPost() {
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.status === 'submitting'

  return (
    <div>
      <h1>Write a New Post</h1>

      <Form method="post" className="post-form">
        {actionData?.errors?.form && (
          <div className="error-banner">{actionData.errors.form}</div>
        )}

        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            defaultValue={actionData?.values?.title}
            disabled={isSubmitting}
            required
          />
          {actionData?.errors?.title && (
            <span className="error">{actionData.errors.title}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="excerpt">Excerpt (optional)</label>
          <input
            type="text"
            id="excerpt"
            name="excerpt"
            placeholder="Brief description for post listings"
            defaultValue={actionData?.values?.excerpt}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            name="content"
            rows={10}
            defaultValue={actionData?.values?.content}
            disabled={isSubmitting}
            required
          />
          {actionData?.errors?.content && (
            <span className="error">{actionData.errors.content}</span>
          )}
        </div>

        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Post'}
        </button>
      </Form>
    </div>
  )
}
```

## Add Form Styles

Add to `public/styles.css`:

```css
/* Form styles */
.post-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-group input:disabled,
.form-group textarea:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.form-group .error {
  display: block;
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1.5rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

## Add Comment Form

Update `app/routes/posts/[slug].tsx` to include a comment form:

```tsx
// app/routes/posts/[slug].tsx
import { createLoader, createAction } from '@ereo/data'
import { Form, Link, useActionData, useNavigation } from '@ereo/client'
import { getPost, getPostComments, createComment } from '../../lib/db'

export const loader = createLoader(async ({ params }) => {
  const post = getPost(params.slug)

  if (!post) {
    throw new Response('Post not found', { status: 404 })
  }

  const comments = getPostComments(post.id)

  return { post, comments }
})

export const action = createAction(async ({ request, params }) => {
  const formData = await request.formData()
  const author = formData.get('author') as string
  const content = formData.get('content') as string

  // Validation
  const errors: Record<string, string> = {}

  if (!author || author.trim().length < 2) {
    errors.author = 'Name must be at least 2 characters'
  }

  if (!content || content.trim().length < 3) {
    errors.content = 'Comment must be at least 3 characters'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { author, content } }
  }

  // Get the post to get its ID
  const post = getPost(params.slug)
  if (!post) {
    return { errors: { form: 'Post not found' } }
  }

  createComment({
    postId: post.id,
    author: author.trim(),
    content: content.trim()
  })

  return { success: true }
})

export function meta({ data }) {
  return [
    { title: `${data.post.title} | My Blog` },
    { name: 'description', content: data.post.excerpt }
  ]
}

export default function PostPage({ loaderData }) {
  const { post, comments } = loaderData
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.status === 'submitting'

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

        {/* Comment Form */}
        <div className="comment-form">
          <h3>Leave a Comment</h3>

          {actionData?.success && (
            <div className="success-banner">Comment posted!</div>
          )}

          <Form method="post">
            <div className="form-group">
              <label htmlFor="author">Name</label>
              <input
                type="text"
                id="author"
                name="author"
                defaultValue={actionData?.success ? '' : actionData?.values?.author}
                disabled={isSubmitting}
                required
              />
              {actionData?.errors?.author && (
                <span className="error">{actionData.errors.author}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="content">Comment</label>
              <textarea
                id="content"
                name="content"
                rows={4}
                defaultValue={actionData?.success ? '' : actionData?.values?.content}
                disabled={isSubmitting}
                required
              />
              {actionData?.errors?.content && (
                <span className="error">{actionData.errors.content}</span>
              )}
            </div>

            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </Form>
        </div>

        {/* Comments List */}
        {comments.length === 0 ? (
          <p>No comments yet. Be the first!</p>
        ) : (
          <div className="comments-list">
            {comments.map((comment: any) => (
              <div key={comment.id} className="comment">
                <strong>{comment.author}</strong>
                <span className="comment-date">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
                <p>{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href="/posts">← Back to all posts</Link>
    </article>
  )
}
```

## Add Success Banner Style

```css
/* Add to public/styles.css */

.success-banner {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1.5rem;
}

.comment-form {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
}

.comment-form h3 {
  margin-bottom: 1rem;
}

.comments-list {
  margin-top: 1.5rem;
}
```

## Understanding the Data Flow

Let's review what happens when a user submits a form:

1. **User submits form** → Browser sends POST request
2. **Server receives request** → `action` function runs
3. **Action validates data** → Returns errors or processes
4. **On success** → Redirect to new page (or return success)
5. **On error** → Return errors and form values
6. **Component re-renders** → Shows errors or success message

```
User Input
    │
    ▼
┌─────────────┐
│ Form Submit │
└─────────────┘
    │
    ▼
┌─────────────┐
│   Action    │ ← Validates, processes
└─────────────┘
    │
    ├── Success → redirect('/posts/new-slug')
    │
    └── Error → { errors, values }
                     │
                     ▼
              ┌─────────────┐
              │ Re-render   │ ← Shows errors
              └─────────────┘
```

## Testing the Forms

Try these scenarios:

1. **Create a post with valid data** → Should redirect to the new post
2. **Submit with empty fields** → Should show validation errors
3. **Submit with short title** → Should show "Title must be at least 3 characters"
4. **Add a comment** → Should appear in the comments list

## Progressive Enhancement

Notice that forms work even without JavaScript:

1. Disable JavaScript in your browser
2. Try submitting a form
3. It still works! (Full page reload instead of SPA navigation)

When JavaScript is enabled, you get:
- No full page reload
- Loading states
- Optimistic UI updates (coming next)

## What We've Done

1. Created a form to add new posts
2. Implemented server-side validation
3. Handled form errors with helpful messages
4. Added a comment form to post pages
5. Learned about the action data flow

## Next Step

In the next chapter, we'll add edit and delete functionality for posts.

[← Previous: Routes](/tutorials/blog/02-routes) | [Continue to Chapter 4: Forms →](/tutorials/blog/04-forms)
