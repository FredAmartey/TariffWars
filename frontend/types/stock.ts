export interface StockData {
  symbol: string;
  name: string;
  impact: "positive" | "negative";
  percentage: number;
  reason: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  previousClose?: number;
  dayHigh?: number;
  dayLow?: number;
  tradeCount?: number; // Number of trades
  index?: number;
}

export interface YahooFinanceQuote {
  symbol: string;
  shortName: string;
  longName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap: number;
  sector?: string;
}
