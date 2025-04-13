import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { TariffService } from "./services/tariffService";
import { NewsService } from "./services/newsService";
import { DataRefreshService } from "./services/dataRefreshService";
import { TariffEntry } from "./types/tariff";
import { NewsArticle } from "./types/news";
import { tariffRoutes } from "./routes/tariffRoutes";
import { marketAnalysisRoutes } from "./routes/marketAnalysisRoutes";
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
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: "Too many requests, please try again later." },
  // Add proper IP extraction with guaranteed string return
  keyGenerator: (req) => {
    const realIP = req.headers["x-real-ip"];
    const forwardedFor = req.headers["x-forwarded-for"];
    return (
      (typeof realIP === "string" ? realIP : undefined) ||
      (typeof forwardedFor === "string" ? forwardedFor.split(",")[0] : undefined) ||
      req.ip ||
      "unknown"
    );
  },
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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// API rate limiting for specific endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: { error: "Too many API requests, please try again later." },
});

// Initialize services
const tariffService = new TariffService();
const newsService = new NewsService();
const dataRefreshService = new DataRefreshService();

// Start scheduled data refresh
dataRefreshService.startScheduling();

// Set up routes
console.log("Setting up routes...");

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Set up routes with their respective services - apply API rate limiter
app.use("/api/tariffs", apiLimiter, tariffRoutes(tariffService));
app.use("/api/news", apiLimiter, newsRoutes);
app.use("/api/market-analysis", apiLimiter, marketAnalysisRoutes(tariffService, newsService));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  dataRefreshService.stopScheduling();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Received SIGINT. Performing graceful shutdown...");
  dataRefreshService.stopScheduling();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Perform graceful shutdown
  dataRefreshService.stopScheduling();
  server.close(() => {
    console.log("Server closed due to uncaught exception");
    process.exit(1);
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Log only, don't crash the server
});
