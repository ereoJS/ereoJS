# ---- Stage 1: Install all deps + build ----
FROM oven/bun:1-slim AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --ignore-scripts
COPY . .
RUN bun run build

# ---- Stage 2: Production dependencies only ----
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production --ignore-scripts

# ---- Stage 3: Production image ----
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S -g 1001 ereo && \
    adduser -S -u 1001 -G ereo -H ereo

# Copy production node_modules
COPY --from=deps --chown=ereo:ereo /app/node_modules ./node_modules

# Copy build output and runtime files
COPY --from=builder --chown=ereo:ereo /app/.ereo        ./.ereo
COPY --from=builder --chown=ereo:ereo /app/app          ./app
COPY --from=builder --chown=ereo:ereo /app/public       ./public
COPY --from=builder --chown=ereo:ereo /app/package.json ./
COPY --from=builder --chown=ereo:ereo /app/ereo.config.* ./
COPY --from=builder --chown=ereo:ereo /app/tsconfig.*    ./

# Create data directory for SQLite with proper permissions
RUN mkdir -p /app/data && chown -R ereo:ereo /app/data

USER ereo

# Mount a volume for persistent SQLite data
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["bun", "run", "start"]
