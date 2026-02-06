# Deploying with Docker

Containerize your EreoJS application with Docker.

## Basic Dockerfile

```dockerfile
# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 ereo
RUN adduser --system --uid 1001 ereo

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER ereo

EXPOSE 3000

CMD ["bun", "ereo", "start"]
```

## Multi-Stage Build (Optimized)

```dockerfile
# Stage 1: Install dependencies
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Stage 2: Build
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 3: Production
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", "ereo", "start"]
```

## Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://postgres:password@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## Development with Docker

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: bun dev
```

```dockerfile
# Dockerfile.dev
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "dev"]
```

Run:

```bash
docker-compose -f docker-compose.dev.yml up
```

## Building and Running

```bash
# Build image
docker build -t my-ereo-app .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://... \
  my-ereo-app

# Run with docker-compose
docker-compose up -d
```

## Environment Variables

### Via docker-compose

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
```

### Via .env file

```yaml
services:
  app:
    env_file:
      - .env.production
```

### Via secrets (Docker Swarm)

```yaml
services:
  app:
    secrets:
      - db_password

secrets:
  db_password:
    external: true
```

## Volume Mounts

```yaml
services:
  app:
    volumes:
      # Persist uploads
      - uploads:/app/uploads
      # Persist SQLite database
      - ./data:/app/data

volumes:
  uploads:
```

## Nginx Reverse Proxy

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app

  app:
    build: .
    expose:
      - "3000"
```

```nginx
# nginx.conf
events {}

http {
  upstream app {
    server app:3000;
  }

  server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
  }

  server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    location / {
      proxy_pass http://app;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_cache_bypass $http_upgrade;
    }
  }
}
```

## CI/CD with GitHub Actions

```yaml
name: Build and Push Docker

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: username/my-ereo-app:latest
```

## Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ereo-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ereo-app
  template:
    metadata:
      labels:
        app: ereo-app
    spec:
      containers:
        - name: app
          image: my-ereo-app:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          resources:
            limits:
              memory: "256Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: ereo-app
spec:
  selector:
    app: ereo-app
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

## Best Practices

1. **Use multi-stage builds** - Smaller final images
2. **Run as non-root** - Security best practice
3. **Add health checks** - For orchestration
4. **Pin versions** - Reproducible builds
5. **Use .dockerignore** - Exclude unnecessary files
6. **Layer caching** - Order COPY commands wisely
7. **Scan for vulnerabilities** - Use `docker scout`

## .dockerignore

```
node_modules
dist
.git
.env*
*.md
.DS_Store
```
