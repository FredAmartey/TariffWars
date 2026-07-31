# TariffWars

A dashboard for tracking international trade tariffs: current and proposed rates by
commodity and by country, the market context around them, and where each figure came
from.

Live at [fredamartey.com/projects/tariff-wars](https://fredamartey.com/projects/tariff-wars).

## What it does

- **Tariff tables.** Rates by commodity and by country, sortable and filterable, with
  status (active, proposed, threatened, suspended, withdrawn, ended), the change from
  the previous rate, and the effective date. Rates that are no longer charged are shown
  struck through so a withdrawn threat is never mistaken for a live duty.
- **Key metrics.** Average active rate, highest active tariff, largest increase and
  largest decrease, each measured against the dataset rather than hand-written.
- **Market analysis.** An OpenAI-generated read of the current dataset, broken down by
  commodity and region, regenerated on demand.
- **Affected stocks.** Delayed quotes for tariff-exposed tickers, proxied through the
  backend so the market-data credential stays server-side.
- **Tariff news.** Headlines from NewsAPI with a ScrapingDog fallback, filtered for
  relevance and deduplicated across outlets.
- **Export.** The commodity or country table as CSV or JSON, honouring the current
  search.

## Data

The dataset is the point of the project, so it lives in the repo rather than in a
database:

- `backend/src/data/tariffs_commodities.csv`
- `backend/src/data/tariffs_countries.csv`
- `backend/src/data/meta.json`, the last-updated date and the source list rendered
  under the table
- `backend/src/data/history.json`, recorded snapshots, which is what the
  year-over-year figure is measured against

Git history of those CSVs is the audit trail for every data change.

The refresh is autonomous and weekly: a scheduled Claude cloud agent researches current
rates, edits the CSVs, and opens a PR. Two guardrails sit in front of it.
`scripts/validate-data.mjs` is a deterministic validator (schema, value ranges, date
sanity) that exits non-zero with a readable reason, and a churn guard fails CI when a
single run rewrites an implausible share of the rows unless the change is explicitly
marked reviewed. Neither guardrail involves a model. See
[docs/plans/architecture/self-updating-tariff-data.md](docs/plans/architecture/self-updating-tariff-data.md).

```bash
npm run validate-data    # check the CSVs
npm run record-history   # append a snapshot to history.json
```

## Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind, React Router, Axios, Lucide icons.

**Backend:** Node, Express, TypeScript, Axios, OpenAI, csv-parse/csv-stringify, Helmet,
express-rate-limit.

Deployed on Vercel. The app is served under the `/projects/tariff-wars` path prefix
behind a reverse proxy, which is why `vite.config.ts` sets `base` and the API client
uses that prefix.

## Layout

```text
backend/
  src/
    routes/        API endpoints
    services/      tariff, news, stock and market-analysis logic
    utils/         cache-control policy, effective-status derivation
    data/          CSVs, meta.json, history.json
  test/            node:test unit tests
frontend/
  components/      UI, with dashboard widgets under components/dashboard
  services/        API clients
  context/         React context providers
  types/           shared type definitions
docs/
  plans/           architecture docs and the plan index
  lessons.md
scripts/           data validator and history recorder
.github/workflows/ data validation and freshness checks
```

## Running locally

Requires Node 18+ and npm 9+.

```bash
git clone https://github.com/FredAmartey/TariffWars.git
cd TariffWars
npm install
(cd backend && npm install)
```

The frontend needs no environment variables. Configure the backend:

```bash
cd backend
cp .env.example .env
```

`.env.example` documents every variable the backend reads. The ones that matter:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Market analysis and insights |
| `NEWS_API_KEY` | Tariff news |
| `FINNHUB_API_KEY` | Stock quotes |
| `SCRAPINGDOG_API_KEY` | Optional news fallback |
| `PORT` | Defaults to 3001 |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist |

Every credential is server-side. None is read by the browser bundle, and none should
be: an earlier build exposed the market-data key through a `VITE_`-prefixed variable,
which Vite compiles into the public JavaScript.

Then run both servers:

```bash
cd backend && npm run dev     # http://localhost:3001
npm run dev                   # http://localhost:5173/projects/tariff-wars/
```

The Vite dev server proxies `/projects/tariff-wars/api` to the backend, so the UI works
without a build. Point it elsewhere with `API_ORIGIN`.

## Checks

```bash
npx tsc --noEmit       # frontend types
npm run lint           # frontend lint
npm run build          # frontend production build
npm run validate-data  # dataset
cd backend && npm test # backend build and unit tests
```

## Author

Fred Amartey
