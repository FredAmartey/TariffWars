# Frontend design system

How the app is themed and how its controls are built. Written after the
shadcn/ui adoption (plans 001-003, merged 2026-08-01) and the light-mode work
that followed. The implementation plans that produced this have been deleted
per the lifecycle in `CLAUDE.md`; what survived them is here.

## Shape

- **Tailwind v4**, configured in CSS. There is no `tailwind.config.js` and no
  `postcss.config.js`: `@tailwindcss/vite` handles everything, and the theme
  lives in `@theme inline` inside `frontend/index.css`. `vite.config.ts`
  declares an inline empty PostCSS config on purpose, so that a stale v3-era
  `postcss.config.js` in a parent directory cannot leak in when this repo is
  checked out inside another one.
- **shadcn/ui primitives** in `frontend/components/ui/`, all ten in use. They
  are the control layer: a screen should reach for `Button`, `Badge`, `Card`,
  `Table`, `Tabs`, `Select`, `Dialog`, `Tooltip`, `Separator` or `Skeleton`
  rather than styling a bare element.
- **Theme** is a `light | dark` value in `frontend/context/ThemeContext.tsx`,
  persisted to `localStorage`, defaulting to the OS preference and falling back
  to dark. It toggles a `dark` class on `<html>`, which is what every `dark:`
  variant and every `.dark` token override keys off.

## The token layer

Three tiers, all in `frontend/index.css`:

1. **shadcn semantic tokens** (`--background`, `--card`, `--muted-foreground`,
   `--border`, …), defined once under `:root` and overridden under `.dark`.
2. **Domain tokens** for tariff status and severity (`--status-active`,
   `--severity-high`, …). These are not decoration: status and rate band carry
   product meaning, so they get their own names rather than borrowing `accent`
   or `destructive`. The precedence rule they encode lives with
   `rateBadgeClass` in `TariffTable.tsx`: inactive wins, then rate bands.
3. **A few bespoke properties** for things a flat token cannot express, such as
   `--stock-card-gradient`.

### The page is a ground, the cards sit on it

The preset ships `--background` and `--card` at the same `oklch(1 0 0)`. Dark
mode raises a card above the page (card `0.205` over background `0.145`), so a
surface reads as an object; light mode had them identical, so the brightest
possible colour covered the whole viewport and a card was only ever the absence
of a border. Light now inverts dark's relationship rather than flattening it:

```text
muted 0.955  <  background 0.972  <  card 1.0     light: wells -> page -> cards
background 0.145  <  card 0.205                    dark:  page -> cards
```

`--muted` sits *below* the page on purpose, so the footer, the tab strips and
the inactive chips read as recessed wells rather than competing with real cards.

Four of these deviate from the shadcn defaults deliberately:

- **`--primary` is the app's blue**, not the preset's monochrome. Nothing
  consumed `--primary` while every button hardcoded its own blue, which is why
  the primitives sat installed and unused for a whole migration: adopting
  `<Button>` as shipped would have turned every action black. Pointing the
  token at the existing brand colour is what made adoption a no-op visually.
- **`--primary-hover` exists** because `hover:bg-primary/80` fades a fill toward
  the surface. In light mode that lightens it, and white-on-blue drops from
  5.25:1 to 3.5:1 exactly while the pointer is on the control. The token
  darkens instead.
- **`--border` and `--muted-foreground` are darker than the preset.** At the
  defaults, card edges sat at 1.26:1 against their surface (invisible, so the
  light theme had no structure) and muted text at 4.35:1 on `bg-muted`
  surfaces, which is where it most often sits.
- **`--foreground` is `oklch(0.195)`, not the preset's `0.145`.** Pure-ish black
  on white measures 18.5:1, about four times what AA asks of body text, and past
  a point more contrast is just glare. The value has a hard floor from an
  unobvious direction: the Tabs primitive renders its inactive trigger as
  `text-foreground/60`, so anything expressed as an alpha of this token moves
  when it moves *and* composites against whatever is behind it. At `0.21` that
  control measures 4.45:1 and fails AA; `0.195` holds it at 4.57:1. Solve for
  this value against the tab strip rather than picking it by eye.

There is also a `--focus-ring` token, per theme, because one hardcoded blue
cannot clear 3:1 (WCAG 1.4.11) against both a white and a near-black page.

## Rules that hold

- **A control must not hardcode one theme's value.** Every light-mode defect
  found in the 2026-08-01 audit was an instance of this: a hand-rolled control
  picks a literal, and a literal only has one theme. If a primitive does not
  fit, override it with a token, not a colour.
- **Fixing one theme means matching the other, measured.** The working theme is
  the specification. Composite each tinted surface onto the surface it sits on,
  convert to OKLCH, and compare chroma; do not judge a tint by eye or by the
  palette number in the class name. Doing this turned "light mode looks washed
  out" into "these three cards are at 0.000 chroma where dark renders
  0.055-0.080", which is a fact that can be argued with. Expect roughly 0.06 to
  be the ceiling for a light tint: the sRGB gamut narrows this close to white,
  so dark's 0.08 is not reachable and ~77% of it is the honest target.
- **A container stays quieter than its contents, in both themes.** Dark renders
  the Key Metrics wrapper at 0.064 chroma around cards at 0.080. Light keeps the
  same ordering (`-100` wrapper, `-200` cards). Get this backwards and the card
  matching the wrapper loses its edge entirely.
- **Do not express one token as an alpha of another.** `text-foreground/60`
  inherits `--foreground`'s lightness and composites against whatever is behind
  it, so the same class measures differently on a card than on the page and
  shifts silently when the other token is tuned. Use `--muted-foreground`.
- **Theme work is value work.** Light-mode problems get solved by changing
  `:root` values and unprefixed Tailwind shades, never by restructuring. Prove
  the other theme is untouched mechanically rather than by eye: diff the set of
  `dark:` class tokens per file, diff the `.dark` block, and where a `dark:`
  variant has to be *added* to pin existing behaviour, compare the computed
  colour before and after.
- **`bg-*` colour and `bg-linear-*` image are different CSS properties.** A
  `dark:` gradient does not replace a light `background-color`; it composites
  over it. Express a flat colour as a gradient with identical stops, or set
  `bg-transparent` alongside the gradient. This has now caused two separate
  visual bugs.
- **tailwind-merge only collapses classes sharing a group *and* a modifier.**
  An unprefixed `max-w-4xl` does not override a baked-in `sm:max-w-sm`; both
  survive and the `sm:` rule wins above 640px. Match the modifier when
  overriding a primitive's responsive class.
- **Layer order follows first declaration.** An `@import` given
  `layer(utilities)` ahead of `@import 'tailwindcss'` makes `utilities` the
  first layer declared, which puts it *below* `base`, so preflight beats every
  utility. Keep unlayered imports unlayered.

## Verifying visual work

`tsc`, `lint`, `build` and the jsdom test suite cannot see any of the above.
jsdom does no layout and computes no styles, so a component test passes while
every border is the wrong colour. Five real defects have now shipped past all
four gates and been caught only in a browser.

What does work:

- A **contrast crawl** over every rendered text node, sampling colours through
  a canvas (Chrome returns `oklab()` from `getComputedStyle` verbatim, so
  regexes and probe elements both fail) and compositing each ancestor
  background down to an opaque base.
- **Both themes, every time.** Two of the defects were dark-mode-only.
- **Open every overlay explicitly**, and every tab inside it. A closed dialog is
  invisible to both a screenshot pass and a DOM crawl. Radix tab triggers ignore
  a synthetic `element.click()` and a dispatched `keydown`; drive them with a
  compositor-level coordinate click, and scope the selector to `[role=dialog]`
  or you will find the page's own tabs instead.
- **Enumerate conditional states, not just pages.** A crawl only sees what is
  mounted. `AffectedStocks` rendered its stale-price warning at 2.13:1 through a
  full contrast audit because that branch only mounts when the quote provider
  stops responding.

The current baseline is 572-602 text nodes per view with zero AA failures,
across three pages and both dialogs in both themes.

## Known gaps

- `TariffTable` still hand-rolls sorting, pagination and column config across
  ~900 lines. The `Table` primitives were adopted for markup and tokens; the
  TanStack state model was not.
- The app renders no charts despite being an analysis dashboard. `Chart`
  (Recharts) is uninstalled.
- One deliberate bare `<button>` remains, in `SortableHeader`: its whole job is
  to fill its cell, and `Button`'s fixed height, radius and ring would
  reintroduce the dead hitbox border that the markup exists to remove.
