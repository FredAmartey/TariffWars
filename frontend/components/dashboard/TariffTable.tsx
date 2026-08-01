import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  PackageIcon,
  GlobeIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react";
import { apiService } from "../../services/api";
import type { TariffEntry } from "../../types/index";
import debounce from "lodash/debounce";
import type { ChangeEvent } from "react";

interface TariffTableProps {
  searchTerm?: string;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  filters?: Array<{ field: string; value: string }>;
  page: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  /** Optional: the dashboard renders no pager of its own, so it has no
      count to receive and used to pass an empty function to satisfy this. */
  onTotalPagesChange?: (totalPages: number) => void;
  handleSortChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  /**
   * Lets an owner that renders its own sort control stay in step with the
   * column headers. Without it the two disagree: clicking a header re-sorted
   * the rows while the dropdown carried on displaying the previous order.
   */
  onSortChange?: (field: string, direction: "asc" | "desc") => void;
  /** Lets the page know which dataset is on screen, so Export can match it. */
  onDatasetChange?: (dataset: "product" | "country") => void;
  /**
   * "compact" drops the columns that are near-constant or derivable, for the
   * two-thirds-width dashboard card. The full eight-column layout overflowed
   * that container by ~60px even on a wide desktop, clipping the effective
   * date to "August ' 2026".
   */
  variant?: "full" | "compact";
}

type TabType = "countries" | "products";

/**
 * Statuses where no duty is actually being collected.
 *
 * Their recorded rate is history, not a price: a withdrawn 250% threat was
 * rendered in the same alarm-red as a live 250% tariff, and under the default
 * "Highest Rate First" sort two withdrawn rows led the page.
 */
const INACTIVE_STATUSES = new Set(["Withdrawn", "Ended", "Suspended", "Paused", "Expired"]);

export const isInactive = (status: string | undefined) => INACTIVE_STATUSES.has(status ?? "");

const MUTED_BADGE = "bg-muted text-muted-foreground";

// Same blue pairing STATUS_COLOURS uses for "Legacy Tariff", but this badge
// reports a different fact (the country's own tariff rate on the US, not a US
// tariff's status), so it stays a literal colour rather than borrowing that
// token's name.
const COUNTRY_TARIFF_BADGE = "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";

const BADGE_BASE = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium";

/**
 * Rate colour is severity, so it only applies while the rate is being charged.
 */
const rateBadgeClass = (entry: TariffEntry): string => {
  if (isInactive(entry.status)) return MUTED_BADGE;
  if (entry.rateDisplay === "N/A" || entry.rateDisplay === "Paused") {
    return MUTED_BADGE;
  }
  if (entry.rateDisplay === "Restricted" || entry.rate >= 25) {
    return "bg-severity-high text-severity-high-foreground";
  }
  if (entry.rate >= 15) {
    return "bg-severity-medium text-severity-medium-foreground";
  }
  return "bg-severity-low text-severity-low-foreground";
};

const STATUS_COLOURS: Record<string, string> = {
  Active: "bg-status-active text-status-active-foreground",
  Threatened: "bg-status-threatened text-status-threatened-foreground",
  Proposed: "bg-status-proposed text-status-proposed-foreground",
  Restricted: "bg-status-restricted text-status-restricted-foreground",
  "Legacy Tariff": "bg-status-legacy text-status-legacy-foreground",
  "Reciprocal Tariff": "bg-status-reciprocal text-status-reciprocal-foreground",
  "Under Investigation": "bg-status-investigating text-status-investigating-foreground",
};

const statusBadgeClass = (status: string | undefined): string =>
  STATUS_COLOURS[status ?? ""] ?? MUTED_BADGE;

const marketImpactClass = (entry: TariffEntry): string => {
  const impact = entry.marketImpact?.toLowerCase() ?? "";
  if (impact.includes("severe") || impact.includes("significant")) {
    return "bg-severity-high text-severity-high-foreground";
  }
  if (impact.includes("moderate")) {
    return "bg-severity-medium text-severity-medium-foreground";
  }
  if (impact.includes("mild") || impact.includes("minimal") || impact.includes("mixed")) {
    return "bg-severity-low text-severity-low-foreground";
  }
  return MUTED_BADGE;
};

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

/**
 * Frozen module-level default for an omitted `filters` prop.
 *
 * `filters = []` as a default parameter allocates a NEW array on every render.
 * That reference is a dependency of `getCacheKey` -> `fetchData` ->
 * `debouncedFetchData` -> the fetch effect, so every render invalidated the
 * whole chain, and the effect's cleanup cancelled the pending request and
 * started a fresh 500ms timer. While the dashboard's other panels (stocks,
 * news, insights, metrics) resolved and re-rendered the tree, the table's
 * fetch was starved: measured 3.6s from click to the request leaving, then
 * three duplicates at once.
 */
const NO_FILTERS: Array<{ field: string; value: string }> = [];

/**
 * Relative column widths, normalised at render time (see ColGroup).
 *
 * The table used to size itself from its content, so every sort reflowed it:
 * measured shifts of up to 41px, which moved the header out from under the
 * cursor that had just clicked it.
 *
 * The numbers are taken from what the browser's auto layout actually chose for
 * this data, measured on the deployed table, rather than guessed. A first pass
 * did guess, and gave MARKET IMPACT 14 when auto settles on ~22; the prose
 * columns were squeezed into ribbons and the rows grew to compensate.
 */
const COUNTRY_COLUMNS = [
  { key: "country", label: "COUNTRY", width: 12 },
  { key: "rateDisplay", label: "RATE IMPOSED BY USA", width: 11 },
  { key: "status", label: "STATUS", width: 10 },
  { key: "countrysTariffOnUS", label: "RATE IMPOSED ON USA", width: 12 },
  { key: "keyAffectedSectors", label: "KEY SECTORS", width: 18 },
  { key: "marketImpact", label: "MARKET IMPACT", width: 22 },
  { key: "responseType", label: "RESPONSE TYPE", width: 15 },
] as const;

/**
 * Widths are weights, not percentages, because the dashboard renders a
 * six-column subset of the same eight. Normalising against the visible set
 * keeps both layouts full-width without a second table of numbers to maintain.
 */
const ColGroup: React.FC<{ columns: ReadonlyArray<{ key: string; width: number }> }> = ({
  columns,
}) => {
  const total = columns.reduce((sum, c) => sum + c.width, 0);
  return (
    <colgroup>
      {columns.map((c) => (
        <col key={c.key} style={{ width: `${((c.width / total) * 100).toFixed(3)}%` }} />
      ))}
    </colgroup>
  );
};

const RateBadge: React.FC<{ entry: TariffEntry }> = ({ entry }) => {
  const inactive = isInactive(entry.status);
  return (
    <span
      className={`${BADGE_BASE} ${rateBadgeClass(entry)} ${
        inactive ? "line-through decoration-1" : ""
      }`}
      title={inactive ? `Not currently charged (${entry.status})` : undefined}
    >
      {entry.rateDisplay || `${entry.rate}%`}
    </span>
  );
};

const StatusBadge: React.FC<{ status: string | undefined }> = ({ status }) => (
  <span className={`${BADGE_BASE} ${statusBadgeClass(status)}`}>{status || "N/A"}</span>
);

/**
 * Change direction, coloured for the subject matter rather than for a stock
 * ticker.
 *
 * A rising tariff was drawn green-with-an-up-arrow and a cut red, borrowing the
 * markets convention where "up" is good news. On a tariff tracker the opposite
 * holds: an increase is the cost and a reduction is the relief.
 */
const ChangeCell: React.FC<{ display: string | undefined }> = ({ display }) => {
  const numeric = display ? Number(display.replace("%", "")) : NaN;
  const neutral = "text-muted-foreground";

  if (!display || display === "–" || Number.isNaN(numeric) || numeric === 0) {
    return <span className={neutral}>{display || "–"}</span>;
  }

  const rose = numeric > 0;
  const tone = rose ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
  const Icon = rose ? ArrowUpIcon : ArrowDownIcon;

  return (
    <span
      className={`flex items-center space-x-1 ${tone}`}
      title={rose ? "Tariff increased" : "Tariff reduced"}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{display}</span>
    </span>
  );
};

/**
 * A sortable column header.
 *
 * These were plain `<th onClick>` elements: not focusable, not operable by
 * keyboard, and carrying no `aria-sort`, so sorting existed only for mouse
 * users and the current order was invisible to a screen reader. The button
 * inside gives it a role, focus and Enter/Space for free.
 */
const SortableHeader = ({
  field,
  label,
  activeField,
  direction,
  onSort,
  tooltip,
}: {
  field: string;
  label: string;
  activeField: string;
  direction: "asc" | "desc";
  onSort: (field: string) => void;
  tooltip?: string;
}) => {
  const active = activeField === field;
  return (
    // The padding lives on the button, not the th, so the click target is the
    // whole cell. With it on the th, the button sat inside a 16px horizontal
    // and 12px vertical dead border that still lit up on hover (the hover
    // style is on the th) but ignored clicks.
    //
    // `h-px` is doing real work: a button's `h-full` cannot resolve against a
    // table cell that has no definite height, so only the tallest header (the
    // one whose label wraps) was fully covered and the rest sat at 68%. Giving
    // the th a nominal height that content immediately overrides is what lets
    // `h-full` resolve. `display:flex` on the th also works but can strip its
    // implicit columnheader role, and these carry scope and aria-sort.
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="h-px p-0 text-left text-sm font-semibold text-muted-foreground hover:bg-gray-700/50"
      title={tooltip}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center w-full h-full px-4 py-3 text-left font-semibold"
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ChevronUpIcon className="h-4 w-4 ml-1" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 ml-1" aria-hidden="true" />
          )
        ) : null}
      </button>
    </th>
  );
};

const TARIFF_TYPE_TOOLTIP =
  "Kind of trade action, independent of status and date. " +
  "New: creates a tariff line. " +
  "Additional: stacks on a duty already being collected. " +
  "Reciprocal: retaliation imposed on the US. " +
  "Temporary: time-limited by statute.";

type ColumnKey =
  | "commodity"
  | "tariffOrigin"
  | "to"
  | "rate"
  | "changeDisplay"
  | "status"
  | "nature"
  | "effectiveDate";

const PRODUCT_COLUMNS: Array<{
  key: ColumnKey;
  label: string;
  tooltip?: string;
  compact: boolean;
  width: number;
}> =
  [
    { key: "commodity", label: "COMMODITY", compact: true, width: 33 },
    { key: "tariffOrigin", label: "TARIFF FROM", compact: false, width: 8 },
    { key: "to", label: "TO", compact: true, width: 16 },
    { key: "rate", label: "RATE", compact: true, width: 7 },
    { key: "changeDisplay", label: "CHANGE", compact: true, width: 7 },
    { key: "status", label: "STATUS", compact: true, width: 9 },
    { key: "nature", label: "TYPE", tooltip: TARIFF_TYPE_TOOLTIP, compact: false, width: 8 },
    { key: "effectiveDate", label: "EFFECTIVE DATE", compact: true, width: 12 },
  ];

export const TariffTable: React.FC<TariffTableProps> = ({
  searchTerm = "",
  sortField = "effectiveDate",
  sortDirection = "desc",
  filters = NO_FILTERS,
  page,
  itemsPerPage = 5,
  onPageChange,
  onTotalPagesChange,
  handleSortChange,
  onSortChange,
  onDatasetChange,
  variant = "full",
}) => {
  const [data, setData] = useState<TariffEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [localSortField, setLocalSortField] = useState(sortField);
  const [localSortDirection, setLocalSortDirection] = useState(sortDirection);
  const requestCache = useRef<{ [key: string]: { data: any; timestamp: number } }>({});
  const latestRequestId = useRef(0);
  const cacheTimeout = 60000; // 1 minute cache timeout
  const [isMobile, setIsMobile] = useState(false);

  const productColumns = PRODUCT_COLUMNS.filter((c) => variant === "full" || c.compact);

  const handleSort = (field: string) => {
    const newDirection =
      field === localSortField ? (localSortDirection === "asc" ? "desc" : "asc") : "asc";
    const newField = field;

    setLocalSortField(newField);
    setLocalSortDirection(newDirection);
    // Tell the owner too, so a sort control it renders alongside the table does
    // not keep advertising an order the rows no longer use.
    onSortChange?.(newField, newDirection);
  };

  // Serialised once so everything downstream can depend on the VALUE of the
  // filters rather than the array's identity. A caller that rebuilds its
  // filter array each render (TariffRates does, via setState) would otherwise
  // invalidate the fetch chain on every unrelated re-render.
  const filtersKey = JSON.stringify(filters);

  const getCacheKey = useCallback(() => {
    return JSON.stringify({
      searchTerm,
      localSortField,
      localSortDirection,
      filters: filtersKey,
      page,
      itemsPerPage,
      activeTab,
    });
  }, [searchTerm, localSortField, localSortDirection, filtersKey, page, itemsPerPage, activeTab]);

  const fetchData = useCallback(async () => {
    const now = Date.now();
    const cacheKey = getCacheKey();
    const cachedResult = requestCache.current[cacheKey];

    // Every change of search, sort, filter, page or tab starts a request.
    // Without this token, a slow earlier request could land after a faster
    // later one and repaint the table with a query the user has moved on from.
    const requestId = ++latestRequestId.current;
    const isStale = () => requestId !== latestRequestId.current;

    if (cachedResult && now - cachedResult.timestamp < cacheTimeout) {
      setData(cachedResult.data.data);
      setTotalItems(cachedResult.data.total);
      onTotalPagesChange?.(cachedResult.data.totalPages);
      // Clear the previous failure too. Serving cached rows while last
      // request's error banner stayed on screen showed good data under a
      // message saying the data could not be loaded.
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const apiParams = {
        search: searchTerm,
        sortBy: localSortField as keyof TariffEntry,
        sortOrder: localSortDirection,
        page,
        itemsPerPage,
        type: (activeTab === "countries" ? "country" : "product") as "country" | "product",
        ...filters.reduce(
          (acc, filter) => ({
            ...acc,
            [filter.field]: filter.value,
          }),
          {}
        ),
      };

      const response = await apiService.getTariffRates(apiParams);
      if (isStale()) return;

      // Cache the response, dropping entries that have aged out so a long
      // session of unique searches can't grow this map without bound.
      for (const [key, entry] of Object.entries(requestCache.current)) {
        if (now - entry.timestamp >= cacheTimeout) {
          delete requestCache.current[key];
        }
      }

      if (response && response.data && Array.isArray(response.data)) {
        // Only successful responses are cached. Caching a failure meant an
        // outage kept being replayed from memory for a minute after it ended.
        requestCache.current[cacheKey] = { data: response, timestamp: now };
        setData(response.data);
        setTotalItems(response.total || 0);
        onTotalPagesChange?.(response.totalPages);
      } else {
        console.error("Invalid tariff data structure:", response);
        setError("Tariff data came back in an unexpected format.");
        setData([]);
        setTotalItems(0);
        onTotalPagesChange?.(1);
      }
      setIsLoading(false);
    } catch (err) {
      if (isStale()) return;
      setError("Failed to load tariff data. Please try again.");
      console.error("Error fetching tariff data:", err);
      setIsLoading(false);
    }
    // `filters` is read above but `filtersKey` is the dependency on purpose:
    // the key is its serialised value, so it changes exactly when the filters
    // meaningfully change, whereas the array's identity changes on every
    // render of a caller that rebuilds it. Depending on the identity is what
    // starved this fetch for seconds at a time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchTerm,
    localSortField,
    localSortDirection,
    filtersKey,
    page,
    itemsPerPage,
    onTotalPagesChange,
    getCacheKey,
    activeTab,
  ]);

  // Only the search box needs debouncing; it is the one input that changes on
  // every keystroke. Routing tab switches, page turns and sorts through the
  // same 500ms timer made each of them wait for a delay that exists to absorb
  // typing, on top of the starvation described on NO_FILTERS above.
  const fetchRef = useRef(fetchData);
  fetchRef.current = fetchData;

  const debouncedSearchFetch = useMemo(
    // Reads through a ref so the debounced function keeps a stable identity;
    // recreating it per render is what let the cleanup cancel pending work.
    () => debounce(() => fetchRef.current(), 500),
    []
  );

  useEffect(() => {
    if (searchTerm) {
      debouncedSearchFetch();
      return () => debouncedSearchFetch.cancel();
    }
    // Discrete actions fetch immediately.
    fetchRef.current();
  }, [searchTerm, filtersKey, localSortField, localSortDirection, page, itemsPerPage, activeTab, debouncedSearchFetch]);

  // Any pending keystroke fetch dies with the component.
  useEffect(() => () => debouncedSearchFetch.cancel(), [debouncedSearchFetch]);

  // Keep local sort in step when the owner drives it (its own dropdown).
  useEffect(() => {
    setLocalSortField(sortField);
    setLocalSortDirection(sortDirection);
  }, [sortField, sortDirection]);

  // Switching tabs returns to page 1. `page` is read but deliberately not a
  // dependency: including it would re-run this on every page change and pin
  // the user to page 1.
  useEffect(() => {
    if (page !== 1) {
      onPageChange(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, onPageChange]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const MobileTariffCard: React.FC<{
    entry: TariffEntry;
    activeTab: TabType;
  }> = ({ entry, activeTab }) => {
    const cardBg = "bg-card border-border";
    const labelColor = "text-gray-500";
    const valueColor = "text-foreground";
    return (
      <div className={`border rounded-lg p-4 ${cardBg}`}>
        {activeTab === "products" ? (
          <>
            <div className="mb-2">
              <span className={`text-xs font-medium ${labelColor}`}>Commodity</span>
              <p className={`font-semibold ${valueColor}`}>{entry.commodity}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className={`block text-xs ${labelColor}`}>Rate</span>
                <RateBadge entry={entry} />
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Status</span>
                <StatusBadge status={entry.status} />
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Effective Date</span>
                <p className={valueColor}>{entry.effectiveDate || "N/A"}</p>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>To</span>
                <p className={valueColor}>{entry.to || "N/A"}</p>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Tariff From</span>
                <p className={valueColor}>{entry.tariffOrigin || "N/A"}</p>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Type</span>
                <p className={valueColor} title={TARIFF_TYPE_TOOLTIP}>
                  {entry.nature || "N/A"}
                </p>
              </div>
              {entry.changeDisplay && entry.changeDisplay !== "–" && (
                <div>
                  <span className={`block text-xs ${labelColor}`}>Change</span>
                  <ChangeCell display={entry.changeDisplay} />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mb-2">
              <span className={`text-xs font-medium ${labelColor}`}>Country</span>
              <p className={`font-semibold ${valueColor}`}>{entry.country}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className={`block text-xs ${labelColor}`}>Rate (by USA)</span>
                <RateBadge entry={entry} />
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Status</span>
                <StatusBadge status={entry.status} />
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Rate (on USA)</span>
                <span
                  className={`${BADGE_BASE} ${
                    !entry.countrysTariffOnUS || entry.countrysTariffOnUS === "N/A"
                      ? MUTED_BADGE
                      : COUNTRY_TARIFF_BADGE
                  }`}
                >
                  {entry.countrysTariffOnUS}
                </span>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Key Sectors</span>
                <p className={valueColor}>{entry.keyAffectedSectors}</p>
              </div>

              {entry.marketImpact && (
                <div className="col-span-2">
                  <span className={`block text-xs ${labelColor}`}>Market Impact</span>
                  <span className={`${BADGE_BASE} ${marketImpactClass(entry)}`}>
                    {entry.marketImpact}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  if (isLoading && !data.length) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
        <p role="status">Loading tariff data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500" role="alert">
        <p>{error}</p>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="p-8 text-center rounded-lg bg-muted">
        <p className="text-lg font-medium text-muted-foreground">
          No tariff data found{searchTerm ? ` for "${searchTerm}"` : ""}.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Try adjusting your search criteria or check back later.
        </p>
      </div>
    );
  }

  const renderProductCell = (entry: TariffEntry, key: ColumnKey) => {
    const textCell = "px-4 py-4 text-sm text-foreground";
    switch (key) {
      case "commodity":
        return <td className={textCell}>{entry.commodity}</td>;
      case "tariffOrigin":
        return <td className={textCell}>{entry.tariffOrigin || "N/A"}</td>;
      case "to":
        return <td className={textCell}>{entry.to}</td>;
      case "rate":
        return (
          <td className="px-4 py-4 text-sm">
            <RateBadge entry={entry} />
          </td>
        );
      case "changeDisplay":
        return (
          <td className={textCell}>
            <ChangeCell display={entry.changeDisplay} />
          </td>
        );
      case "status":
        return (
          <td className="px-4 py-4 text-sm">
            <StatusBadge status={entry.status} />
          </td>
        );
      case "nature":
        return (
          <td className={textCell} title={TARIFF_TYPE_TOOLTIP}>
            {entry.nature || "N/A"}
          </td>
        );
      case "effectiveDate":
        return <td className={`${textCell} whitespace-nowrap`}>{entry.effectiveDate || "N/A"}</td>;
    }
  };

  return (
    <div>
      <div className="mb-4 flex space-x-4" role="group" aria-label="Dataset">
        <button
          onClick={() => {
            setActiveTab("products");
            onDatasetChange?.("product");
            onPageChange(1);
          }}
          aria-pressed={activeTab === "products"}
          className={`px-4 py-2 rounded-md flex items-center ${
            activeTab === "products"
              ? "bg-blue-500 text-white dark:bg-blue-600"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <PackageIcon className="w-4 h-4 mr-2" aria-hidden="true" />
          Products
        </button>
        <button
          onClick={() => {
            setActiveTab("countries");
            onDatasetChange?.("country");
            onPageChange(1);
          }}
          aria-pressed={activeTab === "countries"}
          className={`px-4 py-2 rounded-md flex items-center ${
            activeTab === "countries"
              ? "bg-blue-500 text-white dark:bg-blue-600"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <GlobeIcon className="w-4 h-4 mr-2" aria-hidden="true" />
          Countries
        </button>
      </div>

      {isMobile && handleSortChange && localSortField && localSortDirection && (
        <div className="mb-4">
          <label htmlFor="mobileSort" className="sr-only text-muted-foreground">
            Sort by
          </label>
          <select
            id="mobileSort"
            value={`${localSortField}-${localSortDirection}`}
            onChange={handleSortChange}
            className="w-full appearance-none px-4 py-2 rounded-md border border-input bg-transparent text-foreground dark:bg-input/30"
          >
            {sortOptionsFor(localSortField, localSortDirection).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {isMobile ? (
        <div className="mt-4 space-y-4">
          {data.map((entry) => (
            <MobileTariffCard key={entry.id} entry={entry} activeTab={activeTab} />
          ))}
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          {/* table-fixed is what makes the widths above authoritative; with
              the default `auto` the browser re-derives them from content on
              every sort. */}
          <table className="w-full table-fixed text-left">
            <ColGroup columns={activeTab === "products" ? productColumns : COUNTRY_COLUMNS} />
            <thead>
              {activeTab === "products" ? (
                <tr className="border-b border-border">
                  {productColumns.map((column) => (
                    <SortableHeader
                      key={column.key}
                      field={column.key}
                      label={column.label}
                      activeField={localSortField}
                      direction={localSortDirection}
                      onSort={handleSort}
                      tooltip={column.tooltip}
                    />
                  ))}
                </tr>
              ) : (
                <tr className="border-b border-border">
                  {COUNTRY_COLUMNS.map((column) => (
                    <SortableHeader
                      key={column.key}
                      field={column.key}
                      label={column.label}
                      activeField={localSortField}
                      direction={localSortDirection}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((entry) =>
                activeTab === "products" ? (
                  <tr key={entry.id} className="border-t border-border hover:bg-accent/50">
                    {productColumns.map((column) => (
                      <React.Fragment key={column.key}>
                        {renderProductCell(entry, column.key)}
                      </React.Fragment>
                    ))}
                  </tr>
                ) : (
                  <tr key={entry.id} className="border-t border-border hover:bg-accent/50">
                    <td className="px-4 py-4 text-sm text-foreground">{entry.country}</td>
                    <td className="px-4 py-4 text-sm">
                      <RateBadge entry={entry} />
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`${BADGE_BASE} ${
                          !entry.countrysTariffOnUS || entry.countrysTariffOnUS === "N/A"
                            ? MUTED_BADGE
                            : COUNTRY_TARIFF_BADGE
                        }`}
                      >
                        {entry.countrysTariffOnUS}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {entry.keyAffectedSectors}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`${BADGE_BASE} ${marketImpactClass(entry)}`}>
                        {entry.marketImpact}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground">{entry.responseType}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-sm text-gray-500" role="status">
          Showing {Math.min((page - 1) * itemsPerPage + 1, totalItems)} to{" "}
          {Math.min(page * itemsPerPage, totalItems)} of {totalItems} entries
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Previous page of tariffs"
            className={`p-2 rounded-lg ${
              page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"
            }`}
          >
            <ArrowLeftIcon aria-hidden="true" className="h-5 w-5 text-foreground" />
          </button>
          <span className="text-sm text-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page of tariffs"
            className={`p-2 rounded-lg ${
              page === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"
            }`}
          >
            <ArrowRightIcon aria-hidden="true" className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

