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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground" role="status">
        Loading market analysis data...
      </div>
    );
  }

  // Only a total failure replaces the modal. Judging this by "no overview and
  // no commodities" hid working Regional and Predictions tabs whenever the
  // commodity call legitimately returned an empty array.
  if (allFailed) {
    return <div className="p-4 text-center text-red-600 dark:text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* A partial failure still has sections worth showing, so the banner sits
          above the tabs rather than replacing them. */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm text-red-700 bg-red-500/10 dark:text-red-300"
          role="status"
        >
          {error}
        </div>
      )}
      {/*
        Radix Tabs rather than four buttons over a switch statement. The old
        strip was `flex flex-wrap border-b overflow-x-auto` with no tablist,
        tab or tabpanel roles and no arrow-key movement, and its wrap plus
        scroll combination is what turned into three stacked rows with a
        visible scrollbar once the dialog rendered narrow. `w-full` on the
        list plus `flex-wrap` lets it reflow to two rows on a phone instead of
        scrolling sideways.
      */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-x-1 gap-y-0">
          {TAB_DEFS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="flex-none px-3 py-1.5">
              <Icon aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab data={marketOverview} />
        </TabsContent>
        <TabsContent value="commodities">
          <CommoditiesTab data={commodityAnalysis} />
        </TabsContent>
        <TabsContent value="regions">
          <RegionsTab data={regionalAnalysis} />
        </TabsContent>
        <TabsContent value="predictions">
          <PredictionsTab data={marketPredictions} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const TAB_DEFS = [
  { id: "overview", label: "Overview", icon: LineChartIcon },
  { id: "commodities", label: "Commodities", icon: ShoppingBagIcon },
  { id: "regions", label: "Regional Analysis", icon: Globe2Icon },
  { id: "predictions", label: "Market Predictions", icon: BarChart2Icon },
] as const;

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

/**
 * -700/-300 rather than -500/-600: these read on `bg-card`, where green-500 is
 * 2.3:1 and red-500 3.8:1. The pairs below clear AA in both themes.
 */
const changeToneClass = (change: string): string => {
  if (change.startsWith("+")) return "text-green-700 dark:text-green-400";
  if (change.startsWith("-")) return "text-red-700 dark:text-red-400";
  return "text-muted-foreground";
};

const outlookToneClass = (outlook: string): string => {
  if (outlook === "positive") return "text-green-700 dark:text-green-400 capitalize";
  if (outlook === "negative") return "text-red-700 dark:text-red-400 capitalize";
  return "text-muted-foreground capitalize";
};

/** Shares the severity tokens the tariff table's rate bands use. */
const severityClass = (impact: string): string => {
  if (impact === "high") return "bg-severity-high text-severity-high-foreground";
  if (impact === "medium") return "bg-severity-medium text-severity-medium-foreground";
  return "bg-severity-low text-severity-low-foreground";
};

const CommoditiesTab = ({ data }: { data: CommodityAnalysis[] }) => {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Detailed analysis of tariff impacts across major global commodities, highlighting rate
        changes, market reactions, and future projections.
      </p>
      {/*
        Every surface and rule in this table used to be a literal: `bg-white`,
        `border-gray-200`, `bg-gray-50` and `divide-gray-200` with no dark
        counterpart, so in dark mode the header and rules stayed light. It sits
        inside a dialog, which is why the light-mode audit never reached it.
        The Table primitive supplies the rules and the row hover from tokens.
      */}
      <div className="rounded-lg overflow-hidden ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              {["Commodity", "Current Rate", "YoY Change", "Market Impact", "Outlook"].map(
                (heading) => (
                  <TableHead
                    key={heading}
                    scope="col"
                    className="h-auto px-3 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                  >
                    {heading}
                  </TableHead>
                )
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                {/* px-3, not the px-6 this carried while it lived in a
                    full-width page: five columns at 48px of horizontal padding
                    each overflowed the dialog and clipped the Outlook column
                    behind a scrollbar. The commodity name wraps for the same
                    reason, since one of them is 49 characters. */}
                <TableCell className="px-3 py-3 font-medium whitespace-normal">
                  {item.name}
                </TableCell>
                <TableCell className="px-3 py-3">{item.rate}</TableCell>
                <TableCell className="px-3 py-3">
                  <span className={changeToneClass(item.change)}>{item.change}</span>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Badge className={`rounded-md capitalize ${severityClass(item.impact)}`}>
                    {item.impact}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-3">
                  <span className={outlookToneClass(item.outlook)}>{item.outlook}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
                  <Badge key={sectorIndex} className={theme.tag}>
                    {sector}
                  </Badge>
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
      <div className="p-5 rounded-lg bg-linear-to-br from-blue-100 to-purple-50 border border-blue-200 dark:from-blue-900/20 dark:to-purple-900/20 dark:border-blue-900/20">
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
    card: "bg-linear-to-br from-blue-100 to-blue-50 border border-blue-200 dark:from-blue-900/20 dark:to-blue-900/20 dark:border-blue-900/20",
    chip: "bg-blue-100 dark:bg-blue-900/50",
    icon: "text-blue-600 dark:text-blue-300",
    title: "text-blue-700 dark:text-blue-300",
    tag: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  "Asia-Pacific": {
    card: "bg-linear-to-br from-red-100 to-red-50 border border-red-200 dark:from-red-900/20 dark:to-red-900/20 dark:border-red-900/20",
    chip: "bg-red-100 dark:bg-red-900/50",
    icon: "text-red-600 dark:text-red-300",
    title: "text-red-700 dark:text-red-300",
    tag: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  Europe: {
    card: "bg-linear-to-br from-indigo-100 to-indigo-50 border border-indigo-200 dark:from-indigo-900/20 dark:to-indigo-900/20 dark:border-indigo-900/20",
    chip: "bg-indigo-100 dark:bg-indigo-900/50",
    icon: "text-indigo-600 dark:text-indigo-300",
    title: "text-indigo-700 dark:text-indigo-300",
    tag: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  "Latin America": {
    card: "bg-linear-to-br from-amber-100 to-amber-50 border border-amber-200 dark:from-amber-900/20 dark:to-amber-900/20 dark:border-amber-900/20",
    chip: "bg-amber-100 dark:bg-amber-900/50",
    icon: "text-amber-600 dark:text-amber-300",
    title: "text-amber-700 dark:text-amber-300",
    tag: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  Other: {
    card: "bg-linear-to-br from-teal-100 to-teal-50 border border-teal-200 dark:from-teal-900/20 dark:to-teal-900/20 dark:border-teal-900/20",
    chip: "bg-teal-100 dark:bg-teal-900/50",
    icon: "text-teal-600 dark:text-teal-300",
    title: "text-teal-700 dark:text-teal-300",
    tag: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
  Global: {
    card: "bg-linear-to-br from-slate-100 to-slate-50 border border-slate-200 dark:from-slate-900/20 dark:to-slate-900/20 dark:border-slate-900/20",
    chip: "bg-slate-100 dark:bg-slate-900/50",
    icon: "text-slate-600 dark:text-slate-300",
    title: "text-slate-700 dark:text-slate-300",
    tag: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  },
};

const getRegionTheme = (region: string): RegionTheme =>
  REGION_THEMES[region] ?? REGION_THEMES.Global;
