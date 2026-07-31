import axios from "axios";
import type { TariffEntry, NewsArticle } from "../types/index";
import type { StockQuote } from "../types/stock";

// Create a simple Axios instance
const apiClient = axios.create({
  baseURL: "/projects/tariff-wars",
  timeout: 15000, // 15 second timeout
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable credentials
});

// Successful requests and responses were both logged unconditionally, so a
// dashboard load printed a dozen entries into every visitor's console. Failures
// are still reported: those are worth seeing.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Response Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });

    return Promise.reject(error);
  }
);

class ApiService {
  async getTariffRates(params: {
    search?: string;
    type?: "country" | "product";
    status?: string;
    sortBy?: keyof TariffEntry;
    sortOrder?: "asc" | "desc";
    page?: number;
    itemsPerPage?: number;
  }): Promise<{
    data: TariffEntry[];
    total: number;
    page: number;
    itemsPerPage: number;
    totalPages: number;
  }> {
    try {
      // Use path relative to the baseURL (/projects/tariff-wars)
      const response = await apiClient.get("/api/tariffs/rates", {
        params: { ...params },
      });
      return response.data;
    } catch (error) {
      // Returning an empty page here made every outage look like "no tariffs
      // match", and the caller cached that empty answer. Let it surface.
      console.error("Error in getTariffRates service call:", error);
      throw error;
    }
  }

  async getNewsArticles(params: {
    search?: string;
    sortField?: keyof NewsArticle;
    sortDirection?: "asc" | "desc";
    filters?: Array<{
      field: string;
      value: string;
    }>;
    page?: number;
    itemsPerPage?: number;
  }): Promise<{
    data: NewsArticle[];
    total: number;
    page: number;
    itemsPerPage: number;
  }> {
    try {
      const response = await apiClient.get("/api/news/tariff-news", {
        params: {
          ...params,
          filters: params.filters ? JSON.stringify(params.filters) : undefined,
        },
      });

      // Ensure the response is an array before wrapping
      if (Array.isArray(response.data)) {
        const articles: NewsArticle[] = response.data;
        const itemsPerPage = params.itemsPerPage || 10;
        const page = params.page || 1;
        // Wrap the array in the expected object structure
        return {
          data: articles,
          total: articles.length,
          page: page,
          itemsPerPage: itemsPerPage,
        };
      } else {
        // Handle unexpected non-array response from backend
        console.error("Backend returned non-array for news:", response.data);
        throw new Error("Invalid data format received from news API backend.");
      }
    } catch (error) {
      console.error("Error in getNewsArticles service call:", error);
      throw error;
    }
  }

  async getTariffMeta(): Promise<{
    lastUpdated: string;
    sources: Array<{ name: string; url: string }>;
  }> {
    try {
      const response = await apiClient.get("/api/tariffs/meta");
      return response.data;
    } catch (error) {
      console.error("Error in getTariffMeta service call:", error);
      throw error;
    }
  }

  /**
   * Market quotes, proxied by our backend so the provider credential stays
   * server-side. Errors propagate: a failed fetch is an outage to report, not
   * an empty market.
   */
  async getStockQuotes(): Promise<{ quotes: StockQuote[]; capturedAt: string | null }> {
    const response = await apiClient.get("/api/stocks/quotes");
    if (!response.data || !Array.isArray(response.data.quotes)) {
      throw new Error("Invalid data format received from the stock API.");
    }
    return { quotes: response.data.quotes, capturedAt: response.data.capturedAt ?? null };
  }
}

export const apiService = new ApiService();
export const stockApi = {
  getQuotes: () => apiService.getStockQuotes(),
};
