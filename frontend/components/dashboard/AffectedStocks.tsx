import React, { useState, useEffect, useCallback, useContext } from "react";
import { ChevronLeftIcon, ChevronRightIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import styles from "./AffectedStocks.module.css";
import { StockData } from "../../types/stock";
import { ThemeContext } from "../../App"; // Import ThemeContext

// List of stock symbols we want to track
const TRACKED_SYMBOLS = [
  "X",
  "NUE",
  "STLD",
  "CLF",
  "TSLA",
  "AAPL",
  "GM",
  "INTC",
  "CAT",
  "BA",
  "SMH",
  "XME",
  "F", // Ford
  "MU", // Micron
  "JD", // JD.com
  "NIO", // NIO Inc
  "BABA", // Alibaba
  "TM", // Toyota
  "CRSR", // Corsair Gaming
  "HPQ", // HP Inc
];

// Add company full names for display
const COMPANY_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  AMZN: "Amazon.com, Inc.",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla, Inc.",
  GOOG: "Alphabet Inc.",
  META: "Meta Platforms, Inc.",
  WMT: "Walmart Inc.",
  BA: "Boeing Company",
  X: "United States Steel Corporation",
  XME: "SPDR Metals & Mining ETF",
  GM: "General Motors Company",
  F: "Ford Motor Company",
  NUE: "Nucor Corporation",
  CLF: "Cleveland-Cliffs Inc.",
  CAT: "Caterpillar Inc.",
  DE: "Deere & Company",
  FCX: "Freeport-McMoRan Inc.",
  AA: "Alcoa Corporation",
  STLD: "Steel Dynamics, Inc.",
  MU: "Micron Technology, Inc.",
  JD: "JD.com, Inc.",
  NIO: "NIO Inc.",
  BABA: "Alibaba Group Holding",
  TM: "Toyota Motor Corporation",
  CRSR: "Corsair Gaming, Inc.",
  HPQ: "HP Inc.",
};

// Mapping of impact reasons based on sector/symbol
const IMPACT_REASONS: { [key: string]: { positive: string; negative: string } } = {
  X: {
    positive: "Benefiting from steel tariffs and domestic market protection",
    negative: "Market concerns over tariff effectiveness",
  },
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
  X: "Steel Manufacturing",
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
const CardContent: React.FC<{ stock: StockData; isDarkMode: boolean }> = ({
  stock,
  isDarkMode,
}) => {
  // Format market cap as simply as possible: $22.5M or $22.5B for larger values
  const formatMarketCap = (marketCap: number) => {
    if (marketCap === 0) return "N/A";

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

  return (
    <div className={`p-6 h-full flex flex-col ${isDarkMode ? "text-white" : "text-gray-900"}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-2xl font-bold text-white">{stock.symbol}</h3>
          <p className="text-gray-400 text-sm">{COMPANY_NAMES[stock.symbol] || stock.name}</p>
        </div>
        {stock.impact === "positive" ? (
          <TrendingUpIcon className="h-6 w-6 text-green-400" />
        ) : (
          <TrendingDownIcon className="h-6 w-6 text-red-400" />
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center">
          <span
            className={`text-4xl font-bold ${
              stock.impact === "positive" ? "text-green-400" : "text-red-400"
            }`}
          >
            {stock.impact === "positive" ? "+" : "-"}
            {stock.percentage.toFixed(2)}%
          </span>
        </div>
        <p className="text-gray-400 mt-2 text-sm">
          ${stock.price.toFixed(2)} • Mkt Cap: {formatMarketCap(stock.marketCap)}
        </p>
      </div>

      <div className="mt-auto">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h4 className="text-gray-300 font-semibold mb-2">Impact Reason</h4>
          <p className="text-gray-400 text-sm">{stock.reason}</p>
        </div>

        <div className="mt-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-400/10 text-indigo-400">
            {stock.sector}
          </span>
        </div>
      </div>
    </div>
  );
};

// Add SkeletonCard component for loading state
const SkeletonCard: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  return (
    <div
      className={`h-96 rounded-xl overflow-hidden animate-pulse ${
        isDarkMode
          ? "bg-gradient-to-r from-gray-700/50 to-gray-800/50"
          : "bg-gradient-to-r from-gray-200 to-gray-300"
      }`}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="h-8 w-16 bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-32 bg-gray-700 rounded"></div>
          </div>
          <div className="h-6 w-6 bg-gray-700 rounded"></div>
        </div>

        <div className="mt-6">
          <div className="h-10 w-24 bg-gray-700 rounded mb-2"></div>
          <div className="h-4 w-40 bg-gray-700 rounded"></div>
        </div>

        <div className="mt-auto">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="h-4 w-24 bg-gray-700 rounded mb-3"></div>
            <div className="h-4 w-full bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-3/4 bg-gray-700 rounded"></div>
          </div>

          <div className="mt-4">
            <div className="h-5 w-24 bg-gray-700 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Rename the CSS animation variable to avoid conflict
const scrollAnimationStyles = `
@keyframes scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
`;

// Inject styles into the document
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = scrollAnimationStyles;
document.head.appendChild(styleSheet);

export const AffectedStocks: React.FC = () => {
  const { isDarkMode } = useContext(ThemeContext); // Get dark mode status
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Add Mobile Detection State & Effect ---
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // --- Keep original fetchStockData and related useEffect ---
  const fetchStockData = useCallback(async () => {
    console.log("[AffectedStocks] Starting fetchStockData...");
    setIsLoading(true); // Set loading true at the start
    try {
      setError(null);

      const fetchPromises = TRACKED_SYMBOLS.map(async (symbol) => {
        try {
          // Get basic quote data
          console.log(`[AffectedStocks] Fetching quote for ${symbol}`);
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${
              import.meta.env.VITE_FINNHUB_API_KEY
            }`
          );

          if (!response.ok) {
            console.error(
              `[AffectedStocks] Failed quote fetch for ${symbol}: Status ${response.status}`
            );
            throw new Error(`Failed to fetch ${symbol} quote`);
          }

          const data = await response.json();
          console.log(`[AffectedStocks] Quote data for ${symbol}:`, data);

          // Check if we have valid data
          if (!data || typeof data.c !== "number") {
            console.warn(`[AffectedStocks] No valid quote data for ${symbol}`);
            return null; // Skip this symbol if quote data is invalid
          }

          // Get company profile for market cap
          console.log(`[AffectedStocks] Fetching profile for ${symbol}`);
          const profileResponse = await fetch(
            `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${
              import.meta.env.VITE_FINNHUB_API_KEY
            }`
          );

          let marketCap = 0;
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            marketCap = profileData.marketCapitalization || 0;
            console.log(`[AffectedStocks] Profile data for ${symbol}: Market Cap ${marketCap}`);
          } else {
            console.warn(
              `[AffectedStocks] Failed profile fetch for ${symbol}: Status ${profileResponse.status}. Estimating market cap.`
            );
            // Estimate market cap if not available (in millions to match API format)
            const estimatedShares = {
              AAPL: 16000, // 16B shares, but in millions
              TSLA: 3200, // 3.2B shares, but in millions
              GM: 1400, // 1.4B shares, but in millions
              BA: 600, // 600M shares, but in millions
              X: 230, // 230M shares, but in millions
              NUE: 250, // 250M shares, but in millions
              CLF: 500, // 500M shares, but in millions
              STLD: 200, // 200M shares, but in millions
              XME: 50, // 50M shares (ETF), but in millions
              INTC: 4200, // 4.2B shares, but in millions
              CAT: 520, // 520M shares, but in millions
              SMH: 150, // 150M shares (ETF), but in millions
              F: 4000, // 4B shares, but in millions
              MU: 1100, // 1.1B shares, but in millions
              JD: 1600, // 1.6B shares, but in millions
              NIO: 1700, // 1.7B shares, but in millions
              BABA: 2600, // 2.6B shares, but in millions
              TM: 1400, // 1.4B shares, but in millions
              CRSR: 100, // 100M shares, but in millions
              HPQ: 990, // 990M shares, but in millions
            };

            // If we have an estimated number of shares, calculate market cap
            if (estimatedShares[symbol as keyof typeof estimatedShares]) {
              // Calculate in millions directly
              marketCap =
                (data.c * estimatedShares[symbol as keyof typeof estimatedShares]) / 1000000;
            }
          }

          const currentPrice = data.c;
          const previousClose = data.pc;
          const change = currentPrice - previousClose;
          const changePercent = (change / previousClose) * 100;

          return {
            symbol,
            name: COMPANY_NAMES[symbol] || symbol,
            impact: change >= 0 ? "positive" : "negative",
            percentage: Math.abs(changePercent),
            reason:
              IMPACT_REASONS[symbol]?.[change >= 0 ? "positive" : "negative"] ||
              "Market reaction to tariffs",
            sector: SECTORS[symbol] || "N/A",
            price: currentPrice,
            change: change,
            changePercent: changePercent,
            volume: data.v || 0,
            marketCap: marketCap,
            previousClose: previousClose,
            dayHigh: data.h,
            dayLow: data.l,
            tradeCount: data.t,
          };
        } catch (symbolError) {
          console.error(`[AffectedStocks] Error fetching data for symbol ${symbol}:`, symbolError);
          return null; // Return null if fetching for a specific symbol fails
        }
      });

      const results = (await Promise.all(fetchPromises)).filter(
        (result): result is NonNullable<typeof result> => result !== null
      );

      console.log("[AffectedStocks] Filtered API results:", results);

      if (results.length === 0) {
        console.warn("[AffectedStocks] No valid stock data retrieved after filtering.");
        // Don't throw an error here, let the component render the "No data" message
      }

      // --- Data Processing ---
      const processedData: StockData[] = results.map((apiData) => {
        const {
          symbol,
          name,
          impact,
          reason,
          sector,
          price,
          change,
          changePercent,
          volume,
          marketCap,
          previousClose,
          dayHigh,
          dayLow,
          tradeCount,
        } = apiData;

        // Ensure percentage is a valid number, default to 0 if calculation fails
        const safePercentage =
          typeof changePercent === "number" && isFinite(changePercent)
            ? Math.abs(changePercent)
            : 0;

        // Ensure impact is strictly positive or negative based on changePercent
        const safeImpact: "positive" | "negative" =
          typeof changePercent === "number" && changePercent >= 0 ? "positive" : "negative";

        return {
          symbol: symbol || "N/A",
          name: name || symbol || "Unknown",
          impact: safeImpact, // Use the strictly typed impact
          percentage: safePercentage,
          reason: reason || "N/A",
          sector: sector || "N/A",
          price: typeof price === "number" ? price : 0,
          change: typeof change === "number" ? change : 0,
          changePercent: typeof changePercent === "number" ? changePercent : 0,
          volume: typeof volume === "number" ? volume : 0,
          marketCap: typeof marketCap === "number" ? marketCap : 0,
          previousClose: typeof previousClose === "number" ? previousClose : 0,
          dayHigh: typeof dayHigh === "number" ? dayHigh : 0,
          dayLow: typeof dayLow === "number" ? dayLow : 0,
          tradeCount: typeof tradeCount === "number" ? tradeCount : 0,
        };
      });
      // --- End Data Processing ---

      // --- Deduplication Step ---
      const uniqueSymbols = new Set<string>();
      const uniqueProcessedData = processedData.filter((stock) => {
        // Ensure stock and stock.symbol exist before checking the Set
        if (stock && stock.symbol && !uniqueSymbols.has(stock.symbol)) {
          uniqueSymbols.add(stock.symbol);
          return true;
        }
        return false;
      });
      // --- End Deduplication Step ---

      console.log("[AffectedStocks] Setting stock data state with:", uniqueProcessedData);
      setStockData(uniqueProcessedData);
    } catch (err) {
      console.error("[AffectedStocks] Global fetch error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during data fetch");
    } finally {
      console.log("[AffectedStocks] Setting isLoading to false.");
      setIsLoading(false); // Ensure loading is set to false in finally block
    }
  }, []); // Removed isLoading from dependency array as it causes loops

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // --- Keep original filteredData logic ---
  const filteredData = stockData.filter((stock) => stock.price > 0 && stock.reason);

  // --- Keep original duplicatedStockData logic IF NEEDED for desktop marquee ---
  const duplicatedStockData = [...filteredData, ...filteredData];

  // --- Keep original handleCardClick ---
  const handleCardClick = (symbol: string) => {
    window.open(`https://finance.yahoo.com/quote/${symbol}`, "_blank");
  };

  // --- Keep original Error handling return ---
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {[...Array(5)].map((_, index) => (
          <SkeletonCard key={index} isDarkMode={isDarkMode} />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center p-4">Error fetching stock data: {error}</p>;
  }

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No stock data available at this time.
      </div>
    );
  }

  return (
    <div className="relative">
      {isMobile ? (
        // --- Mobile Horizontal Scroll View ---
        <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
          {filteredData.map((stock) => (
            <div
              key={`mobile-${stock.symbol}`}
              onClick={() => handleCardClick(stock.symbol)}
              className={`rounded-xl overflow-hidden cursor-pointer w-72 flex-shrink-0 border ${
                isDarkMode ? "border-gray-600/50" : "shadow-md border-gray-200"
              }`}
              style={{
                background: isDarkMode
                  ? "linear-gradient(145deg, rgba(17, 24, 39, 0.95), rgba(88, 28, 135, 0.8))"
                  : "linear-gradient(145deg, rgba(224, 231, 255, 0.9), rgba(237, 233, 254, 0.9))",
                backdropFilter: "blur(16px)",
              }}
            >
              <CardContent stock={stock} isDarkMode={isDarkMode} /> {/* Pass isDarkMode */}
            </div>
          ))}
          {!filteredData.length && (
            <div className="text-center p-4 text-gray-500 w-full flex-shrink-0">
              No stocks found.
            </div>
          )}
        </div>
      ) : (
        // --- Original Desktop Marquee/Layout ---
        // <<< PASTE YOUR ORIGINAL DESKTOP VIEW JSX HERE (Unchanged) >>>
        // <<< It should use CardContent and potentially duplicatedStockData >>>
        <div className="relative overflow-hidden">
          <div
            className={styles.cardContainer}
            style={{ animation: `${styles.scroll || "scroll"} 30s linear infinite` }}
            // Add hover pause/resume if needed
          >
            {duplicatedStockData.map((stock, index) => (
              <div
                key={`${stock.symbol}-${index}`}
                className={`${styles.card} h-96 rounded-xl overflow-hidden`} // Use desktop styles.card
                onClick={() => handleCardClick(stock.symbol)}
                style={{
                  background: isDarkMode
                    ? "linear-gradient(145deg, rgba(17, 24, 39, 0.95), rgba(88, 28, 135, 0.8))"
                    : "linear-gradient(145deg, rgba(224, 231, 255, 0.9), rgba(237, 233, 254, 0.9))", // Example light mode gradient
                  backdropFilter: "blur(16px)",
                }}
              >
                <CardContent stock={stock} isDarkMode={isDarkMode} /> {/* Pass isDarkMode */}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
