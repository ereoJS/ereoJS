# Blog Tutorial: Advanced Forms

In this chapter, we'll add edit and delete functionality, handle multiple actions, and implement optimistic UI.

## Edit Post Page

Create `src/routes/posts/[slug]/edit.tsx`:

```tsx
// src/routes/posts/[slug]/edit.tsx
import { createLoader, createAction, redirect } from '@ereo/data'
import { Form, Link, useActionData, useNavigation } from '@ereo/client'
import { getPost, db } from '../../../lib/db'

export const loader = createLoader(async ({ params }) => {
  const post = getPost(params.slug)

  if (!post) {
    throw new Response('Post not found', { status: 404 })
  }

  return { post }
})

export const action = createAction(async ({ request, params }) => {
  const formData = await request.formData()
  const intent = formData.get('intent')

  const post = getPost(params.slug)
  if (!post) {
    throw new Response('Post not found', { status: 404 })
  }

  // Handle delete
  if (intent === 'delete') {
    db.prepare('DELETE FROM posts WHERE id = ?').run(post.id)
    return redirect('/posts')
  }

  // Handle update
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
    return { errors, values: { title, content, excerpt } }
  }

  // Update the post
  db.prepare(`
    UPDATE posts
    SET title = ?, content = ?, excerpt = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title.trim(), content.trim(), excerpt?.trim() || '', post.id)

  return redirect(`/posts/${params.slug}`)
})

export default function EditPost({ loaderData }) {
  const { post } = loaderData
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  // Check which action is being performed
  const isDeleting =
    isSubmitting && navigation.formData?.get('intent') === 'delete'
  const isSaving =
    isSubmitting && navigation.formData?.get('intent') === 'save'

  return (
    <div>
      <h1>Edit Post</h1>

      <Form method="post" className="post-form">
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            defaultValue={actionData?.values?.title ?? post.title}
            disabled={isSubmitting}
            required
          />
          {actionData?.errors?.title && (
            <span className="error">{actionData.errors.title}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="excerpt">Excerpt</label>
          <input
            type="text"
            id="excerpt"
            name="excerpt"
            defaultValue={actionData?.values?.excerpt ?? post.excerpt}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            name="content"
            rows={10}
            defaultValue={actionData?.values?.content ?? post.content}
            disabled={isSubmitting}
            required
          />
          {actionData?.errors?.content && (
            <span className="error">{actionData.errors.content}</span>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            name="intent"
            value="save"
            className="btn"
            disabled={isSubmitting}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>

          <Link href={`/posts/${post.slug}`} className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </Form>

      {/* Separate delete form */}
      <div className="danger-zone">
        <h3>Danger Zone</h3>
        <p>Deleting a post cannot be undone.</p>

        <Form method="post">
          <button
            type="submit"
            name="intent"
            value="delete"
            className="btn btn-danger"
            disabled={isSubmitting}
            onClick={(e) => {
              if (!confirm('Are you sure you want to delete this post?')) {
                e.preventDefault()
              }
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Post'}
          </button>
        </Form>
      </div>
    </div>
  )
}
```

## Add Edit Link to Post Page

Update `src/routes/posts/[slug].tsx` to add an edit link:

```tsx
// Add after the post header in the PostPage component

<header>
  <h1>{post.title}</h1>
  <p className="post-meta">
    Published on {new Date(post.created_at).toLocaleDateString()}
    {' · '}
    <Link href={`/posts/${post.slug}/edit`}>Edit</Link>
  </p>
</header>
```

## Add Styles

```css
/* Add to public/styles.css */

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.danger-zone {
  margin-top: 3rem;
  padding: 1.5rem;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  background: #fef2f2;
}

.danger-zone h3 {
  color: #dc2626;
  margin-bottom: 0.5rem;
}

.danger-zone p {
  color: #7f1d1d;
  margin-bottom: 1rem;
}

.btn-danger {
  background: #dc2626;
}

.btn-danger:hover {
  background: #b91c1c;
}
```

## Inline Actions with useFetcher

Let's add a "like" feature using `useFetcher` for non-navigating updates.

First, add a likes column to the database. Update `src/lib/db.ts`:

```ts
// Add this after the CREATE TABLE statements
db.exec(`
  ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0;
`).catch(() => {
  // Column might already exist
})
```

Create an API route for likes at `src/routes/api/posts/[id]/like.ts`:

```ts
// src/routes/api/posts/[id]/like.ts
import { db } from '../../../../lib/db'

export async function POST(request: Request, { params }) {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(params.id)

  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 })
  }

  db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').run(params.id)

  const updated = db.prepare('SELECT likes FROM posts WHERE id = ?').get(params.id)

  return Response.json({ likes: updated.likes })
}
```

Now create a LikeButton island at `src/islands/LikeButton.tsx`:

```tsx
// src/islands/LikeButton.tsx
import { useFetcher } from '@ereo/client'

interface LikeButtonProps {
  postId: number
  initialLikes: number
}

export default function LikeButton({ postId, initialLikes }: LikeButtonProps) {
  const fetcher = useFetcher<{ likes: number }>()

  // Optimistic update: show +1 immediately while submitting
  const likes = fetcher.state === 'submitting'
    ? initialLikes + 1
    : (fetcher.data?.likes ?? initialLikes)

  const isLiking = fetcher.state === 'submitting'

  return (
    <fetcher.Form method="post" action={`/api/posts/${postId}/like`}>
      <button
        type="submit"
        className="like-button"
        disabled={isLiking}
      >
        ❤️ {likes} {likes === 1 ? 'Like' : 'Likes'}
      </button>
    </fetcher.Form>
  )
}
```

Register the island in your client entry:

```ts
// src/client.ts
import { registerIslandComponent, initClient } from '@ereo/client'
import LikeButton from './islands/LikeButton'

registerIslandComponent('LikeButton', LikeButton)

initClient()
```

Use it in the post page:

```tsx
// In src/routes/posts/[slug].tsx
import LikeButton from '../../islands/LikeButton'

// In the component, after the title
<LikeButton
  data-island="LikeButton"
  data-hydrate="idle"
  postId={post.id}
  initialLikes={post.likes || 0}
/>
```

Add styles:

```css
/* Add to public/styles.css */

.like-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 9999px;
  color: #dc2626;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.like-button:hover {
  background: #fee2e2;
}

.like-button:disabled {
  opacity: 0.7;
  cursor: wait;
}
```

## Understanding Optimistic UI

The LikeButton demonstrates optimistic UI:

1. User clicks "Like"
2. **Immediately** show likes + 1 (optimistic)
3. Send request to server in background
4. When response arrives, use actual value
5. If error, revert to original value

```
Click → Optimistic Update → Server Request → Confirm/Revert
         (instant UI)         (background)    (real data)
```

This makes the app feel instant even with slow networks.

## What We've Done

1. Created an edit page with multiple actions (save/delete)
2. Used the `intent` pattern for handling multiple forms
3. Added confirmation for destructive actions
4. Implemented optimistic UI with `useFetcher`
5. Created an interactive island component

## Next Step

In the next chapter, we'll add proper styling with Tailwind CSS.

[← Previous: Data Loading](/tutorials/blog-tutorial/03-data-loading) | [Continue to Chapter 5: Styling →](/tutorials/blog-tutorial/05-styling)
