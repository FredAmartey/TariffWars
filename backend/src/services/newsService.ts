import axios from "axios";

/**
 * Log-safe description of a request failure.
 *
 * Logging the whole Axios error printed `config.params`, which carries the
 * NewsAPI and ScrapingDog keys, straight into the platform logs.
 */
function describeRequestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return [
      error.code ? `code=${error.code}` : null,
      error.response ? `status=${error.response.status}` : null,
      error.message,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Accept only ordinary web URLs. Article links are rendered as anchors and
 * opened on click, so an upstream item offering `javascript:` or `data:`
 * would otherwise become a click target we hand the user.
 */
export function safeArticleUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
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
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes
  private lastFetchTime = 0;
  private cachedArticles: MappedNewsArticle[] = [];
  private inFlight: Promise<MappedNewsArticle[]> | null = null;
  /** Shared cool-off after a total provider failure. See fetchFresh. */
  private retryNotBefore = 0;
  private readonly retryBackoff = 60 * 1000;

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

  async getTariffNews(): Promise<FrontendNewsArticle[]> {
    const now = Date.now();

    if (now - this.lastFetchTime < this.cacheDuration && this.cachedArticles.length > 0) {
      return this.cachedArticles.map(this.mapToFrontendArticle);
    }

    // Concurrent cold requests would otherwise each hit the provider.
    if (this.inFlight) return (await this.inFlight).map(this.mapToFrontendArticle);

    // Sequential requests during an outage are the other half of that problem:
    // share the cool-off armed by the last total failure rather than each
    // paying for its own round of provider timeouts. This applies with nothing
    // cached too, which is exactly the cold-start-against-a-dead-provider case
    // where the amplification is worst.
    if (now < this.retryNotBefore) {
      if (this.cachedArticles.length > 0) {
        return this.cachedArticles.map(this.mapToFrontendArticle);
      }
      throw new Error("News providers are unavailable; retry shortly");
    }

    this.inFlight = this.fetchFresh().finally(() => {
      this.inFlight = null;
    });

    const articles = await this.inFlight;
    return articles.map(this.mapToFrontendArticle);
  }

  /**
   * NewsAPI first, ScrapingDog second, last good snapshot third.
   *
   * Each fetcher used to return its own stale cache on failure, so the
   * orchestrator saw a successful empty-ish result and never reached the
   * configured fallback. They now report failure honestly and the decision
   * about what to serve is made here.
   */
  private async fetchFresh(): Promise<MappedNewsArticle[]> {
    for (const [name, fetcher] of [
      ["NewsAPI", () => this.fetchFromNewsAPI()],
      ["ScrapingDog", () => this.fetchFromScrapingDog()],
    ] as const) {
      try {
        const articles = await fetcher();
        if (articles.length > 0) {
          this.cachedArticles = articles;
          this.lastFetchTime = Date.now();
          return articles;
        }
        console.warn(`${name} returned no usable articles; trying the next provider.`);
      } catch (error) {
        console.error(`Error fetching news from ${name}:`, describeRequestError(error));
      }
    }

    // Every provider failed. Hold off before trying again: without this the
    // stale snapshot is returned without advancing any clock, so the next
    // request re-attempts both providers. A fast 401 or 429 then becomes one
    // upstream retry pair per visitor, and a timeout adds its full 15 seconds
    // to every page load until someone recovers.
    this.retryNotBefore = Date.now() + this.retryBackoff;

    if (this.cachedArticles.length > 0) {
      console.warn("All news providers failed; serving the last good snapshot.");
      return this.cachedArticles;
    }
    throw new Error("No news provider returned articles");
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
    const response = await axios.get(this.scrapingDogUrl, {
      params: {
        api_key: this.scrapingDogApiKey,
        query: "US tariffs trade",
        country: "us",
        results: 30,
      },
      timeout: 15000,
    });

    if (response.status !== 200 || !response.data?.news_results) {
      throw new Error("ScrapingDog returned an unexpected response structure");
    }

    return this.dedupe(
      response.data.news_results
        .map((article: any, index: number) => ({
          id: `scrapingdog-${index}-${Date.now()}`,
          title: article.title,
          summary: article.snippet,
          url: safeArticleUrl(article.url),
          date: article.lastUpdated,
          imageUrl: safeArticleUrl(article.imgSrc) ?? this.randomFallbackImage(),
          source: {
            name: article.source,
          },
        }))
        .filter((article: MappedNewsArticle) => Boolean(article.url))
    );
  }

  private randomFallbackImage(): string {
    return this.fallbackImages[Math.floor(Math.random() * this.fallbackImages.length)];
  }

  private async fetchFromNewsAPI(): Promise<MappedNewsArticle[]> {
    const response = await axios.get(this.apiUrl + "/everything", {
      params: {
        q: '"tariff" OR "tariffs" OR "trade war" OR "customs duty" OR "trade deal"',
        searchIn: "title,description",
        language: "en",
        sortBy: "publishedAt",
        pageSize: 50,
        apiKey: this.apiKey,
      },
      timeout: 15000,
    });

    if (response.data?.status !== "ok") {
      throw new Error(`NewsAPI returned status ${response.data?.status ?? "unknown"}`);
    }

    return this.dedupe(
      (response.data.articles ?? [])
        .map((article: any, index: number) => ({
          id: `newsapi-${index}-${Date.now()}`,
          title: article.title || "No Title",
          summary: article.description || "No Description",
          url: safeArticleUrl(article.url),
          date: article.publishedAt,
          imageUrl: safeArticleUrl(article.urlToImage) ?? this.randomFallbackImage(),
          source: {
            name: article.source?.name || "Unknown Source",
          },
        }))
        .filter(
          (article: MappedNewsArticle) =>
            article.url && NewsService.RELEVANCE.test(`${article.title} ${article.summary}`)
        )
    );
  }
}
