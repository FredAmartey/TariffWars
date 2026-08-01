---
status: active
---

# Plan 002: Retire the 371 isDarkMode ternaries for shadcn semantic tokens

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, set `status: completed` and
> `completed_date` in this file's frontmatter and update `docs/plans/INDEX.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7d2fba2..HEAD -- frontend/`
> This plan is written against the *pre-migration* state of the components.
> Plan 001 deliberately does not touch them, so the excerpts below should still match.
> If a component's `isDarkMode` usage has already changed, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: `001-tailwind-v4-and-shadcn-foundation.md` (tokens, `dark`
  class and primitives must exist)
- **Category**: tech-debt
- **Planned at**: commit `7d2fba2`, 2026-07-31

## Why this matters

The app decides every colour in JavaScript. `isDarkMode` is read **371 times
across 14 files**, almost always as a ternary picking between two hardcoded
Tailwind classes:

```tsx
// frontend/components/Dashboard.tsx:189-193
className={`col-span-1 lg:col-span-2 rounded-xl overflow-hidden ${
  isDarkMode
    ? "bg-gray-800/80 border border-gray-700"
    : "bg-white border border-gray-200 shadow-sm"
}`}
```

Three concrete costs. Every new element is a decision about two palettes, and
the light variant is the one that gets forgotten — that is exactly how the stock
cards ended up at ~1.3:1 contrast in light mode. Every component needs the flag
threaded in, so `ThemeContext` is consumed by 14 files that otherwise have no
reason to know a theme exists. And after plan 001 the repo has two theming
systems: `components/ui/*` themed by CSS variables, everything else by ternary,
free to drift.

Replacing them with semantic tokens (`bg-card`, `text-muted-foreground`,
`border-border`) means one class per element, both themes correct by
construction, and `isDarkMode` deleted.

## Current state

After plan 001: Tailwind v4, shadcn installed with `cssVariables: true`,
`frontend/components/ui/` holds button, card, badge, dialog, select, tabs,
table, tooltip, separator, skeleton. `ThemeContext` still exposes
`{ isDarkMode, toggleTheme }` and the `dark` class is on
`document.documentElement`.

Distribution of the 371 occurrences — migrate in this order, smallest first, so
the pattern is proven on low-risk files. These are **occurrence** counts (a
single line often contains two), and they sum to exactly 371. Reproduce with:

```bash
python3 -c "
import pathlib
for f in sorted(pathlib.Path('frontend').rglob('*.tsx')):
    n = f.read_text().count('isDarkMode')
    if n: print(f'{n:>3}  {f}')"
```

| File | Occurrences | Running total |
| --- | --- | --- |
| `frontend/components/Footer.tsx` | 3 | 3 |
| `frontend/components/Modal.tsx` | 3 | 6 |
| `frontend/components/Notifications.tsx` | 4 | 10 |
| `frontend/components/dashboard/DataFreshness.tsx` | 4 | 14 |
| `frontend/components/Sidebar.tsx` | 6 | 20 |
| `frontend/App.tsx` + `frontend/context/ThemeContext.tsx` | 15 | 35 |
| `frontend/components/dashboard/AIInsights.tsx` | 21 | 53 |
| `frontend/components/dashboard/AffectedStocks.tsx` | 21 | 74 |
| `frontend/components/TariffRates.tsx` | 24 | 98 |
| `frontend/components/dashboard/TariffStats.tsx` | 26 | 124 |
| `frontend/components/NewsFeed.tsx` | 31 | 155 |
| `frontend/components/Dashboard.tsx` | 44 | 199 |
| `frontend/components/dashboard/DetailedMarketAnalysis.tsx` | 82 | 281 |
| `frontend/components/dashboard/TariffTable.tsx` | 90 | 374 |

### The one genuinely hard part

Most of the 371 are a mechanical surface swap. The exception is the
domain-colour system in `TariffTable.tsx:56-118`, which encodes product rules,
not decoration:

```tsx
// frontend/components/dashboard/TariffTable.tsx:56-63
const INACTIVE_STATUSES = new Set(["Withdrawn", "Ended", "Suspended", "Paused", "Expired"]);
const isInactive = (status: string | undefined) => INACTIVE_STATUSES.has(status ?? "");
const MUTED_BADGE = (isDarkMode: boolean) =>
  isDarkMode ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500";
const BADGE_BASE = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium";
```

```tsx
// frontend/components/dashboard/TariffTable.tsx:82-96
const STATUS_COLOURS: Record<string, { dark: string; light: string }> = {
  Active: { dark: "bg-green-900/50 text-green-300", light: "bg-green-100 text-green-800" },
  Threatened: { dark: "bg-yellow-900/50 text-yellow-300", light: "bg-yellow-100 text-yellow-800" },
  Proposed: { dark: "bg-sky-900/50 text-sky-300", light: "bg-sky-100 text-sky-800" },
  Restricted: { dark: "bg-red-900/50 text-red-300", light: "bg-red-100 text-red-800" },
  "Legacy Tariff": { dark: "bg-blue-900/50 text-blue-300", light: "bg-blue-100 text-blue-800" },
  // ...
};
```

These carry meaning shadcn's four badge variants cannot express: severity by
rate band, status by category, and a mute rule that overrides both when a tariff
is not being charged. **Do not flatten them into `variant="destructive"`.**
Step 5 defines custom tokens for them instead.

The rate badge rule in particular is a real product decision worth preserving
verbatim: colour is severity, so it applies only while the rate is actually
being charged, which is why a withdrawn 250% threat renders muted and struck
through rather than in alarm red.

### Token mapping

Apply this consistently. The left column is what appears in the ternaries today.

| Legacy pair (dark / light) | Token |
| --- | --- |
| `bg-gray-900` / `bg-gray-50` (page) | `bg-background` |
| `bg-gray-800`, `bg-gray-800/80` / `bg-white` (panel) | `bg-card` |
| `text-white`, `text-gray-100` / `text-gray-800`, `text-gray-900` | `text-foreground` |
| `text-gray-400` / `text-gray-500`, `text-gray-600` | `text-muted-foreground` |
| `border-gray-700` / `border-gray-200`, `border-gray-300` | `border-border` |
| `hover:bg-gray-700` / `hover:bg-gray-100` | `hover:bg-accent` |
| `bg-gray-700` / `bg-gray-100` (input) | `bg-muted` or `bg-input` |
| `bg-indigo-600`/`bg-blue-600` / lighter (primary action) | `bg-primary text-primary-foreground` |

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| Count remaining | `grep -rho "isDarkMode" frontend --include='*.tsx' \| wc -l` | decreasing; 0 at the end |
| Dev | `npm run dev` + `cd backend && npm run dev` | app at `/projects/tariff-wars/` |

## Suggested executor toolkit

- `vercel-react-best-practices` — several of these components re-render on every
  theme read; removing the context dependency is also a render win worth doing
  correctly.
- shadcn theming reference: <https://ui.shadcn.com/docs/theming>

## Scope

**In scope**: the 14 files in the table above, plus `frontend/index.css` for the
custom tokens added in Step 5.

**Out of scope** (do NOT touch):

- `frontend/components/ui/**` — shadcn-generated. If one needs a change, that is
  a signal to wrap it locally, not to edit the generated file (editing it means
  the next `shadcn add` overwrites your work).
- `backend/**`, `scripts/**`, `docs/**`
- **Behaviour of any kind.** This plan changes appearance mechanism only. No
  data flow, no props beyond removing `isDarkMode`, no JSX restructuring beyond
  swapping an element for its shadcn equivalent. If you find a bug, write it
  down and keep going.
- `AffectedStocks.module.css` marquee/reduced-motion rules.

## Git workflow

- Branch: `advisor/002-semantic-tokens`
- **One commit per file** from the table, in the listed order. This is the
  single most important workflow instruction here: a 371-site change as one
  commit is unreviewable and unbisectable. Message style, e.g.
  `refactor: theme Sidebar with semantic tokens`.
- No AI attribution.
- Do NOT push or open a PR.

## Steps

### Step 1: Confirm the 002 baseline is green

```bash
npx tsc --noEmit && npm run lint && npm run build
grep -rho "isDarkMode" frontend --include='*.tsx' | wc -l   # expect 374
```

**Verify**: all green, count is 374. Note this is 374, not the 371 quoted
elsewhere in this plan: plan 001 legitimately added three, moving the flag out
of `App.tsx` (12 -> 7) and into the new `frontend/context/ThemeContext.tsx`
(0 -> 8). No component's count changed, which is what "001 did not leak scope"
means. If a component file's count differs from the table below, STOP.

### Step 2: Recapture reference screenshots

Same 8 as plan 001 Step 2 (3 routes desktop + 1 at 390px, both themes). These
are your correctness oracle for every step that follows.

**Verify**: 8 screenshots saved outside the repo.

### Step 3: Prove the pattern on the four smallest files

Migrate `Modal.tsx` (3), `Footer.tsx` (3), `Notifications.tsx` (4),
`DataFreshness.tsx` (4) — 14 occurrences total.

For each: replace ternaries with tokens from the mapping table, delete the
`isDarkMode` prop and the `useContext(ThemeContext)` call, and update callers to
stop passing it.

`Modal.tsx` should additionally be reduced to a thin wrapper over
`components/ui/dialog`, deleting its hand-written focus trap and Escape handler —
Radix provides both.

That deletion removes hand-written accessibility behaviour, so **verify each of
these by hand in the browser** on the Export dialog and the Detailed Market
Analysis dialog. Radix satisfies all five; if one fails, Radix is wired wrong.
Do not ship the step until all five hold:

1. The dialog exposes `role="dialog"` with `aria-modal="true"` (check in devtools).
2. Escape closes it.
3. A click on the backdrop closes it; a click inside the panel does not.
4. Tab cycles within the dialog and never reaches the page behind it.
5. On close, focus returns to the button that opened it.

Item 5 is the one that has silently regressed before — the old implementation
keyed its focus-restore effect on `[isOpen]` alone precisely so an unrelated
re-render could not yank focus mid-dialog. Confirm it still holds.

**Verify**: the five checks above pass; `npx tsc --noEmit` exits 0; count is 357;
the four surfaces look identical in both themes.

### Step 4: Migrate the mid-size files

In order: `Sidebar.tsx` (6), `App.tsx` (12), `AIInsights.tsx` (21),
`AffectedStocks.tsx` (21), `TariffRates.tsx` (24), `TariffStats.tsx` (26),
`NewsFeed.tsx` (31), `Dashboard.tsx` (44) — 185 occurrences.

Swap to primitives where a hand-rolled element has a direct equivalent:

- the panel wrappers in `Dashboard.tsx` → `Card`
- the `<select>` elements in `TariffRates.tsx` and `TariffTable.tsx` → `Select`
- the Products/Countries toggle in `TariffTable.tsx` → `Tabs`
- the filter chips in `TariffRates.tsx` → `Badge`
- primary/secondary buttons → `Button` with the appropriate variant

`App.tsx` is special: it keeps `toggleTheme` and the provider. Only its
presentational ternaries go; the provider's own use of the flag survives until
Step 6.

**Verify** after **each** file: `npx tsc --noEmit`, and a visual check of that
surface in both themes against the Step 2 screenshots. Count reaches 172.

### Step 5: Define domain tokens, then migrate the two large files

Before touching `DetailedMarketAnalysis.tsx` (82) and `TariffTable.tsx` (90),
add semantic tokens for the domain colours to `frontend/index.css`, defined once
per theme under `:root` and `.dark`:

```css
/* Tariff status and severity. These encode product meaning, not decoration:
   severity colour applies only while a rate is actually being charged. */
--status-active: …;      --status-active-foreground: …;
--status-threatened: …;  --status-threatened-foreground: …;
--status-proposed: …;    --status-proposed-foreground: …;
--status-restricted: …;  --status-restricted-foreground: …;
--status-legacy: …;      --status-legacy-foreground: …;
--status-reciprocal: …;  --status-reciprocal-foreground: …;
--status-investigating: …; --status-investigating-foreground: …;
--severity-high: …;      --severity-high-foreground: …;
--severity-medium: …;    --severity-medium-foreground: …;
--severity-low: …;       --severity-low-foreground: …;
```

Derive the values from the existing pairs in `STATUS_COLOURS`
(`TariffTable.tsx:82-96`) so colours do not visibly shift — the dark value from
`.dark`, the light value from `:root`.

Then `STATUS_COLOURS` collapses from a `{dark, light}` record to a flat
`Record<string, string>` of token class names, `MUTED_BADGE` becomes the constant
`"bg-muted text-muted-foreground"`, and `rateBadgeClass`/`statusBadgeClass`/
`marketImpactClass` all lose their `isDarkMode` parameter.

Preserve exactly, in this order of precedence:
1. `isInactive(status)` wins over everything and yields the muted badge.
2. Otherwise rate bands: `>= 25` high, `>= 15` medium, else low.
3. `rateDisplay` of `"N/A"` or `"Paused"` is muted regardless of the number.

Then migrate the two files. `TariffTable.tsx` is 925 lines; work through it in
sections (helpers → badges → headers → desktop rows → mobile cards → pager),
verifying as you go.

**Verify**: `npx tsc --noEmit` exits 0, and in the browser confirm the
precedence rules by eye against real rows — a **Withdrawn** row's rate badge is
muted and struck through, an **Active** row of the same rate is not, and a
`Paused` rateDisplay is muted regardless of its number. Count is now down to
only the provider's own occurrences in `App.tsx` / `ThemeContext.tsx`.

### Step 6: Delete the flag

`isDarkMode` should now exist only in `ThemeContext`. Reduce the context to
what is actually needed — a `theme` value and a setter — and remove
`isDarkMode` from its public shape. Update the toggle in `Dashboard.tsx`.

```bash
grep -rn "isDarkMode" frontend --include='*.tsx'   # expect: no output
```

**Verify**: no output; all four gates green.

### Step 7: Full visual and accessibility comparison

Recapture the 8 screenshots and compare against Step 2. Then check contrast on
the surfaces that were previously wrong in light mode — the stock cards in
`AffectedStocks.tsx` especially, which is where the old system's blind spot
showed up. Confirm every text/background pair meets 4.5:1.

**Verify**: no unintended visual differences; no contrast regressions.

## Verification approach

This plan changes how colour is chosen, not what the app does, so the oracle is
the screenshot pair from Step 2 plus `tsc`, `lint` and `build`. Automated tests
would add little: jsdom computes no styles, so a passing suite tells you nothing
about whether a token resolved to the right colour.

Two things screenshots cannot check, so they get explicit manual gates above:
the dialog accessibility behaviour in Step 3 (five checks) and the status
precedence rules in Step 5.

Do **not** add tests asserting on token class names (`bg-card` etc.). That
couples a test to styling and breaks on every future restyle without ever having
caught a real defect. Plan 003 covers the pure logic that is genuinely worth
testing, and it is independent of this plan.

## Done criteria

ALL must hold:

- [ ] `grep -rn "isDarkMode" frontend --include='*.tsx'` → no output
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -rn "bg-gray-\|text-gray-\|border-gray-" frontend/components --include='*.tsx'` → no output, or every remaining hit is justified in the commit message
- [ ] The status/severity precedence rules from Step 5 hold, verified in the UI
      against a Withdrawn row and an Active row
- [ ] All 8 screenshots match Step 2 apart from intended improvements
- [ ] 14 separate commits, one per file
- [ ] Frontmatter updated; `docs/plans/INDEX.md` updated

## STOP conditions

Stop and report (do not improvise) if:

- The Step 1 count is not 371.
- One of the five dialog accessibility checks in Step 3 fails and the cause is
  not obvious Radix wiring.
- A semantic token genuinely cannot express a domain colour — report it and
  propose a new token rather than reaching back for a hardcoded pair.
- You are tempted to change behaviour, data flow, or JSX structure to make
  styling easier. Note it and move on.
- `DetailedMarketAnalysis.tsx` or `TariffTable.tsx` turns out to need
  restructuring rather than a surface swap. Those two are 153 of the 371 and a
  rewrite is a different plan.
- The count stops decreasing across two consecutive files.

## Maintenance notes

- After this lands, adding a themed element means picking one semantic class,
  not two hardcoded palettes. Reviewers should reject `bg-gray-*` / `text-gray-*`
  in `frontend/components` from here on — that is the regression to guard.
- The domain tokens from Step 5 are the extension point. New tariff statuses get
  a token pair in `index.css` and an entry in `STATUS_COLOURS`, not a ternary.
- `components/ui/*` stays generated. Customise by wrapping, never by editing, or
  the next `shadcn add` silently reverts it.
- Deferred on purpose, and worth revisiting once this is stable: `TariffTable.tsx`
  is still 925 lines hand-rolling sorting, pagination, column config and a
  separate mobile card renderer. shadcn's DataTable (TanStack Table) would absorb
  most of that. It was kept out because a structural rewrite on top of a
  371-site restyle is two risky changes in one diff.
