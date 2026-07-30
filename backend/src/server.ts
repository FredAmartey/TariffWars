import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { clientKey } from "./utils/clientKey";
import { cacheableIfOk } from "./utils/cacheControl";
import { TariffService } from "./services/tariffService";
import { NewsService } from "./services/newsService";
import { StockService } from "./services/stockService";
import { tariffRoutes } from "./routes/tariffRoutes";
import { marketAnalysisRoutes } from "./routes/marketAnalysisRoutes";
import { stockRoutes } from "./routes/stockRoutes";
import newsRoutes from "./routes/newsRoutes";

// Load environment variables
dotenv.config();

const app = express();

// Configure trust proxy more securely
app.set("trust proxy", 1); // trust first proxy

const port = process.env.PORT || 3001;

console.log("Starting server initialization...");

// Configure rate limiting with IP handling
console.log("Configuring rate limiting...");
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "600"),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: "Too many requests, please try again later." },
  keyGenerator: clientKey,
});

// Set up security middleware with helmet
console.log("Setting up security middleware...");
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://*.vercel-analytics.com",
        "https://*.vercel-insights.com",
        "https://*.vercel.app",
        "https://va.vercel-scripts.com",
      ],
      connectSrc: [
        "'self'",
        "https://*",
        "https://*.vercel-analytics.com",
        "https://*.vercel-insights.com",
        "https://*.vercel.app",
        "https://va.vercel-scripts.com",
      ],
      imgSrc: ["'self'", "data:", "https://*"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

// Configure CORS with specific origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:5173", "https://fredamartey.com"];

const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void
  ) {
    // Allow requests with no origin OR from allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`); // Log blocked origins
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Set up middleware
console.log("Setting up middleware...");
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(limiter);

// Set security headers manually for all routes
app.use((req, res, next) => {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Everything served here is public, read-only data derived from CSVs the
  // weekly agent rewrites, yet this used to send no-store on every route — so
  // the CDN never held anything and each search, sort and page ran a lambda.
  // Let the edge serve GETs; a data push redeploys and purges the cache, so
  // staleness is bounded by the deploy, not just the TTL.
  if (
    (req.method === "GET" || req.method === "HEAD") &&
    req.query.refresh !== "true" &&
    req.query.bypass_cache !== "true"
  ) {
    cacheableIfOk(res, 3600, 86400);
  } else {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// API rate limiting for specific endpoints
// Reading the tariff table is cheap (in-memory CSV) and interactive: searching,
// sorting and paging all issue requests, so the old 50/15min cap throttled
// ordinary browsing. Expensive AI routes keep their own tighter limiters.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many API requests, please try again later." },
  keyGenerator: clientKey,
});

// Initialize services. One instance each: a per-router NewsService would let
// concurrent analysis requests each fan out their own upstream news fetch.
const tariffService = new TariffService();
const newsService = new NewsService();
const stockService = new StockService();

// fredamartey.com serves the app under /projects/tariff-wars via reverse
// proxy, and the frontend's API base URL carries that prefix; accept those
// requests as if they arrived at bare /api.
app.use((req, _res, next) => {
  if (req.url.startsWith("/projects/tariff-wars/api/")) {
    req.url = req.url.slice("/projects/tariff-wars".length);
  }
  next();
});

// Set up routes
console.log("Setting up routes...");

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Set up routes with their respective services - apply API rate limiter
app.use("/api/tariffs", apiLimiter, tariffRoutes(tariffService));
app.use("/api/news", apiLimiter, newsRoutes(newsService));
app.use("/api/stocks", apiLimiter, stockRoutes(stockService));
app.use("/api/market-analysis", apiLimiter, marketAnalysisRoutes(tariffService, newsService));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);

  // Don't expose error details in production
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Internal Server Error",
    message: isProduction ? "Something went wrong" : err.message,
  });
});

// Start server
console.log("Starting server...");
const server = app
  .listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log("Environment:", {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
    });
  })
  .on("error", (error: any) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Please try a different port or kill the process using this port.`
      );
    } else {
      console.error("Failed to start server:", error);
    }
    process.exit(1);
  });

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Performing graceful shutdown...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Received SIGINT. Performing graceful shutdown...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Perform graceful shutdown
  server.close(() => {
    console.log("Server closed due to uncaught exception");
    process.exit(1);
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Log only, don't crash the server
});
