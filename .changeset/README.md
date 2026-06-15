# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets),
which we use to track changes and generate `CHANGELOG.md` entries across the
versioned workspaces (`@vivamama/backend`, `@vivamama/chatbot`, `@vivamama/contracts`).

## Adding a changeset

When your PR changes the behaviour of a versioned package, run:

```bash
pnpm changeset
```

Pick the affected package(s) and the bump type (`patch` / `minor` / `major`)
following [Semantic Versioning](https://semver.org/), and write a short,
user-facing summary. Commit the generated Markdown file in this folder with your PR.

The mobile app (`@vivamama/mobile`) is versioned through its app-store release
process and is intentionally excluded (see `ignore` in `config.json`).

On merge to `main`, the release workflow consumes accumulated changesets to bump
versions and update changelogs. See [CONTRIBUTING.md](../CONTRIBUTING.md).
