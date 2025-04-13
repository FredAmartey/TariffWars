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
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-center text-red-500 col-span-1 md:col-span-2 lg:col-span-4`}>
        Error loading key metrics: {error}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div
        className={`p-4 text-center ${
          isDarkMode ? "text-gray-300" : "text-gray-700"
        } col-span-1 md:col-span-2 lg:col-span-4`}
      >
        No key metrics data available.
      </div>
    );
  }

  const yoyChangePositive = metrics.yoyChange >= 0;
  const ChangeIcon = yoyChangePositive ? TrendingUpIcon : TrendingDownIcon;
  const changeColorClass = yoyChangePositive
    ? isDarkMode
      ? "bg-green-900/50 text-green-300"
      : "bg-green-50 text-green-700"
    : isDarkMode
    ? "bg-red-900/50 text-red-300"
    : "bg-red-50 text-red-700";
  const changePrefix = yoyChangePositive ? "+" : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        className={`relative overflow-hidden rounded-xl ${
          isDarkMode
            ? "bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border border-indigo-700/50"
            : "bg-white border border-indigo-100 shadow-sm"
        }`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8">
          <div
            className={`w-full h-full rounded-full ${
              isDarkMode ? "bg-indigo-600/10" : "bg-indigo-100/80"
            }`}
          ></div>
        </div>
        <div className="absolute top-4 right-4">
          <GlobeIcon className={`h-6 w-6 ${isDarkMode ? "text-indigo-400" : "text-indigo-400"}`} />
        </div>
        <div className="p-6 relative">
          <h3 className={`text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            Average Tariff Rate
          </h3>
          <p className={`text-3xl font-bold mt-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            {metrics.averageRate.toFixed(2)}%
          </p>
          <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            Across all commodities
          </p>
          <div
            className={`mt-4 inline-flex items-center px-2 py-1 rounded-full text-xs ${changeColorClass}`}
          >
            <ChangeIcon className="h-3 w-3 mr-1" />
            {changePrefix}
            {metrics.yoyChange.toFixed(1)}% YoY
          </div>
        </div>
      </div>
      <div
        className={`relative overflow-hidden rounded-xl ${
          isDarkMode
            ? "bg-gradient-to-br from-amber-900/50 to-amber-800/30 border border-amber-700/50"
            : "bg-white border border-amber-100 shadow-sm"
        }`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8">
          <div
            className={`w-full h-full rounded-full ${
              isDarkMode ? "bg-amber-600/10" : "bg-amber-100/80"
            }`}
          ></div>
        </div>
        <div className="absolute top-4 right-4">
          <BarChart2Icon
            className={`h-6 w-6 ${isDarkMode ? "text-amber-400" : "text-amber-400"}`}
          />
        </div>
        <div className="p-6 relative">
          <h3 className={`text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            Highest Tariff
          </h3>
          <p className={`text-3xl font-bold mt-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            {metrics.highestTariffRate !== null
              ? `${metrics.highestTariffRate.toFixed(2)}%`
              : "N/A"}
          </p>
          <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            {metrics.highestTariffCommodity}
            {metrics.highestTariffCountries !== "N/A" && ` (${metrics.highestTariffCountries})`}
          </p>
          <div
            className={`mt-4 inline-flex items-center px-2 py-1 rounded-full text-xs ${
              isDarkMode ? "bg-amber-900/50 text-amber-300" : "bg-amber-50 text-amber-700"
            }`}
          >
            Effective: {metrics.highestTariffEffectiveDate}
          </div>
        </div>
      </div>
      <div
        className={`relative overflow-hidden rounded-xl ${
          isDarkMode
            ? "bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-700/50"
            : "bg-white border border-green-100 shadow-sm"
        }`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8">
          <div
            className={`w-full h-full rounded-full ${
              isDarkMode ? "bg-green-600/10" : "bg-green-100/80"
            }`}
          ></div>
        </div>
        <div className="absolute top-4 right-4">
          <TrendingUpIcon
            className={`h-6 w-6 ${isDarkMode ? "text-green-400" : "text-green-400"}`}
          />
        </div>
        <div className="p-6 relative">
          <h3 className={`text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            Biggest Increase
          </h3>
          <div className="flex items-center mt-2">
            <ArrowUpIcon className="h-5 w-5 text-green-500 mr-1" />
            <p className={`text-3xl font-bold text-green-500`}>
              {metrics.biggestIncreaseValue !== null
                ? `${metrics.biggestIncreaseValue.toFixed(2)}%`
                : "N/A"}
            </p>
          </div>
          <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            {metrics.biggestIncreaseCommodity}
          </p>
          <div
            className={`mt-4 inline-flex items-center px-2 py-1 rounded-full text-xs ${
              isDarkMode ? "bg-green-900/50 text-green-300" : "bg-green-50 text-green-700"
            }`}
          >
            {metrics.biggestIncreaseDescription}
          </div>
        </div>
      </div>
      <div
        className={`relative overflow-hidden rounded-xl ${
          isDarkMode
            ? "bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700/50"
            : "bg-white border border-red-100 shadow-sm"
        }`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8">
          <div
            className={`w-full h-full rounded-full ${
              isDarkMode ? "bg-red-600/10" : "bg-red-100/80"
            }`}
          ></div>
        </div>
        <div className="absolute top-4 right-4">
          <TrendingDownIcon className={`h-6 w-6 ${isDarkMode ? "text-red-400" : "text-red-400"}`} />
        </div>
        <div className="p-6 relative">
          <h3 className={`text-sm font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            Biggest Decrease
          </h3>
          <div className="flex items-center mt-2">
            <ArrowDownIcon className="h-5 w-5 text-red-500 mr-1" />
            <p className={`text-3xl font-bold text-red-500`}>
              {metrics.biggestDecreaseValue !== null
                ? `${Math.abs(metrics.biggestDecreaseValue).toFixed(2)}%`
                : "0.00%"}
            </p>
          </div>
          <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            {metrics.biggestDecreaseValue !== null
              ? metrics.biggestDecreaseCommodity
              : "No recent decreases"}
          </p>
          <div
            className={`mt-4 inline-flex items-center px-2 py-1 rounded-full text-xs ${
              isDarkMode ? "bg-red-900/50 text-red-300" : "bg-red-50 text-red-700"
            }`}
          >
            {metrics.biggestDecreaseValue !== null
              ? metrics.biggestDecreaseDescription
              : "No decrease found"}
          </div>
        </div>
      </div>
    </div>
  );
};
