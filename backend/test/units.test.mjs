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
