import type { Post } from './types';

/**
 * Mock blog posts data.
 * In a real app, this would come from a database or CMS.
 */
export const posts: Post[] = [
  {
    slug: 'getting-started-with-ereo',
    title: 'Getting Started with EreoJS',
    excerpt: 'Learn how to build modern web applications with EreoJS, the React fullstack framework powered by Bun.',
    content: `
# Getting Started with EreoJS

EreoJS is a modern React fullstack framework that runs on Bun, offering exceptional performance and developer experience.

## Key Features

- **Server-Side Rendering**: Fast initial page loads with SSR
- **File-Based Routing**: Intuitive routing with automatic code splitting
- **Data Loading**: Simple and powerful data fetching with loaders
- **Actions**: Handle form submissions and mutations easily
- **Islands Architecture**: Selective hydration for optimal performance

## Quick Start

\`\`\`bash
bunx create-ereo my-app
cd my-app
bun run dev
\`\`\`

You're now ready to build amazing applications!
    `.trim(),
    author: 'EreoJS Team',
    date: '2024-01-15',
    readTime: '5 min read',
    tags: ['ereo', 'react', 'tutorial'],
  },
  {
    slug: 'understanding-loaders-and-actions',
    title: 'Understanding Loaders and Actions',
    excerpt: 'Deep dive into EreoJS\'s data loading and mutation patterns for building robust applications.',
    content: `
# Understanding Loaders and Actions

Loaders and actions are the core data primitives in EreoJS.

## Loaders

Loaders run on the server before rendering and provide data to your components:

\`\`\`typescript
export async function loader({ params }) {
  const user = await db.user.findUnique({
    where: { id: params.id }
  });
  return { user };
}
\`\`\`

## Actions

Actions handle form submissions and mutations:

\`\`\`typescript
export async function action({ request }) {
  const formData = await request.formData();
  await db.user.create({
    data: Object.fromEntries(formData)
  });
  return { success: true };
}
\`\`\`
    `.trim(),
    author: 'EreoJS Team',
    date: '2024-01-20',
    readTime: '8 min read',
    tags: ['ereo', 'data', 'tutorial'],
  },
  {
    slug: 'styling-with-tailwind',
    title: 'Styling with Tailwind CSS',
    excerpt: 'How to use Tailwind CSS effectively in your EreoJS applications for beautiful, responsive designs.',
    content: `
# Styling with Tailwind CSS

EreoJS comes with first-class Tailwind CSS support out of the box.

## Setup

The Tailwind plugin is already configured when you create a new project:

\`\`\`typescript
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  plugins: [tailwind()],
});
\`\`\`

## Usage

Just use Tailwind classes in your components:

\`\`\`tsx
export default function Button({ children }) {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      {children}
    </button>
  );
}
\`\`\`
    `.trim(),
    author: 'EreoJS Team',
    date: '2024-01-25',
    readTime: '4 min read',
    tags: ['ereo', 'tailwind', 'css'],
  },
];

/**
 * Get all posts.
 */
export function getAllPosts(): Post[] {
  return posts;
}

/**
 * Get a single post by slug.
 */
export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

/**
 * Simulate API delay for demo purposes.
 */
export async function simulateDelay(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}