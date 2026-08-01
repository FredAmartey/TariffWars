import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { apiService } from "../../services/api";

interface TariffMeta {
  lastUpdated: string;
  sources: Array<{ name: string; url: string }>;
}

export const DataFreshness: React.FC = () => {
  const [meta, setMeta] = useState<TariffMeta | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getTariffMeta()
      .then((m) => {
        if (!cancelled && m) setMeta(m);
      })
      .catch((e) => {
        console.error("Could not load tariff metadata:", e);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Silently rendering nothing removed the "Data updated ..." line and the
  // source list altogether, so a metadata outage looked like a page that had
  // simply never claimed a date. Say that it is unavailable instead.
  if (failed) {
    return (
      <div className="mt-3 text-xs text-muted-foreground">
        Data freshness information is unavailable right now.
      </div>
    );
  }

  if (!meta) return null;

  const parsed = new Date(`${meta.lastUpdated}T00:00:00`);
  const formatted = isNaN(parsed.getTime())
    ? meta.lastUpdated
    : format(parsed, "MMMM d, yyyy");

  return (
    <div className="mt-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
        Data updated {formatted}
      </span>
      {meta.sources.length > 0 && (
        // Every source's full headline used to be rendered inline, as one run
        // of a dozen underlined sentences. On a phone that block ran ~700px:
        // longer than the table it was annotating. Publisher names, folded
        // away, carry the same provenance in a line.
        <details className="mt-2">
          <summary className="cursor-pointer underline hover:no-underline w-fit">
            {meta.sources.length} source{meta.sources.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 space-y-1">
            {meta.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                  // The publisher is the label; the headline stays reachable as
                  // the accessible name and the tooltip.
                  title={s.name}
                  aria-label={s.name}
                >
                  {publisherOf(s)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

/**
 * "USTR: Takes Action in Forced Labor Section 301 Investigations" -> "USTR".
 * Falls back to the host when a source is not titled that way.
 */
function publisherOf(source: { name: string; url: string }): string {
  const [prefix] = source.name.split(":");
  if (prefix && prefix.trim() && prefix.length <= 48) return prefix.trim();
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.name;
  }
}
