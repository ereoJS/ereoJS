# Deploying to Railway

Deploy your EreoJS application to [Railway](https://railway.app) for simple, managed hosting.

## Prerequisites

- A [Railway account](https://railway.app)
- Your project in a Git repository (GitHub, GitLab, or Bitbucket)

## Connect Your Repository

1. Log in to the [Railway dashboard](https://railway.app/dashboard)
2. Click **New Project** > **Deploy from GitHub repo**
3. Select your EreoJS repository
4. Railway detects Bun automatically and begins the first deploy

## Build and Start Commands

Railway auto-detects Bun projects. If you need to customize the commands, set them in the Railway dashboard under **Settings** > **Build & Deploy**:

| Setting | Value |
|---------|-------|
| Build command | `bun run build` |
| Start command | `bun ereo start` |
| Watch paths | `/src/**`, `/routes/**` |

Alternatively, configure via a `railway.json` in your project root:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "bun run build"
  },
  "deploy": {
    "startCommand": "bun ereo start",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## Environment Variables

Set environment variables in the Railway dashboard:

1. Go to your project > **Variables**
2. Add your variables:

```
NODE_ENV=production
DATABASE_URL=postgres://...
SESSION_SECRET=your-secret
```

Or use the Railway CLI:

```bash
railway variables set DATABASE_URL="postgres://..."
railway variables set SESSION_SECRET="your-secret"
```

Variables are encrypted and injected at runtime.

## Custom Domain

Add a custom domain in the Railway dashboard:

1. Go to **Settings** > **Networking** > **Custom Domain**
2. Enter your domain (e.g., `app.example.com`)
3. Add the provided CNAME record to your DNS provider
4. Railway provisions an SSL certificate automatically

## Database

Add a database service directly in Railway:

1. In your project, click **New** > **Database**
2. Choose PostgreSQL, MySQL, Redis, or MongoDB
3. Railway creates the database and sets the connection URL as an environment variable automatically

Reference the variable in your EreoJS config:

```ts
const db = new Database(process.env.DATABASE_URL)
```

## Railway CLI

Install the CLI for command-line management:

```bash
npm install -g @railway/cli
railway login
```

Deploy from your local machine:

```bash
railway up
```

View logs:

```bash
railway logs
```

## Scaling

Railway handles scaling automatically based on your plan. For manual control:

- **Replicas** --- Configure in **Settings** > **Scaling**
- **Resources** --- Set memory and CPU limits in the dashboard
- **Regions** --- Select your preferred deployment region

## Continuous Deployment

Railway deploys automatically on every push to your connected branch (usually `main`). To change the deploy branch or add preview environments for pull requests, configure in **Settings** > **Build & Deploy**.
