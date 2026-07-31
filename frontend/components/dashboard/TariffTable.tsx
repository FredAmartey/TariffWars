import React, { useEffect, useState, useContext, useCallback, useMemo, useRef } from "react";
import { ThemeContext } from "../../App";
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
  onTotalPagesChange: (totalPages: number) => void;
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

const isInactive = (status: string | undefined) => INACTIVE_STATUSES.has(status ?? "");

const MUTED_BADGE = (isDarkMode: boolean) =>
  isDarkMode ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500";

const BADGE_BASE = "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium";

/**
 * Rate colour is severity, so it only applies while the rate is being charged.
 */
const rateBadgeClass = (entry: TariffEntry, isDarkMode: boolean): string => {
  if (isInactive(entry.status)) return MUTED_BADGE(isDarkMode);
  if (entry.rateDisplay === "N/A" || entry.rateDisplay === "Paused") {
    return MUTED_BADGE(isDarkMode);
  }
  if (entry.rateDisplay === "Restricted" || entry.rate >= 25) {
    return isDarkMode ? "bg-red-900/50 text-red-300" : "bg-red-100 text-red-800";
  }
  if (entry.rate >= 15) {
    return isDarkMode ? "bg-yellow-900/50 text-yellow-300" : "bg-yellow-100 text-yellow-800";
  }
  return isDarkMode ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-800";
};

const STATUS_COLOURS: Record<string, { dark: string; light: string }> = {
  Active: { dark: "bg-green-900/50 text-green-300", light: "bg-green-100 text-green-800" },
  Threatened: { dark: "bg-yellow-900/50 text-yellow-300", light: "bg-yellow-100 text-yellow-800" },
  Proposed: { dark: "bg-sky-900/50 text-sky-300", light: "bg-sky-100 text-sky-800" },
  Restricted: { dark: "bg-red-900/50 text-red-300", light: "bg-red-100 text-red-800" },
  "Legacy Tariff": { dark: "bg-blue-900/50 text-blue-300", light: "bg-blue-100 text-blue-800" },
  "Reciprocal Tariff": {
    dark: "bg-purple-900/50 text-purple-300",
    light: "bg-purple-100 text-purple-800",
  },
  "Under Investigation": {
    dark: "bg-orange-900/50 text-orange-300",
    light: "bg-orange-100 text-orange-800",
  },
};

const statusBadgeClass = (status: string | undefined, isDarkMode: boolean): string => {
  const colours = STATUS_COLOURS[status ?? ""];
  if (!colours) return MUTED_BADGE(isDarkMode);
  return isDarkMode ? colours.dark : colours.light;
};

const marketImpactClass = (entry: TariffEntry, isDarkMode: boolean): string => {
  const impact = entry.marketImpact?.toLowerCase() ?? "";
  if (impact.includes("severe") || impact.includes("significant")) {
    return isDarkMode ? "bg-red-900/50 text-red-300" : "bg-red-100 text-red-800";
  }
  if (impact.includes("moderate")) {
    return isDarkMode ? "bg-yellow-900/50 text-yellow-300" : "bg-yellow-100 text-yellow-800";
  }
  if (impact.includes("mild") || impact.includes("minimal") || impact.includes("mixed")) {
    return isDarkMode ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-800";
  }
  return MUTED_BADGE(isDarkMode);
};

/** Human labels for every sortable field, shared by the table and its owners. */
export const COLUMN_LABELS: Record<string, string> = {
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

const COUNTRY_COLUMNS = [
  { key: "country", label: "COUNTRY" },
  { key: "rateDisplay", label: "RATE IMPOSED BY USA" },
  { key: "status", label: "STATUS" },
  { key: "countrysTariffOnUS", label: "RATE IMPOSED ON USA" },
  { key: "keyAffectedSectors", label: "KEY SECTORS" },
  { key: "marketImpact", label: "MARKET IMPACT" },
  { key: "responseType", label: "RESPONSE TYPE" },
] as const;

const RateBadge: React.FC<{ entry: TariffEntry; isDarkMode: boolean }> = ({
  entry,
  isDarkMode,
}) => {
  const inactive = isInactive(entry.status);
  return (
    <span
      className={`${BADGE_BASE} ${rateBadgeClass(entry, isDarkMode)} ${
        inactive ? "line-through decoration-1" : ""
      }`}
      title={inactive ? `Not currently charged (${entry.status})` : undefined}
    >
      {entry.rateDisplay || `${entry.rate}%`}
    </span>
  );
};

const StatusBadge: React.FC<{ status: string | undefined; isDarkMode: boolean }> = ({
  status,
  isDarkMode,
}) => (
  <span className={`${BADGE_BASE} ${statusBadgeClass(status, isDarkMode)}`}>{status || "N/A"}</span>
);

/**
 * Change direction, coloured for the subject matter rather than for a stock
 * ticker.
 *
 * A rising tariff was drawn green-with-an-up-arrow and a cut red, borrowing the
 * markets convention where "up" is good news. On a tariff tracker the opposite
 * holds: an increase is the cost and a reduction is the relief.
 */
const ChangeCell: React.FC<{ display: string | undefined; isDarkMode: boolean }> = ({
  display,
  isDarkMode,
}) => {
  const numeric = display ? Number(display.replace("%", "")) : NaN;
  const neutral = isDarkMode ? "text-gray-400" : "text-gray-600";

  if (!display || display === "–" || Number.isNaN(numeric) || numeric === 0) {
    return <span className={neutral}>{display || "–"}</span>;
  }

  const rose = numeric > 0;
  const tone = rose
    ? isDarkMode
      ? "text-red-400"
      : "text-red-600"
    : isDarkMode
    ? "text-green-400"
    : "text-green-600";
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
  isDarkMode,
  tooltip,
}: {
  field: string;
  label: string;
  activeField: string;
  direction: "asc" | "desc";
  onSort: (field: string) => void;
  isDarkMode: boolean;
  tooltip?: string;
}) => {
  const active = activeField === field;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 text-left text-sm font-semibold ${
        isDarkMode ? "text-gray-400" : "text-gray-600"
      } hover:bg-gray-700/50`}
      title={tooltip}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center w-full text-left font-semibold"
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

const PRODUCT_COLUMNS: Array<{ key: ColumnKey; label: string; tooltip?: string; compact: boolean }> =
  [
    { key: "commodity", label: "COMMODITY", compact: true },
    { key: "tariffOrigin", label: "TARIFF FROM", compact: false },
    { key: "to", label: "TO", compact: true },
    { key: "rate", label: "RATE", compact: true },
    { key: "changeDisplay", label: "CHANGE", compact: true },
    { key: "status", label: "STATUS", compact: true },
    { key: "nature", label: "TYPE", tooltip: TARIFF_TYPE_TOOLTIP, compact: false },
    { key: "effectiveDate", label: "EFFECTIVE DATE", compact: true },
  ];

export const TariffTable: React.FC<TariffTableProps> = ({
  searchTerm = "",
  sortField = "effectiveDate",
  sortDirection = "desc",
  filters = [],
  page,
  itemsPerPage = 5,
  onPageChange,
  onTotalPagesChange,
  handleSortChange,
  onSortChange,
  onDatasetChange,
  variant = "full",
}) => {
  const { isDarkMode } = useContext(ThemeContext);
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

  const getCacheKey = useCallback(() => {
    return JSON.stringify({
      searchTerm,
      localSortField,
      localSortDirection,
      filters,
      page,
      itemsPerPage,
      activeTab,
    });
  }, [searchTerm, localSortField, localSortDirection, filters, page, itemsPerPage, activeTab]);

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
      onTotalPagesChange(cachedResult.data.totalPages);
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
        onTotalPagesChange(response.totalPages);
      } else {
        console.error("Invalid tariff data structure:", response);
        setError("Tariff data came back in an unexpected format.");
        setData([]);
        setTotalItems(0);
        onTotalPagesChange(1);
      }
      setIsLoading(false);
    } catch (err) {
      if (isStale()) return;
      setError("Failed to load tariff data. Please try again.");
      console.error("Error fetching tariff data:", err);
      setIsLoading(false);
    }
  }, [
    searchTerm,
    localSortField,
    localSortDirection,
    filters,
    page,
    itemsPerPage,
    onTotalPagesChange,
    getCacheKey,
    activeTab,
  ]);

  // Debounced version of fetchData for search term changes only
  const debouncedFetchData = useMemo(
    () => debounce(fetchData, 500), // 500ms delay
    [fetchData]
  );

  // Every query change routes through the debounced fetcher, so typing a search
  // term costs one request after the user stops rather than one per keystroke.
  // The cleanup cancels the superseded timer — without it each keystroke's
  // pending call would still fire 500ms later and the debounce would be moot.
  useEffect(() => {
    debouncedFetchData();
    return () => {
      debouncedFetchData.cancel();
    };
  }, [debouncedFetchData]);

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
    isDarkMode: boolean;
    activeTab: TabType;
  }> = ({ entry, isDarkMode, activeTab }) => {
    const cardBg = isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
    const labelColor = "text-gray-500";
    const valueColor = isDarkMode ? "text-gray-100" : "text-gray-900";
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
                <RateBadge entry={entry} isDarkMode={isDarkMode} />
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Status</span>
                <StatusBadge status={entry.status} isDarkMode={isDarkMode} />
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
                  <ChangeCell display={entry.changeDisplay} isDarkMode={isDarkMode} />
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
                <RateBadge entry={entry} isDarkMode={isDarkMode} />
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Status</span>
                <StatusBadge status={entry.status} isDarkMode={isDarkMode} />
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Rate (on USA)</span>
                <span
                  className={`${BADGE_BASE} ${
                    !entry.countrysTariffOnUS || entry.countrysTariffOnUS === "N/A"
                      ? MUTED_BADGE(isDarkMode)
                      : isDarkMode
                      ? "bg-blue-900/50 text-blue-300"
                      : "bg-blue-100 text-blue-800"
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
                  <span className={`${BADGE_BASE} ${marketImpactClass(entry, isDarkMode)}`}>
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
      <div className={`p-4 text-center ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
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
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`p-8 text-center rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-gray-50"}`}>
        <p className={`text-lg font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
          No tariff data found{searchTerm ? ` for "${searchTerm}"` : ""}.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Try adjusting your search criteria or check back later.
        </p>
      </div>
    );
  }

  const renderProductCell = (entry: TariffEntry, key: ColumnKey) => {
    const textCell = `px-4 py-4 text-sm ${isDarkMode ? "text-gray-200" : "text-gray-700"}`;
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
            <RateBadge entry={entry} isDarkMode={isDarkMode} />
          </td>
        );
      case "changeDisplay":
        return (
          <td className={textCell}>
            <ChangeCell display={entry.changeDisplay} isDarkMode={isDarkMode} />
          </td>
        );
      case "status":
        return (
          <td className="px-4 py-4 text-sm">
            <StatusBadge status={entry.status} isDarkMode={isDarkMode} />
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
              ? isDarkMode
                ? "bg-blue-600 text-white"
                : "bg-blue-500 text-white"
              : isDarkMode
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
              ? isDarkMode
                ? "bg-blue-600 text-white"
                : "bg-blue-500 text-white"
              : isDarkMode
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <GlobeIcon className="w-4 h-4 mr-2" aria-hidden="true" />
          Countries
        </button>
      </div>

      {isMobile && handleSortChange && localSortField && localSortDirection && (
        <div className="mb-4">
          <label
            htmlFor="mobileSort"
            className={`sr-only ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
          >
            Sort by
          </label>
          <select
            id="mobileSort"
            value={`${localSortField}-${localSortDirection}`}
            onChange={handleSortChange}
            className={`w-full appearance-none px-4 py-2 rounded-md border ${
              isDarkMode
                ? "bg-gray-700 border-gray-600 text-white"
                : "bg-white border-gray-300 text-gray-900"
            }`}
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
            <MobileTariffCard
              key={entry.id}
              entry={entry}
              isDarkMode={isDarkMode}
              activeTab={activeTab}
            />
          ))}
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              {activeTab === "products" ? (
                <tr className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}>
                  {productColumns.map((column) => (
                    <SortableHeader
                      key={column.key}
                      field={column.key}
                      label={column.label}
                      activeField={localSortField}
                      direction={localSortDirection}
                      onSort={handleSort}
                      isDarkMode={isDarkMode}
                      tooltip={column.tooltip}
                    />
                  ))}
                </tr>
              ) : (
                <tr className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}>
                  {COUNTRY_COLUMNS.map((column) => (
                    <SortableHeader
                      key={column.key}
                      field={column.key}
                      label={column.label}
                      activeField={localSortField}
                      direction={localSortDirection}
                      onSort={handleSort}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </tr>
              )}
            </thead>
            <tbody className={`divide-y ${isDarkMode ? "divide-gray-700" : "divide-gray-200"}`}>
              {data.map((entry) =>
                activeTab === "products" ? (
                  <tr
                    key={entry.id}
                    className={`border-t ${
                      isDarkMode
                        ? "border-gray-700 hover:bg-gray-800/50"
                        : "border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {productColumns.map((column) => (
                      <React.Fragment key={column.key}>
                        {renderProductCell(entry, column.key)}
                      </React.Fragment>
                    ))}
                  </tr>
                ) : (
                  <tr
                    key={entry.id}
                    className={`border-t ${
                      isDarkMode
                        ? "border-gray-700 hover:bg-gray-800/50"
                        : "border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {entry.country}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <RateBadge entry={entry} isDarkMode={isDarkMode} />
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <StatusBadge status={entry.status} isDarkMode={isDarkMode} />
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`${BADGE_BASE} ${
                          !entry.countrysTariffOnUS || entry.countrysTariffOnUS === "N/A"
                            ? MUTED_BADGE(isDarkMode)
                            : isDarkMode
                            ? "bg-blue-900/50 text-blue-300"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {entry.countrysTariffOnUS}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {entry.keyAffectedSectors}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`${BADGE_BASE} ${marketImpactClass(entry, isDarkMode)}`}>
                        {entry.marketImpact}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {entry.responseType}
                    </td>
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
              page === 1
                ? "opacity-50 cursor-not-allowed"
                : isDarkMode
                ? "hover:bg-gray-700"
                : "hover:bg-gray-200"
            }`}
          >
            <ArrowLeftIcon
              aria-hidden="true"
              className={`h-5 w-5 ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}
            />
          </button>
          <span className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page of tariffs"
            className={`p-2 rounded-lg ${
              page === totalPages
                ? "opacity-50 cursor-not-allowed"
                : isDarkMode
                ? "hover:bg-gray-700"
                : "hover:bg-gray-200"
            }`}
          >
            <ArrowRightIcon
              aria-hidden="true"
              className={`h-5 w-5 ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

