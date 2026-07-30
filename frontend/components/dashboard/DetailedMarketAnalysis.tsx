import { useState, useContext, useEffect } from "react";
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
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // allSettled, not all: one failing tab used to discard the three that
        // succeeded and replace the whole modal with a single error.
        const [overview, commodities, regions, predictions] = await Promise.allSettled([
          marketAnalysisApi.getMarketOverview(),
          marketAnalysisApi.getCommodityAnalysis(),
          marketAnalysisApi.getRegionalAnalysis(),
          marketAnalysisApi.getMarketPredictions(),
        ]);

        if (overview.status === "fulfilled") setMarketOverview(overview.value);
        if (commodities.status === "fulfilled") setCommodityAnalysis(commodities.value ?? []);
        if (regions.status === "fulfilled") setRegionalAnalysis(regions.value ?? []);
        if (predictions.status === "fulfilled") setMarketPredictions(predictions.value ?? []);

        const failed = [
          overview.status === "rejected" ? "overview" : null,
          commodities.status === "rejected" ? "commodities" : null,
          regions.status === "rejected" ? "regional analysis" : null,
          predictions.status === "rejected" ? "predictions" : null,
        ].filter(Boolean);

        setAllFailed(failed.length === 4);
        if (failed.length === 4) {
          setError("Failed to load market analysis data");
        } else if (failed.length > 0) {
          setError(`Could not load ${failed.join(", ")}. The other sections are up to date.`);
        }
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

    // A partial failure still has sections worth showing, so the banner sits
    // above the content rather than replacing it.
    const banner = error ? (
      <div className="p-3 mb-4 rounded-lg text-sm text-red-500 bg-red-500/10" role="status">
        {error}
      </div>
    ) : null;

    // Only a total failure replaces the modal. Judging this by "no overview and
    // no commodities" hid working Regional and Predictions tabs whenever the
    // commodity call legitimately returned an empty array.
    if (allFailed) {
      return <div className={`p-4 text-center text-red-500`}>{error}</div>;
    }

    return (
      <>
        {banner}
        {renderTab()}
      </>
    );
  };

  const renderTab = () => {
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
          {/* This previously reported the average rate *level* as the amount rates had
              changed by over 12 months, and leaned on a year-over-year figure no
              historical data supports. State the level as a level. */}
          Active tariffs average {averageTariffRate.toFixed(1)}%, with significant variations
          across regions and commodities, amid continued economic uncertainty and geopolitical
          tensions.
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
        {data.map((region, index) => {
          const theme = getRegionTheme(region.region);
          return (
          <div
            key={index}
            className={`p-5 rounded-lg ${isDarkMode ? theme.cardDark : theme.cardLight}`}
          >
            <div className="flex items-center mb-4">
              <div className={`p-2 rounded-full ${isDarkMode ? theme.chipDark : theme.chipLight}`}>
                <Globe2Icon
                  className={`h-5 w-5 ${isDarkMode ? theme.iconDark : theme.iconLight}`}
                  aria-hidden="true"
                />
              </div>
              <h3
                className={`ml-3 text-lg font-medium ${
                  isDarkMode ? theme.titleDark : theme.titleLight
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
            {/* A "12-Month Change" row used to sit here showing a number the
                model made up. Tariffs in force is measured, so it can stay. */}
            <div
              className={`flex items-center justify-between mb-3 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              <span>Tariffs in force:</span>
              <span className="font-semibold">{region.tariffCount}</span>
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
                      isDarkMode ? theme.tagDark : theme.tagLight
                    }`}
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          </div>
          );
        })}
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

/**
 * Complete class strings per region.
 *
 * These used to be assembled as `bg-${getRegionColor(r)}-100`. Tailwind scans
 * source text for whole class names and never sees an interpolated one, so
 * none of those utilities were emitted and every region card rendered
 * unstyled. Full literals are the only form the scanner can find.
 */
interface RegionTheme {
  cardDark: string;
  cardLight: string;
  chipDark: string;
  chipLight: string;
  iconDark: string;
  iconLight: string;
  titleDark: string;
  titleLight: string;
  tagDark: string;
  tagLight: string;
}

const REGION_THEMES: Record<string, RegionTheme> = {
  "North America": {
    cardDark: "bg-gradient-to-br from-blue-900/20 to-blue-900/20 border border-blue-900/20",
    cardLight: "bg-gradient-to-br from-blue-50 to-blue-50 border border-blue-100",
    chipDark: "bg-blue-900/50",
    chipLight: "bg-blue-100",
    iconDark: "text-blue-300",
    iconLight: "text-blue-600",
    titleDark: "text-blue-300",
    titleLight: "text-blue-700",
    tagDark: "bg-blue-900/30 text-blue-300",
    tagLight: "bg-blue-100 text-blue-700",
  },
  "Asia-Pacific": {
    cardDark: "bg-gradient-to-br from-red-900/20 to-red-900/20 border border-red-900/20",
    cardLight: "bg-gradient-to-br from-red-50 to-red-50 border border-red-100",
    chipDark: "bg-red-900/50",
    chipLight: "bg-red-100",
    iconDark: "text-red-300",
    iconLight: "text-red-600",
    titleDark: "text-red-300",
    titleLight: "text-red-700",
    tagDark: "bg-red-900/30 text-red-300",
    tagLight: "bg-red-100 text-red-700",
  },
  Europe: {
    cardDark: "bg-gradient-to-br from-indigo-900/20 to-indigo-900/20 border border-indigo-900/20",
    cardLight: "bg-gradient-to-br from-indigo-50 to-indigo-50 border border-indigo-100",
    chipDark: "bg-indigo-900/50",
    chipLight: "bg-indigo-100",
    iconDark: "text-indigo-300",
    iconLight: "text-indigo-600",
    titleDark: "text-indigo-300",
    titleLight: "text-indigo-700",
    tagDark: "bg-indigo-900/30 text-indigo-300",
    tagLight: "bg-indigo-100 text-indigo-700",
  },
  "Latin America": {
    cardDark: "bg-gradient-to-br from-amber-900/20 to-amber-900/20 border border-amber-900/20",
    cardLight: "bg-gradient-to-br from-amber-50 to-amber-50 border border-amber-100",
    chipDark: "bg-amber-900/50",
    chipLight: "bg-amber-100",
    iconDark: "text-amber-300",
    iconLight: "text-amber-600",
    titleDark: "text-amber-300",
    titleLight: "text-amber-700",
    tagDark: "bg-amber-900/30 text-amber-300",
    tagLight: "bg-amber-100 text-amber-700",
  },
  Other: {
    cardDark: "bg-gradient-to-br from-teal-900/20 to-teal-900/20 border border-teal-900/20",
    cardLight: "bg-gradient-to-br from-teal-50 to-teal-50 border border-teal-100",
    chipDark: "bg-teal-900/50",
    chipLight: "bg-teal-100",
    iconDark: "text-teal-300",
    iconLight: "text-teal-600",
    titleDark: "text-teal-300",
    titleLight: "text-teal-700",
    tagDark: "bg-teal-900/30 text-teal-300",
    tagLight: "bg-teal-100 text-teal-700",
  },
  Global: {
    cardDark: "bg-gradient-to-br from-slate-900/20 to-slate-900/20 border border-slate-900/20",
    cardLight: "bg-gradient-to-br from-slate-50 to-slate-50 border border-slate-100",
    chipDark: "bg-slate-900/50",
    chipLight: "bg-slate-100",
    iconDark: "text-slate-300",
    iconLight: "text-slate-600",
    titleDark: "text-slate-300",
    titleLight: "text-slate-700",
    tagDark: "bg-slate-900/30 text-slate-300",
    tagLight: "bg-slate-100 text-slate-700",
  },
};

const getRegionTheme = (region: string): RegionTheme =>
  REGION_THEMES[region] ?? REGION_THEMES.Global;
