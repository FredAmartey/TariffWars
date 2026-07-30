import express from "express";
import { cacheableIfOk } from "../utils/cacheControl";
import { clientKey } from "../utils/clientKey";
import rateLimit from "express-rate-limit";
import { MarketAnalysisService } from "../services/marketAnalysisService";
import { TariffService } from "../services/tariffService";
import { NewsService } from "../services/newsService";
import { AIInsight, KeyMetrics } from "../services/marketAnalysisService";

// Configure rate limiter for the refresh action
const aiInsightsRefreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 refresh requests per windowMs
  message: { error: "Too many refresh requests from this IP, please try again after 5 minutes" },
  // Only apply this limiter if refresh=true is in the query
  skip: (req) => req.query.refresh !== "true",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
});

// Stricter rate limiting for sensitive analysis endpoints
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for market analysis API." },
  keyGenerator: clientKey,
});

export const marketAnalysisRoutes = (tariffService: TariffService, newsService: NewsService) => {
  const router = express.Router();
  const marketAnalysisService = new MarketAnalysisService(tariffService, newsService);

  // Security middleware for all routes in this router
  router.use((req, res, next) => {
    res.removeHeader("X-Powered-By");

    if (req.query.refresh === "true") {
      // Manual refresh must regenerate and must not seed the CDN cache.
      res.setHeader("Cache-Control", "no-store");
    } else {
      // These responses are OpenAI-generated from CSVs that change weekly.
      // Let Vercel's edge cache serve them: first hit after expiry pays the
      // generation latency, everyone else gets CDN-speed responses. Browsers
      // always revalidate (max-age=0) so a fresh deploy shows up immediately.
      cacheableIfOk(res, 3600, 86400, { fromRoute: true });
    }

    if (req.query.refresh && req.query.refresh !== "true" && req.query.refresh !== "false") {
      return res.status(400).json({ error: "Invalid refresh parameter" });
    }

    next();
  });

  router.get("/overview", analysisLimiter, async (req, res) => {
    try {
      const overview = await marketAnalysisService.getMarketOverview();
      res.json(overview);
    } catch (error: any) {
      console.error("Error in /overview endpoint:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message:
          process.env.NODE_ENV === "production" ? "Failed to fetch market overview" : error.message,
      });
    }
  });

  router.get("/commodities", analysisLimiter, async (req, res) => {
    try {
      const analysis = await marketAnalysisService.getCommodityAnalysis();
      res.json(analysis);
    } catch (error: any) {
      console.error("Error in /commodities endpoint:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message:
          process.env.NODE_ENV === "production"
            ? "Failed to fetch commodity analysis"
            : error.message,
      });
    }
  });

  router.get("/regions", analysisLimiter, async (req, res) => {
    try {
      const analysis = await marketAnalysisService.getRegionalAnalysis();
      res.json(analysis);
    } catch (error: any) {
      console.error("Error in /regions endpoint:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message:
          process.env.NODE_ENV === "production"
            ? "Failed to fetch regional analysis"
            : error.message,
      });
    }
  });

  router.get("/predictions", analysisLimiter, async (req, res) => {
    try {
      const data = await marketAnalysisService.getMarketPredictions();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching market predictions:", error);
      res.status(500).json({
        error: "Failed to fetch market predictions",
        message:
          process.env.NODE_ENV === "production"
            ? "Could not retrieve market predictions"
            : error.message,
      });
    }
  });

  router.get("/key-metrics", analysisLimiter, async (req, res) => {
    try {
      const data: KeyMetrics = await marketAnalysisService.getKeyMetrics();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching key metrics:", error);
      res.status(500).json({
        error: "Failed to fetch key metrics",
        message:
          process.env.NODE_ENV === "production" ? "Could not retrieve key metrics" : error.message,
      });
    }
  });

  router.get("/ai-insights", aiInsightsRefreshLimiter, async (req, res) => {
    try {
      // Validate request parameters
      const bypassCache = req.query.refresh === "true";

      const data: AIInsight[] = await marketAnalysisService.getAIInsights(bypassCache);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching AI insights:", error);
      res.status(500).json({
        error: "Failed to fetch AI insights",
        message:
          process.env.NODE_ENV === "production" ? "Could not retrieve AI insights" : error.message,
      });
    }
  });

  return router;
};
