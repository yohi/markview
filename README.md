# MarkView

A lightweight, temporary Markdown workspace with GitHub Flavored Markdown, Mermaid diagrams and side-by-side live preview.

## Features

- **Editor / Split / Preview** modes, with a resizable split pane (30–70% on desktop)
- GitHub Flavored Markdown (tables, task lists, footnotes, strikethrough)
- Mermaid fenced blocks (rendered in-browser with strict security mode)
- One-click **Copy Raw** — copies the original Markdown, not the rendered preview
- Light / dark themes and responsive layout
- **No saving, accounts or backend.** Content stays in React memory only and is lost on refresh or closing the tab

## Local development

Requires Node.js 22+.

~~~bash
npm install
npm run dev
npm test
npm run build
npm run preview
~~~

## Cloudflare Workers Static Assets

The repository includes `wrangler.jsonc` for a static-only deployment. Nothing has been deployed by this repository.

After explicit deployment approval, run:

~~~bash
npm run build
npx wrangler deploy
~~~

The GitHub Actions workflow runs tests and a production build on commits. It does **not** deploy.

## Markdown and security

- `react-markdown`, `remark-gfm` and `rehype-sanitize` render Markdown without enabling raw HTML.
- Mermaid is loaded on demand, uses `securityLevel: "strict"`, and displays errors without crashing the preview.
- Markdown is not sent to an application API, localStorage, sessionStorage or IndexedDB.
- Remote images and links in Markdown can contact external servers when viewed or clicked. Browser/OS history and clipboard behavior are outside the app's control.
- The browser Clipboard API requires HTTPS or another secure context.

## Current scope

This is an MVP: no document saving, autosave, cloud sync, authentication, AI calls, server functions or deployment automation. GitHub-specific extensions outside standard GFM (such as GitHub Alerts) are not guaranteed.
