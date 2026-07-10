---
status: active
---

# Self-Updating Tariff Data Implementation Plan

> **For agentic workers:** Execution follows the arbitrage routing below: code tasks dispatch to codex via `codex exec "/goal ..."`, research/config/git tasks run in the Fable session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring TariffWars tariff data current to July 2026 and keep it current via a weekly autonomous Claude cloud agent, guarded by a deterministic validator.

**Architecture:** CSVs stay the source of truth with schemas unchanged; a new `meta.json` carries freshness metadata. A dependency-light Node validator gates every data change (agent-side before push, CI-side after push). One new backend endpoint and one small frontend component surface freshness to visitors.

**Tech Stack:** Node ESM script + csv-parse (existing dep), GitHub Actions, Express route (existing router), React + date-fns (existing deps), /schedule cloud routine.

**Spec:** `docs/plans/architecture/self-updating-tariff-data.md`

## Global Constraints

- CSV schemas unchanged: countries = `Country, Rate Imposed By USA, Status, Rate Imposed on USA, Key Sectors, Market Impact, Response Type`; commodities = `Commodity, From, To, Rate, Change, Status, Nature, Effective Date`
- No new npm dependencies anywhere
- Commit messages: plain, no prefix except `fix:`/`docs:`/`refactor:` where applicable; no AI attribution of any kind
- Work happens on branch `self-updating-data`; nothing pushes to main directly from this work (main pushes are the scheduled agent's job later)
- `tariffService.ts` CSV parsing is not touched
- Status enum: `Active, Paused, Suspended, Ended, Proposed, Delayed, Threatened, Under Investigation, N/A`
- Venue routing (arbitrage): Tasks 1-4 dispatch to codex; Tasks 5-7 run in the Fable session

---

### Task 1: meta.json + validator script (codex)

**Files:**

- Create: `backend/src/data/meta.json`
- Create: `scripts/validate-data.mjs`
- Modify: `package.json` (root, add npm script)

**Interfaces:**

- Produces: `meta.json` shape `{ lastUpdated: "YYYY-MM-DD", sources: [{ name: string, url: string }] }` (Tasks 3-5 rely on this exact shape)
- Produces: `node scripts/validate-data.mjs [--base <git-ref>] [--data-dir <dir>]`, exit 0 on pass, exit 1 with reasons on stderr on fail (Tasks 2, 5, 6 invoke it)

- [ ] **Step 1: Create branch**

```bash
git checkout -b self-updating-data
```

- [ ] **Step 2: Create `backend/src/data/meta.json`**

```json
{
  "lastUpdated": "2026-07-10",
  "sources": [
    {
      "name": "PIIE Trump Tariff Tracker",
      "url": "https://www.piie.com/research/piie-charts/2025/trumps-trade-war-timeline-date-guide"
    }
  ]
}
```

(Task 5 overwrites this with the sources actually used by the data refresh.)

- [ ] **Step 3: Write `scripts/validate-data.mjs`**

```js
#!/usr/bin/env node
// Deterministic gate for tariff data changes. Exit 0 = safe to publish.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
function flagValue(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}
const BASE = flagValue("--base") ?? "HEAD";
const DATA_DIR = flagValue("--data-dir") ?? path.join(ROOT, "backend", "src", "data");
// Churn comparison needs git history of the real data files; skip it for fixture dirs.
const CHURN_ENABLED = flagValue("--data-dir") === undefined;

const STATUS_ENUM = new Set([
  "Active", "Paused", "Suspended", "Ended", "Proposed",
  "Delayed", "Threatened", "Under Investigation", "N/A",
]);
const RATE_SPECIALS = new Set(["Exempt", "Restricted", "N/A"]);
const CHANGE_PLACEHOLDERS = new Set(["—", "-", "N/A", ""]);
const MAX_CHURN = 0.6;

// Deliberate escape hatch for human-reviewed mass changes (e.g. the initial
// 15-month refresh): CHURN_OVERRIDE=1 locally, or "[churn-reviewed]" in the
// HEAD commit message so CI honors a reviewed data commit. The weekly agent's
// pinned commit message ("weekly tariff refresh YYYY-MM-DD") can never
// contain the marker, so autonomous runs stay fully guarded.
function headMessage() {
  try {
    return execFileSync("git", ["log", "-1", "--format=%B"], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}
const CHURN_OVERRIDE =
  process.env.CHURN_OVERRIDE === "1" || headMessage().includes("[churn-reviewed]");

const FILES = [
  {
    file: "tariffs_countries.csv",
    headers: [
      "Country", "Rate Imposed By USA", "Status", "Rate Imposed on USA",
      "Key Sectors", "Market Impact", "Response Type",
    ],
    minRows: 8,
    rateCols: ["Rate Imposed By USA", "Rate Imposed on USA"],
    changeCols: [],
    dateCols: [],
  },
  {
    file: "tariffs_commodities.csv",
    headers: ["Commodity", "From", "To", "Rate", "Change", "Status", "Nature", "Effective Date"],
    minRows: 5,
    rateCols: ["Rate"],
    changeCols: ["Change"],
    dateCols: ["Effective Date"],
  },
];

const errors = [];
const fail = (msg) => errors.push(msg);

function percentTokensValid(value) {
  const tokens = value.match(/(\d+(?:\.\d+)?)%/g);
  if (!tokens) return false;
  return tokens.every((t) => {
    const n = parseFloat(t);
    return n >= 0 && n <= 1000;
  });
}

function checkRate(value, where) {
  const v = value.trim();
  if (RATE_SPECIALS.has(v)) return;
  if (!percentTokensValid(v)) {
    fail(`${where}: rate "${v}" is not a special value and has no percentage in 0-1000`);
  }
}

function checkChange(value, where) {
  const v = value.trim();
  if (CHANGE_PLACEHOLDERS.has(v)) return;
  const m = v.match(/^[+-]?(\d+(?:\.\d+)?)%$/);
  if (!m) {
    fail(`${where}: change "${v}" is not a signed percentage or placeholder`);
  } else if (parseFloat(m[1]) > 1000) {
    fail(`${where}: change "${v}" exceeds 1000%`);
  }
}

function checkDate(value, where) {
  const v = value.trim();
  if (v === "TBD") return;
  if (Number.isNaN(Date.parse(v))) {
    fail(`${where}: effective date "${v}" is neither a parseable date nor TBD`);
  }
}

function dataLines(content) {
  return content.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean);
}

function baselineContent(relPath) {
  try {
    return execFileSync("git", ["show", `${BASE}:${relPath}`], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null; // file absent at base (or no git): skip churn check
  }
}

for (const spec of FILES) {
  const filePath = path.join(DATA_DIR, spec.file);
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    fail(`${spec.file}: file missing at ${filePath}`);
    continue;
  }

  let rows;
  try {
    rows = parse(content, { skip_empty_lines: true });
  } catch (e) {
    fail(`${spec.file}: CSV does not parse (${e.message})`);
    continue;
  }

  const header = rows[0] ?? [];
  if (JSON.stringify(header) !== JSON.stringify(spec.headers)) {
    fail(`${spec.file}: header mismatch.\n  expected: ${spec.headers.join(",")}\n  actual:   ${header.join(",")}`);
    continue;
  }

  const records = rows.slice(1);
  if (records.length < spec.minRows) {
    fail(`${spec.file}: only ${records.length} rows, floor is ${spec.minRows}`);
  }

  const col = (name) => spec.headers.indexOf(name);
  records.forEach((r, i) => {
    const where = `${spec.file} row ${i + 2}`;
    if (r.length !== spec.headers.length) {
      fail(`${where}: ${r.length} fields, expected ${spec.headers.length}`);
      return;
    }
    const status = r[col("Status")].trim();
    if (!STATUS_ENUM.has(status)) {
      fail(`${where}: status "${status}" not in enum [${[...STATUS_ENUM].join(", ")}]`);
    }
    for (const c of spec.rateCols) checkRate(r[col(c)], `${where} (${c})`);
    for (const c of spec.changeCols) checkChange(r[col(c)], `${where} (${c})`);
    for (const c of spec.dateCols) checkDate(r[col(c)], `${where} (${c})`);
  });

  if (CHURN_ENABLED) {
    const relPath = path.relative(ROOT, filePath).split(path.sep).join("/");
    const baseline = baselineContent(relPath);
    if (baseline === null) {
      console.warn(`warn: ${spec.file} not found at ${BASE}, skipping churn check`);
    } else if (CHURN_OVERRIDE) {
      console.warn(`warn: churn checks skipped for ${spec.file} (human-reviewed override)`);
    } else {
      const oldLines = dataLines(baseline);
      const newLines = dataLines(content);
      const oldSet = new Set(oldLines);
      const changed = newLines.filter((l) => !oldSet.has(l)).length;
      const churn = newLines.length === 0 ? 1 : changed / newLines.length;
      if (churn > MAX_CHURN) {
        fail(`${spec.file}: ${(churn * 100).toFixed(0)}% of rows changed vs ${BASE} (limit ${MAX_CHURN * 100}%). A human must review a shift this large.`);
      }
      if (oldLines.length >= spec.minRows && newLines.length < oldLines.length * 0.5) {
        fail(`${spec.file}: row count dropped from ${oldLines.length} to ${newLines.length} vs ${BASE} (mass deletion)`);
      }
    }
  }
}

// meta.json
const metaPath = path.join(DATA_DIR, "meta.json");
try {
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.lastUpdated ?? "")) {
    fail(`meta.json: lastUpdated "${meta.lastUpdated}" is not YYYY-MM-DD`);
  } else {
    const ageDays = (Date.now() - Date.parse(meta.lastUpdated)) / 86400000;
    if (Number.isNaN(ageDays) || ageDays > 8 || ageDays < -1) {
      fail(`meta.json: lastUpdated "${meta.lastUpdated}" must be within the last 8 days`);
    }
  }
  if (!Array.isArray(meta.sources) || meta.sources.length === 0) {
    fail("meta.json: sources must be a non-empty array");
  } else {
    meta.sources.forEach((s, i) => {
      if (!s || typeof s.name !== "string" || s.name.trim() === "") {
        fail(`meta.json: sources[${i}].name missing`);
      }
      if (!s || typeof s.url !== "string" || !s.url.startsWith("https://")) {
        fail(`meta.json: sources[${i}].url must be https`);
      }
    });
  }
} catch (e) {
  fail(`meta.json: missing or invalid JSON at ${metaPath} (${e.message})`);
}

if (errors.length > 0) {
  console.error("Tariff data validation FAILED:\n");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("Tariff data validation OK");
```

- [ ] **Step 4: Add npm script to root `package.json`**

In `"scripts"`, after `"preview": "vite preview"`:

```json
"validate-data": "node scripts/validate-data.mjs"
```

- [ ] **Step 5: Run against real (still-stale) data, expect pass**

Run: `npm run validate-data`
Expected: warns that `meta.json` was not found at HEAD (new file, churn skipped), then `Tariff data validation OK`, exit 0.

- [ ] **Step 6: Fixture tests, each must fail with a clear message**

```bash
FIX=$(mktemp -d)
cp backend/src/data/tariffs_countries.csv backend/src/data/tariffs_commodities.csv backend/src/data/meta.json "$FIX/"

# a) broken header
sed '1s/Country/Nation/' backend/src/data/tariffs_countries.csv > "$FIX/tariffs_countries.csv"
node scripts/validate-data.mjs --data-dir "$FIX" && echo "BUG: should have failed"
cp backend/src/data/tariffs_countries.csv "$FIX/"

# b) rate out of bounds
sed 's/145%/4500%/' backend/src/data/tariffs_countries.csv > "$FIX/tariffs_countries.csv"
node scripts/validate-data.mjs --data-dir "$FIX" && echo "BUG: should have failed"
cp backend/src/data/tariffs_countries.csv "$FIX/"

# c) bad status
sed 's/,Active,/,Bogus,/' backend/src/data/tariffs_countries.csv > "$FIX/tariffs_countries.csv"
node scripts/validate-data.mjs --data-dir "$FIX" && echo "BUG: should have failed"
cp backend/src/data/tariffs_countries.csv "$FIX/"

# d) truncated file
head -4 backend/src/data/tariffs_commodities.csv > "$FIX/tariffs_commodities.csv"
node scripts/validate-data.mjs --data-dir "$FIX" && echo "BUG: should have failed"
cp backend/src/data/tariffs_commodities.csv "$FIX/"

# e) stale meta
printf '{"lastUpdated":"2025-04-13","sources":[{"name":"x","url":"https://example.com"}]}' > "$FIX/meta.json"
node scripts/validate-data.mjs --data-dir "$FIX" && echo "BUG: should have failed"
```

Expected: every invocation exits 1 printing the matching `✗` reason; no `BUG:` lines appear.

- [ ] **Step 7: Commit**

```bash
git add backend/src/data/meta.json scripts/validate-data.mjs package.json
git commit -m "add tariff data validator and freshness metadata"
```

---

### Task 2: CI backstop workflow (codex)

**Files:**

- Create: `.github/workflows/validate-data.yml`

**Interfaces:**

- Consumes: `scripts/validate-data.mjs --base HEAD~1` from Task 1

- [ ] **Step 1: Write `.github/workflows/validate-data.yml`**

```yaml
name: validate-data

on:
  push:
    paths:
      - "backend/src/data/**"
  pull_request:
    paths:
      - "backend/src/data/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      # Full npm ci pulls puppeteer/playwright; the validator only needs csv-parse.
      - run: npm install --no-save --no-audit --no-fund csv-parse
      - run: node scripts/validate-data.mjs --base HEAD~1
```

- [ ] **Step 2: Sanity-check the workflow parses**

Run: `npx --yes js-yaml .github/workflows/validate-data.yml > /dev/null && echo YAML_OK`
Expected: `YAML_OK` (the real check is the Action running on the PR from Task 7).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/validate-data.yml
git commit -m "add data validation CI workflow"
```

---

### Task 3: /api/tariffs/meta endpoint (codex)

**Files:**

- Modify: `backend/src/routes/tariffRoutes.ts` (add route inside `tariffRoutes` factory, after the `/export` route, before `return router`)

**Interfaces:**

- Consumes: `backend/src/data/meta.json` from Task 1
- Produces: `GET /api/tariffs/meta` returning the meta.json body as JSON (Task 4 fetches it)

- [ ] **Step 1: Add imports at top of `tariffRoutes.ts`**

```ts
import fs from "fs/promises";
import path from "path";
```

- [ ] **Step 2: Add the route after the `/export` handler**

```ts
router.get("/meta", async (_req, res) => {
  try {
    // Same __dirname-relative pattern tariffService uses for the CSVs,
    // so it resolves identically under ts-node-dev, tsc dist, and Vercel.
    const metaPath = path.resolve(__dirname, "../data/meta.json");
    const content = await fs.readFile(metaPath, "utf8");
    res.json(JSON.parse(content));
  } catch (error: any) {
    console.error("Error in /meta endpoint:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Could not load data metadata",
    });
  }
});
```

- [ ] **Step 3: Verify locally**

Run: `cd backend && npm run dev` (leave running), then `curl -s http://localhost:3001/api/tariffs/meta`
Expected: `{"lastUpdated":"2026-07-10","sources":[{"name":"PIIE Trump Tariff Tracker","url":"..."}]}`

- [ ] **Step 4: Verify the backend still compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: exit 0, no errors (pre-existing errors, if any, must be listed and unchanged).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tariffRoutes.ts
git commit -m "serve tariff data freshness metadata"
```

---

### Task 4: Frontend freshness stamp (codex)

**Files:**

- Modify: `frontend/services/api.ts` (add `getTariffMeta` to `ApiService`)
- Create: `frontend/components/dashboard/DataFreshness.tsx`
- Modify: `frontend/components/Dashboard.tsx` (replace news-date badge, render component under table)

**Interfaces:**

- Consumes: `GET /api/tariffs/meta` from Task 3, `ThemeContext` exported by `frontend/App.tsx`
- Produces: `apiService.getTariffMeta(): Promise<TariffMeta | null>`; `<DataFreshness />` component

- [ ] **Step 1: Add `getTariffMeta` to `ApiService` in `frontend/services/api.ts`**

Inside the `ApiService` class, after `getNewsArticles`:

```ts
async getTariffMeta(): Promise<{
  lastUpdated: string;
  sources: Array<{ name: string; url: string }>;
} | null> {
  try {
    const response = await apiClient.get("/api/tariffs/meta");
    return response.data;
  } catch (error) {
    console.error("Error in getTariffMeta service call:", error);
    return null;
  }
}
```

- [ ] **Step 2: Create `frontend/components/dashboard/DataFreshness.tsx`**

```tsx
import React, { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../App";
import { format } from "date-fns";
import { apiService } from "../../services/api";

interface TariffMeta {
  lastUpdated: string;
  sources: Array<{ name: string; url: string }>;
}

export const DataFreshness: React.FC = () => {
  const { isDarkMode } = useContext(ThemeContext);
  const [meta, setMeta] = useState<TariffMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiService.getTariffMeta().then((m) => {
      if (!cancelled && m) setMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!meta) return null;

  const parsed = new Date(`${meta.lastUpdated}T00:00:00`);
  const formatted = isNaN(parsed.getTime())
    ? meta.lastUpdated
    : format(parsed, "MMMM d, yyyy");

  return (
    <div className={`mt-3 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${
          isDarkMode ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-800"
        }`}
      >
        Data updated {formatted}
      </span>
      {meta.sources.length > 0 && (
        <span className="ml-2">
          Sources:{" "}
          {meta.sources.map((s, i) => (
            <React.Fragment key={s.url}>
              {i > 0 && ", "}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                {s.name}
              </a>
            </React.Fragment>
          ))}
        </span>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Wire into `frontend/components/Dashboard.tsx`**

1. Add import near the other dashboard component imports: `import { DataFreshness } from "./dashboard/DataFreshness";`
2. In the "Current Tariff Rates" card (around lines 248-266): the header currently shows a "Last Updated" badge driven by `latestNewsDate` (a NEWS article date, not the tariff data date). Delete that entire `<div className="flex space-x-2">...</div>` badge block.
3. Render `<DataFreshness />` immediately after the `<TariffTable ... />` element, inside the same `p-6` container.
4. Grep for remaining uses of `latestNewsDate`, `isLoadingNews`, `newsError` in `Dashboard.tsx`. If the deleted badge was their only consumer, remove the state, the fetch effect that populates them, and any now-unused imports (e.g. `format` from date-fns if unused elsewhere in the file). If they have other consumers, leave them.

- [ ] **Step 4: Verify the frontend builds**

Run: `npm run build`
Expected: exit 0. Then with the backend running (`cd backend && npm run dev`): `npm run dev`, open the dashboard, confirm the green "Data updated July 10, 2026" pill and the PIIE source link render under the tariff table, in both light and dark mode.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/api.ts frontend/components/dashboard/DataFreshness.tsx frontend/components/Dashboard.tsx
git commit -m "show tariff data freshness and sources in dashboard"
```

---

### Task 5: Initial data refresh to July 2026 (Fable session — research work)

**Files:**

- Modify: `backend/src/data/tariffs_countries.csv`
- Modify: `backend/src/data/tariffs_commodities.csv`
- Modify: `backend/src/data/meta.json`

**Interfaces:**

- Consumes: validator from Task 1
- Produces: current, cited dataset (the weekly routine from Task 6 maintains it from here)

- [ ] **Step 1: Research the current landscape.** Use Exa + Tavily (peer tier) and official sources. Targets: PIIE tariff tracker, Yale Budget Lab tariff tracker, Reuters tariff coverage, USTR press releases, Federal Register / executive orders. Every rate that differs from the April 2025 snapshot needs two independent corroborating sources. Cover: current US rate per country in the table, current retaliation rate, status changes (the April "Paused" reciprocal rates are long resolved one way or the other), sectoral actions (steel/aluminum, autos, pharma, semis, copper), and any new major actions since April 2025.
- [ ] **Step 2: Rewrite both CSVs.** Schemas unchanged. Superseded commodity actions get `Status: Ended` or updated rates; do not silently drop rows. Market Impact and Response Type fields updated to current reality (these are editorial; source-grounded but judgment-phrased).
- [ ] **Step 3: Update `meta.json`** with `lastUpdated: 2026-07-10` and the 3-6 sources actually used (name + https URL).
- [ ] **Step 4: Validate.** Run `npm run validate-data`. NOTE: the churn guard SHOULD fire here (15 months of change will exceed 60%). Expected: failure on churn only, everything else green. Do NOT weaken the validator.
- [ ] **Step 5: Human-review the diff** (`git diff --stat` + full read of both CSVs), cross-checking each changed country rate against the sources in meta.json. Then confirm the override path passes: `CHURN_OVERRIDE=1 npm run validate-data` → `Tariff data validation OK`.
- [ ] **Step 6: Commit with the override marker** (this is what lets the CI churn check honor the reviewed commit):

```bash
git add backend/src/data/
git commit -m "refresh tariff data to July 2026 [churn-reviewed]"
```

---

### Task 6: Weekly /schedule routine (Fable session — config work)

**Files:** none in repo (claude.ai scheduled agent)

**Interfaces:**

- Consumes: validator, data files, and issue-on-failure contract from Tasks 1 and 5

- [ ] **Step 1: Confirm prerequisite.** The TariffWars repo must be connected in claude.ai/code scheduled-agents settings. If not connected, stop and tell Fred; this is his one-time manual step.
- [ ] **Step 2: Create the routine** via the /schedule skill. Cadence: Mondays 06:00 America/New_York (`0 6 * * 1`). Repo: FredAmartey/TariffWars. Prompt (verbatim):

```text
You maintain the TariffWars tariff dataset. Work only inside backend/src/data/.

1. Research the current US tariff landscape as of today. Sources: PIIE tariff
   tracker, Yale Budget Lab tariff tracker, Reuters tariff coverage, official
   USTR announcements, Federal Register notices, White House executive orders.
   Cross-check every rate you change against at least two independent sources.
2. Update backend/src/data/tariffs_countries.csv and
   backend/src/data/tariffs_commodities.csv to reflect current reality. Keep
   the exact CSV schemas and column order. Mark superseded actions
   Status: Ended or update their rates; never silently delete rows.
3. Update backend/src/data/meta.json: set lastUpdated to today (YYYY-MM-DD)
   and list the sources you actually used (name + https url).
4. Run: node scripts/validate-data.mjs — fix data issues until it passes.
   Never edit scripts/validate-data.mjs itself.
5. If validation passes and sourcing was conclusive: commit exactly
   "weekly tariff refresh YYYY-MM-DD" (no other prefix, no attribution
   footers) and push to main.
6. If validation cannot pass, or sources are contradictory or inconclusive,
   or nothing material changed this week and only meta.json would update:
   for no-change weeks, still update meta.json lastUpdated, validate, commit
   and push. For failures: do NOT push; open a GitHub issue titled
   "tariff data refresh failed YYYY-MM-DD" describing what failed, with links
   to what you found.
Never modify files outside backend/src/data/. Never force-push. Never open PRs.
```

- [ ] **Step 3: Dry run.** Trigger the routine once manually. Expected: either a clean `weekly tariff refresh` push (validator green, CI workflow green on the push) or a well-formed failure issue. Verify whichever occurred; fix the routine prompt if the behavior deviated.

---

### Task 7: Verification, review gate, PR (Fable session)

- [ ] **Step 1: End-to-end verify** (per the verify skill): backend up, `curl /api/tariffs/rates` returns July 2026 data, `curl /api/tariffs/meta` returns new meta; frontend dev server shows current numbers + freshness stamp; screenshot for the PR.
- [ ] **Step 2: Autoreview gate.** Run the autoreview skill (codex engine) on the full branch diff; verify findings; fix → focused re-verify → re-review until clean.
- [ ] **Step 3: Bundle docs.** `git add docs/ && git commit -m "docs: spec and plan for self-updating tariff data"` (spec + INDEX + this plan, per Fred's bundling instruction).
- [ ] **Step 4: Push branch + open PR** with what/why, verification evidence (validator output, curl outputs, screenshot), risks (autonomous weekly pushes; churn guard as the safety). No AI attribution.
- [ ] **Step 5: Trigger external review**: comment `@claude` review request on the PR (pre-authorized), confirm CI (validate-data workflow) runs and passes.
- [ ] **Step 6: Gather all review sources, triage together, fix once, re-verify, then ask Fred for the merge decision.** Task 6's dry run happens after merge (the routine pushes to main and needs the validator present there).

---

## Self-Review Notes

- Spec coverage: data layer (T1), validator (T1), CI (T2), endpoint (T3), frontend (T4), initial refresh (T5), routine (T6), testing (T1 step 6, T3 step 3, T4 step 4, T6 step 3, T7 step 1). Failure-path table covered by T1 (validator exit), T2 (CI), T6 (issue-on-failure).
- Task 6 ordering: routine creation is written before T7 but its dry run is explicitly deferred until after merge, since the validator must exist on main. The routine can be created any time; it must not fire before merge — Monday cadence makes this a non-issue if merge happens this week; otherwise create the routine after merge.
- Churn guard intentionally fires on the initial refresh (T5 step 4); the override is a human review, not a validator change.
