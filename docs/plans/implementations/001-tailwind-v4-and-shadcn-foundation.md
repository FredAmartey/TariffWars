---
status: active
---

# Plan 001: Upgrade to Tailwind v4 and install shadcn/ui with real theme tokens

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, set `status: completed` and
> `completed_date` in this file's frontmatter and update `docs/plans/INDEX.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7d2fba2..HEAD -- frontend/ package.json tailwind.config.js postcss.config.js vite.config.ts tsconfig.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `7d2fba2`, 2026-07-31

## Why this matters

The app is on Tailwind 3.4.17. The current shadcn CLI (4.16.1) is **Tailwind v4
only** — verified by unpacking the published tarballs: `tailwindcss-animate`,
the v3 animation plugin, appears in `shadcn@2.10.0` and is **absent from every
3.x and 4.x release**. Running `npx shadcn@latest init` against this repo today
would write a v4 stylesheet (`@import "tailwindcss"`, `@theme inline`, oklch
tokens) into a v3 project and break the build immediately.

Two paths existed. The decision is to **upgrade Tailwind to v4 first**, then use
current shadcn, so the project lands on the supported path rather than adopting a
line shadcn already calls legacy.

This plan does the upgrade and the install, and gets a genuine `ThemeProvider`
in place. It deliberately stops before rewriting the 371 `isDarkMode` ternaries —
that is plan 002. After this plan the app looks the same and behaves the same;
it just has tokens, primitives, and a real theme mechanism available.

## Current state

```js
// tailwind.config.js — the entire file
export default { content: ["./index.html", "./frontend/**/*.{js,ts,jsx,tsx}"] };
```

No `darkMode` strategy, no theme extension, no plugins.

```js
// postcss.config.js — the entire file
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```css
/* frontend/index.css:1-5 */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';
/* Import Inter font from Google Fonts */
@import url('<https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'>);
```

`frontend/index.css` also contains, and these must survive the upgrade intact:

- webkit scrollbar rules plus a `.dark-scrollbar` class toggled from `App.tsx`
- a `:focus-visible` rule that is the app's only focus indicator
- a `prefers-reduced-motion` block that exempts `.animate-spin` on purpose

Theme state today, in `frontend/App.tsx`:

```tsx
// frontend/App.tsx:22-25
export const ThemeContext = createContext({
  isDarkMode: true,
  toggleTheme: () => {},
});

// frontend/App.tsx:41
const [isDarkMode, setIsDarkMode] = useState(true);
```

It is hardcoded to dark, never persisted, and never consults the OS setting, so
the theme resets on every page load. `isDarkMode` is then threaded through
context into **371 ternaries across 14 files**.

No path aliases exist: `tsconfig.json` has no `baseUrl` or `paths`, and
`vite.config.ts` has no `resolve.alias`. shadcn emits `@/lib/utils` imports, so
this must be fixed before any component is added.

`vite.config.ts` currently sets `base: "/projects/tariff-wars/"` and a dev-only
`server.proxy` for the API. **Both must be preserved** — the app is served under
a path prefix behind a reverse proxy, and without the proxy `vite dev` has no
backend.

### Tailwind v4 breaking changes that actually bite this codebase

I scanned for each. These are the real counts, not a generic list:

| Change | Sites | Where |
| --- | --- | --- |
| `bg-opacity-*` → `/50` modifier | 1 | `Modal.tsx:98` (`bg-black bg-opacity-50`) |
| `flex-shrink-*` → `shrink-*` | 7 | `NewsFeed.tsx` ×4, `Notifications.tsx:18`, `Sidebar.tsx:60,89` |
| `flex-grow` → `grow` | 2 | `NewsFeed.tsx:207,255` |
| `outline-none` → `outline-hidden` | 3 | `NewsFeed.tsx:219`, `TariffRates.tsx:137`, `Modal.tsx:111` |
| bare `border` default colour changes from `gray-200` to `currentColor` | 10 | listed below |
| `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm` | 9 | across components |

The 10 uncoloured-`border` sites, which are the highest silent-visual-risk items
because nothing errors — the border just turns the wrong colour:

```
frontend/components/NewsFeed.tsx:505
frontend/components/TariffRates.tsx:137, 174, 197, 302, 330, 354
frontend/components/dashboard/TariffTable.tsx:513, 737
frontend/components/dashboard/AffectedStocks.tsx:490
```

Most of these take a `border-<colour>` from an interpolated ternary on an
adjacent line, so they are probably fine — **check each one individually**
rather than assuming either way.

Browser support note: Tailwind v4 targets Safari 16.4+, Chrome 111+, Firefox
128+. It uses `@property` and `color-mix()`. If this project must support older
browsers, that is a STOP condition — raise it rather than proceeding.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm install` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0, `✓ built in …` |
| Dev server | `npm run dev` | serves `http://localhost:5173/projects/tariff-wars/` |
| Backend (for dev) | `cd backend && npm run dev` | listens on 3001 |

## Suggested executor toolkit

- Invoke `next-best-practices` or `vercel-react-best-practices` if available
  when writing the ThemeProvider in Step 6 — it is a client-side context with a
  layout-effect concern (avoiding a flash of the wrong theme).
- Tailwind v4 upgrade guide: <https://tailwindcss.com/docs/upgrade-guide>
- shadcn Vite install: <https://ui.shadcn.com/docs/installation/vite>
- shadcn dark mode for Vite: <https://ui.shadcn.com/docs/dark-mode/vite>

## Scope

**In scope**:

- `package.json`, `package-lock.json`
- `tailwind.config.js` (will be deleted — v4 moves config into CSS)
- `postcss.config.js` (will be deleted — replaced by the Vite plugin)
- `vite.config.ts`, `tsconfig.json`
- `frontend/index.css`
- `frontend/App.tsx` (theme provider only)
- `frontend/lib/utils.ts` (create)
- `frontend/components/ui/**` (create — shadcn output)
- `frontend/context/ThemeContext.tsx` (create)
- `components.json` (create)
- The specific utility-rename sites listed in the table above

**Out of scope** (do NOT touch):

- **The 371 `isDarkMode` ternaries.** Do not start converting components to
  semantic tokens. That is plan 002 and doing it here makes this diff
  unreviewable. The only `isDarkMode` change permitted is in `App.tsx` /
  `ThemeContext.tsx` to add persistence and the `dark` class.
- `backend/**`
- `frontend/components/dashboard/AffectedStocks.module.css` — the marquee
  keyframes and `prefers-reduced-motion` block are deliberate and already
  minimal. v4 does not require changes to plain CSS modules.
- Any change to `base: "/projects/tariff-wars/"` or `server.proxy` in
  `vite.config.ts`.

## Git workflow

- Branch: `advisor/001-tailwind-v4-shadcn`
- Commit per step. Prefixes in this repo are **only** `fix:`, `docs:`,
  `refactor:`, or none. Use `refactor:` for the migration steps.
- No AI attribution in commit messages.
- Do NOT push or open a PR.

## Steps

### Step 1: Confirm the baseline is green before touching anything

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Record the output. You need a known-good starting point to attribute any later
failure.

**Verify**: all three exit 0. If not, STOP — do not start a major upgrade on a
red baseline.

### Step 2: Capture reference screenshots

Start the backend (`cd backend && npm run dev`) and the frontend
(`npm run dev`), then capture the three routes at desktop width and one at
390px, in both themes:

- `/projects/tariff-wars/dashboard`
- `/projects/tariff-wars/tariff-rates`
- `/projects/tariff-wars/news-feed`

Save them outside the repo. These are your before/after comparison for a change
whose whole risk profile is "it still compiles but looks different."

**Verify**: 8 screenshots exist.

### Step 3: Run the official Tailwind upgrade tool

Requires Node 20+ (this machine has v26, fine).

```bash
npx @tailwindcss/upgrade
```

It will migrate `frontend/index.css`, rewrite renamed utilities, and try to
convert `tailwind.config.js`. Then install the Vite plugin and remove the
PostCSS pipeline:

```bash
npm install tailwindcss@latest @tailwindcss/vite@latest
npm uninstall autoprefixer postcss
rm postcss.config.js
```

Add the plugin to `vite.config.ts`, **keeping `base` and `server.proxy`**:

```ts
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/projects/tariff-wars/",     // unchanged
  plugins: [react(), tailwindcss()],
  server: { /* unchanged proxy block */ },
});
```

**Verify**: `npm run build` exits 0 and emits a CSS asset.

### Step 4: Hand-check the utility renames the tool may have missed

Confirm each is gone:

```bash
grep -rn "bg-opacity-\|text-opacity-\|border-opacity-" frontend --include='*.tsx'   # expect: no output
grep -rn "flex-shrink-\|flex-grow" frontend --include='*.tsx'                        # expect: no output
grep -rn "outline-none" frontend --include='*.tsx'                                   # expect: no output
```

Then inspect all 10 uncoloured-`border` sites from the table above and confirm
each still resolves to an explicit colour. Where it does not, add the colour the
v3 default supplied (`border-gray-200`) rather than leaving it `currentColor`.

**Verify**: the three greps produce no output; `npm run build` exits 0.

### Step 5: Add path aliases, then install shadcn

`tsconfig.json` — add inside `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./frontend/*"] }
```

`vite.config.ts` — add `resolve.alias` (needs `import path from "path"` and
`npm i -D @types/node`):

```ts
resolve: { alias: { "@": path.resolve(__dirname, "./frontend") } },
```

Note this repo's source root is `frontend/`, not the `src/` that every shadcn
doc assumes. Every alias and every `components.json` path must say `frontend`.

Then:

```bash
npx shadcn@latest init
```

Answer so that `components.json` ends up with:

```json
{
  "tailwind": { "css": "frontend/index.css", "baseColor": "slate", "cssVariables": true },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

`cssVariables: true` is **required** — plan 002 depends on semantic tokens
existing. `baseColor: slate` is the closest neutral to the app's current
gray palette.

**Verify**: `frontend/lib/utils.ts` exists and exports `cn`;
`npx tsc --noEmit` exits 0.

### Step 6: Replace the hardcoded theme with a real ThemeProvider

Create `frontend/context/ThemeContext.tsx` exporting a provider that:
1. reads the initial theme from `localStorage` (key `tariffwars-theme`), falling
   back to `window.matchMedia("(prefers-color-scheme: dark)")`, then to dark;
2. writes the `dark` class onto `document.documentElement` (shadcn's dark mode
   is a class on the root, not a prop);
3. keeps `.dark-scrollbar` on `document.body` in sync — `frontend/index.css`
   still targets that class and it is a separate element from the root;
4. persists on change;
5. **still exposes `{ isDarkMode, toggleTheme }`** with the identical shape.

Point 5 is load-bearing: 371 call sites read `isDarkMode` and none of them may
change in this plan. `App.tsx` should re-export `ThemeContext` from the new
module so existing `import { ThemeContext } from "../App"` lines keep working.

Add a small inline script in `index.html` that sets the `dark` class before
first paint, so a light-theme user does not get a flash of dark.

**Verify**: toggling the theme in the browser persists across a reload; the OS
setting is respected on a fresh profile (clear `localStorage` first); the page
does not flash the wrong theme on load.

### Step 7: Add the primitives plan 002 will consume

```bash
npx shadcn@latest add button card badge dialog select tabs table tooltip separator skeleton
```

Do **not** wire them into any page yet. This step only makes them available.

Sanity-check one in isolation (a scratch route or a test render) to confirm
tokens resolve and dark mode flips with the root class.

**Verify**: `frontend/components/ui/` contains the ten components;
`npx tsc --noEmit`, `npm run lint` and `npm run build` all exit 0.

### Step 8: Compare against the reference screenshots

Recapture all 8 from Step 2 and diff by eye. The app should be
**visually unchanged**. Any difference is v4 fallout — find and fix it now,
because plan 002's diff will be far too large to attribute a regression to.

Pay particular attention to: border colours, shadow depth, ring widths on focus,
and gaps between elements using `space-x`/`space-y` (v4 changed that selector).

**Verify**: no unintended visual differences across all 8.

## Verification approach

There is no automated test suite for the frontend, and for this plan that is the
right call rather than a gap. Everything here is a **visual** change: jsdom does
no layout and computes no styles, so a unit test would pass happily while a v4
default turned every border the wrong colour. The oracle for this migration is
the screenshot pair from Steps 2 and 8, backed by `tsc`, `lint` and `build`.

Treat the screenshot comparison as a required gate, not a nicety. It is the only
thing in this plan that can catch the failure mode it actually has: still
compiles, looks different.

Plan 003 adds tests for the pure logic that screenshots cannot see. It is
independent of this plan and can run before or after it.

## Done criteria

ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -rn "bg-opacity-\|flex-shrink-\|flex-grow\|outline-none" frontend --include='*.tsx'` → no output
- [ ] `postcss.config.js` and `tailwind.config.js` no longer exist
- [ ] `frontend/components/ui/` contains the 10 primitives
- [ ] `components.json` has `cssVariables: true`
- [ ] `grep -c "isDarkMode" frontend/components/dashboard/TariffTable.tsx` is **unchanged from 77** (lines, not occurrences) — proof that no component migration leaked into this plan
- [ ] Theme persists across reload and honours the OS setting on first visit
- [ ] `vite.config.ts` still has `base: "/projects/tariff-wars/"` and the API proxy
- [ ] All 8 screenshots visually match Step 2
- [ ] Frontmatter updated; `docs/plans/INDEX.md` updated

## STOP conditions

Stop and report (do not improvise) if:

- The Step 1 baseline is not green.
- This project must support browsers older than Safari 16.4 / Chrome 111 /
  Firefox 128 — Tailwind v4 cannot serve them and the whole approach needs
  revisiting.
- `npx @tailwindcss/upgrade` leaves the build broken and the cause is not one of
  the renames in the table above.
- `npx shadcn@latest init` wants to overwrite `frontend/index.css` wholesale.
  The scrollbar rules, `:focus-visible` rule and `prefers-reduced-motion` block
  in it are deliberate and must survive; merge by hand instead.
- You find yourself editing `isDarkMode` ternaries in any component to make
  something look right. That is plan 002's job and the signal that scope is
  slipping.
- The visual diff in Step 8 shows differences you cannot attribute to a specific
  v4 change.

## Maintenance notes

- After this lands the repo has **two** theming systems in play: the new CSS
  variables (used only by `components/ui/*`) and the 371 legacy ternaries.
  That is expected and temporary. Plan 002 removes the second. Do not leave it
  in this state indefinitely — drift between them is exactly the failure mode
  this sequencing is meant to bound.
- `tailwind.config.js` is gone; theme customisation now lives in `@theme` inside
  `frontend/index.css`. Anyone looking for the old config file needs to know
  that.
- A reviewer should check that `base` and the dev proxy survived, that
  `index.css`'s three deliberate blocks survived, and that the `isDarkMode`
  count is untouched.
- Deferred on purpose: the shadcn `Chart` component (Recharts). The app renders
  no charts at all today; adding them is a product decision, not part of this
  migration.
