# CI/CD

Set up continuous integration and deployment pipelines for EreoJS projects.

## GitHub Actions

### Basic CI Pipeline

Test and build your EreoJS application on every push and pull request:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bun run typecheck

      - name: Run tests
        run: bun test

      - name: Build
        run: bun run build
```

### Caching Dependencies

Speed up CI runs by caching `node_modules` and the Bun lockfile:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: |
            node_modules
            ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}
          restore-keys: |
            bun-${{ runner.os }}-

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun test

      - name: Build
        run: bun run build
```

### Deploy to Fly.io

Automatically deploy to Fly.io when pushing to `main`:

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

      - name: Setup Fly CLI
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Deploy to Railway

Railway deploys automatically from your connected repo. For manual triggers via GitHub Actions:

```yaml
# .github/workflows/deploy-railway.yml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## GitLab CI

```yaml
# .gitlab-ci.yml
image: oven/bun:1

stages:
  - test
  - build
  - deploy

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/

install:
  stage: .pre
  script:
    - bun install --frozen-lockfile

test:
  stage: test
  script:
    - bun run typecheck
    - bun test

build:
  stage: build
  script:
    - bun run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - echo "Deploy to your target platform"
  only:
    - main
```

## Environment Variables in CI

Store secrets in your CI platform's secret management:

**GitHub Actions:**

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
```

**GitLab CI:**

Configure variables in **Settings** > **CI/CD** > **Variables**.

## Docker-Based CI

For environments where Bun is not directly available, use the official Docker image:

```yaml
# .github/workflows/ci-docker.yml
name: CI (Docker)

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: oven/bun:1
    steps:
      - uses: actions/checkout@v4
      - run: bun install --frozen-lockfile
      - run: bun test
      - run: bun run build
```

## Pre-Commit Hooks

Use a tool like `lefthook` or `husky` to run checks before committing:

```yaml
# .lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      run: bun run lint --staged
    typecheck:
      run: bun run typecheck
```

This prevents broken code from being committed and reduces CI failures.
