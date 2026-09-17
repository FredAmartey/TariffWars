import type { NewsArticle } from "@/types/index";

export const BOOKMARK_KEY = "tariffNewsBookmarks";

/**
 * Bookmarks are rendered as click targets, and storage predates the scheme
 * check the backend now applies at ingestion. A `javascript:` or `data:` URL
 * saved by an older build would otherwise be handed straight back to the user
 * as something to activate.
 */
export function isSafeUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw.trim()) return false;
  try {
    const { protocol } = new URL(raw);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Never throws: bad JSON, a non-array value or blocked storage yields [].
 *
 * Earlier releases stored bare URL strings. Those are migrated rather than
 * dropped: discarding them here would combine with the persistence effect below
 * to erase every existing bookmark the first time a user loaded the new build.
 * A migrated entry keeps the link working immediately, and is upgraded to the
 * full article as soon as it appears in a live feed.
 */
export function readBookmarks(): NewsArticle[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry): NewsArticle | null => {
        // Both shapes are checked: a legacy string and a stored object can each
        // carry a URL written before the scheme was validated anywhere.
        if (typeof entry === "string") {
          return isSafeUrl(entry)
            ? ({
                id: entry,
                title: entry,
                summary: "",
                url: entry,
                date: "",
                source: { name: "Saved link" },
              } as NewsArticle)
            : null;
        }
        if (entry && typeof entry === "object" && isSafeUrl(entry.url)) {
          return entry as NewsArticle;
        }
        return null;
      })
      .filter((a): a is NewsArticle => a !== null);
  } catch {
    return [];
  }
}

/**
 * Syndicated summaries routinely end in "Read More: https://…", which renders
 * as a wrapped, unclickable URL eating three lines of the card.
 */
export function cleanSummary(summary: string | undefined): string {
  if (!summary) return "";
  return summary
    .replace(/\s*(read more|continue reading|full story)\s*:?\s*https?:\/\/\S+\s*$/i, "")
    .replace(/\s*https?:\/\/\S+\s*$/i, "")
    .trim();
}
