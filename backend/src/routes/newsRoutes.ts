import express from "express";
import { NewsService } from "../services/newsService";
import rateLimit from "express-rate-limit";
import { clientKey } from "../utils/clientKey";
import { cacheableIfOk } from "../utils/cacheControl";

const newsRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many news requests, please try again later." },
  keyGenerator: clientKey,
});

// Takes the service rather than constructing its own: the market-analysis
// routes need the same instance, and two instances meant two independent
// caches and two upstream fetches on every cold start.
export const newsRoutes = (newsService: NewsService) => {
  const router = express.Router();

  // News turns over during the day, so it gets a shorter edge TTL than the
  // hourly app-wide default.
  router.use((req, res, next) => {
    if (req.method === "GET" && req.query.refresh !== "true") {
      cacheableIfOk(res, 900, 3600, { fromRoute: true });
    }
    next();
  });

  router.get("/tariff-news", newsRateLimiter, async (_req, res) => {
    try {
      const articles = await newsService.getTariffNews();
      res.removeHeader("X-Powered-By");

      if (!Array.isArray(articles)) {
        console.error("Invalid data from newsService: expected array, got", typeof articles);
        return res.status(500).json({
          error: "Internal Server Error",
          message: "Received invalid data while fetching news.",
        });
      }

      res.json(articles);
    } catch (error: any) {
      console.error("Error in /api/news/tariff-news handler:", error?.message ?? error);
      res.status(502).json({
        error: "Failed to fetch news",
        message:
          process.env.NODE_ENV === "production"
            ? "An error occurred while fetching news data"
            : error.message,
      });
    }
  });

  return router;
};

export default newsRoutes;
