# Changelog

All notable changes to Ereo will be documented here.

## [Unreleased]

### Added

- Initial release of Ereo framework
- File-based routing with dynamic routes
- Loaders and actions for data loading
- Islands architecture for selective hydration
- Tag-based cache invalidation
- Streaming SSR support
- Built-in state management with signals
- CLI tools (dev, build, start)

### Core Features

- `@ereo/core` - Application foundation, plugins, environment, caching
- `@ereo/router` - File-based routing, middleware, validation
- `@ereo/client` - React hooks, Link, Form, navigation, islands
- `@ereo/data` - Loaders, actions, caching, revalidation
- `@ereo/server` - Bun server, middleware, streaming
- `@ereo/state` - Signals and stores for state management
- `@ereo/cli` - Development and build tools

---

## Versioning

Ereo follows [Semantic Versioning](https://semver.org/):

- **MAJOR** - Incompatible API changes
- **MINOR** - New features, backwards compatible
- **PATCH** - Bug fixes, backwards compatible

## Contributing

See the [contributing guide](https://github.com/ereo-framework/ereo/blob/main/CONTRIBUTING.md) for how to contribute to Ereo.
