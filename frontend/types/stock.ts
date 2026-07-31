/** A flat day is neither a tariff win nor a loss, so it gets its own state. */
export type StockDirection = "positive" | "negative" | "neutral";

export interface StockData {
  symbol: string;
  name: string;
  impact: StockDirection;
  percentage: number;
  reason: string;
  sector: string;
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
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  marketCap: number | null;
}
