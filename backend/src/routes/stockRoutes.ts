import express from "express";
import rateLimit from "express-rate-limit";
import { clientKey } from "../utils/clientKey";
import { cacheableIfOk } from "../utils/cacheControl";
import { StockService } from "../services/stockService";
import { TariffService } from "../services/tariffService";
import { exposureFor, interleaveBySector } from "../services/tariffExposure";

const stockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many stock requests, please try again later." },
  keyGenerator: clientKey,
});

/**
 * How few exposed names is too few to be worth a panel.
 *
 * The join can legitimately return nothing: if every sector tariff lapses, no
 * tracked company is affected, and the panel should say so rather than pad
 * itself with unaffected tickers. Below this the route reports the empty set
 * honestly and lets the UI render the reason.
 */
const MIN_EXPOSED = 1;

export const stockRoutes = (stockService: StockService, tariffService: TariffService) => {
  const router = express.Router();

  router.get("/quotes", stockLimiter, async (_req, res) => {
    if (!stockService.isConfigured()) {
      // An unconfigured key is an operator problem, not a client one. Say so
      // plainly instead of returning an empty list the UI would read as
      // "markets are quiet".
      return res.status(503).json({
        error: "Stock data unavailable",
        message: "Market data is not configured on this server.",
      });
    }

    try {
      const allQuotes = await stockService.getQuotes();
      if (allQuotes.length === 0) {
        return res.status(502).json({
          error: "Stock data unavailable",
          message: "The market data provider did not return any quotes.",
        });
      }

      // The panel's contents, not the tracked list. A company appears because a
      // duty is currently charged on its industry, so the set changes when the
      // tariff data does. itemsPerPage is generous because this needs the whole
      // commodity table to rank against, not a page of it.
      const tariffs = await tariffService.getTariffRates({ type: "product", itemsPerPage: 1000 });
      const quotes = allQuotes
        .map((quote) => ({ ...quote, exposure: exposureFor(quote.industry, tariffs.data) }))
        .filter((quote) => quote.exposure !== null);
      const ordered = interleaveBySector(quotes);

      if (ordered.length < MIN_EXPOSED) {
        return res.json({ quotes: [], capturedAt: null, exposedCount: 0 });
      }

      // Quotes move all day, so they need a shorter edge TTL than the app-wide
      // hourly default, and the decision has to happen here rather than in
      // middleware: the service deliberately leaves a thin snapshot expired so
      // the next request retries it. Letting the CDN hold that thin snapshot
      // for five minutes would cancel the retry it was left expired for.
      // Cacheable only when the snapshot is genuinely current. Keying this on
      // the coverage threshold instead let the edge hold a partial snapshot for
      // five minutes and swallow the 30-second retry the service had queued.
      cacheableIfOk(res, 300, 600, {
        fromRoute: true,
        noStore: !stockService.isSnapshotFresh(),
      });

      // An absolute capture instant, not an age: this response is shared-cached
      // for minutes, so an age computed here would be frozen at send time and
      // every CDN hit would report the data as seconds old. The browser
      // subtracts it from its own clock.
      const capturedAt = stockService.oldestCapturedAt();
      res.json({
        quotes: ordered,
        capturedAt: capturedAt === null ? null : new Date(capturedAt).toISOString(),
        exposedCount: ordered.length,
      });
    } catch (error: any) {
      console.error("Error fetching stock quotes:", error?.message ?? error);
      res.status(502).json({
        error: "Stock data unavailable",
        message: "Could not retrieve market data.",
      });
    }
  });

  return router;
};
