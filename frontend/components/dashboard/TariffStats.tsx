import React, { useState, useEffect } from "react";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  BarChart2Icon,
  TrendingUpIcon,
  TrendingDownIcon,
  GlobeIcon,
} from "lucide-react";
import { marketAnalysisApi } from "../../services/marketAnalysisApi";
import type { KeyMetrics } from "../../services/marketAnalysisApi";

/**
 * Colour follows the subject, not the ticker.
 *
 * "Biggest Increase" used to be the green card with an up arrow and "Biggest
 * Decrease" the red one, borrowing the markets convention where up is good.
 * On a tariff tracker a rise is the cost being reported and a cut is the
 * relief, so the palettes are the other way round.
 */
type Tone = "neutral" | "escalation" | "relief";

const TONE_STYLES: Record<Tone, { card: string; pill: string; icon: string }> = {
  neutral: {
    // A flat colour is expressed as a gradient with identical stops rather
    // than bg-white + a dark:bg-linear-to-br override: background-color and
    // background-image are different properties, so the dark gradient (itself
    // semi-transparent, /50 and /30) would otherwise only ever composite over
    // the light bg-white, never replace it, leaving the card washed-out pale
    // in dark mode instead of the intended indigo tint.
    card: "bg-linear-to-br from-white to-white border border-indigo-100 shadow-xs dark:from-indigo-900/50 dark:to-indigo-800/30 dark:border-indigo-700/50 dark:shadow-none",
    pill: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
    icon: "text-indigo-400",
  },
  escalation: {
    card: "bg-linear-to-br from-white to-white border border-red-100 shadow-xs dark:from-red-900/50 dark:to-red-800/30 dark:border-red-700/50 dark:shadow-none",
    pill: "bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    icon: "text-red-400",
  },
  relief: {
    card: "bg-linear-to-br from-white to-white border border-green-100 shadow-xs dark:from-green-900/50 dark:to-green-800/30 dark:border-green-700/50 dark:shadow-none",
    pill: "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    icon: "text-green-400",
  },
};

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  /** Long, so it is clamped with the full text kept in the tooltip. */
  detail: string;
  footnote?: React.ReactNode;
  icon: React.ElementType;
  tone: Tone;
}

/**
 * The headline name of a commodity, without its qualifying parenthetical.
 *
 * The dataset encodes scope inside the name, e.g. "Pharmaceuticals (patented;
 * EU, Japan, South Korea, Switzerland capped at 15%)". At card width that
 * clamped to "...Switzerland capped at…", cutting immediately before the
 * number and reading as though something were capped at an unstated value.
 * The card is a summary, so it shows the head of the name; the full string
 * stays on the element's `title` for hover.
 */
const shortCommodity = (name: string): string => {
  const head = name.split(" (")[0].trim();
  return head || name;
};

/**
 * The qualifying clause the headline drops: scope, caps, expiry.
 *
 * This is the informative half of a commodity string, so it becomes the pill.
 * The pills used to render the API's `biggest*Description`, which is built as
 * `Largest increase imposed on ${commodity}.` — the line directly above with a
 * prefix, under a card already titled "Biggest Increase". This says something
 * the card does not already say.
 */
const commodityQualifier = (name: string): string | undefined => {
  const open = name.indexOf(" (");
  if (open === -1) return undefined;
  const inner = name.slice(open + 2).replace(/\)\s*$/, "").trim();
  return inner || undefined;
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  detail,
  footnote,
  icon: Icon,
  tone,
}) => {
  const styles = TONE_STYLES[tone];
  return (
    <div className={`relative overflow-hidden rounded-xl ${styles.card}`}>
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8" aria-hidden="true">
        <div className="w-full h-full rounded-full bg-gray-900/4 dark:bg-white/4"></div>
      </div>
      <div className="absolute top-4 right-4">
        <Icon className={`h-6 w-6 ${styles.icon}`} aria-hidden="true" />
      </div>
      {/* Tighter padding below `sm`: at p-6 with an unclamped commodity name
          these four cards ran to roughly 2000px, so the phone view was two
          screens of headline figures before any tariff data. */}
      <div className="p-4 sm:p-6 relative">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="text-3xl font-bold mt-2 text-foreground">{value}</div>
        <p className="text-sm mt-1 line-clamp-2 text-muted-foreground" title={detail}>
          {typeof detail === "string" ? shortCommodity(detail) : detail}
        </p>
        {footnote && (
          <div
            className={`mt-4 inline-flex max-w-full items-center px-2 py-1 rounded-full text-xs ${styles.pill}`}
            title={typeof footnote === "string" ? footnote : undefined}
          >
            <span className="truncate">{footnote}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const TariffStats = () => {
  const [metrics, setMetrics] = useState<KeyMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await marketAnalysisApi.getKeyMetrics();
        setMetrics(data);
      } catch (err) {
        console.error("Error fetching key metrics:", err);
        setError("Failed to load key metrics");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-muted-foreground">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl p-6 animate-pulse bg-muted border border-border dark:bg-muted/50"
          >
            <div className="h-4 bg-gray-600 rounded-sm w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-500 rounded-sm w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-600 rounded-sm w-3/4 mb-3"></div>
            <div className="h-5 bg-gray-500 rounded-sm w-1/4"></div>
          </div>
        ))}
        <span className="sr-only" role="status">
          Loading key metrics
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500" role="alert">
        Error loading key metrics: {error}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No key metrics data available.
      </div>
    );
  }

  // Measured against a recorded snapshot rather than derived from the current
  // data, so it is absent until history reaches back far enough. Percentage
  // points, because both figures are themselves percentages.
  const yoy = metrics.yoyChangePoints;
  const yoyRose = (yoy ?? 0) >= 0;
  const YoyIcon = yoyRose ? TrendingUpIcon : TrendingDownIcon;

  // "since" only holds for a date that has actually arrived. The card reports
  // the highest tariff currently being collected, so its start date is always
  // in the past, but the field also carries "N/A", "TBD" and "Error" when
  // there is nothing to report: drop the pill rather than say "since TBD".
  const highestStartedOn = Number.isNaN(Date.parse(metrics.highestTariffEffectiveDate))
    ? null
    : metrics.highestTariffEffectiveDate;

  const yoyBaseline = metrics.yoyComparedTo
    ? new Date(`${metrics.yoyComparedTo}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  const decrease = metrics.biggestDecreaseValue;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Average Tariff Rate"
        value={`${metrics.averageRate.toFixed(2)}%`}
        detail="Across active tariffs"
        icon={GlobeIcon}
        tone="neutral"
        footnote={
          yoy !== null && yoyBaseline ? (
            <span
              className={`inline-flex items-center ${
                yoyRose ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"
              }`}
            >
              <YoyIcon className="h-3 w-3 mr-1" aria-hidden="true" />
              {yoyRose ? "+" : ""}
              {yoy.toFixed(1)} pts vs {yoyBaseline}
            </span>
          ) : undefined
        }
      />

      <MetricCard
        title="Highest Active Tariff"
        value={
          metrics.highestTariffRate !== null ? `${metrics.highestTariffRate.toFixed(2)}%` : "N/A"
        }
        detail={`${metrics.highestTariffCommodity}${
          metrics.highestTariffCountries !== "N/A" ? ` (${metrics.highestTariffCountries})` : ""
        }`}
        icon={BarChart2Icon}
        tone="escalation"
        footnote={highestStartedOn ? `Effective since ${highestStartedOn}` : undefined}
      />

      <MetricCard
        title="Biggest Increase"
        value={
          <span className="flex items-center">
            <ArrowUpIcon
              className="h-5 w-5 mr-1 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <span className="text-red-600 dark:text-red-400">
              {metrics.biggestIncreaseValue !== null
                ? `${metrics.biggestIncreaseValue.toFixed(2)}%`
                : "N/A"}
            </span>
          </span>
        }
        detail={metrics.biggestIncreaseCommodity}
        icon={TrendingUpIcon}
        tone="escalation"
        footnote={commodityQualifier(metrics.biggestIncreaseCommodity)}
      />

      <MetricCard
        title="Biggest Decrease"
        value={
          <span className="flex items-center">
            <ArrowDownIcon
              className="h-5 w-5 mr-1 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <span className="text-green-600 dark:text-green-400">
              {decrease !== null ? `${Math.abs(decrease).toFixed(2)}%` : "0.00%"}
            </span>
          </span>
        }
        detail={decrease !== null ? metrics.biggestDecreaseCommodity : "No recent decreases"}
        icon={TrendingDownIcon}
        tone="relief"
        footnote={
          decrease !== null
            ? commodityQualifier(metrics.biggestDecreaseCommodity)
            : "No decrease in any active tariff"
        }
      />
    </div>
  );
};
