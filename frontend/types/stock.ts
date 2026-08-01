/** A flat day is neither a tariff win nor a loss, so it gets its own state. */
export type StockDirection = "positive" | "negative" | "neutral";

/** The duty currently charged on a company's industry. Never fabricated. */
export interface TariffExposure {
  commodity: string;
  rate: number;
  rateDisplay: string;
  status: string;
  effectiveDate: string;
}

export interface StockData {
  symbol: string;
  name: string;
  impact: StockDirection;
  percentage: number;
  /**
   * Replaced `reason` and `sector`, which were two hardcoded 19-entry maps in
   * the component. `reason` in particular held two pre-written sentences per
   * ticker and picked between them by the day's price direction, so the same
   * company under the same tariffs read "supply chain resilience" when it
   * closed up and "supply chain disruptions" when it closed down.
   */
  industry: string | null;
  exposure: TariffExposure;
  price: number;
  change: number;
  changePercent: number;
  /** Millions of USD. Null when the provider has no profile for the symbol. */
  marketCap: number | null;
  previousClose?: number;
  dayHigh?: number;
  dayLow?: number;
  // `volume`, `tradeCount` and `index` used to sit here. Finnhub's quote
  // endpoint returns none of them, so the mapper filled the first two with a
  // literal 0 and nothing ever read any of the three.
}

/** Shape returned by our own /api/stocks/quotes proxy. */
export interface StockQuote {
  symbol: string;
  /** From the provider's company profile, not a local table. */
  name: string | null;
  industry: string | null;
  /** Why this symbol is on the panel at all. The API omits unexposed symbols. */
  exposure: TariffExposure;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  marketCap: number | null;
}
