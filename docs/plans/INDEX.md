# Plans Index

Single source of truth for all plans in this repo.

## Architecture (long-lived)

- [self-updating-tariff-data.md](architecture/self-updating-tariff-data.md): weekly autonomous tariff data refresh via scheduled Claude cloud agent, deterministic validator, CI backstop, frontend freshness stamp.
- [frontend-design-system.md](architecture/frontend-design-system.md): Tailwind v4 config-in-CSS, the three-tier token layer and where it departs from the shadcn preset, the shadcn primitives as the control layer, and how visual work is verified.

## Completed implementation plans

shadcn/ui adoption, planned 2026-07-31 against `7d2fba2`, all three merged
2026-08-01. The plan files have been deleted per the lifecycle in `CLAUDE.md`;
their durable content is in
[architecture/frontend-design-system.md](architecture/frontend-design-system.md),
and what the work actually caught is recorded below.

| Plan | Title | Effort | Risk | Status |
| --- | --- | --- | --- | --- |
| 001 | Upgrade to Tailwind v4 and install shadcn/ui with real theme tokens | M | MED | DONE — merged, plan deleted |
| 002 | Retire the isDarkMode ternaries for shadcn semantic tokens | L | MED | DONE — merged, plan deleted |
| 003 | Test the frontend logic that screenshots cannot see | S | LOW | DONE — merged, plan deleted |

### How these were verified, and what it caught

001 and 002 are visual changes, so their oracle was a before/after screenshot
pair plus `tsc`, `lint` and `build` — not an automated suite. jsdom does no
layout and computes no styles, so a component test would pass while a Tailwind
v4 default turned every border the wrong colour. The two behaviours screenshots
cannot check (dialog accessibility, status-badge precedence) got explicit
manual gates inside 002.

That choice paid for itself. **Three defects shipped past `tsc`, `lint`, `build`
and all 28 tests, and were caught only in a browser:**

1. 001: the Tailwind upgrade tool moved the font `@import` into
   `layer(utilities)`, making it the first layer declared. Layer precedence
   follows first declaration, so utilities fell below `base` and preflight's
   `*{margin:0;padding:0}` beat every spacing utility. The app rendered with no
   padding, margins or gaps anywhere.
2. 002: `bg-white` with a `dark:bg-linear-to-br` override left the metric cards
   and risk alert rendering white in dark mode — `background-color` and
   `background-image` are different properties, so the dark variant never
   replaced the light one.
3. 002: closing a dialog stopped returning focus to its trigger, because Radix
   only restores focus for a trigger it rendered itself.

No automated gate in any of the three plans could have caught any of them.

### Findings considered and rejected

- **A React Testing Library baseline as a prerequisite for the migration**: the
  original shape of plan 003, rejected on review. The tests it specified would
  not have caught the failure modes of 001 or 002, and it forbade asserting on
  colour classes — which is correct, but leaves the suite covering almost none
  of what a restyle risks. Replaced by 003's much smaller pure-logic scope, with
  the dependency dropped.
- **Pin `shadcn@2.10.0` and stay on Tailwind v3**: viable, and the smaller
  change. `2.10.0` is the last CLI line shipping the v3 path (`tailwindcss-animate`
  is absent from every 3.x and 4.x release). Rejected in favour of the v4
  upgrade so the project lands on the supported path rather than adopting a line
  shadcn already calls legacy.
- **Testing `rateBadgeClass` / `statusBadgeClass` now**: real product logic, but
  their signatures lose the `isDarkMode` argument in plan 002, so tests written
  today break immediately. Revisit after 002 lands.
- **shadcn `Chart` (Recharts)**: the app renders no charts at all despite being a
  tariff analysis dashboard, so this is a genuine gap — but it is a product
  decision, not part of a styling migration. Revisit after 002.
- **Swap `TariffTable` to shadcn DataTable (TanStack Table)**: it is 925 lines
  hand-rolling sorting, pagination and column config, so the payoff is real.
  Deferred: a structural rewrite stacked on a 371-site restyle is two risky
  changes in one diff. Revisit after 002 is stable. Still open — the follow-up
  below adopted the `Table` *primitives* (markup and tokens), not TanStack's
  state model, so the hand-rolled sorting and pagination logic is unchanged.

## Follow-up after 002 (2026-08-01, not a planned item)

A light-mode audit found nine sub-AA text nodes and six controls carrying
dark-only literals, all tracing to the same cause: 002 migrated the tokens but
left the controls hand-rolled, and a hand-rolled control hardcodes one theme's
value. Fixed, then the cause was removed by adopting all ten installed
primitives (previously nine were imported by nothing). Two decisions worth
keeping:

- `--primary` now points at the app's blue rather than shadcn's monochrome
  default. That is what makes `<Button>` adoptable without turning every action
  black, and it is why the app looks unchanged across a 17-file diff.
- Two defects were found that no automated gate would have caught, and both
  lived where the earlier audits could not see: `Modal` passed an unprefixed
  `max-w-4xl` against DialogContent's `sm:max-w-sm`, so the market analysis
  dialog rendered at 384px instead of 896px; and the commodity table inside it
  still used `bg-white`/`divide-gray-200` with no dark values. A closed dialog
  is invisible to both a screenshot pass and a DOM contrast crawl. Open every
  overlay explicitly when auditing.

## Completed

- self-updating-tariff-data (2026-07-10): all 7 tasks shipped in PR #2; plan file deleted per lifecycle, insights folded into the architecture doc and docs/lessons.md.
- shadcn/ui adoption 001-003 (2026-08-01): merged, plus the light-mode and primitive-adoption follow-up above. Plan files deleted per lifecycle, insights folded into architecture/frontend-design-system.md.
