import dotenv from "dotenv";

dotenv.config();

/**
 * Only settings something actually reads.
 *
 * This file used to carry `port`, `cors`, `rateLimit`, `proxies` and `cache`
 * keys that nothing imported. The `cors` entry was also wrong: `A || B ? x : y`
 * parses as `(A || B) ? x : y`, so setting CORS_ORIGIN without VERCEL_URL
 * produced the origin "https://undefined". Harmless only because it was dead.
 * Live CORS is configured from ALLOWED_ORIGINS in server.ts.
 */
export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
};
