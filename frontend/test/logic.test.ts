// Regression tests for the pure logic screenshots and manual QA cannot see:
// no render, no layout, just the functions that decide what data reaches the
// user and how it is shaped once it does.
import { describe, test, expect, beforeEach, vi } from "vitest";
import { isSafeUrl, readBookmarks, cleanSummary } from "../components/NewsFeed";
import { isInactive } from "../components/dashboard/TariffTable";
import { sortOptionsFor } from "../components/dashboard/TariffTable";

const BOOKMARK_KEY = "tariffNewsBookmarks";

// A minimal in-memory Storage stand-in, stubbed onto the global per test.
// Some Node builds now claim the `localStorage` global for their own
// (opt-in, file-backed) Web Storage implementation, which can leave jsdom's
// version unset; stubbing directly keeps this test independent of that.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("isSafeUrl", () => {
  // web URLs are the only thing a bookmark or an article link should ever
  // resolve to.
  test("accepts https and http URLs", () => {
    expect(isSafeUrl("https://example.com/a")).toBe(true);
    expect(isSafeUrl("http://example.com/a")).toBe(true);
  });

  // a scheme that runs script or embeds a payload instead of navigating.
  test("rejects a javascript: URL", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  test("rejects a data: URL", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  test("rejects the empty string", () => {
    expect(isSafeUrl("")).toBe(false);
  });

  // `.trim()` guards against a value that is non-empty but has no real content.
  test("rejects whitespace", () => {
    expect(isSafeUrl("   ")).toBe(false);
  });

  test("rejects a non-string value", () => {
    expect(isSafeUrl(42)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });

  // `new URL()` throws on a string with no scheme at all; that throw has to
  // be caught rather than propagate.
  test("rejects an unparseable value without throwing", () => {
    expect(isSafeUrl("not a url")).toBe(false);
  });
});

describe("readBookmarks", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  test("returns [] when the key is absent", () => {
    expect(readBookmarks()).toEqual([]);
  });

  // must never throw: a corrupted value should degrade to an empty list, not
  // take the whole news view down with it.
  test("returns [] and does not throw on malformed JSON", () => {
    localStorage.setItem(BOOKMARK_KEY, "{not json");
    expect(() => readBookmarks()).not.toThrow();
    expect(readBookmarks()).toEqual([]);
  });

  test("returns [] when the stored value is an object rather than an array", () => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify({ url: "https://example.com/a" }));
    expect(readBookmarks()).toEqual([]);
  });

  // earlier releases stored bare URL strings. Dropping them here would combine
  // with the persistence effect to erase every existing bookmark on first load
  // of a new build, so they are migrated into full article placeholders.
  test("migrates a legacy bare-URL string entry instead of dropping it", () => {
    const url = "https://example.com/legacy-article";
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify([url]));
    const result = readBookmarks();
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(url);
    expect(result[0].title).toBe(url);
  });

  // security regression: a legacy string entry carrying an unsafe scheme must
  // not survive migration.
  test("rejects a legacy string entry whose URL is javascript:", () => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(["javascript:alert(1)"]));
    expect(readBookmarks()).toEqual([]);
  });

  // security regression: the object-shaped branch takes a different code path
  // than the legacy string branch, so it needs its own coverage.
  test("rejects a stored object entry whose url is javascript:", () => {
    localStorage.setItem(
      BOOKMARK_KEY,
      JSON.stringify([
        {
          id: "x",
          title: "Malicious",
          summary: "",
          url: "javascript:alert(1)",
          date: "",
          source: { name: "Bad Source" },
        },
      ])
    );
    expect(readBookmarks()).toEqual([]);
  });

  test("keeps a well-formed stored article object intact", () => {
    const article = {
      id: "https://example.com/a",
      title: "A real headline",
      summary: "A short summary",
      url: "https://example.com/a",
      date: "2026-01-01",
      source: { name: "A Source" },
    };
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify([article]));
    expect(readBookmarks()).toEqual([article]);
  });

  test("keeps only the safe entries out of a mixed array", () => {
    const safeString = "https://example.com/legacy";
    const safeArticle = {
      id: "https://example.com/b",
      title: "Safe article",
      summary: "",
      url: "https://example.com/b",
      date: "",
      source: { name: "Source" },
    };
    const unsafeArticle = {
      id: "y",
      title: "Unsafe",
      summary: "",
      url: "javascript:alert(1)",
      date: "",
      source: { name: "Source" },
    };
    localStorage.setItem(
      BOOKMARK_KEY,
      JSON.stringify([safeString, "javascript:alert(1)", safeArticle, unsafeArticle])
    );
    const result = readBookmarks();
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.url)).toEqual([safeString, safeArticle.url]);
  });
});

describe("cleanSummary", () => {
  // syndicated feeds append a trailing "Read More: https://…" that would
  // otherwise render as a wrapped, unclickable URL eating card space.
  test("strips a trailing 'Read More: https://…' tail", () => {
    expect(cleanSummary("Tariffs rose today. Read More: https://example.com/story")).toBe(
      "Tariffs rose today."
    );
  });

  test("strips a bare trailing URL with no label", () => {
    expect(cleanSummary("Tariffs rose today. https://example.com/story")).toBe(
      "Tariffs rose today."
    );
  });

  test("leaves a summary with no trailing URL untouched", () => {
    expect(cleanSummary("Tariffs rose today.")).toBe("Tariffs rose today.");
  });

  test("returns '' for undefined", () => {
    expect(cleanSummary(undefined)).toBe("");
  });
});

describe("isInactive", () => {
  // a withdrawn or expired tariff's recorded rate is history, not a price
  // currently being charged; this predicate is what keeps that distinction
  // visible everywhere the status is used.
  test.each(["Withdrawn", "Ended", "Suspended", "Paused", "Expired"])(
    "is true for %s",
    (status) => {
      expect(isInactive(status)).toBe(true);
    }
  );

  test("is false for Active", () => {
    expect(isInactive("Active")).toBe(false);
  });

  test("is false for undefined", () => {
    expect(isInactive(undefined)).toBe(false);
  });
});

describe("sortOptionsFor", () => {
  // a <select> whose value matches no option silently displays its first one,
  // so a header-driven sort that IS a preset must return the presets
  // unmodified rather than growing a duplicate entry.
  test("returns the presets unchanged when the pair is already a preset", () => {
    const presets = sortOptionsFor("rate", "desc");
    expect(presets.map((o) => o.value)).toEqual([
      "rate-desc",
      "rate-asc",
      "changeDisplay-desc",
      "changeDisplay-asc",
      "effectiveDate-desc",
      "effectiveDate-asc",
    ]);
  });

  // a header sort outside the preset list must not leave the dropdown
  // claiming an order the rows no longer use.
  test("appends exactly one synthetic option when the pair is not a preset", () => {
    const options = sortOptionsFor("commodity", "asc");
    expect(options).toHaveLength(7);
    expect(options[options.length - 1]).toEqual({
      value: "commodity-asc",
      label: "Commodity (A-Z)",
    });
  });
});
