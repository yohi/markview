# MarkView

A lightweight, temporary Markdown workspace with GitHub Flavored Markdown, Mermaid diagrams and side-by-side live preview.

## Features

- **Editor / Split / Preview** modes, with a resizable split pane (30–70% on desktop)
- GitHub Flavored Markdown (tables, task lists, footnotes, strikethrough)
- Mermaid fenced blocks (rendered in-browser with strict security mode)
- One-click **Copy Raw** — copies the original Markdown, not the rendered preview
- Light / dark themes and responsive layout
- Larger edge-to-edge workspace and a **Fullscreen** toolbar button (browser fullscreen, with Esc to exit) that retains mode switching and Raw Copy
- **Maximize** fills the browser tab's available viewport without hiding browser tabs; **Restore** returns to the normal layout
- Click GFM task checkboxes in Preview to toggle them; the corresponding `[ ]` / `[x]` in the in-memory Markdown source updates immediately, including in Split mode
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

The repository includes `wrangler.jsonc` for a static-only Workers deployment.

### GitHub Actions deployment

- `.github/workflows/ci.yml` runs tests, TypeScript checks and a production build on pushes and pull requests.
- `.github/workflows/deploy.yml` runs **only after CI succeeds on a trusted push to `master`**. PR or feature-branch CI cannot deploy. It checks that the CI-tested commit is still the current `master` HEAD before deploying.
- The deployment workflow must first exist on the default branch. Merely committing it to a feature branch does not deploy anything.
- The deploy job uses the GitHub `production` environment. You can configure its required reviewers as an approval gate in GitHub Settings before merging.
- Do **not** also enable Cloudflare Workers Builds Git integration for automatic deployment of the same Worker; that would create a second deployment path.

Configure these at `GitHub → yohi/markview → Settings → Secrets and variables → Actions`:

| Type | Name | Value |
| --- | --- | --- |
| Repository secret | `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers edit permissions for the intended account |
| Repository variable | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID (not Zone ID) |

Create the token in Cloudflare Dashboard → Account API Tokens → Create Token → **Edit Cloudflare Workers**. Restrict its resources to the intended account; custom-domain routes need separately checked permissions. Never commit or paste the token into a file. If you prefer environment-scoped configuration, use the same names under the GitHub `production` environment.

**When you merge this workflow into `master`**, a subsequent successful `master` CI push may trigger the first deployment automatically if credentials and any environment approvals are in place. Do not merge until that behavior is desired.

Manual deployment remains available after separate approval:

~~~bash
npm install
npm run build
npx wrangler deploy
~~~

The deploy workflow currently uses `npm install` because no lockfile exists; creating and committing a `package-lock.json` would allow switching CI and deploy to `npm ci`.

## Markdown and security

- `react-markdown`, `remark-gfm` and `rehype-sanitize` render Markdown without enabling raw HTML.
- Mermaid is loaded on demand, uses `securityLevel: "strict"`, and displays errors without crashing the preview.
- Markdown is not sent to an application API, localStorage, sessionStorage or IndexedDB.
- Remote images and links in Markdown can contact external servers when viewed or clicked. Browser/OS history and clipboard behavior are outside the app's control.
- The browser Clipboard API requires HTTPS or another secure context.

## Current scope

This is an MVP: no document saving, autosave, cloud sync, authentication, AI calls, server functions or cloud synchronization. GitHub-specific extensions outside standard GFM (such as GitHub Alerts) are not guaranteed.

### Preview task editing

Only checkboxes generated from GFM list items are interactive. The renderer uses the original list-item source position to update exactly one Markdown checkbox marker. If the source has changed since that preview was rendered, an outdated click does not apply. No changes are persisted beyond the current tab. Maximize and browser Fullscreen are independent modes.
