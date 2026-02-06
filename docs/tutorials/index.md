# Tutorials

Hands-on tutorials to learn EreoJS by building real applications.

## Available Tutorials

### [Build a Blog](/tutorials/blog/01-setup)

A comprehensive 6-part tutorial that covers all the fundamentals by building a full-featured blog application.

**What you'll learn:**
- Setting up an EreoJS project
- File-based routing
- Data loading with loaders
- Form handling with actions
- Styling with Tailwind CSS
- Deploying to production

**Prerequisites:** Basic React knowledge

**Time:** ~2 hours

### [Build a Dashboard](/tutorials/dashboard/)

Learn advanced patterns by building an authenticated dashboard with interactive islands.

**What you'll learn:**
- Authentication patterns
- Islands architecture
- Real-time updates
- Complex state management

**Prerequisites:** Completed Blog tutorial

**Time:** ~3 hours

### Dashboard Tutorial Chapters

| Chapter | Topic | Duration |
|---------|-------|----------|
| [1. Setup](/tutorials/dashboard/01-setup) | Project and database setup | 20 min |
| [2. Authentication](/tutorials/dashboard/02-authentication) | Login, registration, sessions | 30 min |
| [3. Islands](/tutorials/dashboard/03-islands) | Interactive widgets | 35 min |
| [4. Analytics](/tutorials/dashboard/04-analytics) | Shared state between islands | 30 min |
| [5. Deployment](/tutorials/dashboard/05-deployment) | Production deployment | 25 min |

## Tutorial Structure

Each tutorial is broken into manageable sections:

1. **Setup** - Project initialization and configuration
2. **Core Features** - Building the main functionality
3. **Enhancements** - Adding polish and advanced features
4. **Deployment** - Getting your app live

## Getting the Most from Tutorials

1. **Type along** - Don't just copy-paste. Typing helps you learn.
2. **Experiment** - Try changing things to see what happens.
3. **Read the errors** - Error messages teach you about the framework.
4. **Check the source** - Reference code is available in `/packages/examples/`.

## Quick Reference

### Blog Tutorial Chapters

| Chapter | Topic | Duration |
|---------|-------|----------|
| [1. Setup](/tutorials/blog/01-setup) | Project initialization | 15 min |
| [2. Routes](/tutorials/blog/02-routes) | Pages and navigation | 20 min |
| [3. Data Loading](/tutorials/blog/03-data-loading) | Loaders and database | 25 min |
| [4. Forms](/tutorials/blog/04-forms) | Actions and mutations | 25 min |
| [5. Styling](/tutorials/blog/05-styling) | Tailwind CSS | 20 min |
| [6. Deployment](/tutorials/blog/06-deployment) | Going live | 15 min |

## Example Code

All tutorial code is available in the repository:

- Blog: `/packages/examples/blog`
- Minimal: `/packages/examples/minimal`

Clone and run:

```bash
git clone https://github.com/ereo-framework/ereo
cd ereo/packages/examples/blog
bun install
bun dev
```

## Need Help?

- Check the [API Reference](/api/core/create-app) for detailed documentation
- Visit [GitHub Discussions](https://github.com/ereo-framework/ereo/discussions) for community support
- Report issues on [GitHub Issues](https://github.com/ereo-framework/ereo/issues)
