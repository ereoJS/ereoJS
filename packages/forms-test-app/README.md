# /private/tmp/claude-501/-Users-macm1-new-y-combinator-oreo-js/12bee8ec-054b-4bda-88f2-26bc110a7d98/scratchpad/ereo-forms-test

A modern web application built with [EreoJS](https://github.com/ereo-js/ereo) - a React fullstack framework powered by Bun.

## Features

This project demonstrates:

- **Server-Side Rendering** - Fast initial loads with SSR
- **File-Based Routing** - Intuitive `app/routes` structure
- **Data Loading** - Server loaders for data fetching
- **Form Actions** - Handle mutations with actions
- **Dynamic Routes** - `[slug]` parameters
- **Nested Layouts** - Shared layouts per route segment
- **Islands Architecture** - Selective hydration for interactivity
- **Error Boundaries** - Graceful error handling
- **Tailwind CSS** - Utility-first styling

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Open http://localhost:3000
```

## Project Structure

```
app/
├── components/          # Reusable React components
│   ├── Counter.tsx      # Interactive island example
│   ├── Footer.tsx
│   ├── Navigation.tsx
│   └── PostCard.tsx
├── lib/                 # Shared utilities and data
│   ├── data.ts          # Mock data and helpers
│   └── types.ts         # TypeScript types
├── routes/              # File-based routes
│   ├── _layout.tsx      # Root layout
│   ├── _error.tsx       # Error boundary
│   ├── _404.tsx         # Not found page
│   ├── index.tsx        # Home page (/)
│   ├── about.tsx        # About page (/about)
│   ├── contact.tsx      # Contact form (/contact)
│   └── blog/
│       ├── _layout.tsx  # Blog layout
│       ├── index.tsx    # Blog list (/blog)
│       └── [slug].tsx   # Blog post (/blog/:slug)
└── styles.css           # Global styles with Tailwind
```

## Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun test` - Run tests
- `bun run typecheck` - TypeScript type checking

## Learn More

- [EreoJS Documentation](https://ereo.dev/docs)
- [Bun Documentation](https://bun.sh/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
