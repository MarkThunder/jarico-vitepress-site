# Repository Guidelines

## Project Structure & Module Organization

This repository is a small VitePress site. Key paths:
- `.vitepress/` — Site configuration and theme overrides.
  - `.vitepress/config.mts` — Global site config (nav, sidebar, title).
  - `.vitepress/theme/` — Theme entry (`index.ts`) and custom styles (`style.css`).
- `index.md` — Home page content and hero configuration.
- `markdown-examples.md`, `api-examples.md` — Example content pages.
- `node_modules/` — Dependencies (generated).

There is no dedicated `src/` or `tests/` directory in this repo.

## Build, Test, and Development Commands

Use the scripts from `package.json`:
- `pnpm docs:dev` — Start local dev server with hot reload.
- `pnpm docs:build` — Build the static site output.
- `pnpm docs:preview` — Preview the built site locally.

## Coding Style & Naming Conventions

- Follow existing formatting in files: 2-space indentation is used in `.mts` and `.css`.
- Keep content pages in Markdown with clear headings (`#`, `##`) and short paragraphs.
- Keep config keys aligned with VitePress defaults (do not rename structure fields).
- Prefer small, localized changes (e.g., change CSS variables rather than adding new selectors).

No formatter or linter is configured in this repo.

## Testing Guidelines

No automated tests are present. If you add tests in the future, document the framework and commands here, and keep test files in a dedicated `tests/` directory.

## Commit & Pull Request Guidelines

This directory is not a Git repository, so there is no commit history to infer conventions. If you initialize Git, use short, imperative commit messages (e.g., `Update home hero copy`). For pull requests, include:
- A short summary of the change
- Screenshots for visual changes (e.g., theme or layout updates)
- Linked issue/task references when applicable

## Agent-Specific Instructions

Keep changes minimal and low-risk, especially for theme and layout updates. Prefer updating Markdown content or CSS variables over structural or layout modifications.
