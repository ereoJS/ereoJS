# Contributing to EreoJS

Thank you for your interest in contributing to EreoJS! Every contribution -- whether it is a bug fix, a documentation improvement, a test case, or a community discussion -- helps make the framework better for everyone. We value contributors at all experience levels and are happy to help you get started.

## Getting Started

Before diving in, familiarize yourself with the project structure and tooling:

- **[Development Setup](/contributing/development-setup)** -- Step-by-step instructions for cloning the monorepo, installing dependencies with Bun, and running the test suite locally.
- **[Code Architecture](/contributing/code-architecture)** -- An overview of the monorepo structure, the package dependency graph, and how the core modules (router, renderer, cache, state) interact.
- **[Testing Internals](/contributing/testing-internals)** -- How the test suite is organized, testing conventions used across packages, and how to write effective tests for new features.

## Ways to Contribute

### Code

Bug fixes, new features, and performance optimizations are always welcome. Here is how to get started:

1. Browse [open issues](https://github.com/ereo-framework/ereo/issues) for tasks that need attention. Issues labeled [`good first issue`](https://github.com/ereo-framework/ereo/issues?q=label%3A%22good+first+issue%22) are specifically selected for newcomers.
2. Comment on the issue to let maintainers know you are working on it.
3. Follow the [development setup guide](/contributing/development-setup) to get a local environment running.
4. Make your changes on a feature branch and submit a pull request.

### Documentation

Clear, accurate documentation is just as important as code. Ways to help:

- Fix typos, grammar, or unclear explanations in existing pages.
- Add missing examples or improve existing code samples.
- Write new guides for topics not yet covered.
- Review the [Documentation Guide](/contributing/documentation) for writing style conventions, file structure, and how to run the docs site locally.

### Testing

Improving test coverage makes the framework more reliable:

- Write tests for untested code paths or edge cases you discover.
- Report bugs with a minimal reproduction -- even if you do not have a fix, a well-written bug report is a valuable contribution.
- Test EreoJS on different platforms (macOS, Linux, Windows) and different Bun versions to help catch compatibility issues.

### Community

Help other developers succeed with EreoJS:

- Answer questions on [GitHub Discussions](https://github.com/ereo-framework/ereo/discussions) or in the [Discord community](https://discord.gg/ereo).
- Write blog posts or tutorials about building with EreoJS.
- Create video walkthroughs, screencasts, or conference talks.
- Share your EreoJS projects to inspire others.

### Plugins

Extend the EreoJS ecosystem by building plugins:

- Authentication adapters, database integrations, analytics providers, and more.
- See the [Plugin Development Guide](/contributing/plugin-development) for the plugin API, available hooks, and publishing best practices.

## Development Workflow

The typical contribution workflow:

1. **Fork** the [EreoJS repository](https://github.com/ereo-framework/ereo) on GitHub.
2. **Clone** your fork locally and install dependencies with `bun install`.
3. **Create a branch** for your change: `git checkout -b feat/my-feature` or `git checkout -b fix/issue-123`.
4. **Make your changes** -- write code, add tests, update documentation as needed.
5. **Run tests** to verify nothing is broken: `bun test`.
6. **Run the type checker** to catch type errors: `bun run typecheck`.
7. **Commit** using conventional commit messages (see below).
8. **Push** your branch and open a pull request against the `main` branch.

## Pull Request Guidelines

To keep the review process smooth and efficient:

- **One feature or fix per PR.** Smaller, focused pull requests are easier to review and less likely to introduce regressions.
- **Add tests for new features.** If your PR adds a new capability, include tests that cover the expected behavior and important edge cases.
- **Run checks before submitting.** Always run `bun test` and `bun run typecheck` locally before pushing. PRs with failing checks will not be reviewed until they pass.
- **Use conventional commits.** Prefix your commit messages with a type:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `chore:` for maintenance tasks (dependency updates, CI changes)
  - `test:` for adding or updating tests
  - `refactor:` for code restructuring without behavior changes
- **Keep PRs focused and small.** If your change touches multiple areas, consider splitting it into separate pull requests.
- **Write a clear description.** Explain what the PR does, why the change is needed, and how it was tested. Link to any related issues.

## Code Style

EreoJS follows consistent code conventions across all packages:

- **TypeScript** is required for all source code. JavaScript files are not accepted in `src/` directories.
- **ESM only.** All packages use `"type": "module"` and ES module `import`/`export` syntax. Do not use `require()` or `module.exports`.
- **Follow existing patterns.** When adding code to an existing package, match the style, naming conventions, and file organization already in use.
- **No default exports for utilities.** Use named exports for utility functions and types to enable better tree-shaking and IDE support. Default exports are acceptable for route page components and configuration files.
- **Formatting:** The project uses consistent formatting. Run the formatter before committing to ensure your code matches.

## Monorepo Structure

EreoJS is organized as a Bun workspace monorepo:

```
ereo/
  packages/
    core/          # Router, renderer, server, cache
    state/         # Signal-based state management (@ereo/state)
    forms/         # Form library with validation (@ereo/forms)
    data/          # Data loading utilities (@ereo/data)
    create-ereo/   # Project scaffolding CLI
  docs/            # Documentation site (what you are reading)
  examples/        # Example applications
```

Each package under `packages/` is independently versioned and published to npm. Internal dependencies use `workspace:*` references in `package.json`.

## Community

- **[GitHub Discussions](https://github.com/ereo-framework/ereo/discussions)** -- The best place for ideas, RFC proposals, and longer-form Q&A.
- **[Discord](https://discord.gg/ereo)** -- Real-time chat with other contributors and the core team. Join the `#contributing` channel for development-related discussions.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](https://github.com/ereo-framework/ereo/blob/main/CODE_OF_CONDUCT.md). We are committed to providing a welcoming, respectful, and harassment-free experience for everyone. Please report any unacceptable behavior to the maintainers.
