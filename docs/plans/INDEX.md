# Plans Index

Single source of truth for all plans in this repo.

## Architecture (long-lived)

- [self-updating-tariff-data.md](architecture/self-updating-tariff-data.md): weekly autonomous tariff data refresh via scheduled Claude cloud agent, deterministic validator, CI backstop, frontend freshness stamp.

## Active implementation plans

shadcn/ui adoption, generated 2026-07-31 against commit `7d2fba2`.

| Plan | Title | Priority | Effort | Risk | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [001](implementations/001-tailwind-v4-and-shadcn-foundation.md) | Upgrade to Tailwind v4 and install shadcn/ui with real theme tokens | P1 | M | MED | — | DONE — approved after 1 revision, awaiting merge (branch `advisor/001-tailwind-v4-shadcn`) |
| [002](implementations/002-retire-isdarkmode-ternaries.md) | Retire the 371 isDarkMode ternaries for shadcn semantic tokens | P2 | L | MED | 001 | TODO |
| [003](implementations/003-frontend-logic-tests.md) | Test the frontend logic that screenshots cannot see | P2 | S | LOW | — | DONE — approved, awaiting merge (branch `advisor/003-frontend-logic-tests`) |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

### Dependency notes

- **002 requires 001** because it consumes the CSS-variable tokens, the `dark`
  class and the primitives that 001 installs.
- **003 depends on nothing** and can run before, between or after the other two.
  Its tests deliberately assert on no class names, so a restyle cannot break them.
- 001 deliberately leaves all 371 `isDarkMode` ternaries untouched. Its done
  criteria assert the count is unchanged, so a scope leak into 002's territory
  fails the gate rather than passing silently.

### How these are verified

001 and 002 are visual changes, so their oracle is a before/after screenshot
pair plus `tsc`, `lint` and `build` — not an automated suite. jsdom does no
layout and computes no styles, so a component test would pass while a Tailwind
v4 default turned every border the wrong colour. The two behaviours screenshots
cannot check (dialog accessibility, status-badge precedence) get explicit manual
gates inside 002.

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
  changes in one diff. Revisit after 002 is stable.

## Completed

- self-updating-tariff-data (2026-07-10): all 7 tasks shipped in PR #2; plan file deleted per lifecycle, insights folded into the architecture doc and docs/lessons.md.
