# Self-Updating Tariff Data

**Status:** Implemented and live (merged to main 2026-07-10, PR #2; weekly routine trig_011ZtcHBzu5AZeeHighC4GUB armed for Mondays 06:00 ET)
**Date:** 2026-07-10
**Owner:** Fred Amartey

## Problem

TariffWars displays tariff data frozen at April 13, 2025 (China 145%, EU "Paused" at 10%, effective dates from April 2025). The data lives in two hand-edited CSVs and there is no mechanism to keep it current. The app reads as abandoned.

## Goal

Replace the stale snapshot with current data and keep the dataset current automatically, on a weekly cadence, with zero required human touch. Runs on Fred's Claude subscription quota (scheduled cloud agent), not API keys.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Freshness | Weekly refresh |
| Operating model | Fully autonomous publish, validation guardrails only |
| Engine | Claude Code scheduled cloud agent (/schedule routine), not an API script |
| Data format | Keep existing CSV schemas unchanged; add `meta.json` for freshness metadata |
| Failure surface | GitHub issue on the repo; no push on failure |

## Architecture

### 1. Data layer

Source of truth stays in the repo:

- `backend/src/data/tariffs_countries.csv`. Schema unchanged: `Country, Rate Imposed By USA, Status, Rate Imposed on USA, Key Sectors, Market Impact, Response Type`
- `backend/src/data/tariffs_commodities.csv`. Schema unchanged: `Commodity, From, To, Rate, Change, Status, Nature, Effective Date`
- `backend/src/data/meta.json` (new):

```json
{
  "lastUpdated": "2026-07-10",
  "sources": [
    { "name": "PIIE US-China Tariff Tracker", "url": "https://..." },
    { "name": "USTR press release 2026-06-XX", "url": "https://..." }
  ]
}
```

`tariffService.ts` parsing is untouched. Git history of the CSVs becomes the audit trail of every data change.

### 2. Deterministic validator

`scripts/validate-data.mjs` (plain Node, csv-parse from existing deps). Exits non-zero with a readable reason on any failure:

- Headers of both CSVs match the expected schemas exactly
- Rate fields (`Rate Imposed By USA`, `Rate Imposed on USA`, `Rate`): either a special value (`Exempt`, `Restricted`, `N/A`) or a string containing at least one percentage token, where every percentage token sits in 0 to 1000 (real data includes free-form rates like `90% or $75/item`)
- `Change`: a signed percentage (`+105%`, `-8%`), or a placeholder (`—`, `-`, `N/A`, empty)
- `Status` values from a fixed enum: `Active, Paused, Suspended, Ended, Proposed, Delayed, Threatened, Under Investigation, N/A`
- `Effective Date` values parse as dates, or are `TBD` (real data uses TBD for threatened actions)
- Row floors: countries >= 8 rows, commodities >= 5 rows (catches truncation)
- `meta.json`: valid JSON, `lastUpdated` parses and is within 8 days, at least one source, all source URLs https
- Churn guard: compared against a git baseline (`--base <ref>`, default `HEAD`), if more than 60% of rows in either CSV changed, or the row count halved, fail. Big legitimate shifts require a human once: the override is `CHURN_OVERRIDE=1` locally or a `[churn-reviewed]` marker in the commit message (honored by CI). The weekly agent's pinned commit message can never contain the marker, so autonomous runs stay guarded.

The validator is the safety that makes autonomous publishing acceptable: the agent cannot push data that does not parse, breaks schema, or churns wildly.

### 3. Weekly autonomous agent

A /schedule cloud routine on the TariffWars repo. Cadence: Mondays 06:00 America/New_York.

Prompt contract:

1. Research the current US tariff landscape: PIIE tariff tracker, Reuters tariff coverage, Yale Budget Lab, official USTR / Federal Register / White House notices. Cross-check at least two sources for any rate change.
2. Update both CSVs to reflect current reality (rates, statuses, retaliation, sectors). Superseded actions get `Status: Ended` or are replaced, not silently deleted.
3. Update `meta.json` with today's date and the sources actually used.
4. Run `node scripts/validate-data.mjs`. Iterate until it passes.
5. On pass: commit `weekly tariff refresh YYYY-MM-DD` (plain message, no prefix) and push to main. Vercel auto-deploys.
6. On validation failure or inconclusive sourcing: do NOT push. Open a GitHub issue titled `tariff data refresh failed YYYY-MM-DD` with the reason and evidence.

Setup prerequisite (one-time, manual): the TariffWars repo must be connected in claude.ai/code scheduled-agents settings.

### 4. CI backstop

`.github/workflows/validate-data.yml`: on any push touching `backend/src/data/**`, check out with `fetch-depth: 2` and run the validator with `--base HEAD~1`. Catches anything that slips past the agent, costs nothing.

### 5. Frontend freshness signal

One small addition, no redesign:

- New endpoint `GET /api/tariffs/meta` in `backend/src/routes/tariffRoutes.ts` serving `meta.json`
- A "Data last updated {date}" stamp with source links rendered near the tariff tables in the dashboard

This tells visitors the tracker is alive and where the numbers come from.

### 6. Initial refresh (one-time, this session)

Research the tariff landscape as of July 2026 and rebuild both CSVs with cited current data, create `meta.json`, run the validator, spot-check manually. The first scheduled run then only maintains.

## Error handling summary

| Failure | Behavior |
| --- | --- |
| Validator fails in agent run | No push, GitHub issue with reason |
| Sources inconclusive / contradictory | No push, GitHub issue |
| Bad data pushed anyway | CI workflow fails on the push, visible in repo |
| Agent run does not fire | Site keeps serving last good data; stamp date ages visibly |

## Testing

- Validator: run against refreshed data (must pass) and against deliberately broken fixtures (bad header, rate out of bounds, truncated file, stale meta date; each must fail with a clear message). Fixture checks run locally, not committed as test infra.
- Endpoint: `GET /api/tariffs/meta` returns the JSON.
- Frontend: stamp renders with the correct date and links.
- Routine: one manual trigger of the scheduled agent as a dry run before trusting the cadence.

## Out of scope

Stack upgrades (React/Vite/Tailwind/ESLint), UI redesign, custom alerts, the OpenAI insights service, historical timeline features (git history preserves the option).
