import express from "express";
import { NewsService } from "../services/newsService";
import rateLimit from "express-rate-limit";
import { clientKey } from "../utils/clientKey";
import { cacheableIfOk } from "../utils/cacheControl";

const router = express.Router();
const newsService = new NewsService();


const newsRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many news requests, please try again later." },
  keyGenerator: clientKey,
});

// News turns over during the day, so it gets a shorter edge TTL than the
// hourly default the rest of the API uses.
router.use((req, res, next) => {
  if (req.method === "GET" && req.query.refresh !== "true") {
    cacheableIfOk(res, 900, 3600);
  }
  next();
});

router.get("/tariff-news", newsRateLimiter, async (req, res) => {
  console.log(`[${new Date().toISOString()}] Received request for /api/news/tariff-news`); 
  try {
    
    
    console.log(`[${new Date().toISOString()}] Calling newsService.getTariffNews()...`);
    const articles = await newsService.getTariffNews();
    console.log(
      `[${new Date().toISOString()}] newsService.getTariffNews() returned ${
        articles ? articles.length : "null/undefined"
      } articles.`
    );

    
    res.removeHeader("X-Powered-By");

    
    if (Array.isArray(articles)) {
      console.log(
        `[${new Date().toISOString()}] Sending JSON response with ${articles.length} articles.`
      );
      res.json(articles);
    } else {
      console.error(
        `[${new Date().toISOString()}] Invalid data returned from newsService. Expected array, got:`,
        typeof articles
      );
      res.status(500).json({
        error: "Internal Server Error",
        message: "Received invalid data while fetching news.",
      });
    }
  } catch (error: any) {
    
    console.error(`[${new Date().toISOString()}] Error in /api/news/tariff-news handler:`, error);

    
    res.status(500).json({
      error: "Failed to fetch news",
      message:
        process.env.NODE_ENV === "production"
          ? "An error occurred while fetching news data"
          : error.message,
    });
  }
});

export default router;
