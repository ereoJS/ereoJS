# db (Database Commands)

Database CLI commands for managing migrations, schema, and seeding using Drizzle Kit.

## Overview

EreoJS provides a set of database commands that wrap Drizzle Kit for database management:

| Command | Description |
|---------|-------------|
| `ereo db:migrate` | Run pending database migrations |
| `ereo db:generate` | Generate migration from schema changes |
| `ereo db:studio` | Open Drizzle Studio GUI |
| `ereo db:push` | Push schema directly to database (dev only) |
| `ereo db:seed` | Run database seeders |

## Prerequisites

1. Install Drizzle Kit:

```bash
bun add drizzle-kit
```

2. Create a Drizzle config file (`drizzle.config.ts`):

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## db:migrate

Run pending database migrations.

### Usage

```bash
bun ereo db:migrate [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--config` | | Path to drizzle config file | Auto-detected |
| `--verbose` | `-v` | Enable verbose output | `false` |

### Examples

```bash
# Run migrations with default config
bun ereo db:migrate

# Use custom config file
bun ereo db:migrate --config ./config/drizzle.config.ts

# Verbose output
bun ereo db:migrate --verbose
```

### Expected Output

```
  ⬡ Running database migrations...

  ▶ Running: drizzle-kit migrate --config /path/to/drizzle.config.ts

  [drizzle-kit output]

  ✓ Migrations completed successfully
```

## db:generate

Generate a new migration file from schema changes.

### Usage

```bash
bun ereo db:generate --name <migration-name> [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--name` | | Migration name (required) | - |
| `--config` | | Path to drizzle config file | Auto-detected |
| `--out` | | Output directory for migrations | From config |

### Examples

```bash
# Generate migration with name
bun ereo db:generate --name add_users_table

# Use custom output directory
bun ereo db:generate --name add_posts --out ./migrations

# With custom config
bun ereo db:generate --name initial --config ./drizzle.config.ts
```

### Expected Output

```
  ⬡ Generating migration...

  ▶ Running: drizzle-kit generate --config /path/to/drizzle.config.ts --name add_users_table

  [drizzle-kit output showing generated SQL]

  ✓ Migration "add_users_table" generated successfully
```

### Naming Conventions

Use descriptive, snake_case names:

```bash
# Good
bun ereo db:generate --name add_users_table
bun ereo db:generate --name add_email_to_users
bun ereo db:generate --name create_posts_comments

# Avoid
bun ereo db:generate --name migration1
bun ereo db:generate --name update
```

## db:studio

Open Drizzle Studio, a visual database browser.

### Usage

```bash
bun ereo db:studio [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--port` | | Port for Drizzle Studio | `4983` |
| `--config` | | Path to drizzle config file | Auto-detected |
| `--open` | | Open browser automatically | `true` |

### Examples

```bash
# Start studio with defaults
bun ereo db:studio

# Custom port
bun ereo db:studio --port 4000

# With custom config
bun ereo db:studio --config ./drizzle.config.ts
```

### Expected Output

```
  ⬡ Starting Drizzle Studio...

  ▶ Running: drizzle-kit studio --config /path/to/drizzle.config.ts

  Drizzle Studio is running on https://local.drizzle.studio
```

### Features

Drizzle Studio provides:

- Visual table browser
- Query editor
- Data editing
- Relationship visualization
- Schema explorer

## db:push

Push schema changes directly to the database without creating migrations. **Use only in development.**

### Usage

```bash
bun ereo db:push [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--config` | | Path to drizzle config file | Auto-detected |
| `--force` | `-f` | Skip confirmation prompts | `false` |
| `--verbose` | `-v` | Enable verbose output | `false` |

### Examples

```bash
# Push schema (with confirmation)
bun ereo db:push

# Force push without confirmation
bun ereo db:push --force

# Verbose output
bun ereo db:push --verbose
```

### Expected Output

```
  ⬡ Pushing schema to database...
  ⚠  This should only be used in development

  ▶ Running: drizzle-kit push --config /path/to/drizzle.config.ts

  [drizzle-kit output showing schema changes]

  ✓ Schema pushed successfully
```

### Warning

`db:push` modifies the database directly and can cause data loss. Use `db:migrate` in production environments.

```bash
# Development workflow
bun ereo db:push  # Quick iteration

# Production workflow
bun ereo db:generate --name my_changes
bun ereo db:migrate
```

## db:seed

Run database seeder scripts to populate data.

### Usage

```bash
bun ereo db:seed [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--file` | | Path to seed file | Auto-detected |
| `--reset` | `-r` | Reset database before seeding | `false` |

### Auto-Detection

The CLI looks for seed files in these locations:

1. `db/seed.ts` or `db/seed.js`
2. `src/db/seed.ts` or `src/db/seed.js`
3. `seeds/index.ts` or `seeds/index.js`
4. `drizzle/seed.ts` or `drizzle/seed.js`

### Examples

```bash
# Run default seed file
bun ereo db:seed

# Use custom seed file
bun ereo db:seed --file ./scripts/seed.ts

# Reset database before seeding
bun ereo db:seed --reset
```

### Expected Output

```
  ⬡ Running database seeders...
  Using seed file: /path/to/db/seed.ts

  [seed script output]

  ✓ Seeding completed successfully
```

### Creating a Seed File

```ts
// db/seed.ts
import { db } from './index';
import { users, posts } from './schema';

async function seed() {
  console.log('Seeding database...');

  // Check if we should reset
  if (process.env.DB_SEED_RESET) {
    console.log('Resetting database...');
    await db.delete(posts);
    await db.delete(users);
  }

  // Insert users
  const [user] = await db.insert(users).values({
    name: 'Admin User',
    email: 'admin@example.com',
  }).returning();

  // Insert posts
  await db.insert(posts).values([
    { title: 'First Post', userId: user.id },
    { title: 'Second Post', userId: user.id },
  ]);

  console.log('Seeding complete!');
}

seed().catch(console.error);
```

## db:help

Display help for database commands.

```bash
bun ereo db:help
# or
bun ereo db
```

### Output

```
  ⬡ Ereo Database Commands

  Usage:
    ereo db:<command> [options]

  Commands:
    db:migrate              Run pending database migrations
    db:generate --name <n>  Generate migration from schema changes
    db:studio               Open Drizzle Studio GUI
    db:push                 Push schema directly (dev only)
    db:seed                 Run database seeders

  Migrate Options:
    --config <path>   Path to drizzle config file
    --verbose         Enable verbose output

  Generate Options:
    --name <name>     Migration name (required)
    --config <path>   Path to drizzle config file
    --out <dir>       Output directory for migrations

  Studio Options:
    --port <port>     Port for Drizzle Studio
    --config <path>   Path to drizzle config file

  Push Options:
    --config <path>   Path to drizzle config file
    --force           Skip confirmation prompts
    --verbose         Enable verbose output

  Seed Options:
    --file <path>     Path to seed file
    --reset           Reset database before seeding

  Examples:
    ereo db:generate --name add_users_table
    ereo db:migrate
    ereo db:studio --port 4000
    ereo db:push --force
    ereo db:seed --reset
```

## Configuration

### Drizzle Config File

The CLI searches for config files in this order:

1. `drizzle.config.ts`
2. `drizzle.config.js`
3. `drizzle.config.mjs`
4. `drizzle.config.json`

### Example Configurations

**PostgreSQL:**

```ts
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**SQLite:**

```ts
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: './data/app.db',
  },
} satisfies Config;
```

**MySQL:**

```ts
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle/migrations',
  driver: 'mysql2',
  dbCredentials: {
    uri: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## Programmatic Usage

```ts
import {
  dbMigrate,
  dbGenerate,
  dbStudio,
  dbPush,
  dbSeed,
} from '@ereo/cli';

// Run migrations
await dbMigrate({ verbose: true });

// Generate migration
await dbGenerate({ name: 'add_users_table' });

// Start studio
await dbStudio({ port: 4000 });

// Push schema (dev only)
await dbPush({ force: true });

// Run seeders
await dbSeed({ reset: true });
```

## Type Exports

```ts
import type {
  DbMigrateOptions,
  DbGenerateOptions,
  DbStudioOptions,
  DbPushOptions,
  DbSeedOptions,
} from '@ereo/cli';
```

### Option Interfaces

```ts
interface DbMigrateOptions {
  config?: string;
  verbose?: boolean;
}

interface DbGenerateOptions {
  name: string;
  config?: string;
  out?: string;
}

interface DbStudioOptions {
  port?: number;
  config?: string;
  open?: boolean;
}

interface DbPushOptions {
  config?: string;
  force?: boolean;
  verbose?: boolean;
}

interface DbSeedOptions {
  file?: string;
  reset?: boolean;
}
```

## Workflow Examples

### Development Workflow

```bash
# 1. Create schema
# Edit db/schema.ts

# 2. Push changes directly (fast iteration)
bun ereo db:push

# 3. View data
bun ereo db:studio

# 4. Seed test data
bun ereo db:seed
```

### Production Workflow

```bash
# 1. Create schema changes
# Edit db/schema.ts

# 2. Generate migration
bun ereo db:generate --name add_feature_x

# 3. Review generated SQL
cat drizzle/migrations/0001_add_feature_x.sql

# 4. Run migration
bun ereo db:migrate

# 5. Deploy to production
bun ereo deploy --prod
```

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run migrations
        run: bun ereo db:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy
        run: bun ereo deploy --prod
```

## Troubleshooting

### Config Not Found

```
✗ Drizzle config not found
```

**Solution:** Create a `drizzle.config.ts` file or specify path with `--config`:

```bash
bun ereo db:migrate --config ./config/drizzle.config.ts
```

### Migration Name Required

```
✗ Migration name is required (--name <name>)
```

**Solution:** Provide a name:

```bash
bun ereo db:generate --name my_migration
```

### Seed File Not Found

```
✗ No seed file found.
```

**Solution:** Create a seed file or specify path:

```bash
# Create file at db/seed.ts
# Or specify custom path
bun ereo db:seed --file ./scripts/seed.ts
```

### Database Connection Failed

```
✗ Could not connect to database
```

**Solution:** Check your `DATABASE_URL` environment variable:

```bash
# Verify .env file
cat .env | grep DATABASE_URL

# Or set inline
DATABASE_URL=postgres://... bun ereo db:migrate
```

## Related

- [Data Loading](/concepts/data-loading) - Using data in routes
- [Environment Variables](/guides/environment-variables) - Managing secrets
- [Deployment](/api/cli/deploy) - Deploying with migrations
