import { TariffService } from "./tariffService";
import { NewsService } from "./newsService";
import OpenAI from "openai";
import { config } from "../config";
import { TariffEntry } from "../types/tariff";
import { NewsArticle } from "../types/news";

export interface MarketOverview {
  averageTariffRate: number;
  yearOverYearChange: number;
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
  averageTariffRate: number;
  yearOverYearChange: number;
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
  yoyChange: number;
  activeTariffs: number;
  threatenedTariffs: number;
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
  private openai: OpenAI;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000;
  private CACHE_TTL = 1000 * 60 * 60;

  constructor(tariffService: TariffService, newsService: NewsService) {
    this.tariffService = tariffService;
    this.newsService = newsService;
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
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

    console.log(bypassCache ? `Bypassing cache for ${key}.` : `Fetching fresh data for ${key}.`);
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
    }
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

  private calculateAverageTariffRate(tariffs: TariffEntry[]): number {
    const rates = tariffs.map((t) => t.rate);
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }

  private calculateYearOverYearChange(tariffs: TariffEntry[]): number {
    const increases = tariffs.filter((t) => t.isIncrease).length;
    const decreases = tariffs.filter((t) => !t.isIncrease).length;
    return ((increases - decreases) / tariffs.length) * 100;
  }

  public clearCache(): void {
    console.log("Clearing market analysis cache...");
    this.cache.clear();
  }

  async getMarketOverview(): Promise<MarketOverview> {
    return this.getCachedData("marketOverview", async () => {
      const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 1000 });
      const news = await this.newsService.getTariffNews();

      const averageTariffRate = this.calculateAverageTariffRate(tariffRates.data);

      const prompt = `Based on the following tariff data and news articles, generate a market overview for the current period (around April 2025):

      Tariff Data Sample (Average Rate: ${averageTariffRate.toFixed(1)}%):
      ${JSON.stringify(tariffRates.data.slice(0, 5), null, 2)}

      Recent News Sample:
      ${news
        .slice(0, 5)
        .map((article) => `- ${article.title}`)
        .join("\n")}

      Please provide:
      1. A calculated year-over-year change percentage (number) based on the general sentiment and trends in the data/news.
      2. A list of 3-5 high-risk sectors (name: string, tariffIncrease: number). Estimate tariffIncrease based on data/news if specific numbers aren't present.
      3. A list of 3-5 growth opportunities (name: string, tariffReduction: number). Estimate tariffReduction similarly.
      4. A concise paragraph (string) summarizing the impact on manufacturing.
      5. A concise paragraph (string) summarizing supply chain shifts.
      6. A concise paragraph (string) summarizing the general economic outlook related to tariffs.

      Format the response STRICTLY as a JSON object matching this TypeScript interface, with NO additional text or markdown:
      interface ResponseFormat {
        yearOverYearChange: number;
        highRiskSectors: Array<{name: string, tariffIncrease: number}>;
        growthOpportunities: Array<{name: string, tariffReduction: number}>;
        manufacturingImpact: string;
        supplyChainShifts: string;
        economicOutlook: string;
      }`;

      const response = await this.generateWithOpenAI(prompt);
      try {
        const parsed = JSON.parse(response);
        return {
          averageTariffRate: averageTariffRate,
          yearOverYearChange: parsed.yearOverYearChange || 0,
          highRiskSectors: parsed.highRiskSectors || [],
          growthOpportunities: parsed.growthOpportunities || [],
          manufacturingImpact:
            parsed.manufacturingImpact || "No manufacturing impact analysis available.",
          supplyChainShifts:
            parsed.supplyChainShifts || "No supply chain shift analysis available.",
          economicOutlook: parsed.economicOutlook || "No economic outlook analysis available.",
        };
      } catch (e) {
        console.error(
          "Failed to parse OpenAI response for MarketOverview:",
          e,
          "\nResponse:",
          response
        );
        return {
          averageTariffRate: averageTariffRate,
          yearOverYearChange: 0,
          highRiskSectors: [],
          growthOpportunities: [],
          manufacturingImpact: "Error generating manufacturing impact analysis.",
          supplyChainShifts: "Error generating supply chain shift analysis.",
          economicOutlook: "Error generating economic outlook analysis.",
        };
      }
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

      const prompt = `Based on the following tariff data sample for the current period (around April 2025), generate a detailed commodity analysis for 5-7 major commodities mentioned or implied:

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
      try {
        return JSON.parse(response);
      } catch (e) {
        console.error(
          "Failed to parse OpenAI response for CommodityAnalysis:",
          e,
          "\\nResponse:",
          response
        );
        return [];
      }
    });
  }

  async getRegionalAnalysis(): Promise<RegionalAnalysis[]> {
    return this.getCachedData("regionalAnalysis", async () => {
      const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 1000 });
      const news = await this.newsService.getTariffNews();

      const regions = ["North America", "Europe", "Asia-Pacific", "Latin America", "Other"];
      const regionalData = regions
        .map((region) => {
          const regionTariffs = tariffRates.data.filter(
            (t) =>
              this.getRegionFromCountry(t.tariffOrigin) === region ||
              this.getRegionFromCountry(t.to) === region
          );
          return {
            region: region,
            avgRate: regionTariffs.length > 0 ? this.calculateAverageTariffRate(regionTariffs) : 0,
            count: regionTariffs.length,
          };
        })
        .filter((r) => r.count > 0);

      const prompt = `Based on the following regional tariff data summaries and news articles for the current period (around April 2025), generate a regional analysis for the key regions identified:

      Regional Tariff Summary:
      ${JSON.stringify(regionalData, null, 2)}

      Recent News Sample:
      ${news
        .slice(0, 5)
        .map((article) => `- ${article.title}`)
        .join("\\n")}

      Please provide an analysis of major regions including:
      - Calculated average tariff rate (number)
      - Calculated year-over-year change (number, estimate based on trends/news)
      - A brief description (string) of current trends (1-2 sentences)
      - 3-5 key sectors affected (array of strings)

      Format the response STRICTLY as a JSON array of objects matching this TypeScript interface, with NO additional text or markdown:
      Array<{
        region: string,
        averageTariffRate: number,
        yearOverYearChange: number,
        description: string,
        keySectors: string[]
      }>`;

      const response = await this.generateWithOpenAI(prompt);
      try {
        return JSON.parse(response);
      } catch (e) {
        console.error(
          "Failed to parse OpenAI response for RegionalAnalysis:",
          e,
          "\\nResponse:",
          response
        );
        return [];
      }
    });
  }

  async getMarketPredictions(): Promise<MarketPrediction[]> {
    return this.getCachedData("marketPredictions", async () => {
      const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 1000 });
      const news = await this.newsService.getTariffNews();

      const prompt = `Based on the following tariff data and news articles for the current period (around April 2025), generate market predictions:

      Tariff Data Sample (Average Rate: ${this.calculateAverageTariffRate(tariffRates.data).toFixed(
        1
      )}%):
      ${JSON.stringify(tariffRates.data.slice(0, 5), null, 2)}

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
      try {
        return JSON.parse(response);
      } catch (e) {
        console.error(
          "Failed to parse OpenAI response for MarketPredictions:",
          e,
          "\nResponse:",
          response
        );
        return [];
      }
    });
  }

  private getRegionFromCountry(country: string): string {
    const regionMap: Record<string, string> = {
      China: "Asia-Pacific",
      Japan: "Asia-Pacific",
      "South Korea": "Asia-Pacific",
      India: "Asia-Pacific",
      Germany: "Europe",
      France: "Europe",
      UK: "Europe",
      Canada: "North America",
      Mexico: "North America",
      Brazil: "Latin America",
      Argentina: "Latin America",
    };
    return regionMap[country] || "Other";
  }

  private generateRegionDescription(
    region: string,
    tariffs: TariffEntry[],
    news: NewsArticle[]
  ): string {
    const avgRate = this.calculateAverageTariffRate(tariffs);
    const change = this.calculateYearOverYearChange(tariffs);
    const trend = change > 0 ? "increasing" : "decreasing";

    return (
      `${region} tariffs are currently ${trend}, with an average rate of ${avgRate.toFixed(1)}%. ` +
      `The region has seen a ${Math.abs(change).toFixed(
        1
      )}% change in tariff rates over the past year.`
    );
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

  private generateShortTermPredictions(tariffs: TariffEntry[], news: NewsArticle[]): string[] {
    const highImpactTariffs = tariffs.filter((t) => t.impact === "high");
    const recentNews = news.slice(0, 5);

    return [
      `Steel tariffs expected to remain elevated with potential additional increases`,
      `Agricultural tariffs likely to decrease in regional trade blocs`,
      `Consumer electronics tariffs projected to increase amid tech competition`,
      `Temporary tariff exemptions for critical medical supplies`,
    ];
  }

  private generateMediumTermPredictions(tariffs: TariffEntry[], news: NewsArticle[]): string[] {
    return [
      `Potential moderation in US-China tariffs depending on diplomatic developments`,
      `RCEP implementation to accelerate, reducing intra-Asian tariffs`,
      `European tariffs on energy products likely to increase amid security concerns`,
      `North American automotive sector to benefit from continued USMCA implementation`,
    ];
  }

  private generateLongTermPredictions(tariffs: TariffEntry[], news: NewsArticle[]): string[] {
    return [
      `Regional trade blocs to strengthen with lower internal tariffs`,
      `Strategic sectors (semiconductors, rare earths, energy) to face persistent high tariffs`,
      `Developing markets to benefit from supply chain diversification`,
      `Climate-related tariffs and carbon border adjustments to emerge as significant factors`,
    ];
  }

  // New method to get AI-powered insights
  async getAIInsights(bypassCache = false): Promise<AIInsight[]> {
    return this.getCachedData(
      "aiInsights",
      async () => {
        const tariffRates = await this.tariffService.getTariffRates({ itemsPerPage: 50 });
        const news = await this.newsService.getTariffNews();

        const prompt = `Based on the following tariff data and news articles for the current period (around April 2025), generate 3-4 concise AI-powered insights for a dashboard widget. Prioritize identifying one significant 'alert' if applicable, and include a mix of 'positive' and 'negative' trends.

      Tariff Data Sample (Average Rate: ${this.calculateAverageTariffRate(tariffRates.data).toFixed(
        1
      )}%):
      ${JSON.stringify(tariffRates.data.slice(0, 5), null, 2)}

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
        try {
          const insights = JSON.parse(response);
          if (Array.isArray(insights) && insights.every((i) => i.type && i.text)) {
            return insights;
          }
          throw new Error("Parsed response is not a valid AIInsight array");
        } catch (e) {
          console.error(
            "Failed to parse OpenAI response for AIInsights:",
            e,
            "\nResponse:",
            response
          );
          return [
            {
              type: "alert",
              text: "Error generating insights. Unable to connect to analysis service.",
            },
            { type: "positive", text: "Data refresh pending..." },
            { type: "negative", text: "Please check backend logs for details." },
          ];
        }
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
          yoyChange: 0,
          activeTariffs: 0,
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

      // Calculations using ALL tariffs (where appropriate)
      const averageRate = this.calculateAverageTariffRate(
        tariffs.filter((t) => typeof t.rate === "number")
      );
      const yoyChange = this.calculateYearOverYearChange(tariffs);
      const activeTariffsCount = tariffs.filter((t) => t.status === "Active").length;
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
        yoyChange,
        activeTariffs: activeTariffsCount,
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
        yoyChange: 0,
        activeTariffs: 0,
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
