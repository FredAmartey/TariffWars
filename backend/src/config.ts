import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  cors: {
    origin:
      process.env.CORS_ORIGIN || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:5173", // Default to Vite dev port
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  proxies: {
    // Free proxy list from https://geonode.com/free-proxy-list
    list: process.env.PROXY_LIST ? process.env.PROXY_LIST.split(",") : [],
    timeout: 5000,
    retryDelay: 1000,
    maxRetries: 3,
  },
  cache: {
    timeout: 5 * 60 * 1000, // 5 minutes
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
};
