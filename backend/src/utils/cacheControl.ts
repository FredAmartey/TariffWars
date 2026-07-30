import { Response } from "express";

/**
 * Mark a response as cacheable by the CDN, decided at send time.
 *
 * The status code is not known when middleware runs, so setting a shared-cache
 * header up front would let an error be cached and replayed: one visitor's 429
 * or 500 could then be served to everyone until the TTL expired. Deferring the
 * decision to `writeHead` means only successful responses become cacheable.
 */
export const cacheableIfOk = (res: Response, sMaxAgeSeconds: number, swrSeconds: number): void => {
  const originalWriteHead = res.writeHead.bind(res);

  // Node calls writeHead on the way out of every response, including the
  // implicit call made by res.json()/res.end().
  res.writeHead = ((...args: unknown[]) => {
    if (!res.headersSent) {
      res.setHeader(
        "Cache-Control",
        res.statusCode >= 400
          ? "no-store"
          : `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${swrSeconds}`
      );
    }
    return (originalWriteHead as (...a: unknown[]) => Response)(...args);
  }) as typeof res.writeHead;
};
