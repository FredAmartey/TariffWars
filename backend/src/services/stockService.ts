import axios from "axios";

/**
 * Server-side Finnhub client.
 *
 * The dashboard used to call Finnhub straight from the browser with the key
 * inlined by Vite, which published the credential in the JS bundle for anyone
 * to lift. Fetching here keeps it server-only, and lets one upstream fetch
 * serve every visitor instead of 40 requests per page load.
 */

// Only these symbols are ever forwarded upstream, so a query parameter can
// never steer a request at an arbitrary Finnhub resource.
// "X" (US Steel) used to be here and never returned a quote: it was delisted
// after the Nippon Steel acquisition, so every round spent two requests on it
// and came back 19 of 20.
const TRACKED_SYMBOLS = [
  "NUE", "STLD", "CLF", "TSLA", "AAPL", "GM", "INTC", "CAT", "BA",
  "SMH", "XME", "F", "MU", "JD", "NIO", "BABA", "TM", "CRSR", "HPQ",
] as const;

/**
 * Share of tracked symbols that must be present and current for the snapshot
 * to count as fresh.
 *
 * Not 100%: a single future delisting would then pin the panel to "never
 * fresh", so it would never be cacheable and would re-fan-out every 30 seconds
 * forever. Not a bare count of what happened to come back either, which is the
 * bug this replaces: freshness was judged over *retained* entries, so a cold
 * round returning 10 of 20 was trivially "all fresh" because the 10 it missed
 * were simply absent from the map.
 */
const MIN_COVERAGE = 0.9;

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  /** Millions of USD, as Finnhub reports it. Null when the profile lookup fails. */
  marketCap: number | null;
}

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export class StockService {
  // Per symbol, not per batch. A batch timestamp let a symbol that kept failing
  // ride along on its neighbours' refreshes: the merged snapshot was restamped
  // fresh every round, so one symbol's price could stay frozen for hours while
  // being served, and CDN-cached, as current.
  private quotes: Map<string, { quote: StockQuote; at: number }> = new Map();
  // Quotes move all day but the panel is ambient, not a trading tool.
  private readonly ttl = 5 * 60 * 1000;
  // Concurrent cold requests would otherwise each fan out 40 upstream calls.
  private inFlight: Promise<StockQuote[]> | null = null;
  /**
   * Earliest time an incomplete snapshot may be retried.
   *
   * A thin round leaves the freshness timestamp expired on purpose, so without
   * this every subsequent request would re-run a 40-call fan-out. During a
   * provider outage that turns one failure into sustained amplification and
   * burns the quota. Retry soon, but not on every request.
   */
  private retryNotBefore = 0;
  private readonly retryBackoff = 30 * 1000;
  /**
   * Oldest snapshot still worth showing. Past this, a prolonged provider
   * outage would leave hours-old prices on screen presented as current, which
   * is worse than saying the panel is unavailable.
   */
  private readonly maxStale = 30 * 60 * 1000;

  private get apiKey(): string {
    return process.env.FINNHUB_API_KEY || "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * The single question anything outside this class should ask: is what we are
   * about to serve actually current?
   *
   * There used to be three overlapping answers here (coverage threshold,
   * per-entry freshness, and "cacheable"), and every round of review found
   * another place where two of them disagreed: a 19-of-20 refresh counted as
   * complete, so the route let the CDN pin it for five minutes while the
   * service was scheduling a 30-second retry for the symbol it had missed.
   * One predicate now drives caching, the retry timer, and the read path
   * alike, so they cannot drift apart again.
   */
  isSnapshotFresh(): boolean {
    return this.allFresh(Date.now());
  }

  /**
   * When the oldest quote still being served was captured, as epoch ms, or
   * null when there is nothing to serve.
   *
   * The route sends this rather than a precomputed age: the response is
   * shared-cached for minutes, so an age calculated here would be frozen at
   * whatever it was when the origin answered, and every CDN hit would claim
   * the data was seconds old. An absolute instant stays true in a cache.
   */
  oldestCapturedAt(): number | null {
    // Measured over what is actually sent, so the age the browser computes
    // describes the quotes on screen rather than an entry that was filtered out.
    const served = this.servedEntries(Date.now());
    if (served.length === 0) return null;
    return Math.min(...served.map((e) => e.at));
  }

  /** Entries still inside the stale ceiling, judged per symbol. */
  private liveEntries(now: number): Array<{ quote: StockQuote; at: number }> {
    return [...this.quotes.values()].filter((e) => now - e.at <= this.maxStale);
  }

  private liveQuotes(now: number): StockQuote[] {
    return this.servedEntries(now).map((e) => e.quote);
  }

  /** Entries refreshed within the TTL, i.e. genuinely current. */
  private currentEntries(now: number): Array<{ quote: StockQuote; at: number }> {
    return this.liveEntries(now).filter((e) => now - e.at < this.ttl);
  }

  /**
   * What actually goes out, and it must agree with `allFresh`.
   *
   * These disagreed: freshness counted only current entries while the payload
   * shipped everything inside the 30-minute ceiling, so a snapshot could be
   * declared fresh and CDN-cached for five minutes while carrying a
   * twenty-minute-old price for the one symbol that had failed. A response
   * called fresh now contains only fresh quotes; the failed symbol drops out
   * until it comes back. Degraded mode still serves what it has, but it is
   * never labelled fresh, never cached, and is flagged stale in the UI.
   */
  private servedEntries(now: number): Array<{ quote: StockQuote; at: number }> {
    return this.allFresh(now) ? this.currentEntries(now) : this.liveEntries(now);
  }

  /**
   * True when the held snapshot is both recent and broad enough to stand.
   *
   * Checking only the retained entries let a thin round short-circuit its own
   * retry: one surviving quote is trivially "fresh", so the partial snapshot
   * was served for the full five-minute TTL and the 30-second retry never
   * ran, even though the round had been marked incomplete.
   */
  private allFresh(now: number): boolean {
    // Coverage is measured against the tracked set, not against whatever the
    // map happens to hold, so missing symbols count against freshness instead
    // of being invisible to it.
    return (
      this.currentEntries(now).length >= Math.ceil(TRACKED_SYMBOLS.length * MIN_COVERAGE)
    );
  }

  async getQuotes(): Promise<StockQuote[]> {
    const now = Date.now();
    if (this.allFresh(now)) return this.liveQuotes(now);
    if (this.inFlight) return this.inFlight;

    // Hold off re-fanning-out while a recent round came back thin. This must
    // apply even with nothing cached: a cold start against an invalid key or a
    // dead provider returns zero quotes, creates no cache, and would otherwise
    // let every single request launch another 40 upstream calls, which is the
    // amplification the backoff exists to prevent.
    if (now < this.retryNotBefore) return this.liveQuotes(now);

    this.inFlight = this.fetchAll()
      .then((fresh) => {
        // Merge rather than replace, but stamp each symbol with its own fetch
        // time. A round where the provider answered for one symbol and failed
        // for the other nineteen must not become the authoritative snapshot,
        // and equally must not relabel the nineteen it did not refresh.
        const at = Date.now();
        for (const quote of fresh) this.quotes.set(quote.symbol, { quote, at });

        // Drop anything past the ceiling so it can never be served again.
        for (const [symbol, entry] of this.quotes) {
          if (at - entry.at > this.maxStale) this.quotes.delete(symbol);
        }

        // One predicate decides everything: whether to cache, whether to
        // retry, and whether to serve. A separate "completeness" flag kept
        // drifting out of step with it and produced a fresh review finding
        // every round.
        this.retryNotBefore = this.allFresh(at) ? 0 : at + this.retryBackoff;
        return this.liveQuotes(at);
      })
      .catch((error) => {
        // A thrown round is as much a failure as a thin one, and must arm the
        // same backoff rather than inviting an immediate retry.
        console.error("Stock fetch round failed:", error?.message ?? error);
        this.retryNotBefore = Date.now() + this.retryBackoff;
        return this.liveQuotes(Date.now());
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async fetchAll(): Promise<StockQuote[]> {
    const results = await Promise.all(
      TRACKED_SYMBOLS.map((symbol) => this.fetchOne(symbol).catch(() => null))
    );
    return results.filter((r): r is StockQuote => r !== null);
  }

  private async fetchOne(symbol: string): Promise<StockQuote | null> {
    const [quote, profile] = await Promise.all([
      axios.get(`${FINNHUB_BASE}/quote`, {
        params: { symbol, token: this.apiKey },
        timeout: 8000,
      }),
      axios
        .get(`${FINNHUB_BASE}/stock/profile2`, {
          params: { symbol, token: this.apiKey },
          timeout: 8000,
        })
        .catch(() => null),
    ]);

    const q = quote.data;
    if (!q || typeof q.c !== "number" || typeof q.pc !== "number" || q.pc === 0) {
      return null;
    }

    const change = q.c - q.pc;
    return {
      symbol,
      price: q.c,
      previousClose: q.pc,
      change,
      changePercent: (change / q.pc) * 100,
      dayHigh: q.h,
      dayLow: q.l,
      // Reporting a guess as a market cap is worse than reporting none: the old
      // client-side estimator divided share counts that were already in
      // millions by another million and rendered the result as fact.
      marketCap:
        profile && typeof profile.data?.marketCapitalization === "number"
          ? profile.data.marketCapitalization
          : null,
    };
  }
}
