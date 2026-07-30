import { Request } from "express";

/**
 * Rate-limit key for a request.
 *
 * fredamartey.com proxies through nginx before Vercel, so `req.ip` resolves to
 * the proxy and every visitor collapses into a single shared bucket. Key off
 * the forwarded client address instead so limits apply per visitor.
 */
export const clientKey = (req: Request): string => {
  const realIP = req.headers["x-real-ip"];
  const forwardedFor = req.headers["x-forwarded-for"];
  return (
    (typeof realIP === "string" ? realIP : undefined) ||
    (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : undefined) ||
    req.ip ||
    "unknown"
  );
};
