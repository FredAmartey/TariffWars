import { useState, useEffect } from "react";
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
        <div className="p-4 text-center text-muted-foreground">
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
        return <OverviewTab data={marketOverview} />;
      case "commodities":
        return <CommoditiesTab data={commodityAnalysis} />;
      case "regions":
        return <RegionsTab data={regionalAnalysis} />;
      case "predictions":
        return <PredictionsTab data={marketPredictions} />;
      default:
        return <OverviewTab data={marketOverview} />;
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
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
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

const OverviewTab = ({ data }: { data: MarketOverview | null }) => {
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
      <div className="p-4 rounded-lg bg-muted">
        <h3 className="text-lg font-semibold mb-3 text-foreground">Current Market Outlook</h3>
        <p className="text-sm mb-4 text-muted-foreground">
          {/* This previously reported the average rate *level* as the amount rates had
              changed by over 12 months, and leaned on a year-over-year figure no
              historical data supports. State the level as a level. */}
          Active tariffs average {averageTariffRate.toFixed(1)}%, with significant variations
          across regions and commodities, amid continued economic uncertainty and geopolitical
          tensions.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-lg bg-card">
            <div className="flex items-start">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50 mr-3">
                <AlertCircleIcon className="h-5 w-5 text-red-600 dark:text-red-300" />
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1 text-red-700 dark:text-red-300">
                  High-Risk Sectors
                </h4>
                <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
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
          <div className="p-4 rounded-lg bg-card">
            <div className="flex items-start">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50 mr-3">
                <TrendingUpIcon className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1 text-green-700 dark:text-green-300">
                  Growth Opportunities
                </h4>
                <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
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
        <div className="p-4 rounded-lg bg-muted">
          <div className="flex items-center mb-3">
            <Factory className="h-5 w-5 mr-2 text-muted-foreground" />
            <h3 className="text-base font-medium text-foreground">Manufacturing Impact</h3>
          </div>
          <p className="text-sm text-muted-foreground">{manufacturingImpact}</p>
        </div>
        <div className="p-4 rounded-lg bg-muted">
          <div className="flex items-center mb-3">
            <TruckIcon className="h-5 w-5 mr-2 text-muted-foreground" />
            <h3 className="text-base font-medium text-foreground">Supply Chain Shifts</h3>
          </div>
          <p className="text-sm text-muted-foreground">{supplyChainShifts}</p>
        </div>
        <div className="p-4 rounded-lg bg-muted">
          <div className="flex items-center mb-3">
            <DollarSignIcon className="h-5 w-5 mr-2 text-muted-foreground" />
            <h3 className="text-base font-medium text-foreground">Economic Outlook</h3>
          </div>
          <p className="text-sm text-muted-foreground">{economicOutlook}</p>
        </div>
      </div>
    </div>
  );
};

const CommoditiesTab = ({ data }: { data: CommodityAnalysis[] }) => {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Detailed analysis of tariff impacts across major global commodities, highlighting rate
        changes, market reactions, and future projections.
      </p>
      <div className="rounded-lg overflow-hidden bg-white border border-gray-200 dark:bg-gray-700/50 dark:border-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Commodity
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Current Rate
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  YoY Change
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Market Impact
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Outlook
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.map((item, index) => (
                <tr key={index} className="bg-white dark:bg-gray-800/50">
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
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.impact === "high"
                          ? "bg-severity-high text-severity-high-foreground"
                          : item.impact === "medium"
                          ? "bg-severity-medium text-severity-medium-foreground"
                          : "bg-severity-low text-severity-low-foreground"
                      }`}
                    >
                      {item.impact}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={
                        item.outlook === "positive"
                          ? "text-green-600 dark:text-green-400"
                          : item.outlook === "negative"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
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

const RegionsTab = ({ data }: { data: RegionalAnalysis[] }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((region, index) => {
          const theme = getRegionTheme(region.region);
          return (
          <div key={index} className={`p-5 rounded-lg ${theme.card}`}>
            <div className="flex items-center mb-4">
              <div className={`p-2 rounded-full ${theme.chip}`}>
                <Globe2Icon className={`h-5 w-5 ${theme.icon}`} aria-hidden="true" />
              </div>
              <h3 className={`ml-3 text-lg font-medium ${theme.title}`}>{region.region}</h3>
            </div>
            <div className="flex items-center justify-between mb-3 text-muted-foreground">
              <span>Average Tariff Rate:</span>
              <span className="font-semibold">{region.averageTariffRate.toFixed(1)}%</span>
            </div>
            {/* A "12-Month Change" row used to sit here showing a number the
                model made up. Tariffs in force is measured, so it can stay. */}
            <div className="flex items-center justify-between mb-3 text-muted-foreground">
              <span>Tariffs in force:</span>
              <span className="font-semibold">{region.tariffCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">{region.description}</p>
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Key Sectors:</h4>
              <div className="flex flex-wrap gap-2">
                {region.keySectors.map((sector, sectorIndex) => (
                  <span key={sectorIndex} className={`px-2 py-1 text-xs rounded-full ${theme.tag}`}>
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

// Icon direction (up/down) is a real distinction: long-term predictions read
// as a cooling trend rather than an escalation. Colour is just which
// timeframe bucket the prediction falls in.
const TIMEFRAME_STYLES: Record<
  MarketPrediction["timeframe"],
  { chip: string; icon: string; title: string }
> = {
  "short-term": {
    chip: "bg-blue-100 dark:bg-blue-900/50",
    icon: "text-blue-600 dark:text-blue-300",
    title: "text-blue-700 dark:text-blue-300",
  },
  "medium-term": {
    chip: "bg-green-100 dark:bg-green-900/50",
    icon: "text-green-600 dark:text-green-300",
    title: "text-green-700 dark:text-green-300",
  },
  "long-term": {
    chip: "bg-red-100 dark:bg-red-900/50",
    icon: "text-red-600 dark:text-red-300",
    title: "text-red-700 dark:text-red-300",
  },
};

const PredictionsTab = ({ data }: { data: MarketPrediction[] }) => {
  return (
    <div className="space-y-6">
      <div className="p-5 rounded-lg bg-linear-to-br from-blue-50 to-purple-50 border border-blue-100 dark:from-blue-900/20 dark:to-purple-900/20 dark:border-blue-900/20">
        <h3 className="text-lg font-medium mb-3 text-foreground">AI-Generated Market Predictions</h3>
        <p className="text-sm mb-4 text-muted-foreground">
          Based on historical patterns, current geopolitical trends, and economic indicators, our AI
          model predicts the following tariff developments over the next 12 months:
        </p>
        <div className="space-y-4">
          {data.map((prediction, index) => {
            const style = TIMEFRAME_STYLES[prediction.timeframe];
            return (
              <div key={index} className="flex items-start">
                <div className={`p-1.5 rounded-full ${style.chip} mt-0.5 mr-3`}>
                  {prediction.timeframe === "long-term" ? (
                    <TrendingDownIcon className={`h-4 w-4 ${style.icon}`} />
                  ) : (
                    <TrendingUpIcon className={`h-4 w-4 ${style.icon}`} />
                  )}
                </div>
                <div>
                  <h4 className={`text-sm font-medium mb-1 ${style.title}`}>
                    {prediction.timeframe.charAt(0).toUpperCase() + prediction.timeframe.slice(1)}{" "}
                    Predictions
                  </h4>
                  <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                    {prediction.predictions.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2 text-muted-foreground">
                    Confidence: {(prediction.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            );
          })}
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
  card: string;
  chip: string;
  icon: string;
  title: string;
  tag: string;
}

const REGION_THEMES: Record<string, RegionTheme> = {
  "North America": {
    card: "bg-linear-to-br from-blue-50 to-blue-50 border border-blue-100 dark:from-blue-900/20 dark:to-blue-900/20 dark:border-blue-900/20",
    chip: "bg-blue-100 dark:bg-blue-900/50",
    icon: "text-blue-600 dark:text-blue-300",
    title: "text-blue-700 dark:text-blue-300",
    tag: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  "Asia-Pacific": {
    card: "bg-linear-to-br from-red-50 to-red-50 border border-red-100 dark:from-red-900/20 dark:to-red-900/20 dark:border-red-900/20",
    chip: "bg-red-100 dark:bg-red-900/50",
    icon: "text-red-600 dark:text-red-300",
    title: "text-red-700 dark:text-red-300",
    tag: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  Europe: {
    card: "bg-linear-to-br from-indigo-50 to-indigo-50 border border-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/20 dark:border-indigo-900/20",
    chip: "bg-indigo-100 dark:bg-indigo-900/50",
    icon: "text-indigo-600 dark:text-indigo-300",
    title: "text-indigo-700 dark:text-indigo-300",
    tag: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  "Latin America": {
    card: "bg-linear-to-br from-amber-50 to-amber-50 border border-amber-100 dark:from-amber-900/20 dark:to-amber-900/20 dark:border-amber-900/20",
    chip: "bg-amber-100 dark:bg-amber-900/50",
    icon: "text-amber-600 dark:text-amber-300",
    title: "text-amber-700 dark:text-amber-300",
    tag: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  Other: {
    card: "bg-linear-to-br from-teal-50 to-teal-50 border border-teal-100 dark:from-teal-900/20 dark:to-teal-900/20 dark:border-teal-900/20",
    chip: "bg-teal-100 dark:bg-teal-900/50",
    icon: "text-teal-600 dark:text-teal-300",
    title: "text-teal-700 dark:text-teal-300",
    tag: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
  Global: {
    card: "bg-linear-to-br from-slate-50 to-slate-50 border border-slate-100 dark:from-slate-900/20 dark:to-slate-900/20 dark:border-slate-900/20",
    chip: "bg-slate-100 dark:bg-slate-900/50",
    icon: "text-slate-600 dark:text-slate-300",
    title: "text-slate-700 dark:text-slate-300",
    tag: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  },
};

const getRegionTheme = (region: string): RegionTheme =>
  REGION_THEMES[region] ?? REGION_THEMES.Global;
