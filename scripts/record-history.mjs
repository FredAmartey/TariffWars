#!/usr/bin/env node
// Appends one snapshot of the dataset to backend/src/data/history.json.
//
// A year-over-year figure needs a value from a year ago, and nothing was ever
// recorded — which is why the dashboard used to show a fabricated one. Run this
// as part of every refresh so a genuine comparison becomes possible over time.
// Re-running on the same date replaces that date's record, so it is safe to
// run more than once per day.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "backend", "src", "data");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");

// Rates that carry no number. Counting these as 0% would understate the average.
const NON_NUMERIC = new Set(["N/A", "Restricted", "Exempt"]);

const rows = parse(readFileSync(path.join(DATA_DIR, "tariffs_commodities.csv"), "utf8"), {
  columns: true,
  skip_empty_lines: true,
});

const active = rows.filter((r) => (r["Status"] || "").trim() === "Active");
const rated = active
  .map((r) => String(r["Rate"] || "").trim())
  .filter((v) => !NON_NUMERIC.has(v))
  .map((v) => parseFloat(v.replace("%", "")))
  .filter((n) => !Number.isNaN(n));

if (rated.length === 0) {
  console.error("record-history: no active rows carry a numeric rate; refusing to write");
  process.exit(1);
}

const record = {
  date: new Date().toISOString().slice(0, 10),
  activeAverageRate: +(rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(2),
  activeCount: active.length,
  totalCount: rows.length,
};

let history = [];
try {
  history = JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
  if (!Array.isArray(history)) throw new Error("history.json is not an array");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}

history = history.filter((r) => r.date !== record.date);
history.push(record);
history.sort((a, b) => a.date.localeCompare(b.date));

writeFileSync(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);
console.log(
  `record-history: ${record.date} — ${record.activeAverageRate}% across ${record.activeCount} active of ${record.totalCount}`
);
