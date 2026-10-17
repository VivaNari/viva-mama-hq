# VivaMama contributor docs

The static documentation site served at
[docs/site](https://github.com/VivaNari/viva-mama-hq/tree/main/docs/site). React + Vite,
content authored in Markdown.

## Why this is not a workspace package

`pnpm-workspace.yaml` globs `apps/*`, `services/*` and `packages/*` — this site is
deliberately outside all three. It is documentation, not a shipped artifact, so keeping it
out means it never enters Turbo's task graph, the release pipeline, or changesets. The
trade-off is that it installs on its own.

## Local development

```bash
cd docs/site
pnpm install --ignore-workspace
pnpm dev                 # http://localhost:5175
```

`--ignore-workspace` is required: without it pnpm walks up, finds the root
`pnpm-workspace.yaml`, and refuses to treat this directory as its own project.

## Build

```bash
pnpm build      # -> dist/
pnpm preview    # serve dist/ locally
```

`build` runs three steps: `tsc -b` (type check), `vite build`, then
`scripts/spa-fallback.mjs`, which copies `dist/index.html` to `dist/404.html`.

### Base path

GitHub Pages serves project sites from `https://<org>.github.io/<repo>/`, so the bundle
needs a path prefix. `vite.config.ts` reads it from `DOCS_BASE`:

```bash
pnpm build                              # base '/'  — local, or a domain root
DOCS_BASE=/viva-mama-hq/ pnpm build     # base '/viva-mama-hq/' — GitHub Pages
```

The deploy workflow sets it automatically.

## Writing content

Every page is a Markdown file in `content/`. **Adding a page needs no code change** — the
site globs the directory at build time.

1. Create `NN-slug.md`. The numeric prefix sets sidebar order and is stripped from the URL,
   so `04-install.md` serves at `/install`.
2. Add frontmatter:

```markdown
---
title: Install dependencies
section: Getting started
description: One-line summary shown under the page heading.
---
```

3. Write GitHub-flavoured Markdown. Tables, fenced code blocks and syntax highlighting all
   work. `##` and `###` headings feed the on-page contents automatically.

`section` groups pages in the sidebar; groups appear in the order they are first seen,
which follows the filename ordering.

### Callout conventions

Blockquotes carry two markers used throughout the guide:

```markdown
> 🚧 **Needs filling in** — project-specific, cannot be derived from the repo.
> ⚠️ **Known issue** — the repo currently contradicts itself here.
```

## Deploying

`.github/workflows/docs-deploy.yml` builds and publishes to GitHub Pages on every push to
`main` that touches `docs/site/**`, and can be run manually via **workflow_dispatch**.

**One-time setup:** Settings → Pages → **Source: GitHub Actions**. Without that, the
workflow's deploy step fails with a "Pages site not found" error.

The site then publishes to `https://vivanari.github.io/viva-mama-hq/`.

### Deploying somewhere else

The output in `dist/` is plain static files with no server requirement. For any host
serving from a domain root, build without `DOCS_BASE`. The only host-specific need is a
rewrite of unknown paths to `index.html` — `dist/404.html` already covers hosts that fall
back to it (GitHub Pages, Netlify, S3).

## Structure

```text
docs/site/
├─ content/            Markdown pages — the editable content
├─ public/.nojekyll    Stops Pages running the output through Jekyll
├─ scripts/            SPA 404 fallback generator
├─ src/
│  ├─ components/      Layout, Sidebar, TopBar, MarkdownPage, CodeBlock, TOC
│  ├─ config.ts        Repo URL + edit-link builder
│  ├─ content.ts       Markdown glob loader, frontmatter parser, nav model
│  └─ styles.css       Design tokens + layout (light/dark via prefers-color-scheme)
└─ vite.config.ts
```
