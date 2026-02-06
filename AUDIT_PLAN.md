# Ereo Framework Audit Plan

## Baseline Status
- **Tests:** 3122 pass / 0 fail / 105 files
- **TypeScript:** 0 errors
- **Branch:** another-forms

## Dependency Graph

```
Level 0 (Leaf):
  @ereo/core (no deps)
  create-ereo (no @ereo deps)

Level 1 (depends on core only):
  @ereo/state → core
  @ereo/router → core
  @ereo/data → core
  @ereo/client → core
  @ereo/client-sdk → core
  @ereo/db → core
  @ereo/deploy-cloudflare → core
  @ereo/deploy-vercel → core
  @ereo/plugin-tailwind → core
  @ereo/plugin-images → core
  @ereo/rpc → core

Level 2 (depends on Level 0+1):
  @ereo/forms → state
  @ereo/db-drizzle → db
  @ereo/db-surrealdb → db
  @ereo/bundler → core, router
  @ereo/server → core, router, data
  @ereo/router-conventions → core, router
  @ereo/auth → core, router
  @ereo/dev-inspector → core, router, data
  @ereo/testing → core, router, data

Level 3:
  @ereo/runtime-bun → core, server
  @ereo/cli → core, router, server, bundler

Deprecated:
  @ereo/plugin-db (private, deprecated)
```

## Audit Order (bottom-up)

### Batch 1 — Leaf Packages
- [ ] @ereo/core
- [ ] create-ereo

### Batch 2 — Level 1 (core dependents)
- [ ] @ereo/state
- [ ] @ereo/router
- [ ] @ereo/data
- [ ] @ereo/client
- [ ] @ereo/client-sdk
- [ ] @ereo/db
- [ ] @ereo/deploy-cloudflare
- [ ] @ereo/deploy-vercel
- [ ] @ereo/plugin-tailwind
- [ ] @ereo/plugin-images
- [ ] @ereo/rpc

### Batch 3 — Level 2
- [ ] @ereo/forms
- [ ] @ereo/db-drizzle
- [ ] @ereo/db-surrealdb
- [ ] @ereo/bundler
- [ ] @ereo/server
- [ ] @ereo/router-conventions
- [ ] @ereo/auth (plugin-auth)
- [ ] @ereo/dev-inspector
- [ ] @ereo/testing

### Batch 4 — Level 3
- [ ] @ereo/runtime-bun
- [ ] @ereo/cli

### Phase 2 — Integration
- [ ] Full monorepo build
- [ ] Full test suite
- [ ] Cross-package import validation

### Phase 3 — Documentation
- [ ] 150+ doc files audit

### Phase 4 — Final Validation
- [ ] Clean rebuild
- [ ] Full test suite
- [ ] Type check
- [ ] Package.json hygiene
