# Lessons

## Data files must match the consuming parser's contract, not just the validator's

When refreshing `backend/src/data/*.csv`, the deterministic validator (`scripts/validate-data.mjs`) accepts richer rate strings (ranges, annotations) than `tariffService.ts` can render: the service `parseFloat`s `Rate` (commodities) and `Rate Imposed By USA` (countries) and truncates everything after the leading number, while `Rate Imposed on USA` passes through raw. Caught by codex review on the July 2026 refresh: `10% + 7.5%-100% Sec. 301` displayed as `10%`.

Rule: keep parsed rate cells to a single clean percentage (or `N/A`/`Restricted`/`Exempt`), and put ranges, caps, and exemption notes in Key Sectors, Market Impact, or the commodity name, which render verbatim. Before authoring data in any schema, read the consumer, not just the gate.

## GitHub Actions PR runs check out the merge ref

Any CI logic keyed off `HEAD` commit messages (like the validator's `[churn-reviewed]` override) silently breaks on `pull_request` events, because the synthetic merge commit has an auto-generated message. Push events see real commits. The validate-data workflow sets `CHURN_OVERRIDE=1` for PR runs; the full churn guard applies on pushes, which is the autonomous agent's only path to main. Squash-merge messages for data-heavy PRs must include `[churn-reviewed]`.
