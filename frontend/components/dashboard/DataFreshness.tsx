import React, { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../App";
import { format } from "date-fns";
import { apiService } from "../../services/api";

interface TariffMeta {
  lastUpdated: string;
  sources: Array<{ name: string; url: string }>;
}

export const DataFreshness: React.FC = () => {
  const { isDarkMode } = useContext(ThemeContext);
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
      <div className={`mt-3 text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
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
    <div className={`mt-3 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${
          isDarkMode ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-800"
        }`}
      >
        Data updated {formatted}
      </span>
      {meta.sources.length > 0 && (
        <span className="ml-2">
          Sources:{" "}
          {meta.sources.map((s, i) => (
            <React.Fragment key={s.url}>
              {i > 0 && ", "}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                {s.name}
              </a>
            </React.Fragment>
          ))}
        </span>
      )}
    </div>
  );
};
