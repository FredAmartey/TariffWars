import React, { useState, useEffect, useCallback } from "react";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon, PauseIcon, PlayIcon } from "lucide-react";
import styles from "./AffectedStocks.module.css";
import { StockData, StockDirection } from "../../types/stock";
import { apiService } from "../../services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// The tracked symbol list lives on the backend (services/stockService.ts),
// which is also what bounds the symbols it will ask the provider about. These
// three tables are keyed off it, so an entry for a symbol the backend never
// requests can never render. They previously carried twelve such entries:
// MSFT, AMZN, NVDA, GOOG, META, WMT, DE, FCX and AA were never tracked at all,
// and X (US Steel) was dropped when it delisted.

// Add company full names for display
const COMPANY_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  TSLA: "Tesla, Inc.",
  BA: "Boeing Company",
  XME: "SPDR Metals & Mining ETF",
  GM: "General Motors Company",
  F: "Ford Motor Company",
  NUE: "Nucor Corporation",
  CLF: "Cleveland-Cliffs Inc.",
  CAT: "Caterpillar Inc.",
  STLD: "Steel Dynamics, Inc.",
  MU: "Micron Technology, Inc.",
  JD: "JD.com, Inc.",
  NIO: "NIO Inc.",
  BABA: "Alibaba Group Holding",
  TM: "Toyota Motor Corporation",
  CRSR: "Corsair Gaming, Inc.",
  HPQ: "HP Inc.",
  INTC: "Intel Corporation",
  SMH: "VanEck Semiconductor ETF",
};

// Mapping of impact reasons based on sector/symbol
const IMPACT_REASONS: { [key: string]: { positive: string; negative: string } } = {
  NUE: {
    positive: "Strong domestic steel demand and trade protection",
    negative: "Rising raw material costs impacting margins",
  },
  STLD: {
    positive: "Higher domestic steel prices boosting revenue",
    negative: "Increased competition in steel market",
  },
  CLF: {
    positive: "Strong steel demand and pricing power",
    negative: "Cost pressures from raw materials",
  },
  TSLA: {
    positive: "Successfully managing supply chain challenges",
    negative: "Battery & parts cost increases affecting margins",
  },
  AAPL: {
    positive: "Supply chain resilience and strong demand",
    negative: "Supply chain disruptions impacting production",
  },
  GM: {
    positive: "Strong pricing power offsetting costs",
    negative: "Raw material cost increases affecting margins",
  },
  INTC: {
    positive: "Benefiting from domestic chip investment",
    negative: "Semiconductor trade restrictions impact",
  },
  CAT: {
    positive: "Strong infrastructure demand",
    negative: "Steel cost increases affecting margins",
  },
  BA: {
    positive: "Strong order book and deliveries",
    negative: "Aluminum costs and trade tensions impact",
  },
  SMH: {
    positive: "Semiconductor sector showing strength",
    negative: "Chip trade restrictions affecting outlook",
  },
  XME: {
    positive: "Metal tariffs boosting sector performance",
    negative: "Concerns over tariff effectiveness",
  },
  F: {
    positive: "Domestic market strength offsetting tariff costs",
    negative: "Component cost increases affecting vehicle margins",
  },
  MU: {
    positive: "Memory chip demand outpacing tariff costs",
    negative: "Semiconductor tariffs impacting production costs",
  },
  JD: {
    positive: "Domestic China growth offsetting US trade tensions",
    negative: "Chinese export tariffs severely limiting growth",
  },
  NIO: {
    positive: "Battery technology advances improving margins",
    negative: "US-China trade tensions affecting global expansion",
  },
  BABA: {
    positive: "Strong domestic market insulating from tariffs",
    negative: "US-China trade war restricting global market access",
  },
  TM: {
    positive: "Global production limiting tariff exposure",
    negative: "Vehicle and parts tariffs impacting profit margins",
  },
  CRSR: {
    positive: "Gaming demand offsetting component costs",
    negative: "Component tariffs severely impacting electronics margins",
  },
  HPQ: {
    positive: "Enterprise demand providing stable income",
    negative: "Component tariffs dramatically increasing production costs",
  },
};

// Mapping of sectors for symbols
const SECTORS: { [key: string]: string } = {
  NUE: "Steel Production",
  STLD: "Steel Manufacturing",
  CLF: "Mining & Steel",
  TSLA: "Automotive",
  AAPL: "Technology",
  GM: "Automotive",
  INTC: "Technology",
  CAT: "Industrial Machinery",
  BA: "Aerospace",
  SMH: "Semiconductor ETF",
  XME: "Mining ETF",
  F: "Automotive",
  MU: "Semiconductor",
  JD: "E-commerce",
  NIO: "Electric Vehicles",
  BABA: "E-commerce",
  TM: "Automotive",
  CRSR: "Computer Hardware",
  HPQ: "Computer Hardware",
};

// Helper sub-component for card content
const CardContent: React.FC<{ stock: StockData }> = ({ stock }) => {
  // Format market cap as simply as possible: $22.5M or $22.5B for larger values
  const formatMarketCap = (marketCap: number | null) => {
    // Null means the provider had no profile for this symbol. It used to be
    // filled with a locally estimated figure that was a million times too small.
    if (marketCap === null || marketCap === 0) return "N/A";

    // For values over 1000M, convert to billions
    if (marketCap >= 1000) {
      const inBillions = marketCap / 1000;
      // Round to 1 decimal place
      const rounded = Math.round(inBillions * 10) / 10;
      return `$${rounded.toFixed(1)}B`;
    } else {
      // Round to 1 decimal place
      const rounded = Math.round(marketCap * 10) / 10;
      return `$${rounded.toFixed(1)}M`;
    }
  };

  // Light mode used to inherit the dark card's fixed white/gray-400 text, which
  // sat on a pale lavender gradient at roughly 1.3:1 contrast.
  const headingColor = "text-foreground";
  const mutedColor = "text-muted-foreground";

  return (
    <div className="p-6 h-full flex flex-col text-foreground">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className={`text-2xl font-bold ${headingColor}`}>{stock.symbol}</h3>
          <p className={`${mutedColor} text-sm`}>{COMPANY_NAMES[stock.symbol] || stock.name}</p>
        </div>
        {stock.impact === "positive" ? (
          <TrendingUpIcon className="h-6 w-6 text-green-400" aria-hidden="true" />
        ) : stock.impact === "negative" ? (
          <TrendingDownIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
        ) : (
          <MinusIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center">
          <span
            className={`text-4xl font-bold ${
              stock.impact === "positive"
                ? "text-green-700 dark:text-green-400"
                : stock.impact === "negative"
                ? "text-red-700 dark:text-red-400"
                : mutedColor
            }`}
          >
            {stock.impact === "positive" ? "+" : stock.impact === "negative" ? "-" : ""}
            {stock.percentage.toFixed(2)}%
          </span>
        </div>
        <p className={`${mutedColor} mt-2 text-sm`}>
          ${stock.price.toFixed(2)} • Mkt Cap: {formatMarketCap(stock.marketCap)}
        </p>
      </div>

      <div className="mt-auto">
        <div className="rounded-lg p-4 bg-card/50">
          {/* The copy below is a fixed narrative keyed off the day's price
              direction, not measured tariff exposure. Label it honestly. */}
          <h4 className="font-semibold mb-2 text-muted-foreground">Possible tariff angle</h4>
          <p className={`${mutedColor} text-sm`}>{stock.reason}</p>
        </div>

        <div className="mt-4">
          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-400/10 dark:text-indigo-300">
            {stock.sector}
          </Badge>
        </div>
      </div>
    </div>
  );
};

// Add SkeletonCard component for loading state
const SkeletonCard: React.FC = () => {
  return (
    // The card itself already switched with the theme; every bar inside it was
    // a fixed gray-700 and the inner panel a fixed gray-800/50, so the light
    // theme rendered a pale card filled with near-black slabs. A translucent
    // tint of `--foreground` inverts with the theme on its own.
    <div className="h-96 rounded-xl overflow-hidden animate-pulse bg-linear-to-r from-gray-200 to-gray-300 dark:from-gray-700/50 dark:to-gray-800/50">
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Skeleton className="h-8 w-16 rounded-sm bg-foreground/15 mb-2" />
            <Skeleton className="h-4 w-32 rounded-sm bg-foreground/10" />
          </div>
          <Skeleton className="h-6 w-6 rounded-sm bg-foreground/10" />
        </div>

        <div className="mt-6">
          <Skeleton className="h-10 w-24 rounded-sm bg-foreground/15 mb-2" />
          <Skeleton className="h-4 w-40 rounded-sm bg-foreground/10" />
        </div>

        <div className="mt-auto">
          <div className="bg-foreground/5 rounded-lg p-4">
            <Skeleton className="h-4 w-24 rounded-sm bg-foreground/10 mb-3" />
            <Skeleton className="h-4 w-full rounded-sm bg-foreground/10 mb-2" />
            <Skeleton className="h-4 w-3/4 rounded-sm bg-foreground/10" />
          </div>

          <div className="mt-4">
            <Skeleton className="h-5 w-24 rounded-full bg-foreground/10" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Whether the reader has asked the OS to cut down on motion.
 *
 * The panel's default presentation is a track that scrolls for as long as the
 * page is open, which is exactly what this setting exists to switch off.
 */
const usePrefersReducedMotion = (): boolean => {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefers(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return prefers;
};

export const AffectedStocks: React.FC = () => {
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // When the oldest quote on screen was captured. Held-over prices during a
  // provider hiccup are labelled rather than shown as live. This is an absolute
  // instant so it stays accurate however long the response sat in a CDN.
  const [capturedAt, setCapturedAt] = useState<string | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();
  const [isPaused, setIsPaused] = useState(false);

  // --- Add Mobile Detection State & Effect ---
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Quotes come from our own backend, which holds the Finnhub credential and
  // caches upstream calls. Fetching them here in the browser meant shipping the
  // key in the bundle and firing 40 requests per page load.
  const fetchStockData = useCallback(async () => {
    setIsLoading(true);
    try {
      setError(null);
      const { quotes, capturedAt } = await apiService.getStockQuotes();
      setCapturedAt(capturedAt);

      const seen = new Set<string>();
      const processed: StockData[] = quotes
        .filter((q) => {
          if (!q.symbol || seen.has(q.symbol)) return false;
          seen.add(q.symbol);
          return true;
        })
        .map((q) => {
          const changePercent = isFinite(q.changePercent) ? q.changePercent : 0;
          // A flat day is neither a tariff win nor a loss; keeping it out of the
          // positive/negative split stops "+0.00%" being narrated as good news.
          const direction: StockDirection =
            changePercent > 0 ? "positive" : changePercent < 0 ? "negative" : "neutral";

          return {
            symbol: q.symbol,
            name: COMPANY_NAMES[q.symbol] || q.symbol,
            impact: direction,
            percentage: Math.abs(changePercent),
            reason:
              direction === "neutral"
                ? "No movement today"
                : IMPACT_REASONS[q.symbol]?.[direction] || "Market reaction to tariffs",
            sector: SECTORS[q.symbol] || "N/A",
            price: q.price,
            change: q.change,
            changePercent,
            marketCap: q.marketCap,
            previousClose: q.previousClose,
            dayHigh: q.dayHigh,
            dayLow: q.dayLow,
          };
        });

      setStockData(processed);
    } catch (err) {
      // Every symbol failing used to collapse to an empty list, which rendered
      // as "no stock data available" and hid the outage.
      console.error("[AffectedStocks] Fetch failed:", err);
      setError(err instanceof Error ? err.message : "Could not load market data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // Re-fetch on the same cadence as the server's snapshot TTL: an open page
  // then picks up new prices by itself, and the staleness notice appears
  // without waiting for an unrelated render.
  useEffect(() => {
    const id = setInterval(fetchStockData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchStockData]);

  // A lighter tick so the "as of N minutes ago" line keeps counting up between
  // fetches, including while the provider is down and no fetch succeeds.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // --- Keep original filteredData logic ---
  const filteredData = stockData.filter((stock) => stock.price > 0 && stock.reason);

  // The track is rendered twice so the loop has no visible seam. Pointless when
  // nothing is scrolling, and it would double every card in the static list.
  const animate = !isMobile && !prefersReducedMotion;
  const trackData = animate ? [...filteredData, ...filteredData] : filteredData;

  const quoteUrl = (symbol: string) => `https://finance.yahoo.com/quote/${symbol}`;

  // --- Keep original Error handling return ---
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {[...Array(5)].map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center p-4">Error fetching stock data: {error}</p>;
  }

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No stock data available at this time.
      </div>
    );
  }

  // The service holds a snapshot over a brief provider hiccup rather than
  // blanking the panel. Say so once it is no longer fresh, so held-over prices
  // are never read as live. Anything older than the service's ceiling is not
  // served at all.
  // Date.now() is only read during a render, and nothing here re-renders on a
  // schedule, so a page left open would keep showing prices as current however
  // old they got. This tick makes the age advance on its own.
  const capturedMs = capturedAt ? Date.parse(capturedAt) : NaN;
  const ageMs = Number.isNaN(capturedMs) ? null : Date.now() - capturedMs;
  const staleMinutes = ageMs !== null && ageMs > 5 * 60 * 1000 ? Math.round(ageMs / 60000) : null;

  return (
    <div className="relative">
      {staleMinutes !== null && (
        <p className="mb-2 text-xs text-amber-500" role="status">
          Prices as of {staleMinutes} minute{staleMinutes === 1 ? "" : "s"} ago; the market data
          provider is not responding.
        </p>
      )}

      {animate && (
        // Hover and keyboard focus already pause the track in CSS, but neither
        // helps a touch user or anyone who simply wants it to stop, so the
        // control is explicit as well.
        <div className="flex justify-end mb-2">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setIsPaused((paused) => !paused)}
            aria-pressed={isPaused}
            className="text-muted-foreground"
          >
            {isPaused ? (
              <PlayIcon aria-hidden="true" />
            ) : (
              <PauseIcon aria-hidden="true" />
            )}
            {isPaused ? "Resume scrolling" : "Pause scrolling"}
          </Button>
        </div>
      )}

      <div className={animate ? "relative overflow-hidden" : "relative overflow-x-auto pb-4"}>
        <div
          className={`${styles.cardContainer} ${animate ? styles.marquee : ""}`}
          data-paused={animate && isPaused ? "true" : undefined}
        >
          {trackData.map((stock, index) => {
            // The animated track renders the list twice for a seamless loop, so
            // the second copy is hidden from assistive tech and skipped by Tab
            // to avoid announcing every stock again.
            const isDuplicate = animate && index >= filteredData.length;
            return (
              <a
                key={`${stock.symbol}-${index}`}
                href={quoteUrl(stock.symbol)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${stock.name} (${stock.symbol}) on Yahoo Finance`}
                aria-hidden={isDuplicate}
                tabIndex={isDuplicate ? -1 : undefined}
                className={`${styles.card} h-96 rounded-xl overflow-hidden block border border-border shadow-md dark:shadow-none`}
                style={{ background: "var(--stock-card-gradient)", backdropFilter: "blur(16px)" }}
              >
                <CardContent stock={stock} />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};
