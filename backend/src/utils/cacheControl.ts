import { Response } from "express";

const POLICY = Symbol.for("tariffwars.cachePolicy");

interface Policy {
  sMaxAge: number;
  swr: number;
  fromRoute: boolean;
  noStore?: boolean;
}

interface WithPolicy extends Response {
  [POLICY]?: Policy;
}

/**
 * Mark a response as cacheable by the CDN, decided at send time.
 *
 * Two things have to happen late rather than early:
 *
 * 1. The status code is not known when middleware runs, so setting a shared
 *    cache header up front would let an error be cached and replayed: one
 *    visitor's 429 or 500 could then be served to everyone until the TTL
 *    expired. Only a successful response becomes cacheable.
 *
 * 2. The winning TTL cannot be decided by wrapper order. The app-wide
 *    middleware runs before any router, so it wrapped `writeHead` first and
 *    therefore ran *last*, overwriting whatever a route had asked for. News
 *    requested 900s and silently shipped with the app-wide 3600s. The policy
 *    now lives on the response and a single wrapper reads it at write time, so
 *    a route-specific TTL wins regardless of registration order.
 */
export const cacheableIfOk = (
  res: Response,
  sMaxAgeSeconds: number,
  swrSeconds: number,
  opts: { fromRoute?: boolean; noStore?: boolean } = {}
): void => {
  const holder = res as WithPolicy;
  const existing = holder[POLICY];
  const fromRoute = opts.fromRoute === true;

  // A route knows more about its own freshness than the app-wide default does.
  if (existing?.fromRoute && !fromRoute) return;

  holder[POLICY] = {
    sMaxAge: sMaxAgeSeconds,
    swr: swrSeconds,
    fromRoute,
    noStore: opts.noStore === true,
  };

  // Wrap once; later calls only update the policy the wrapper will read.
  if (existing) return;

  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = ((...args: unknown[]) => {
    if (!res.headersSent) {
      // Set immediately above by cacheableIfOk, which is the only writer.
      const policy = holder[POLICY] ?? { sMaxAge: sMaxAgeSeconds, swr: swrSeconds, fromRoute };
      // A handler cannot opt out by calling res.setHeader itself: this hook runs
      // last and would overwrite it. `noStore` is how a route says "this
      // particular successful response must not be shared-cached".
      res.setHeader(
        "Cache-Control",
        res.statusCode >= 400 || policy.noStore
          ? "no-store"
          : `public, max-age=0, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.swr}`
      );
    }
    return (originalWriteHead as (...a: unknown[]) => Response)(...args);
  }) as typeof res.writeHead;
};
