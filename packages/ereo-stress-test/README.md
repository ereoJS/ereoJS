# ereo-stress-test

A full-stack task management app built with [EreoJS](https://github.com/ereoJS/ereoJS) — a React fullstack framework powered by Bun.

## Features

- **Email & Password Authentication** — Secure sign up/sign in with argon2id hashing and JWT sessions
- **SQLite Database** — Production-ready with WAL mode, foreign keys, and automatic migrations
- **Full CRUD** — Create, read, update, and delete tasks with server-side validation
- **Server-Side Rendering** — Fast initial loads with data fetched via loaders
- **File-Based Routing** — Routes map to files with layouts, dynamic segments, and error boundaries
- **Protected Routes** — Auth middleware redirects unauthenticated users to login
- **Tailwind CSS** — Utility-first styling with dark mode support
- **Docker Ready** — Multi-stage Dockerfile with SQLite volume persistence

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Open http://localhost:3000
```

Create an account at http://localhost:3000/register and start managing tasks!

## Project Structure

```
app/
├── components/
│   ├── Navigation.tsx    # Auth-aware navigation
│   ├── Footer.tsx
│   └── TaskCard.tsx      # Task list item
├── lib/
│   ├── db.ts             # SQLite database, schema & queries
│   └── types.ts          # Shared TypeScript types
├── routes/
│   ├── _layout.tsx       # Root layout with auth context
│   ├── _error.tsx        # Error boundary
│   ├── _404.tsx          # Not found page
│   ├── index.tsx         # Landing page
│   ├── logout.tsx        # Logout action
│   ├── (auth)/
│   │   ├── login.tsx     # Sign in
│   │   └── register.tsx  # Sign up
│   └── tasks/
│       ├── index.tsx     # Task list with filters
│       ├── new.tsx       # Create task form
│       └── [id].tsx      # View/edit/delete task
└── styles.css            # Tailwind directives
data/
└── app.db                # SQLite database (auto-created)
```

## Scripts

- `bun run dev` — Start development server
- `bun run build` — Build for production
- `bun run start` — Start production server
- `bun test` — Run tests
- `bun run typecheck` — TypeScript type checking

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_SECRET` | **Yes** (production) | dev secret | JWT signing secret |
| `NODE_ENV` | No | development | Environment |
| `PORT` | No | 3000 | Server port |

Generate a production secret:

```bash
openssl rand -base64 32
```

## Docker

```bash
# Build image
docker build -t ereo-stress-test .

# Run with persistent SQLite data
docker run -p 3000:3000 -v ereo-stress-test-data:/app/data -e AUTH_SECRET=your-secret ereo-stress-test
```

## Learn More

- [EreoJS Documentation](https://ereojs.github.io/ereoJS/)
- [Bun Documentation](https://bun.sh/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
