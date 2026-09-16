/**
 * The filter list as the flat `field: value` pairs the tariff API takes.
 *
 * A later entry for the same field replaces an earlier one, which is what the
 * `reduce` it replaced did too.
 */
export function filterParams(
  filters: ReadonlyArray<{ field: string; value: string }>
): Record<string, string> {
  return Object.fromEntries(filters.map((filter) => [filter.field, filter.value]));
}
