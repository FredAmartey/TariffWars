import axios from "axios";
import type {
  MarketOverview,
  CommodityAnalysis,
  RegionalAnalysis,
  MarketPrediction,
} from "../../backend/src/services/marketAnalysisService";

export type {
  MarketOverview,
  CommodityAnalysis,
  RegionalAnalysis,
  MarketPrediction,
} from "../../backend/src/services/marketAnalysisService";

export interface KeyMetrics {
  averageRate: number;
  yoyChangePoints: number | null;
  yoyComparedTo: string | null;
  activeTariffs: number;
  totalTariffs: number;
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

// Define and Export AIInsight type directly here
export interface AIInsight {
  type: "alert" | "positive" | "negative";
  text: string;
}

// Create a secure Axios instance with defaults
const secureAxios = axios.create({
  baseURL: "/projects/tariff-wars", // Re-enable base URL for API requests under sub-path
  // Vercel serverless cold start + four parallel requests can exceed 10s;
  // 30s keeps the modal alive through a cold hit.
  timeout: 30000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: false, // Disable sending cookies for API requests
});

secureAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors or server errors consistently
    console.error("API Error:", error.message || "Unknown error occurred");

    // Format error response consistently
    const errorResponse = {
      message: "Failed to fetch data",
      status: error.response?.status || 500,
      details: error.response?.data || error.message,
    };

    return Promise.reject(errorResponse);
  }
);

secureAxios.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

class MarketAnalysisApi {
  private readonly baseUrl: string;

  constructor() {
    // API routes are relative to the baseURL set in secureAxios
    this.baseUrl = `/api/market-analysis`;
  }

  /**
   * Safely fetch market overview data
   */
  async getMarketOverview(): Promise<MarketOverview> {
    try {
      const response = await secureAxios.get(`${this.baseUrl}/overview`);
      return response.data;
    } catch (error) {
      console.error("Error fetching market overview:", error);
      throw error;
    }
  }

  /**
   * Safely fetch commodity analysis data
   */
  async getCommodityAnalysis(): Promise<CommodityAnalysis[]> {
    try {
      const response = await secureAxios.get(`${this.baseUrl}/commodities`);
      return response.data;
    } catch (error) {
      console.error("Error fetching commodity analysis:", error);
      throw error;
    }
  }

  /**
   * Safely fetch regional analysis data
   */
  async getRegionalAnalysis(): Promise<RegionalAnalysis[]> {
    try {
      const response = await secureAxios.get(`${this.baseUrl}/regions`);
      return response.data;
    } catch (error) {
      console.error("Error fetching regional analysis:", error);
      throw error;
    }
  }

  /**
   * Safely fetch market predictions data
   */
  async getMarketPredictions(): Promise<MarketPrediction[]> {
    try {
      const response = await secureAxios.get(`${this.baseUrl}/predictions`);
      return response.data;
    } catch (error) {
      console.error("Error fetching market predictions:", error);
      throw error;
    }
  }

  /**
   * Safely fetch key metrics data
   */
  async getKeyMetrics(): Promise<KeyMetrics> {
    try {
      const response = await secureAxios.get(`${this.baseUrl}/key-metrics`);
      return response.data;
    } catch (error) {
      console.error("Error fetching key metrics:", error);
      throw error;
    }
  }

  /**
   * Safely fetch AI insights with optional refresh parameter
   * @param refresh - Boolean flag to bypass cache
   */
  async getAIInsights(refresh = false): Promise<AIInsight[]> {
    try {
      // Validate input
      const shouldRefresh = Boolean(refresh);

      // Build endpoint with query param if needed
      const endpoint = shouldRefresh
        ? `${this.baseUrl}/ai-insights?refresh=true`
        : `${this.baseUrl}/ai-insights`;

      const response = await secureAxios.get(endpoint);
      return response.data;
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      throw error;
    }
  }
}

export const marketAnalysisApi = new MarketAnalysisApi();
