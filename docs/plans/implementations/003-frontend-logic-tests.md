---
status: completed
completed_date: 2026-08-01
---

# Plan 003: Test the frontend logic that screenshots cannot see

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, set `status: completed` and
> `completed_date` in this file's frontmatter and update `docs/plans/INDEX.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7d2fba2..HEAD -- frontend/components/NewsFeed.tsx frontend/components/dashboard/TariffTable.tsx`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none — independent of plans 001 and 002, and can run before,
  between or after them
- **Category**: tests
- **Planned at**: commit `7d2fba2`, 2026-07-31

## Why this matters

This is deliberately **not** a test-coverage drive, and it is deliberately not a
prerequisite for the shadcn migration. An earlier draft of this plan proposed a
full React Testing Library baseline as a safety net for plans 001 and 002. That
reasoning did not survive scrutiny: those plans are almost entirely visual, and
jsdom does no layout and computes no styles. A component test asserting
`role="dialog"` exists passes happily while a Tailwind v4 default turns every
border the wrong colour. The right oracle for a restyle is a screenshot, and
both plans use one.

What screenshots genuinely cannot see is pure logic with no visual output. The
frontend has a small amount of it, and one piece carries a security property:

```tsx
// frontend/components/NewsFeed.tsx:31-39
function isSafeUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw.trim()) return false;
  try {
    const { protocol } = new URL(raw);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
```

Bookmarks are read out of `localStorage` and rendered as click targets. That
storage predates the scheme check, so a `javascript:` URL saved by an older
build would be handed straight back to the user as something to activate.
`readBookmarks` is the only thing preventing it, it is invisible in the UI, and
nothing currently proves it works. That single case justifies the plan; the rest
is cheap to add while the harness is being set up.

Scope is five pure functions. No component rendering, no React Testing Library,
no render helper, two dev dependencies.

## Current state

No test runner is installed for the frontend. The root `package.json` has no
`test` script. The backend has its own suite (`backend/test/units.test.mjs`,
10 tests, run with `node --test`) — that is the style to mirror, not to extend.

The five functions in scope. Four are currently module-private and must be
exported; nothing else about them changes.

`frontend/components/NewsFeed.tsx`:

- `isSafeUrl(raw: unknown): raw is string` — line 31. Shown above.
- `readBookmarks(): NewsArticle[]` — line 50. Reads `localStorage` key
  `tariffNewsBookmarks`. Must never throw. Handles four cases: absent key,
  malformed JSON, a non-array value, and per-entry validation. Migrates legacy
  bare-URL string entries into full article objects rather than dropping them —
  dropping would combine with the persistence effect to erase every existing
  bookmark on first load of a new build.
- `cleanSummary(summary: string | undefined): string` — line 88. Strips a
  trailing "Read More: https://…" tail that syndicated feeds routinely append.

`frontend/components/dashboard/TariffTable.tsx`:

- `isInactive(status: string | undefined): boolean` — line 58. Backed by
  `INACTIVE_STATUSES` at line 56:
  `new Set(["Withdrawn", "Ended", "Suspended", "Paused", "Expired"])`.
- `sortOptionsFor(field, direction)` — line 153, **already exported**. Returns
  the preset sort options, appending a synthetic option when the current
  field/direction pair is not among the presets, so a column-header sort is
  never silently misrepresented by the dropdown.

Repo conventions to match:

- TypeScript strict, with `noUnusedLocals` and `noUnusedParameters` — unused
  variables are compile errors.
- Test style: `backend/test/units.test.mjs`. Flat `test("...", ...)` blocks, one
  behaviour each, with a comment above each explaining *why* the case matters,
  not what the line does.
- Comments in this repo explain rationale. Do not restate mechanics.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `npm install` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| Tests (new) | `npm test` | exit 0, all pass |
| Backend tests | `cd backend && npm test` | 10 pass, 0 fail |

## Scope

**In scope**:

- `package.json` (two devDependencies + a `test` script)
- `vite.config.ts` (a `test` block)
- `frontend/components/NewsFeed.tsx` — **add `export` to three functions, nothing else**
- `frontend/components/dashboard/TariffTable.tsx` — **add `export` to `isInactive`, nothing else**
- `frontend/test/logic.test.ts` (create)
- `README.md` (add `npm test` to the Checks list)

**Out of scope** (do NOT touch):

- Any component rendering test, React Testing Library, jsdom render helpers.
  If you find yourself importing `@testing-library/react`, scope has slipped.
- The **behaviour** of any function under test. Adding `export` is the only
  permitted source change. If a test reveals a bug, **write it down and report
  it** — a test authored against a fix you just made proves nothing.
- `rateBadgeClass`, `statusBadgeClass`, `marketImpactClass` — these take an
  `isDarkMode` argument that plan 002 removes. Testing them now writes a test
  that plan 002 immediately breaks. `isInactive` is safe because it is a pure
  status predicate whose signature survives the migration.
- `backend/**`.

## Git workflow

- Branch: `advisor/003-frontend-logic-tests`
- Prefixes in this repo are **only** `fix:`, `docs:`, `refactor:`, or none — see
  `git log --oneline -8`. Do not use `feat:`, `chore:` or `test:`. Use no prefix
  here, e.g. `cover the frontend logic screenshots cannot check`.
- No AI attribution, `Co-Authored-By`, or "Generated with" footer.
- Do NOT push or open a PR.

## Steps

### Step 1: Install the runner

```bash
npm install -D vitest@^2.1 jsdom@^25
```

Two dependencies. Vitest 2.x for Vite 5.2 compatibility. jsdom is needed only
because `readBookmarks` touches `localStorage`. If npm reports a peer conflict,
STOP rather than forcing with `--legacy-peer-deps`.

**Verify**: `npx vitest --version` → prints a 2.x version.

### Step 2: Configure Vitest inside the existing Vite config

`vite.config.ts` has `base`, `plugins` and `server.proxy`. Add a `test` block
alongside them and change nothing else — `base` and the proxy are load-bearing.

```ts
/// <reference types="vitest" />
// ...existing imports
export default defineConfig({
  // ...existing base, plugins, server unchanged
  test: {
    environment: "jsdom",
    globals: true,
    include: ["frontend/test/**/*.test.ts"],
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

**Verify**: `npm test` → exits 0 reporting no test files found.

### Step 3: Export the four private functions

Add the `export` keyword to `isSafeUrl`, `readBookmarks` and `cleanSummary` in
`frontend/components/NewsFeed.tsx`, and to `isInactive` in
`frontend/components/dashboard/TariffTable.tsx`. Change nothing else in either
file.

**Verify**: `npx tsc --noEmit` and `npm run build` both exit 0;
`git diff --stat` shows exactly two component files touched, 4 insertions and
4 deletions.

### Step 4: Write the tests

`frontend/test/logic.test.ts`. Target ~16 cases:

**`isSafeUrl`** — accepts `https:` and `http:`; rejects `javascript:`, `data:`,
the empty string, whitespace, a non-string, and an unparseable value.

**`readBookmarks`** — the reason this plan exists. Seed `localStorage` directly
in each test:

1. Absent key → `[]`.
2. Malformed JSON → `[]`, does not throw.
3. A JSON object rather than an array → `[]`.
4. A legacy bare-URL string entry is **migrated**, not dropped: the result has
   one entry whose `url` and `title` are that URL. Dropping it would erase real
   user bookmarks on first load of a new build.
5. A legacy string entry with a `javascript:` URL is **rejected** → `[]`.
6. A stored object whose `url` is `javascript:` is rejected → `[]`.
7. A well-formed stored article object survives intact.
8. A mixed array keeps only the safe entries.

Cases 5 and 6 are the security regression tests. Keep both — the two shapes take
different branches.

**`cleanSummary`** — strips a trailing `Read More: https://…`; strips a bare
trailing URL; leaves a summary with no trailing URL untouched; returns `""` for
`undefined`.

**`isInactive`** — true for each of the five statuses in `INACTIVE_STATUSES`;
false for `"Active"`; false for `undefined`.

**`sortOptionsFor`** — returns the presets unchanged when the pair is already a
preset; appends exactly one synthetic option when it is not, so the dropdown
cannot silently misreport a column-header sort.

**Verify**: `npm test` → ~16 passing, 0 failing.

### Step 5: Wire it into the documented checks

Add `npm test` to the "Checks" section of `README.md` so the documented
verification list matches reality.

**Verify**: `npm test && npx tsc --noEmit && npm run lint && npm run build` →
all exit 0.

## Done criteria

ALL must hold:

- [ ] `npm test` exits 0 with ≥16 passing and 0 failing
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `cd backend && npm test` still reports 10 pass, 0 fail
- [ ] `grep -rn "@testing-library" package.json` → no match (scope held)
- [ ] `git diff --stat` shows the only component changes are 4 added `export` keywords
- [ ] `README.md` Checks section lists `npm test`
- [ ] Frontmatter updated; `docs/plans/INDEX.md` updated

## STOP conditions

Stop and report (do not improvise) if:

- The drift check shows either component changed and the excerpts no longer match.
- **A test fails because the function is wrong.** Report it; leave the test
  failing or skipped with a comment. Fixing behaviour is out of scope, and a
  test written to match a fix you just made is worthless as a regression net.
  This is most likely on `readBookmarks` — if a `javascript:` URL survives, that
  is a live security finding and should be reported as one, not quietly patched
  alongside its own test.
- Testing a function requires rendering a component.
- `npm install` reports a peer conflict needing `--legacy-peer-deps` or `--force`.

## Maintenance notes

- These tests are intentionally decoupled from styling. Nothing here asserts on
  a class name, so plans 001 and 002 can run before or after this in any order
  without touching a single test.
- If plan 002 lands first, `isInactive` will have moved into the token-based
  badge helpers. It stays a pure status predicate, so its test still applies;
  only the import path may change.
- The natural next candidate, deliberately left out: the status/severity
  precedence in `rateBadgeClass`. It is real product logic worth covering, but
  its signature loses the `isDarkMode` argument in plan 002. Add it after 002
  lands, not before.
- A reviewer should check that no `@testing-library` dependency crept in and
  that the component diff really is just four `export` keywords.
