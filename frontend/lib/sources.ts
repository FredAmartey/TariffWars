export interface Source {
  name: string;
  url: string;
}

/**
 * One entry per URL, first name wins.
 *
 * The weekly refresh has written the same URL twice under two names (a
 * specific proclamation title and the generic "Presidential Actions"), and the
 * freshness stamp keys its list by URL, so React warned about duplicate keys
 * on every load. The validator now warns on the data; this keeps the render
 * honest whatever the data says.
 */
export function dedupeSources<T extends Source>(sources: readonly T[]): T[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
