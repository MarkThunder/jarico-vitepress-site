# jarico-vitepress-site

A VitePress-based blog with content-driven, metadata-based sidebar generation.

## Project Structure

- `content/` — All docs and blog posts (write here only)
- `.vitepress/config.mts` — Site config (nav/base/srcDir)
- `.vitepress/sidebar.ts` — Auto-generated sidebar (do not edit manually)
- `scripts/gen-sidebar.mjs` — Sidebar generator

## Writing Posts

Create a Markdown file under `content/` and add frontmatter:

```yaml
---
title: 文章标题
category: 技术/前端/Vue
order: 1
date: 2026-02-15
---
```

- `category` supports multi-level paths with `/` (e.g., `技术/前端/Vue`)
- `order` controls ordering within a category (ascending)
- `date` is used as a secondary sort (newer first)

## Development

```bash
pnpm docs:dev
```

The dev/build commands run the sidebar generator automatically.

## Build

```bash
pnpm docs:build
```
