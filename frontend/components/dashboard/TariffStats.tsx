import React, { useContext, useState, useEffect } from "react";
import { ThemeContext } from "../../App";
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

const TONE_STYLES: Record<Tone, { card: { dark: string; light: string }; pill: { dark: string; light: string }; icon: string }> = {
  neutral: {
    card: {
      dark: "bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border border-indigo-700/50",
      light: "bg-white border border-indigo-100 shadow-sm",
    },
    pill: { dark: "bg-indigo-900/50 text-indigo-300", light: "bg-indigo-50 text-indigo-700" },
    icon: "text-indigo-400",
  },
  escalation: {
    card: {
      dark: "bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700/50",
      light: "bg-white border border-red-100 shadow-sm",
    },
    pill: { dark: "bg-red-900/50 text-red-300", light: "bg-red-50 text-red-700" },
    icon: "text-red-400",
  },
  relief: {
    card: {
      dark: "bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-700/50",
      light: "bg-white border border-green-100 shadow-sm",
    },
    pill: { dark: "bg-green-900/50 text-green-300", light: "bg-green-50 text-green-700" },
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
  isDarkMode: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  detail,
  footnote,
  icon: Icon,
  tone,
  isDarkMode,
}) => {
  const styles = TONE_STYLES[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${
        isDarkMode ? styles.card.dark : styles.card.light
      }`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8" aria-hidden="true">
        <div
          className={`w-full h-full rounded-full ${
            isDarkMode ? "bg-white/[0.04]" : "bg-gray-900/[0.04]"
          }`}
        ></div>
      </div>
      <div className="absolute top-4 right-4">
        <Icon className={`h-6 w-6 ${styles.icon}`} aria-hidden="true" />
      </div>
      {/* Tighter padding below `sm`: at p-6 with an unclamped commodity name
          these four cards ran to roughly 2000px, so the phone view was two
          screens of headline figures before any tariff data. */}
      <div className="p-4 sm:p-6 relative">
        <h3 className={`text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
          {title}
        </h3>
        <div className={`text-3xl font-bold mt-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
          {value}
        </div>
        <p
          className={`text-sm mt-1 line-clamp-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
          title={detail}
        >
          {detail}
        </p>
        {footnote && (
          <div
            className={`mt-4 inline-flex items-center px-2 py-1 rounded-full text-xs ${
              isDarkMode ? styles.pill.dark : styles.pill.light
            }`}
          >
            {footnote}
          </div>
        )}
      </div>
    </div>
  );
};

export const TariffStats = () => {
  const { isDarkMode } = useContext(ThemeContext);
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
      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${
          isDarkMode ? "text-gray-400" : "text-gray-600"
        }`}
      >
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl p-6 animate-pulse ${
              isDarkMode
                ? "bg-gray-800/50 border border-gray-700/50"
                : "bg-gray-100 border border-gray-200"
            }`}
          >
            <div className="h-4 bg-gray-600 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-500 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-600 rounded w-3/4 mb-3"></div>
            <div className="h-5 bg-gray-500 rounded w-1/4"></div>
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
      <div className={`p-4 text-center ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
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
        isDarkMode={isDarkMode}
        footnote={
          yoy !== null && yoyBaseline ? (
            <span
              className={`inline-flex items-center ${
                yoyRose
                  ? isDarkMode
                    ? "text-red-300"
                    : "text-red-700"
                  : isDarkMode
                  ? "text-green-300"
                  : "text-green-700"
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
        isDarkMode={isDarkMode}
        footnote={highestStartedOn ? `Effective since ${highestStartedOn}` : undefined}
      />

      <MetricCard
        title="Biggest Increase"
        value={
          <span className="flex items-center">
            <ArrowUpIcon
              className={`h-5 w-5 mr-1 ${isDarkMode ? "text-red-400" : "text-red-600"}`}
              aria-hidden="true"
            />
            <span className={isDarkMode ? "text-red-400" : "text-red-600"}>
              {metrics.biggestIncreaseValue !== null
                ? `${metrics.biggestIncreaseValue.toFixed(2)}%`
                : "N/A"}
            </span>
          </span>
        }
        detail={metrics.biggestIncreaseCommodity}
        icon={TrendingUpIcon}
        tone="escalation"
        isDarkMode={isDarkMode}
        footnote={metrics.biggestIncreaseDescription}
      />

      <MetricCard
        title="Biggest Decrease"
        value={
          <span className="flex items-center">
            <ArrowDownIcon
              className={`h-5 w-5 mr-1 ${isDarkMode ? "text-green-400" : "text-green-600"}`}
              aria-hidden="true"
            />
            <span className={isDarkMode ? "text-green-400" : "text-green-600"}>
              {decrease !== null ? `${Math.abs(decrease).toFixed(2)}%` : "0.00%"}
            </span>
          </span>
        }
        detail={decrease !== null ? metrics.biggestDecreaseCommodity : "No recent decreases"}
        icon={TrendingDownIcon}
        tone="relief"
        isDarkMode={isDarkMode}
        footnote={decrease !== null ? metrics.biggestDecreaseDescription : "No decrease found"}
      />
    </div>
  );
};
