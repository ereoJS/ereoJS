# Blog Tutorial: Setup

In this tutorial, you'll build a full-featured blog application with EreoJS. By the end, you'll have a working blog with posts, comments, and user authentication.

## What We're Building

- Home page with recent posts
- Post listing and detail pages
- Create, edit, and delete posts
- Comment system
- Simple authentication
- Responsive styling

## Prerequisites

- [Bun](https://bun.sh) v1.0.0 or later
- Basic React knowledge
- A code editor (VS Code recommended)

## Create the Project

```bash
bunx create-ereo@latest blog --template minimal
cd blog
```

> **Note:** We use `--template minimal` to start with a clean slate. The default template includes pre-built pages that would conflict with what we're building.

This creates a new project with the following structure:

```
blog/
├── app/
│   └── routes/
│       ├── _layout.tsx
│       └── index.tsx
├── public/
├── ereo.config.ts
├── package.json
└── tsconfig.json
```

## Project Configuration

Open `ereo.config.ts` and review the configuration:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    port: 3000,
  },
})
```

> **Note:** Since Bun has a built-in SQLite driver (`bun:sqlite`), we don't need any extra database dependencies.

## Set Up the Database

Create a simple SQLite database for our blog. Create `app/lib/db.ts`:

```ts
// app/lib/db.ts
import { Database } from 'bun:sqlite'

const db = new Database('blog.db')

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    published INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
`)

// Seed some initial data
const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number }

if (postCount.count === 0) {
  const insertPost = db.prepare(`
    INSERT INTO posts (title, slug, content, excerpt, published)
    VALUES (?, ?, ?, ?, 1)
  `)

  insertPost.run(
    'Welcome to My Blog',
    'welcome',
    'This is my first blog post. I built this blog with EreoJS, a React fullstack framework powered by Bun.',
    'My first blog post built with EreoJS.'
  )

  insertPost.run(
    'Getting Started with EreoJS',
    'getting-started-ereo',
    'EreoJS makes it easy to build full-stack React applications. Let me show you how...',
    'Learn the basics of building with EreoJS.'
  )
}

export { db }

// Helper functions
export function getPosts() {
  return db.prepare(`
    SELECT * FROM posts
    WHERE published = 1
    ORDER BY created_at DESC
  `).all()
}

export function getPost(slug: string) {
  return db.prepare(`
    SELECT * FROM posts WHERE slug = ?
  `).get(slug)
}

export function getPostComments(postId: number) {
  return db.prepare(`
    SELECT * FROM comments
    WHERE post_id = ?
    ORDER BY created_at DESC
  `).all(postId)
}

export function createPost(data: {
  title: string
  slug: string
  content: string
  excerpt?: string
}) {
  const result = db.prepare(`
    INSERT INTO posts (title, slug, content, excerpt, published)
    VALUES (?, ?, ?, ?, 1)
  `).run(data.title, data.slug, data.content, data.excerpt || '')

  return result.lastInsertRowid
}

export function createComment(data: {
  postId: number
  author: string
  content: string
}) {
  const result = db.prepare(`
    INSERT INTO comments (post_id, author, content)
    VALUES (?, ?, ?)
  `).run(data.postId, data.author, data.content)

  return result.lastInsertRowid
}
```

## Create the Root Layout

Create `app/routes/_layout.tsx`:

```tsx
// app/routes/_layout.tsx
import { Link } from '@ereo/client'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Blog</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <header>
          <nav>
            <Link href="/" className="logo">My Blog</Link>
            <div className="nav-links">
              <Link href="/">Home</Link>
              <Link href="/posts">Posts</Link>
              <Link href="/posts/new">Write</Link>
            </div>
          </nav>
        </header>
        <main>
          {children}
        </main>
        <footer>
          <p>Built with EreoJS</p>
        </footer>
      </body>
    </html>
  )
}
```

## Add Basic Styles

Create `public/styles.css`:

```css
/* public/styles.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f9fafb;
}

header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 2rem;
}

header nav {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #111;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  color: #6b7280;
  text-decoration: none;
}

.nav-links a:hover {
  color: #111;
}

main {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}

footer {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  border-top: 1px solid #e5e7eb;
  margin-top: 4rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

p {
  margin-bottom: 1rem;
}

a {
  color: #2563eb;
}

.post-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  border: 1px solid #e5e7eb;
}

.post-card h2 a {
  color: inherit;
  text-decoration: none;
}

.post-card h2 a:hover {
  color: #2563eb;
}

.post-meta {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #2563eb;
  color: white;
  text-decoration: none;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.btn:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #6b7280;
}

.btn-secondary:hover {
  background: #4b5563;
}
```

## Update the Home Page

Replace `app/routes/index.tsx`:

```tsx
// app/routes/index.tsx
import { createLoader } from '@ereo/data'
import { Link } from '@ereo/client'
import { getPosts } from '~/lib/db'

export const loader = createLoader(async () => {
  const posts = getPosts().slice(0, 3)
  return { posts }
})

export default function Home({ loaderData }: { loaderData: any }) {
  const { posts } = loaderData

  return (
    <div>
      <section className="hero">
        <h1>Welcome to My Blog</h1>
        <p>Thoughts on web development, React, and building with EreoJS.</p>
      </section>

      <section>
        <h2>Recent Posts</h2>
        {posts.map((post: any) => (
          <article key={post.id} className="post-card">
            <h2>
              <Link href={`/posts/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="post-meta">
              {new Date(post.created_at).toLocaleDateString()}
            </p>
            <p>{post.excerpt}</p>
          </article>
        ))}

        <Link href="/posts" className="btn">View All Posts</Link>
      </section>
    </div>
  )
}
```

## Start the Development Server

```bash
bun dev
```

Visit `http://localhost:3000` to see your blog's home page!

## What We've Done

1. Created a new EreoJS project
2. Set up a SQLite database with posts and comments
3. Created a root layout with navigation
4. Added basic styling
5. Built a home page that loads and displays posts

## Next Step

In the next chapter, we'll create the posts listing page and individual post pages with dynamic routing.

[Continue to Chapter 2: Routes →](/tutorials/blog/02-routes)
