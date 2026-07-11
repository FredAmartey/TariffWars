import axios from "axios";
import { NewsEntry } from "../types/news";
import { TariffEntry } from "../types/tariff";

interface GetNewsParams {
  search?: string;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  filters?: Array<{ field: string; value: string }>;
  page?: number;
  itemsPerPage?: number;
}

interface GetNewsResponse {
  data: TariffEntry[];
  total: number;
  page: number;
  itemsPerPage: number;
}

interface FrontendNewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: { name: string };
  url?: string;
  imageUrl?: string;
}

interface MappedNewsArticle {
  id: string;
  title: string;
  summary: string;
  url?: string;
  date: string;
  imageUrl?: string;
  source: {
    name: string;
  };
}

export class NewsService {
  private apiUrl: string;
  private apiKey: string;
  private scrapingDogApiKey: string;
  private scrapingDogUrl: string;
  private news: TariffEntry[] = [];
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes
  private lastFetchTime = 0;
  private cachedArticles: MappedNewsArticle[] = [];

  private readonly fallbackImages = [
    "https://images.unsplash.com/photo-1518458028785-8fbcd101ebb9?q=80&w=600", // Global trade
    "https://images.unsplash.com/photo-1589293815088-d3c6f8c1b91d?q=80&w=600", // Shipping containers
    "https://images.unsplash.com/photo-1569025743873-ea3a9ade89f9?q=80&w=600", // Business district
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=600", // Container ship
    "https://images.unsplash.com/photo-1565514020179-026b92b84bb6?q=80&w=600", // Port crane
    "https://images.unsplash.com/photo-1554244933-d876deb6b2ff?q=80&w=600", // Trade center
  ];

  constructor() {
    this.apiUrl = process.env.NEWS_API_URL || "https://newsapi.org/v2";
    this.apiKey = process.env.NEWS_API_KEY || "";
    this.scrapingDogApiKey = process.env.SCRAPINGDOG_API_KEY || "";
    this.scrapingDogUrl = process.env.SCRAPINGDOG_URL || "https://api.scrapingdog.com/google_news/";
  }

  async getNews(params: GetNewsParams): Promise<GetNewsResponse> {
    let filteredNews = [...this.news];

    // Apply search
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredNews = filteredNews.filter(
        (item) =>
          item.commodity.toLowerCase().includes(searchLower) ||
          item.tariffOrigin.toLowerCase().includes(searchLower) ||
          item.to.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    if (params.filters) {
      filteredNews = filteredNews.filter((item) =>
        params.filters!.every((filter) => {
          const value = (item as any)[filter.field];
          return value && value.toString().toLowerCase() === filter.value.toLowerCase();
        })
      );
    }

    // Apply sorting
    if (params.sortField) {
      filteredNews.sort((a, b) => {
        const aValue = (a as any)[params.sortField!];
        const bValue = (b as any)[params.sortField!];
        const modifier = params.sortDirection === "desc" ? -1 : 1;

        if (typeof aValue === "string") {
          return aValue.localeCompare(bValue) * modifier;
        }
        return (aValue < bValue ? -1 : aValue > bValue ? 1 : 0) * modifier;
      });
    }

    // Apply pagination
    const page = params.page || 1;
    const itemsPerPage = params.itemsPerPage || 10;
    const start = (page - 1) * itemsPerPage;
    const paginatedNews = filteredNews.slice(start, start + itemsPerPage);

    return {
      data: paginatedNews,
      total: filteredNews.length,
      page,
      itemsPerPage,
    };
  }

  addNews(entry: TariffEntry) {
    this.news.push(entry);
  }

  updateNews(id: string, entry: Partial<TariffEntry>) {
    const index = this.news.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.news[index] = { ...this.news[index], ...entry };
    }
  }

  deleteNews(id: string) {
    this.news = this.news.filter((item) => item.id !== id);
  }

  async getTariffNews(): Promise<FrontendNewsArticle[]> {
    const now = Date.now();

    if (now - this.lastFetchTime < this.cacheDuration && this.cachedArticles.length > 0) {
      return this.cachedArticles.map(this.mapToFrontendArticle);
    }

    try {
      console.log("Attempting to fetch news from NewsAPI.");
      const articles = await this.fetchFromNewsAPI();
      return articles.map(this.mapToFrontendArticle);
    } catch (error) {
      console.error("Error fetching news from NewsAPI:", error);
      console.log("Falling back to ScrapingDog.");
      const articles = await this.fetchFromScrapingDog();
      return articles.map(this.mapToFrontendArticle);
    }
  }

  // NewsAPI matches loosely (body text included), so a bond story that mentions
  // tariffs once slips through; require the topic in the headline/summary and
  // drop the same headline syndicated across outlets.
  private static readonly RELEVANCE =
    /tariff|trade war|trade deal|trade talk|customs|dut(y|ies)|import|export|sanction|trade polic/i;

  private dedupe(articles: MappedNewsArticle[]): MappedNewsArticle[] {
    const seen = new Set<string>();
    return articles.filter((a) => {
      const key = (a.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private mapToFrontendArticle(article: MappedNewsArticle): FrontendNewsArticle {
    return {
      id: article.id || article.url || Math.random().toString(),
      title: article.title,
      summary: article.summary,
      url: article.url,
      date: article.date,
      imageUrl: article.imageUrl,
      source: article.source,
    };
  }

  private async fetchFromScrapingDog(): Promise<MappedNewsArticle[]> {
    const now = Date.now();
    try {
      const response = await axios.get(this.scrapingDogUrl, {
        params: {
          api_key: this.scrapingDogApiKey,
          query: "US tariffs trade",
          country: "us",
          results: 30,
        },
      });

      console.log("ScrapingDog response:", response.data);

      if (response.status !== 200 || !response.data.news_results) {
        throw new Error("ScrapingDog API returned an error or unexpected response structure");
      }

      const articles = this.dedupe(
        response.data.news_results.map((article: any, index: number) => ({
          id: `scrapingdog-${index}-${Date.now()}`,
          title: article.title,
          summary: article.snippet,
          url: article.url,
          date: article.lastUpdated,
          imageUrl: article.imgSrc,
          source: {
            name: article.source,
          },
        }))
      );

      this.cachedArticles = articles;
      this.lastFetchTime = now;

      return articles;
    } catch (error) {
      console.error("Error fetching news from ScrapingDog:", error);
      if (this.cachedArticles.length > 0) {
        console.log("Using cached data due to ScrapingDog error.");
        return this.cachedArticles;
      }
      return [];
    }
  }

  private async fetchFromNewsAPI(): Promise<MappedNewsArticle[]> {
    try {
      const response = await axios.get(this.apiUrl + "/everything", {
        params: {
          q: '"tariff" OR "tariffs" OR "trade war" OR "customs duty" OR "trade deal"',
          searchIn: "title,description",
          language: "en",
          sortBy: "publishedAt",
          pageSize: 50,
          apiKey: this.apiKey,
        },
      });

      if (response.data.status !== "ok") {
        console.error("NewsAPI returned an error status:", response.data.message);
        throw new Error("NewsAPI returned an error");
      }

      if (!response.data.articles || response.data.articles.length === 0) {
        console.warn("NewsAPI returned no articles.");
        return [];
      }

      const articles = this.dedupe(
        response.data.articles
          .map((article: any, index: number) => ({
            id: `newsapi-${index}-${Date.now()}`,
            title: article.title || "No Title",
            summary: article.description || "No Description",
            url: article.url,
            date: article.publishedAt,
            imageUrl:
              article.urlToImage ||
              this.fallbackImages[Math.floor(Math.random() * this.fallbackImages.length)],
            source: {
              name: article.source?.name || "Unknown Source",
            },
          }))
          .filter(
            (article: MappedNewsArticle) =>
              article.url && NewsService.RELEVANCE.test(`${article.title} ${article.summary}`)
          )
      );

      if (articles.length === 0) {
        throw new Error("NewsAPI returned no relevant articles");
      }

      this.cachedArticles = articles;
      this.lastFetchTime = Date.now();

      return articles;
    } catch (error) {
      console.error("Error fetching news from NewsAPI:", error);
      if (this.cachedArticles.length > 0) {
        console.log("Using cached data due to NewsAPI error.");
        return this.cachedArticles;
      }
      // Propagate so getTariffNews falls back to ScrapingDog.
      throw error;
    }
  }
}
