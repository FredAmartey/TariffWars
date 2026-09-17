// Pure helpers shared by TariffTable and the owners that render its sort
// control. They live outside the component file so React Fast Refresh can
// treat that file as components only.

/**
 * Statuses where no duty is actually being collected.
 *
 * Their recorded rate is history, not a price: a withdrawn 250% threat was
 * rendered in the same alarm-red as a live 250% tariff, and under the default
 * "Highest Rate First" sort two withdrawn rows led the page.
 */
const INACTIVE_STATUSES = new Set(["Withdrawn", "Ended", "Suspended", "Paused", "Expired"]);

export const isInactive = (status: string | undefined) => INACTIVE_STATUSES.has(status ?? "");

/** Human labels for every sortable field, shared by the table and its owners. */
const COLUMN_LABELS: Record<string, string> = {
  commodity: "Commodity",
  tariffOrigin: "Tariff from",
  to: "Target",
  rate: "Rate",
  changeDisplay: "Change",
  status: "Status",
  nature: "Type",
  effectiveDate: "Effective date",
  country: "Country",
  rateDisplay: "Rate imposed by USA",
  countrysTariffOnUS: "Rate imposed on USA",
  keyAffectedSectors: "Key sectors",
  marketImpact: "Market impact",
  responseType: "Response type",
};

const SORT_PRESETS = [
  { value: "rate-desc", label: "Highest Rate First" },
  { value: "rate-asc", label: "Lowest Rate First" },
  { value: "changeDisplay-desc", label: "Biggest Change First" },
  { value: "changeDisplay-asc", label: "Smallest Change First" },
  { value: "effectiveDate-desc", label: "Newest First" },
  { value: "effectiveDate-asc", label: "Oldest First" },
];

/**
 * The preset list, plus the current order when a column header picked
 * something outside it.
 *
 * A `<select>` whose value matches no option silently displays its first one,
 * so sorting by, say, Commodity from a header would have left the control
 * claiming "Highest Rate First".
 */
export function sortOptionsFor(
  field: string,
  direction: "asc" | "desc"
): Array<{ value: string; label: string }> {
  const current = `${field}-${direction}`;
  if (SORT_PRESETS.some((option) => option.value === current)) return SORT_PRESETS;
  const label = COLUMN_LABELS[field] ?? field;
  return [
    ...SORT_PRESETS,
    { value: current, label: `${label} (${direction === "asc" ? "A-Z" : "Z-A"})` },
  ];
}
