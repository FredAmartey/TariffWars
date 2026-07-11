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
