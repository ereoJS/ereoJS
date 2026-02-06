# Version Upgrade Guide

Instructions for upgrading between EreoJS versions.

## General Upgrade Process

1. **Check the changelog** for breaking changes in the target version
2. **Update package versions** in `package.json`
3. **Run `bun install`** to update dependencies
4. **Run the migration script** if one is provided for the version
5. **Run tests and type-check** to verify nothing broke
6. **Test manually** in the browser

## Updating Package Versions

Update all `@ereo/*` packages to the same version. In a project using EreoJS:

```bash
bun add @ereo/core@latest @ereo/client@latest @ereo/data@latest @ereo/server@latest @ereo/cli@latest
```

Or update `package.json` manually:

```json
{
  "dependencies": {
    "@ereo/core": "^0.1.24",
    "@ereo/client": "^0.1.24",
    "@ereo/data": "^0.1.24",
    "@ereo/server": "^0.1.24",
    "@ereo/forms": "^0.1.24"
  },
  "devDependencies": {
    "@ereo/cli": "^0.1.24"
  }
}
```

Then install:

```bash
bun install
```

All `@ereo/*` packages should be on the same version to avoid compatibility issues.

## Running Migration Scripts

Some versions include automated migration scripts. Check the release notes for the version you are upgrading to:

```bash
bunx @ereo/cli migrate --from 0.1.20 --to 0.1.24
```

The migration script handles:
- Renaming changed imports
- Updating deprecated API calls
- Adjusting config file structure

Always review the changes the script makes before committing.

## After Upgrading

Verify your application:

```bash
# Type-check
bun run typecheck

# Run tests
bun test

# Start dev server and test manually
bun dev
```

If you encounter type errors after upgrading, run `bun dev` once to regenerate route types, then restart your editor's TypeScript server.

## Version Policy

EreoJS follows [Semantic Versioning](https://semver.org/):

- **Patch** (0.1.x) --- Bug fixes, no breaking changes
- **Minor** (0.x.0) --- New features, backwards compatible
- **Major** (x.0.0) --- Breaking changes (documented in changelog)

During the 0.x.x phase, minor versions may include breaking changes. Pin to exact versions in production if stability is critical:

```json
{
  "dependencies": {
    "@ereo/core": "0.1.24"
  }
}
```

## Breaking Changes Log

### 0.1.24

- No breaking changes

### 0.1.22

- `@ereo/forms` removed the `adapters.ts` module. Use Standard Schema auto-detection or the `zodAdapter`/`valibotAdapter` named exports instead.

### 0.1.20

- `createLoader` shorthand now requires an async function (previously accepted sync functions)
- Route `config.cache` structure changed: `maxAge` moved under `data` key

Check the [Changelog](/welcome/whats-new) for the complete list of changes per version.
