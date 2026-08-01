// Regression tests for the logic that has actually broken in production.
// Run against the compiled output: `npm test` builds first.
import test from "node:test";
import assert from "node:assert/strict";

const { effectiveStatus } = await import("../dist/utils/effectiveStatus.js");
const { cacheableIfOk } = await import("../dist/utils/cacheControl.js");
const { safeArticleUrl } = await import("../dist/services/newsService.js");
const { clientKey } = await import("../dist/utils/clientKey.js");

test("effectiveStatus promotes a Proposed row on its effective date", () => {
  const before = new Date("2026-07-30T12:00:00Z");
  const after = new Date("2026-07-31T00:00:01Z");
  assert.equal(effectiveStatus("Proposed", "July 31, 2026", before), "Proposed");
  assert.equal(effectiveStatus("Proposed", "July 31, 2026", after), "Active");
});

test("effectiveStatus is timezone independent", () => {
  // Bare dates parse in the host zone unless pinned; a New York laptop used to
  // flip five hours after a UTC server did.
  const at = new Date("2026-07-31T00:00:01Z");
  const original = process.env.TZ;
  for (const tz of ["UTC", "America/New_York", "Asia/Tokyo"]) {
    process.env.TZ = tz;
    assert.equal(effectiveStatus("Proposed", "July 31, 2026", at), "Active", `TZ=${tz}`);
  }
  process.env.TZ = original;
});

test("effectiveStatus only promotes Proposed, and never on an unparseable date", () => {
  const late = new Date("2026-12-31T00:00:00Z");
  for (const status of ["Threatened", "Under Investigation", "Delayed", "Suspended", "Withdrawn"]) {
    assert.equal(effectiveStatus(status, "July 1, 2026", late), status);
  }
  assert.equal(effectiveStatus("Proposed", "TBD", late), "Proposed");
  assert.equal(effectiveStatus("Proposed", "", late), "Proposed");
});

/** Minimal stand-in for the bits of a response cacheableIfOk touches. */
function fakeRes(statusCode = 200) {
  const headers = {};
  return {
    statusCode,
    headersSent: false,
    setHeader: (k, v) => (headers[k.toLowerCase()] = v),
    getHeader: (k) => headers[k.toLowerCase()],
    writeHead() {
      this.headersSent = true;
      return this;
    },
  };
}

test("a route TTL wins over the app-wide default regardless of order", () => {
  const res = fakeRes();
  cacheableIfOk(res, 3600, 86400); // app-wide middleware, registered first
  cacheableIfOk(res, 900, 3600, { fromRoute: true }); // route, registered later
  res.writeHead();
  assert.match(res.getHeader("Cache-Control"), /s-maxage=900/);
});

test("the app-wide default does not clobber a route TTL", () => {
  const res = fakeRes();
  cacheableIfOk(res, 900, 3600, { fromRoute: true });
  cacheableIfOk(res, 3600, 86400);
  res.writeHead();
  assert.match(res.getHeader("Cache-Control"), /s-maxage=900/);
});

test("error responses are never shared-cached", () => {
  const res = fakeRes(429);
  cacheableIfOk(res, 3600, 86400);
  res.writeHead();
  assert.equal(res.getHeader("Cache-Control"), "no-store");
});

test("a route can mark a successful response non-cacheable", () => {
  // The write hook runs last, so a handler calling res.setHeader("Cache-Control")
  // itself would be silently overwritten by the app-wide policy. A 200 carrying
  // a knowingly incomplete payload has to be able to opt out.
  const res = fakeRes(200);
  cacheableIfOk(res, 3600, 86400); // app-wide
  cacheableIfOk(res, 300, 600, { fromRoute: true, noStore: true }); // route opts out
  res.writeHead();
  assert.equal(res.getHeader("Cache-Control"), "no-store");
});

test("the same route still caches when it does not opt out", () => {
  const res = fakeRes(200);
  cacheableIfOk(res, 3600, 86400);
  cacheableIfOk(res, 300, 600, { fromRoute: true, noStore: false });
  res.writeHead();
  assert.match(res.getHeader("Cache-Control"), /s-maxage=300/);
});

test("safeArticleUrl accepts web URLs and rejects everything else", () => {
  assert.equal(safeArticleUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(safeArticleUrl("http://example.com/a"), "http://example.com/a");
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "", null, 7]) {
    assert.equal(safeArticleUrl(bad), undefined, String(bad));
  }
});

test("clientKey prefers the real-IP header, then the first forwarded hop", () => {
  assert.equal(clientKey({ headers: { "x-real-ip": "1.2.3.4" }, ip: "9.9.9.9" }), "1.2.3.4");
  assert.equal(
    clientKey({ headers: { "x-forwarded-for": "5.6.7.8, 10.0.0.1" }, ip: "9.9.9.9" }),
    "5.6.7.8"
  );
  assert.equal(clientKey({ headers: {}, ip: "9.9.9.9" }), "9.9.9.9");
});

// --- tariff exposure -------------------------------------------------------
// The stocks panel used to hardcode which tickers were "affected" and pick its
// explanation from the day's price direction. These cover the join that
// replaced it: a company is on the panel because a duty is being charged on
// its industry today.

const { exposureFor, INDUSTRY_GOODS, interleaveBySector } = await import(
  "../dist/services/tariffExposure.js"
);

const row = (over = {}) => ({
  type: "product",
  commodity: "Steel & Aluminum (UK at 25%)",
  status: "Active",
  rate: 50,
  rateDisplay: "50%",
  effectiveDate: "June 4, 2025",
  ...over,
});

test("exposureFor names the tariff actually charged on the industry", () => {
  const found = exposureFor("Metals & Mining", [row()]);
  assert.equal(found?.commodity, "Steel & Aluminum (UK at 25%)");
  assert.equal(found?.rateDisplay, "50%");
  assert.equal(found?.effectiveDate, "June 4, 2025");
});

test("exposureFor ignores tariffs no longer being collected", () => {
  // The whole point of the panel is companies currently affected. A withdrawn
  // 250% threat put a company on the old list forever, because the old list
  // was a constant and consulted no status at all.
  for (const status of ["Withdrawn", "Ended", "Suspended", "Paused", "Expired"]) {
    assert.equal(exposureFor("Metals & Mining", [row({ status })]), null, status);
  }
});

test("exposureFor promotes a Proposed tariff once its date has passed", () => {
  // Same reading of the CSV the tables use: status is written weekly, so a
  // tariff that started since the last run is already being charged.
  const tariff = [row({ status: "Proposed", effectiveDate: "July 31, 2026" })];
  assert.equal(exposureFor("Metals & Mining", tariff, new Date("2026-07-30T12:00:00Z")), null);
  assert.equal(
    exposureFor("Metals & Mining", tariff, new Date("2026-08-01T00:00:00Z"))?.status,
    "Active"
  );
});

test("exposureFor reports the heaviest duty when several apply", () => {
  const found = exposureFor("Metals & Mining", [
    row({ commodity: "Copper (semi-finished)", rate: 50, rateDisplay: "50%" }),
    row({ commodity: "Steel & Aluminum", rate: 25, rateDisplay: "25%" }),
    row({ commodity: "Critical Minerals", rate: 10, rateDisplay: "10%" }),
  ]);
  assert.equal(found?.rate, 50);
});

test("exposureFor returns null for an industry no tariff names", () => {
  // A company with no live tariff on its sector is dropped from the panel
  // rather than shown with an empty explanation. The fixed list could not
  // express this, which is why it was always the same nineteen tickers.
  assert.equal(exposureFor("Insurance", [row()]), null);
  assert.equal(exposureFor(null, [row()]), null);
});

test("exposureFor does not match blanket tariff lines to a sector", () => {
  // "All Imports" touches every company on earth, so matching it would put the
  // whole candidate list on the panel permanently and mean nothing.
  const blanket = [
    row({ commodity: "All Imports (IEEPA reciprocal tariffs 10%-50%)" }),
    row({ commodity: "All Goods from DST-Enacting Countries" }),
  ];
  for (const { industry } of INDUSTRY_GOODS) {
    assert.equal(exposureFor(industry, blanket), null, industry);
  }
});

test("exposureFor ignores country rows, which carry no commodity", () => {
  assert.equal(exposureFor("Metals & Mining", [row({ type: "country" })]), null);
});

test("interleaveBySector keeps the heaviest sector first without repeating it", () => {
  // Six companies charged on Steel & Aluminum ran as six consecutive identical
  // cards in a scrolling marquee, which reads as a rendering fault.
  const q = (symbol, commodity, rate) => ({ symbol, exposure: { commodity, rate } });
  const ordered = interleaveBySector([
    q("NUE", "Steel", 50), q("CAT", "Steel", 50), q("BA", "Steel", 50),
    q("TSLA", "Autos", 25), q("GM", "Autos", 25),
    q("INTC", "Semis", 25),
  ]);
  assert.equal(ordered.length, 6, "every company is still present");
  assert.equal(ordered[0].symbol, "NUE", "heaviest duty still leads");
  assert.notEqual(
    ordered[0].exposure.commodity,
    ordered[1].exposure.commodity,
    "the second card names a different sector"
  );
});

test("exposureFor routes solar installers to the panel tariff, not the chip one", () => {
  // Finnhub classes the panel makers (First Solar, Enphase, SolarEdge) as
  // "Semiconductors", so tracking them would have reported the 25% chip duty
  // against companies whose real exposure is the 50% one on panels. Installers
  // land in "Electrical Equipment", which can be mapped without that collision.
  const solar = { ...row(), commodity: "Solar Panels (Section 301 four-year review)", rate: 50 };
  const chips = { ...row(), commodity: "Semiconductors", rate: 25 };
  assert.equal(exposureFor("Electrical Equipment", [solar, chips])?.rate, 50);
  assert.equal(exposureFor("Semiconductors", [solar, chips])?.commodity, "Semiconductors");
});
