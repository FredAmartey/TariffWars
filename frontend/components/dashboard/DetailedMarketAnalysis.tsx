import React, { useState, useContext, useEffect } from "react";
import { ThemeContext } from "../../App";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  AlertCircleIcon,
  BarChart2Icon,
  Globe2Icon,
  ShoppingBagIcon,
  TruckIcon,
  Factory,
  DollarSignIcon,
  LineChartIcon,
} from "lucide-react";
import { marketAnalysisApi } from "../../services/marketAnalysisApi";
import type {
  MarketOverview,
  CommodityAnalysis,
  RegionalAnalysis,
  MarketPrediction,
} from "../../../backend/src/services/marketAnalysisService";

export const DetailedMarketAnalysis = () => {
  const { isDarkMode } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState("overview");
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [commodityAnalysis, setCommodityAnalysis] = useState<CommodityAnalysis[]>([]);
  const [regionalAnalysis, setRegionalAnalysis] = useState<RegionalAnalysis[]>([]);
  const [marketPredictions, setMarketPredictions] = useState<MarketPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [overview, commodities, regions, predictions] = await Promise.all([
          marketAnalysisApi.getMarketOverview(),
          marketAnalysisApi.getCommodityAnalysis(),
          marketAnalysisApi.getRegionalAnalysis(),
          marketAnalysisApi.getMarketPredictions(),
        ]);

        setMarketOverview(overview);
        setCommodityAnalysis(commodities);
        setRegionalAnalysis(regions);
        setMarketPredictions(predictions);
      } catch (err) {
        console.error("Error fetching market analysis data:", err);
        setError("Failed to load market analysis data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={`p-4 text-center ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
          Loading market analysis data...
        </div>
      );
    }

    if (error) {
      return <div className={`p-4 text-center text-red-500`}>{error}</div>;
    }

    switch (activeTab) {
      case "overview":
        return <OverviewTab isDarkMode={isDarkMode} data={marketOverview} />;
      case "commodities":
        return <CommoditiesTab isDarkMode={isDarkMode} data={commodityAnalysis} />;
      case "regions":
        return <RegionsTab isDarkMode={isDarkMode} data={regionalAnalysis} />;
      case "predictions":
        return <PredictionsTab isDarkMode={isDarkMode} data={marketPredictions} />;
      default:
        return <OverviewTab isDarkMode={isDarkMode} data={marketOverview} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap border-b overflow-x-auto whitespace-nowrap">
        {[
          {
            id: "overview",
            label: "Overview",
            icon: <LineChartIcon className="h-4 w-4 mr-2" />,
          },
          {
            id: "commodities",
            label: "Commodities",
            icon: <ShoppingBagIcon className="h-4 w-4 mr-2" />,
          },
          {
            id: "regions",
            label: "Regional Analysis",
            icon: <Globe2Icon className="h-4 w-4 mr-2" />,
          },
          {
            id: "predictions",
            label: "Market Predictions",
            icon: <BarChart2Icon className="h-4 w-4 mr-2" />,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 border-b-2 -mb-px ${
              activeTab === tab.id
                ? isDarkMode
                  ? "border-blue-500 text-blue-400"
                  : "border-blue-600 text-blue-600"
                : isDarkMode
                ? "border-transparent text-gray-400 hover:text-gray-300"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
};

const OverviewTab = ({
  isDarkMode,
  data,
}: {
  isDarkMode: boolean;
  data: MarketOverview | null;
}) => {
  if (!data) return null;

  const {
    averageTariffRate,
    yearOverYearChange,
    highRiskSectors,
    growthOpportunities,
    manufacturingImpact,
    supplyChainShifts,
    economicOutlook,
  } = data;

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-700/50" : "bg-gray-50"}`}>
        <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
          Current Market Outlook
        </h3>
        <p className={`text-sm mb-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
          Global tariff rates have {yearOverYearChange > 0 ? "increased" : "decreased"} by an
          average of {averageTariffRate.toFixed(1)}% over the past 12 months (YoY Change:{" "}
          {yearOverYearChange.toFixed(1)}%), with significant variations across regions and
          commodities. This {yearOverYearChange > 0 ? "upward" : "downward"} trend reflects{" "}
          {yearOverYearChange > 0 ? "growing protectionist policies" : "improving trade relations"}{" "}
          amid continued economic uncertainty and geopolitical tensions.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-800/70" : "bg-white"}`}>
            <div className="flex items-start">
              <div
                className={`p-2 rounded-full ${isDarkMode ? "bg-red-900/50" : "bg-red-100"} mr-3`}
              >
                <AlertCircleIcon
                  className={`h-5 w-5 ${isDarkMode ? "text-red-300" : "text-red-600"}`}
                />
              </div>
              <div>
                <h4
                  className={`font-medium text-sm mb-1 ${
                    isDarkMode ? "text-red-300" : "text-red-700"
                  }`}
                >
                  High-Risk Sectors
                </h4>
                <ul
                  className={`list-disc pl-5 text-sm space-y-1 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {highRiskSectors.length > 0 ? (
                    highRiskSectors.map((sector, index) => (
                      <li key={index}>
                        {sector.name} ({sector.tariffIncrease}% tariff increase)
                      </li>
                    ))
                  ) : (
                    <li>No specific high-risk sectors identified.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-800/70" : "bg-white"}`}>
            <div className="flex items-start">
              <div
                className={`p-2 rounded-full ${
                  isDarkMode ? "bg-green-900/50" : "bg-green-100"
                } mr-3`}
              >
                <TrendingUpIcon
                  className={`h-5 w-5 ${isDarkMode ? "text-green-300" : "text-green-600"}`}
                />
              </div>
              <div>
                <h4
                  className={`font-medium text-sm mb-1 ${
                    isDarkMode ? "text-green-300" : "text-green-700"
                  }`}
                >
                  Growth Opportunities
                </h4>
                <ul
                  className={`list-disc pl-5 text-sm space-y-1 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {growthOpportunities.length > 0 ? (
                    growthOpportunities.map((opportunity, index) => (
                      <li key={index}>
                        {opportunity.name} ({opportunity.tariffReduction}% tariff reduction)
                      </li>
                    ))
                  ) : (
                    <li>No specific growth opportunities identified.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-700/50" : "bg-gray-50"}`}>
          <div className="flex items-center mb-3">
            <Factory className={`h-5 w-5 mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
            <h3 className={`text-base font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Manufacturing Impact
            </h3>
          </div>
          <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            {manufacturingImpact}
          </p>
        </div>
        <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-700/50" : "bg-gray-50"}`}>
          <div className="flex items-center mb-3">
            <TruckIcon
              className={`h-5 w-5 mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
            />
            <h3 className={`text-base font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Supply Chain Shifts
            </h3>
          </div>
          <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            {supplyChainShifts}
          </p>
        </div>
        <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-700/50" : "bg-gray-50"}`}>
          <div className="flex items-center mb-3">
            <DollarSignIcon
              className={`h-5 w-5 mr-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
            />
            <h3 className={`text-base font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Economic Outlook
            </h3>
          </div>
          <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            {economicOutlook}
          </p>
        </div>
      </div>
    </div>
  );
};

const CommoditiesTab = ({
  isDarkMode,
  data,
}: {
  isDarkMode: boolean;
  data: CommodityAnalysis[];
}) => {
  return (
    <div className="space-y-6">
      <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
        Detailed analysis of tariff impacts across major global commodities, highlighting rate
        changes, market reactions, and future projections.
      </p>
      <div
        className={`rounded-lg overflow-hidden ${
          isDarkMode ? "bg-gray-700/50" : "bg-white border border-gray-200"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className={isDarkMode ? "bg-gray-800" : "bg-gray-50"}>
              <tr>
                <th
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-500"
                  } uppercase tracking-wider`}
                >
                  Commodity
                </th>
                <th
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-500"
                  } uppercase tracking-wider`}
                >
                  Current Rate
                </th>
                <th
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-500"
                  } uppercase tracking-wider`}
                >
                  YoY Change
                </th>
                <th
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-500"
                  } uppercase tracking-wider`}
                >
                  Market Impact
                </th>
                <th
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-500"
                  } uppercase tracking-wider`}
                >
                  Outlook
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? "divide-gray-700" : "divide-gray-200"}`}>
              {data.map((item, index) => (
                <tr key={index} className={isDarkMode ? "bg-gray-800/50" : "bg-white"}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{item.rate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={
                        item.change.startsWith("+")
                          ? "text-green-500"
                          : item.change.startsWith("-")
                          ? "text-red-500"
                          : "text-gray-500"
                      }
                    >
                      {item.change}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${
                        item.impact === "high"
                          ? isDarkMode
                            ? "bg-red-900/50 text-red-300"
                            : "bg-red-100 text-red-800"
                          : item.impact === "medium"
                          ? isDarkMode
                            ? "bg-yellow-900/50 text-yellow-300"
                            : "bg-yellow-100 text-yellow-800"
                          : isDarkMode
                          ? "bg-green-900/50 text-green-300"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {item.impact}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={
                        item.outlook === "positive"
                          ? isDarkMode
                            ? "text-green-400"
                            : "text-green-600"
                          : item.outlook === "negative"
                          ? isDarkMode
                            ? "text-red-400"
                            : "text-red-600"
                          : isDarkMode
                          ? "text-gray-400"
                          : "text-gray-600"
                      }
                    >
                      {item.outlook}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const RegionsTab = ({ isDarkMode, data }: { isDarkMode: boolean; data: RegionalAnalysis[] }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((region, index) => (
          <div
            key={index}
            className={`p-5 rounded-lg ${
              isDarkMode
                ? `bg-gradient-to-br from-${getRegionColor(
                    region.region
                  )}-900/20 to-${getRegionColor(
                    region.region
                  )}-900/20 border border-${getRegionColor(region.region)}-900/20`
                : `bg-gradient-to-br from-${getRegionColor(region.region)}-50 to-${getRegionColor(
                    region.region
                  )}-50 border border-${getRegionColor(region.region)}-100`
            }`}
          >
            <div className="flex items-center mb-4">
              <div
                className={`p-2 rounded-full ${
                  isDarkMode
                    ? `bg-${getRegionColor(region.region)}-900/50`
                    : `bg-${getRegionColor(region.region)}-100`
                }`}
              >
                <Globe2Icon
                  className={`h-5 w-5 ${
                    isDarkMode
                      ? `text-${getRegionColor(region.region)}-300`
                      : `text-${getRegionColor(region.region)}-600`
                  }`}
                />
              </div>
              <h3
                className={`ml-3 text-lg font-medium ${
                  isDarkMode
                    ? `text-${getRegionColor(region.region)}-300`
                    : `text-${getRegionColor(region.region)}-700`
                }`}
              >
                {region.region}
              </h3>
            </div>
            <div
              className={`flex items-center justify-between mb-3 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              <span>Average Tariff Rate:</span>
              <span className="font-semibold">{region.averageTariffRate.toFixed(1)}%</span>
            </div>
            <div
              className={`flex items-center justify-between mb-3 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              <span>12-Month Change:</span>
              <span
                className={`font-semibold ${
                  region.yearOverYearChange > 0 ? "text-red-500" : "text-green-500"
                }`}
              >
                {region.yearOverYearChange > 0 ? "+" : ""}
                {region.yearOverYearChange.toFixed(1)}%
              </span>
            </div>
            <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              {region.description}
            </p>
            <div className="mt-4">
              <h4
                className={`text-sm font-medium mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Key Sectors:
              </h4>
              <div className="flex flex-wrap gap-2">
                {region.keySectors.map((sector, sectorIndex) => (
                  <span
                    key={sectorIndex}
                    className={`px-2 py-1 text-xs rounded-full ${
                      isDarkMode
                        ? `bg-${getRegionColor(region.region)}-900/30 text-${getRegionColor(
                            region.region
                          )}-300`
                        : `bg-${getRegionColor(region.region)}-100 text-${getRegionColor(
                            region.region
                          )}-700`
                    }`}
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PredictionsTab = ({
  isDarkMode,
  data,
}: {
  isDarkMode: boolean;
  data: MarketPrediction[];
}) => {
  return (
    <div className="space-y-6">
      <div
        className={`p-5 rounded-lg ${
          isDarkMode
            ? "bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-900/20"
            : "bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100"
        }`}
      >
        <h3 className={`text-lg font-medium mb-3 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
          AI-Generated Market Predictions
        </h3>
        <p className={`text-sm mb-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
          Based on historical patterns, current geopolitical trends, and economic indicators, our AI
          model predicts the following tariff developments over the next 12 months:
        </p>
        <div className="space-y-4">
          {data.map((prediction, index) => (
            <div key={index} className="flex items-start">
              <div
                className={`p-1.5 rounded-full ${
                  isDarkMode
                    ? prediction.timeframe === "short-term"
                      ? "bg-blue-900/50"
                      : prediction.timeframe === "medium-term"
                      ? "bg-green-900/50"
                      : "bg-red-900/50"
                    : prediction.timeframe === "short-term"
                    ? "bg-blue-100"
                    : prediction.timeframe === "medium-term"
                    ? "bg-green-100"
                    : "bg-red-100"
                } mt-0.5 mr-3`}
              >
                {prediction.timeframe === "short-term" ? (
                  <TrendingUpIcon
                    className={`h-4 w-4 ${isDarkMode ? "text-blue-300" : "text-blue-600"}`}
                  />
                ) : prediction.timeframe === "medium-term" ? (
                  <TrendingUpIcon
                    className={`h-4 w-4 ${isDarkMode ? "text-green-300" : "text-green-600"}`}
                  />
                ) : (
                  <TrendingDownIcon
                    className={`h-4 w-4 ${isDarkMode ? "text-red-300" : "text-red-600"}`}
                  />
                )}
              </div>
              <div>
                <h4
                  className={`text-sm font-medium mb-1 ${
                    isDarkMode
                      ? prediction.timeframe === "short-term"
                        ? "text-blue-300"
                        : prediction.timeframe === "medium-term"
                        ? "text-green-300"
                        : "text-red-300"
                      : prediction.timeframe === "short-term"
                      ? "text-blue-700"
                      : prediction.timeframe === "medium-term"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {prediction.timeframe.charAt(0).toUpperCase() + prediction.timeframe.slice(1)}{" "}
                  Predictions
                </h4>
                <ul
                  className={`list-disc pl-5 text-sm space-y-1 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {prediction.predictions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <p className={`text-xs mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Confidence: {(prediction.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const getRegionColor = (region: string): string => {
  const colorMap: Record<string, string> = {
    "North America": "blue",
    "Asia-Pacific": "red",
    Europe: "indigo",
    "Latin America": "amber",
  };
  return colorMap[region] || "gray";
};
