import fs from "fs";
import path from "path";
import { TariffService } from "./tariffService";
import { NewsService } from "./newsService";
import OpenAI from "openai";
import { config } from "../config";
import { TariffEntry } from "../types/tariff";

export interface MarketOverview {
  averageTariffRate: number;
  /**
   * Percentage points against a recorded snapshot, or null when history does
   * not reach back far enough. This used to be whatever number the model felt
   * like returning: it reported -5.2 while the measured change was -22.7.
   */
  yearOverYearChange: number | null;
  yearOverYearComparedTo: string | null;
  /** Read off the CSV, not estimated by the model. */
  highRiskSectors: Array<{
    name: string;
    tariffIncrease: number;
    impact: string;
  }>;
  growthOpportunities: Array<{
    name: string;
    tariffReduction: number;
    impact: string;
  }>;
  manufacturingImpact: string;
  supplyChainShifts: string;
  economicOutlook: string;
}

export interface CommodityAnalysis {
  name: string;
  rate: string;
  change: string;
  impact: "high" | "medium" | "low";
  outlook: "positive" | "negative" | "neutral";
}

export interface RegionalAnalysis {
  region: string;
  /** Averaged over active, rated rows in the region. */
  averageTariffRate: number;
  /** How many active tariffs the average is built from. */
  tariffCount: number;
  description: string;
  keySectors: string[];
}

export interface MarketPrediction {
  timeframe: "short-term" | "medium-term" | "long-term";
  predictions: string[];
  confidence: number;
}

// New interface for AI Insights
export interface AIInsight {
  type: "alert" | "positive" | "negative";
  text: string;
}

// Interface for Key Metrics data
export interface KeyMetrics {
  averageRate: number;
  activeTariffs: number;
  totalTariffs: number;
  threatenedTariffs: number;
  /** Change in the active average, in percentage points, against the closest
   *  recorded snapshot to a year ago. Null until history reaches back far
   *  enough — never a fabricated stand-in. */
  yoyChangePoints: number | null;
  /** Date of the snapshot the change was measured against (YYYY-MM-DD). */
  yoyComparedTo: string | null;
  summaryDescription: string;
  highestTariffRate: number | null;
  highestTariffCommodity: string;
  highestTariffCountries: string;
  highestTariffEffectiveDate: string;
  biggestIncreaseValue: number | null;
  biggestIncreaseCommodity: string;
  biggestIncreaseDescription: string;
  biggestDecreaseValue: number | null;
  biggestDecreaseCommodity: string;
  biggestDecreaseDescription: string;
}

export class MarketAnalysisService {
  private tariffService: TariffService;
  private newsService: NewsService;
  private openaiClient: OpenAI | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private inFlight: Map<string, Promise<any>> = new Map();
  private CACHE_TTL = 1000 * 60 * 60;
  /**
   * Floor on how often `refresh=true` may actually pay for a regeneration.
   * The refresh button is public and uncredentialed, so without this a script
   * could bill an unbounded number of completions by looping the endpoint.
   */
  private readonly MIN_REGENERATE_INTERVAL = 5 * 60 * 1000;

  constructor(tariffService: TariffService, newsService: NewsService) {
    this.tariffService = tariffService;
    this.newsService = newsService;
  }

  /**
   * Built on first use, not in the constructor. The routers are constructed at
   * startup, so an absent OPENAI_API_KEY used to throw there and take the
   * tariff and news endpoints down with it, even though neither uses OpenAI.
   */
  private get openai(): OpenAI {
    if (!this.openaiClient) {
      if (!config.openai.apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
      this.openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.openaiClient;
  }

  private async getCachedData<T>(
    key: string,
    fetchFn: () => Promise<T>,
    bypassCache = false
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (!bypassCache && cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`Using cached data for ${key}.`);
      return cached.data;
    }

    // A refresh that lands within the floor gets the cached answer instead of
    // a fresh bill.
    if (bypassCache && cached && Date.now() - cached.timestamp < this.MIN_REGENERATE_INTERVAL) {
      console.log(`Refresh for ${key} throttled; serving recent generation.`);
      return cached.data;
    }

    // The floor above only helps once something is cached. On a cold instance,
    // or the moment the floor lapses, concurrent refreshes would each start
    // their own paid completion before any of them stored a result. Everyone
    // waits on the first one instead.
    const pending = this.inFlight.get(key);
    if (pending) {
      console.log(`Joining in-flight generation for ${key}.`);
      return pending as Promise<T>;
    }

    console.log(bypassCache ? `Bypassing cache for ${key}.` : `Fetching fresh data for ${key}.`);

    const run = (async () => {
      try {
        const data = await fetchFn();
        this.cache.set(key, { data, timestamp: Date.now() });
        return data;
      } catch (error) {
        console.error(`Error fetching data for ${key}:`, error);
        if (cached) {
          console.log(`Returning cached data for ${key} due to error.`);
          return cached.data;
        }
        throw error;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, run);
    return run;
  }

  // The prompts used to hardcode "around April 2025", so the model narrated a
  // dataset that had moved on 15 months ahead of it — describing effective
  // dates already in the past as upcoming. Always tell it the real date.
  private currentPeriodLabel(): string {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  // Five prompts carried this grounding clause verbatim, so every change to the
  // status vocabulary had to land in five places or the panels would describe
  // the same dataset by different rules. One copy, spliced into each.
  private dataGrounding(): string {
    return `today is ${this.currentPeriodLabel()}. Every "Effective Date" at or before today is already in force or concluded, so describe it in past or present tense, never as upcoming. Honor each row's Status: a rate is only being collected when Status is Active. Proposed, Threatened and Under Investigation rates have NOT been imposed and must be described as proposed or threatened. Ended, Suspended and Withdrawn rates are not being collected, and a Withdrawn one never took effect at all, so never state it as a rate anyone paid. A rate that carries an exception in its name, such as a lower rate for one country, applies at the stated exception for that country, not the headline rate`;
  }

  private async generateWithOpenAI(prompt: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a market analysis expert specializing in global trade and tariffs. Provide detailed, accurate analysis based on the given data. Return ONLY raw JSON without any markdown formatting or additional text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("OpenAI returned empty content.");
      }
      const cleanedContent = content.replace(/^```json\\n?/, "").replace(/\\n?```$/, "");
      return cleanedContent;
    } catch (error) {
      console.error("Error generating content with OpenAI:", error);
      return "{}";
    }
  }

  /**
   * Parse a model response, falling back to a value of the right shape.
   *
   * `generateWithOpenAI` returns "{}" when the call fails, so endpoints typed
   * as arrays were handing the frontend an object and its `.map()` threw. The
   * fallback decides the expected shape, and anything that does not match it
   * is treated as a failed generation.
   */
  private parseJson<T>(raw: string, label: string, fallback: T): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error(`Failed to parse OpenAI response for ${label}:`, e);
      return fallback;
    }

    if (Array.isArray(fallback) !== Array.isArray(parsed) || parsed === null) {
      console.error(
        `OpenAI response for ${label} had the wrong shape (expected ${
          Array.isArray(fallback) ? "array" : "object"
        })`
      );
      return fallback;
    }

    return parsed as T;
  }

  // "N/A", "Restricted" and "Exempt" parse to 0, so averaging them in would
  // report a line with no rate as a 0% tariff and drag the headline down.
  private static readonly NON_NUMERIC_RATES = new Set([
    "N/A",
    "Restricted",
    "Exempt",
    "Banned",
    "-",
    "\u2013",
  ]);

  private carriesRate(t: TariffEntry): boolean {
    // Restricted/Banned parse to -1 and the placeholders to 0, so a negative
    // rate is always a sentinel rather than a real tariff.
    return (
      typeof t.rate === "number" &&
      t.rate >= 0 &&
      !MarketAnalysisService.NON_NUMERIC_RATES.has((t.rateDisplay ?? "").trim())
    );
  }

  /**
   * Change in the active average against the recorded snapshot closest to a
   * year ago, in percentage points. Returns null rather than inventing a
   * number when no snapshot is old enough to support the comparison.
   */
  private calculateYearOverYear(currentAverage: number): {
    yoyChangePoints: number | null;
    yoyComparedTo: string | null;
  } {
    const empty = { yoyChangePoints: null, yoyComparedTo: null };
    let history: Array<{ date: string; activeAverageRate: number }>;
    try {
      const raw = fs.readFileSync(path.resolve(__dirname, "../data/history.json"), "utf8");
      history = JSON.parse(raw);
      if (!Array.isArray(history)) return empty;
    } catch (error) {
      console.warn("No tariff history available for year-over-year comparison:", error);
      return empty;
    }

    const DAY = 86400000;
    const now = Date.now();
    const target = now - 365 * DAY;
    // A snapshot from last week cannot stand in for one from last year.
    const MIN_AGE_DAYS = 180;

    const usable = history
      .filter((r) => typeof r?.activeAverageRate === "number" && !Number.isNaN(Date.parse(r?.date)))
      .filter((r) => (now - Date.parse(r.date)) / DAY >= MIN_AGE_DAYS);
    if (usable.length === 0) return empty;

    const baseline = usable.reduce((best, r) =>
      Math.abs(Date.parse(r.date) - target) < Math.abs(Date.parse(best.date) - target) ? r : best
    );

    return {
      yoyChangePoints: +(currentAverage - baseline.activeAverageRate).toFixed(1),
      yoyComparedTo: baseline.date,
    };
  }

  private calculateAverageTariffRate(tariffs: TariffEntry[]): number {
    const rates = tariffs.map((t) => t.rate);
    if (rates.length === 0) return 0;
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }

  /**
   * The rows an average may be built from: in force, and carrying a number.
   *
   * Each caller used to spell this out for itself, and most of them got it
   * wrong. Averaging every row put a withdrawn 250% dairy threat and a
   * superseded 200% spirits rate into the headline, so the prompts were told
   * the average tariff was 44.6% while the dashboard beside them said 22.4%,
   * and the North America region reported 108.3%.
   */
  private collected(tariffs: TariffEntry[]): TariffEntry[] {
    return tariffs.filter((t) => t.status === "Active" && this.carriesRate(t));
  }

  /**
   * Sectors ranked by the size of their most recent rate move, taken straight
   * from the Change column of active rows.
   *
   * The model used to be asked to "estimate" these. It answered with ended
   * tariffs (fentanyl, struck down months ago) and invented figures for rows
   * whose rate is literally "N/A" (robotics, still under investigation).
   */
  private movesFromData(
    tariffs: TariffEntry[],
    direction: "increase" | "decrease"
  ): Array<{ name: string; points: number }> {
    return this.collected(tariffs)
      .map((t) => {
        const raw = (t.changeDisplay ?? "").trim();
        const match = raw.match(/^([+-])(\d+(?:\.\d+)?)%$/);
        if (!match) return null;
        const signed = match[1] === "-" ? -parseFloat(match[2]) : parseFloat(match[2]);
        return { name: t.commodity, points: signed };
      })
      .filter((m): m is { name: string; points: number } => m !== null)
      .filter((m) => (direction === "increase" ? m.points > 0 : m.points < 0))
      .sort((a, b) => (direction === "increase" ? b.points - a.points : a.points - b.points))
      .slice(0, 5)
      .map((m) => ({ name: m.name, points: Math.abs(m.points) }));
  }

  public clearCache(): void {
    console.log("Clearing market analysis cache...");
    this.cache.clear();
  }

  async getMarketOverview(): Promise<MarketOverview> {
    return this.getCachedData("marketOverview", async () => {
      const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 1000 });
      const news = await this.newsService.getTariffNews();

      // Active-only, matching the Key Metrics card and the copy that renders it.
      const collected = this.collected(tariffRates.data);
      const averageTariffRate = this.calculateAverageTariffRate(collected);
      const { yoyChangePoints, yoyComparedTo } = this.calculateYearOverYear(averageTariffRate);

      // Every number below is measured here. The model is asked for prose only,
      // so it can no longer put a figure on screen that nothing supports.
      const highRiskSectors = this.movesFromData(tariffRates.data, "increase").map((m) => ({
        name: m.name,
        tariffIncrease: m.points,
        impact: "high",
      }));
      const growthOpportunities = this.movesFromData(tariffRates.data, "decrease").map((m) => ({
        name: m.name,
        tariffReduction: m.points,
        impact: "positive",
      }));

      const prompt = `Based on the following tariff data and news articles, generate a market overview for the current period (${this.dataGrounding()}):

      Active tariffs in force: ${collected.length}, averaging ${averageTariffRate.toFixed(1)}%.
      ${
        yoyChangePoints === null
          ? "No year-over-year comparison is available."
          : `That average has moved ${yoyChangePoints} percentage points since ${yoyComparedTo}.`
      }

      Largest recent increases among tariffs in force:
      ${highRiskSectors.map((s) => `- ${s.name}: +${s.tariffIncrease}%`).join("\n") || "- none"}

      Largest recent reductions among tariffs in force:
      ${growthOpportunities.map((s) => `- ${s.name}: -${s.tariffReduction}%`).join("\n") || "- none"}

      Tariff Data Sample:
      ${JSON.stringify(collected.slice(0, 5), null, 2)}

      Recent News Sample:
      ${news
        .slice(0, 5)
        .map((article) => `- ${article.title}`)
        .join("\n")}

      Write three concise paragraphs. Use only the figures given above; do not
      introduce any rate, percentage or year-over-year number of your own.
      1. The impact on manufacturing.
      2. Supply chain shifts.
      3. The general economic outlook related to tariffs.

      Format the response STRICTLY as a JSON object matching this TypeScript interface, with NO additional text or markdown:
      interface ResponseFormat {
        manufacturingImpact: string;
        supplyChainShifts: string;
        economicOutlook: string;
      }`;

      const response = await this.generateWithOpenAI(prompt);
      const parsed = this.parseJson<Partial<MarketOverview>>(response, "MarketOverview", {});

      return {
        averageTariffRate,
        yearOverYearChange: yoyChangePoints,
        yearOverYearComparedTo: yoyComparedTo,
        highRiskSectors,
        growthOpportunities,
        manufacturingImpact:
          parsed.manufacturingImpact || "No manufacturing impact analysis available.",
        supplyChainShifts: parsed.supplyChainShifts || "No supply chain shift analysis available.",
        economicOutlook: parsed.economicOutlook || "No economic outlook analysis available.",
      };
    });
  }

  async getCommodityAnalysis(): Promise<CommodityAnalysis[]> {
    return this.getCachedData("commodityAnalysis", async () => {
      const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 1000 });

      const uniqueCommodities = Array.from(new Set(tariffRates.data.map((t) => t.commodity))).slice(
        0,
        10
      );
      const commodityDataSample = tariffRates.data.filter((t) =>
        uniqueCommodities.includes(t.commodity)
      );

      const prompt = `Based on the following tariff data sample for the current period (${this.dataGrounding()}), generate a detailed commodity analysis for 5-7 major commodities mentioned or implied:

      Tariff Data Sample:
      ${JSON.stringify(commodityDataSample.slice(0, 15), null, 2)}

      Please provide an analysis of major commodities including:
      - Current average tariff rate (string, e.g., "5.2%")
      - Approximate year-over-year change (string, e.g., "+1.5%", "-0.8%", "Stable")
      - Market impact ('high' | 'medium' | 'low')
      - Outlook ('positive' | 'negative' | 'neutral')

      Format the response STRICTLY as a JSON array of objects matching this TypeScript interface, with NO additional text or markdown:
      Array<{
        name: string,
        rate: string,
        change: string,
        impact: 'high' | 'medium' | 'low',
        outlook: 'positive' | 'negative' | 'neutral'
      }>`;

      const response = await this.generateWithOpenAI(prompt);
      return this.parseJson<CommodityAnalysis[]>(response, "CommodityAnalysis", []);
    });
  }

  async getRegionalAnalysis(): Promise<RegionalAnalysis[]> {
    return this.getCachedData("regionalAnalysis", async () => {
      const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 1000 });
      const news = await this.newsService.getTariffNews();

      // Only tariffs actually being collected. Averaging every row reported
      // North America at 108.3%, which was a withdrawn 250% dairy threat and a
      // proposed 50% duty averaged in with one real 25% surtax.
      const collected = this.collected(tariffRates.data);

      // "Global" is worldwide measures only; "Other" catches rows naming a
      // country outside the mapped regions. Empty buckets are dropped below.
      const regions = [
        "North America",
        "Europe",
        "Asia-Pacific",
        "Latin America",
        "Global",
        "Other",
      ];
      const regionalData = regions
        .map((region) => {
          const regionTariffs = collected.filter((t) => this.regionsFor(t).includes(region));
          return {
            region,
            avgRate: +this.calculateAverageTariffRate(regionTariffs).toFixed(2),
            count: regionTariffs.length,
            sectors: this.getKeySectors(regionTariffs),
          };
        })
        .filter((r) => r.count > 0);

      const prompt = `Based on the following regional tariff data summaries and news articles for the current period (${this.dataGrounding()}), generate a regional analysis:

      Regional Tariff Summary (already calculated over tariffs in force; treat these numbers as given):
      ${JSON.stringify(regionalData, null, 2)}

      Recent News Sample:
      ${news
        .slice(0, 5)
        .map((article) => `- ${article.title}`)
        .join("\n")}

      For each region listed above, and only those regions, provide:
      - region (string, copied exactly from the summary)
      - description (string, 1-2 sentences on current trends)

      Do not output any rate, percentage or year-over-year figure; the numbers
      are supplied above and will be used as given.

      Format the response STRICTLY as a JSON array of objects matching this TypeScript interface, with NO additional text or markdown:
      Array<{ region: string, description: string }>`;

      const response = await this.generateWithOpenAI(prompt);
      const narrative = this.parseJson<Array<{ region: string; description: string }>>(
        response,
        "RegionalAnalysis",
        []
      );

      // The measured figures are authoritative; the model only supplies prose.
      return regionalData.map((r) => ({
        region: r.region,
        averageTariffRate: r.avgRate,
        tariffCount: r.count,
        description:
          narrative.find((n) => n?.region === r.region)?.description ??
          `${r.count} tariff${r.count === 1 ? "" : "s"} in force, averaging ${r.avgRate.toFixed(
            1
          )}%.`,
        keySectors: r.sectors,
      }));
    });
  }

  async getMarketPredictions(): Promise<MarketPrediction[]> {
    return this.getCachedData("marketPredictions", async () => {
      const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 1000 });
      const news = await this.newsService.getTariffNews();

      const collected = this.collected(tariffRates.data);

      const prompt = `Based on the following tariff data and news articles for the current period (${this.dataGrounding()}), generate market predictions:

      Tariff Data Sample (Average Rate across tariffs in force: ${this.calculateAverageTariffRate(
        collected
      ).toFixed(1)}%):
      ${JSON.stringify(collected.slice(0, 5), null, 2)}

      Recent News Sample:
      ${news
        .slice(0, 5)
        .map((article) => `- ${article.title}`)
        .join("\n")}

      Please provide predictions for:
      1. Short-term (3-6 months)
      2. Medium-term (6-12 months)
      3. Long-term (1-3 years)

      For each timeframe, include:
      - 2-4 specific predictions (array of strings)
      - Confidence level (number between 0 and 1)

      Format the response STRICTLY as a JSON array of objects matching this TypeScript interface, with NO additional text or markdown:
      Array<{
        timeframe: 'short-term' | 'medium-term' | 'long-term',
        predictions: string[],
        confidence: number
      }>`;

      const response = await this.generateWithOpenAI(prompt);
      return this.parseJson<MarketPrediction[]>(response, "MarketPredictions", []);
    });
  }

  /**
   * Regions a row touches.
   *
   * The old version looked up the whole `to` string in an eleven-entry map and
   * called anything else "Other". Real values are things like "Global",
   * "European Union", "France, Italy, Spain" and "60 Economies (99.4% of US
   * imports...)", so almost every row fell through: Europe ended up with a
   * single unrated row and reported 0%. Matching on substrings lets a row
   * count toward every region it actually names, and a global measure counts
   * everywhere.
   */
  private static readonly REGION_TERMS: Record<string, string[]> = {
    // US aliases matter for the five retaliation rows whose target is the US
    // (China's and Canada's counter-tariffs, the EU duty removal). Matched
    // against the target only, never the imposer: 32 of 37 rows are imposed by
    // the USA, so keying on the origin would file almost the whole dataset
    // under North America and turn that card into the global average.
    "North America": [
      "canada", "mexico", "usmca", "north america",
      "usa", "u.s.", "united states",
    ],
    Europe: [
      "european union", "eu ", " eu", "europe", "germany", "france", "italy",
      "spain", "united kingdom", "uk", "switzerland", "ukraine",
    ],
    "Asia-Pacific": [
      "china", "japan", "south korea", "korea", "taiwan", "india", "vietnam",
      "cambodia", "indonesia", "malaysia", "thailand", "philippines",
      "singapore", "bangladesh", "pakistan", "australia", "new zealand",
      "asia",
    ],
    // Mexico is deliberately absent: it is listed under North America, and
    // naming it here too would count the same tariff in two regions.
    "Latin America": [
      "brazil", "argentina", "chile", "colombia", "nicaragua", "venezuela",
      "latin america",
    ],
  };

  private regionsFor(t: TariffEntry): string[] {
    // The target, not the imposer. A US tariff on Chinese goods is exposure for
    // Asia-Pacific, not for North America; China's counter-tariff on US goods
    // is the reverse. Including `tariffOrigin` here put every US-imposed row
    // into North America regardless of who actually pays it.
    const haystack = `${t.to ?? ""}`.toLowerCase();
    const named = Object.keys(MarketAnalysisService.REGION_TERMS);

    // A worldwide measure is collected on goods from everywhere, so it belongs
    // in every regional total as well as in the Global summary. Returning only
    // "Global" left a 50% worldwide steel tariff out of Europe's average even
    // though European steel pays it.
    if (/\bglobal\b|all countries|all u\.s\. trading partners|60 economies/.test(haystack)) {
      return [...named, "Global"];
    }

    const hits = Object.entries(MarketAnalysisService.REGION_TERMS)
      .filter(([, terms]) => terms.some((term) => haystack.includes(term)))
      .map(([region]) => region);

    // A row naming no region we track goes to "Other", not "Global". Putting it
    // in Global made that card claim to summarise worldwide measures while
    // actually mixing in one-off tariffs on unmapped countries.
    return hits.length > 0 ? hits : ["Other"];
  }

  private getKeySectors(tariffs: TariffEntry[]): string[] {
    const sectors = new Map<string, number>();
    tariffs.forEach((t) => {
      const count = sectors.get(t.commodity) || 0;
      sectors.set(t.commodity, count + 1);
    });

    return Array.from(sectors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sector]) => sector);
  }

  // New method to get AI-powered insights
  async getAIInsights(bypassCache = false): Promise<AIInsight[]> {
    return this.getCachedData(
      "aiInsights",
      async () => {
        const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 50 });
        const news = await this.newsService.getTariffNews();

        const collected = this.collected(tariffRates.data);

        const prompt = `Based on the following tariff data and news articles for the current period (${this.dataGrounding()}), generate 3-4 concise AI-powered insights for a dashboard widget. Prioritize identifying one significant 'alert' if applicable, and include a mix of 'positive' and 'negative' trends.

      Tariff Data Sample (Average Rate across tariffs in force: ${this.calculateAverageTariffRate(
        collected
      ).toFixed(1)}%):
      ${JSON.stringify(collected.slice(0, 5), null, 2)}

      Recent News Sample:
      ${news
        .slice(0, 3)
        .map((article) => `- ${article.title}`)
        .join("\n")}

      Generate insights covering potential risks, opportunities, or significant shifts.

      Format the response STRICTLY as a JSON array of objects matching this TypeScript interface, with NO additional text or markdown:
      Array<{
        type: "alert" | "positive" | "negative";
        text: string; 
      }>`;

        const response = await this.generateWithOpenAI(prompt);
        const insights = this.parseJson<AIInsight[]>(response, "AIInsights", []);
        // "Data refresh pending..." and "check backend logs" used to be served
        // as if they were insights. An empty list lets the panel say nothing
        // rather than say something meaningless.
        return insights.filter((i) => i && i.type && i.text);
      },
      bypassCache
    );
  }

  // New method for Key Metrics
  async getKeyMetrics(): Promise<KeyMetrics> {
    console.log("Attempting to get key metrics...");
    try {
      const tariffResponse = await this.tariffService.getTariffRates({
        itemsPerPage: 10000,
      });
      const tariffs = tariffResponse.data;

      if (!tariffs || tariffs.length === 0) {
        console.log("No tariff data available for key metrics calculation.");

        return {
          averageRate: 0,
          yoyChangePoints: null,
          yoyComparedTo: null,
          activeTariffs: 0,
          totalTariffs: 0,
          threatenedTariffs: 0,
          summaryDescription: "No tariff data available.",
          highestTariffRate: null,
          highestTariffCommodity: "N/A",
          highestTariffCountries: "N/A",
          highestTariffEffectiveDate: "N/A",
          biggestIncreaseValue: null,
          biggestIncreaseCommodity: "N/A",
          biggestIncreaseDescription: "N/A",
          biggestDecreaseValue: null,
          biggestDecreaseCommodity: "N/A",
          biggestDecreaseDescription: "N/A",
        };
      }

      console.log(`Calculating key metrics from ${tariffs.length} tariff entries.`);

      // --- Filter for ACTIVE tariffs FIRST ---
      const activeTariffsData = tariffs.filter(
        (t) => t.status === "Active" && typeof t.rate === "number"
      );
      console.log(`Found ${activeTariffsData.length} active tariffs with numeric rates.`);

      // Average only over what is actually collected. Including Withdrawn,
      // Proposed and Suspended rows pulled a lapsed 250% dairy threat and a
      // superseded 200% spirits rate into the headline number, and disagreed
      // with the Highest Active Tariff metric beside it, which is active-only.
      const averageRate = this.calculateAverageTariffRate(
        activeTariffsData.filter((t) => this.carriesRate(t))
      );
      const { yoyChangePoints, yoyComparedTo } = this.calculateYearOverYear(averageRate);
      const activeTariffsCount = tariffs.filter((t) => t.status === "Active").length;
      const totalTariffsCount = tariffs.length;
      const threatenedTariffsCount = tariffs.filter((t) => t.status === "Threatened").length;

      const highestTariffEntry = [...activeTariffsData].sort(
        (a, b) => (b.rate || 0) - (a.rate || 0)
      )[0];

      // --- Find biggest INCREASE among ACTIVE tariffs based on changeDisplay ---
      let biggestIncreaseEntry: TariffEntry | null = null;
      let maxParsedIncrease: number | null = null;

      for (const entry of activeTariffsData) {
        if (typeof entry.changeDisplay === "string" && entry.changeDisplay.startsWith("+")) {
          try {
            const changeStr = entry.changeDisplay.replace("%", "").replace("+", "");
            const changeValue = parseFloat(changeStr);

            if (!isNaN(changeValue)) {
              if (maxParsedIncrease === null || changeValue > maxParsedIncrease) {
                maxParsedIncrease = changeValue;
                biggestIncreaseEntry = entry;
              }
            }
          } catch (parseError) {
            console.warn(
              `Could not parse positive changeDisplay value: ${entry.changeDisplay} for entry ID ${entry.id}`
            );
          }
        }
      }

      let biggestDecreaseEntryByChange: TariffEntry | null = null;
      let maxParsedDecrease: number | null = null;

      for (const entry of activeTariffsData) {
        if (typeof entry.changeDisplay === "string" && entry.changeDisplay.startsWith("-")) {
          try {
            const changeStr = entry.changeDisplay.replace("%", "");
            const changeValue = parseFloat(changeStr);

            if (!isNaN(changeValue)) {
              if (maxParsedDecrease === null || changeValue < maxParsedDecrease) {
                maxParsedDecrease = changeValue;
                biggestDecreaseEntryByChange = entry;
              }
            }
          } catch (parseError) {
            console.warn(
              `Could not parse negative changeDisplay value: ${entry.changeDisplay} for entry ID ${entry.id}`
            );
          }
        }
      }

      const changes = [...activeTariffsData].sort((a, b) => (a.rate || 0) - (b.rate || 0));
      const biggestDecreaseEntry = changes.length > 0 ? changes[0] : null;

      const summaryDescription = `Average tariff rate is ${averageRate.toFixed(
        1
      )}%, with ${activeTariffsCount} active and ${threatenedTariffsCount} threatened tariffs.`;

      console.log("Highest Active Tariff Entry Found:", highestTariffEntry);
      console.log("Biggest Increase (by changeDisplay) Active Entry:", biggestIncreaseEntry);
      console.log(
        "Biggest Decrease (by changeDisplay) Active Entry:",
        biggestDecreaseEntryByChange
      );
      console.log("Legacy Biggest Decrease (by rate) Active Entry:", biggestDecreaseEntry);

      return {
        averageRate,
        yoyChangePoints,
        yoyComparedTo,
        activeTariffs: activeTariffsCount,
        totalTariffs: totalTariffsCount,
        threatenedTariffs: threatenedTariffsCount,
        summaryDescription,

        highestTariffRate: highestTariffEntry ? highestTariffEntry.rate : null,
        highestTariffCommodity: highestTariffEntry ? highestTariffEntry.commodity : "N/A",
        highestTariffCountries: highestTariffEntry
          ? `${highestTariffEntry.tariffOrigin} → ${highestTariffEntry.to}`
          : "N/A",
        highestTariffEffectiveDate: highestTariffEntry ? highestTariffEntry.effectiveDate : "N/A",

        biggestIncreaseValue: maxParsedIncrease,
        biggestIncreaseCommodity: biggestIncreaseEntry ? biggestIncreaseEntry.commodity : "N/A",
        biggestIncreaseDescription: biggestIncreaseEntry
          ? `Largest increase imposed on ${biggestIncreaseEntry.commodity}.`
          : "N/A",

        biggestDecreaseValue: maxParsedDecrease,
        biggestDecreaseCommodity: biggestDecreaseEntryByChange
          ? biggestDecreaseEntryByChange.commodity
          : "N/A",
        biggestDecreaseDescription: biggestDecreaseEntryByChange
          ? `Largest decrease found for ${biggestDecreaseEntryByChange.commodity}.`
          : "No recent decrease in active tariffs.",
      };
    } catch (error) {
      console.error("Error calculating key metrics:", error);

      return {
        averageRate: 0,
        yoyChangePoints: null,
        yoyComparedTo: null,
        activeTariffs: 0,
        totalTariffs: 0,
        threatenedTariffs: 0,
        summaryDescription: "Error calculating key metrics.",
        highestTariffRate: null,
        highestTariffCommodity: "Error",
        highestTariffCountries: "Error",
        highestTariffEffectiveDate: "Error",
        biggestIncreaseValue: null,
        biggestIncreaseCommodity: "Error",
        biggestIncreaseDescription: "Error",
        biggestDecreaseValue: null,
        biggestDecreaseCommodity: "Error",
        biggestDecreaseDescription: "Error",
      };
    }
  }
}
