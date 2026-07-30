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
  /** Lets the page know which dataset is on screen, so Export can match it. */
  onDatasetChange?: (dataset: "product" | "country") => void;
}

type TabType = "countries" | "products";

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
  onDatasetChange,
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

  const handleSort = (field: string) => {
    console.log(`[TariffTable] handleSort called with field: ${field}`);
    let newDirection = localSortDirection;
    let newField = localSortField;

    if (field === localSortField) {
      newDirection = localSortDirection === "asc" ? "desc" : "asc";
      console.log(`[TariffTable] Toggling sort direction for ${field} to: ${newDirection}`);
    } else {
      newField = field;
      newDirection = "asc";
      console.log(`[TariffTable] Setting sort field to: ${newField}, direction: ${newDirection}`);
    }
    // Update state after determining new values
    setLocalSortField(newField);
    setLocalSortDirection(newDirection);
    // Note: We don't fetch data directly here; useEffect handles it
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

  // Add useEffect to sync props with local state
  useEffect(() => {
    console.log(
      `[TariffTable] Props changed: sortField=${sortField}, sortDirection=${sortDirection}. Syncing local state.`
    );
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
    const labelColor = isDarkMode ? "text-gray-500" : "text-gray-500";
    const valueColor = isDarkMode ? "text-gray-100" : "text-gray-900";
    return (
      <div key={`mobile-${entry.id}`} className={`border rounded-lg p-4 ${cardBg}`}>
        {activeTab === "products" ? (
          <>
            <div className="mb-2">
              <span className={`text-xs font-medium ${labelColor}`}>Commodity</span>
              <p className={`font-semibold ${valueColor}`}>{entry.commodity}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className={`block text-xs ${labelColor}`}>Rate</span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                  ${
                    entry.rateDisplay === "N/A"
                      ? "bg-gray-400/10 text-gray-600"
                      : entry.rateDisplay === "Restricted"
                      ? "bg-red-400/10 text-red-600"
                      : entry.rate >= 25
                      ? "bg-red-400/10 text-red-600"
                      : entry.rate >= 15
                      ? "bg-yellow-400/10 text-yellow-600"
                      : "bg-green-400/10 text-green-600"
                  }`}
                >
                  {entry.rateDisplay || `${entry.rate}%`}
                </span>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Status</span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    entry.status === "Active"
                      ? isDarkMode
                        ? "bg-green-900/50 text-green-300"
                        : "bg-green-100 text-green-800"
                      : entry.status === "Threatened"
                      ? isDarkMode
                        ? "bg-yellow-900/50 text-yellow-300"
                        : "bg-yellow-100 text-yellow-800"
                      : entry.status === "Restricted"
                      ? isDarkMode
                        ? "bg-red-900/50 text-red-300"
                        : "bg-red-100 text-red-800"
                      : entry.status === "Legacy Tariff"
                      ? isDarkMode
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-blue-100 text-blue-800"
                      : entry.status === "Reciprocal Tariff"
                      ? isDarkMode
                        ? "bg-purple-900/50 text-purple-300"
                        : "bg-purple-100 text-purple-800"
                      : entry.status === "Under Investigation"
                      ? isDarkMode
                        ? "bg-orange-900/50 text-orange-300"
                        : "bg-orange-100 text-orange-800"
                      : isDarkMode
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {entry.status || "N/A"}
                </span>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Effective Date</span>
                <p className={valueColor}>{entry.effectiveDate || "N/A"}</p>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Tariff From</span>
                <p className={valueColor}>{entry.tariffOrigin || "N/A"}</p>
              </div>

              {entry.changeDisplay && entry.changeDisplay !== "–" && (
                <div>
                  <span className={`block text-xs ${labelColor}`}>Change</span>
                  <div className="flex items-center space-x-1">
                    {!isNaN(Number(entry.changeDisplay.replace("%", ""))) &&
                      (Number(entry.changeDisplay.replace("%", "")) > 0 ? (
                        <ArrowUpIcon
                          className={
                            isDarkMode ? "h-4 w-4 text-green-400" : "h-4 w-4 text-green-600"
                          }
                        />
                      ) : Number(entry.changeDisplay.replace("%", "")) < 0 ? (
                        <ArrowDownIcon
                          className={isDarkMode ? "h-4 w-4 text-red-400" : "h-4 w-4 text-red-600"}
                        />
                      ) : null)}
                    <span
                      className={
                        !isNaN(Number(entry.changeDisplay.replace("%", "")))
                          ? Number(entry.changeDisplay.replace("%", "")) > 0
                            ? isDarkMode
                              ? "text-green-400"
                              : "text-green-600"
                            : Number(entry.changeDisplay.replace("%", "")) < 0
                            ? isDarkMode
                              ? "text-red-400"
                              : "text-red-600"
                            : isDarkMode
                            ? "text-gray-400"
                            : "text-gray-600"
                          : isDarkMode
                          ? "text-gray-400"
                          : "text-gray-600"
                      }
                    >
                      {entry.changeDisplay}
                    </span>
                  </div>
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
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                  ${
                    entry.rateDisplay === "N/A" || entry.rateDisplay === "Paused"
                      ? isDarkMode
                        ? "bg-gray-700 text-gray-300"
                        : "bg-gray-100 text-gray-500"
                      : entry.rate >= 25
                      ? isDarkMode
                        ? "bg-red-900/50 text-red-300"
                        : "bg-red-100 text-red-800"
                      : entry.rate >= 15
                      ? isDarkMode
                        ? "bg-yellow-900/50 text-yellow-300"
                        : "bg-yellow-100 text-yellow-800"
                      : isDarkMode
                      ? "bg-green-900/50 text-green-300"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {entry.rateDisplay}
                </span>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Status</span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    entry.status === "Active"
                      ? isDarkMode
                        ? "bg-green-900/50 text-green-300"
                        : "bg-green-100 text-green-800"
                      : entry.status === "Paused"
                      ? isDarkMode
                        ? "bg-gray-700 text-gray-300"
                        : "bg-gray-100 text-gray-500"
                      : isDarkMode
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {entry.status}
                </span>
              </div>
              <div>
                <span className={`block text-xs ${labelColor}`}>Rate (on USA)</span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                  ${
                    !entry.countrysTariffOnUS || entry.countrysTariffOnUS === "N/A"
                      ? isDarkMode
                        ? "bg-gray-700 text-gray-300"
                        : "bg-gray-100 text-gray-500"
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
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                    ${
                      entry.marketImpact?.toLowerCase().includes("severe") ||
                      entry.marketImpact?.toLowerCase().includes("significant")
                        ? isDarkMode
                          ? "bg-red-900/50 text-red-300"
                          : "bg-red-100 text-red-800"
                        : entry.marketImpact?.toLowerCase().includes("moderate")
                        ? isDarkMode
                          ? "bg-yellow-900/50 text-yellow-300"
                          : "bg-yellow-100 text-yellow-800"
                        : entry.marketImpact?.toLowerCase().includes("mild") ||
                          entry.marketImpact?.toLowerCase().includes("minimal") ||
                          entry.marketImpact?.toLowerCase().includes("mixed")
                        ? isDarkMode
                          ? "bg-green-900/50 text-green-300"
                          : "bg-green-100 text-green-800"
                        : isDarkMode
                        ? "bg-gray-700 text-gray-300"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
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
        <p>Loading tariff data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-center text-red-500`}>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
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

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex space-x-4">
        <button
          onClick={() => {
            setActiveTab("products");
            onDatasetChange?.("product");
            onPageChange(1);
          }}
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
          <PackageIcon className="w-4 h-4 mr-2" />
          Products
        </button>
        <button
          onClick={() => {
            setActiveTab("countries");
            onDatasetChange?.("country");
            onPageChange(1);
          }}
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
          <GlobeIcon className="w-4 h-4 mr-2" />
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
            <option value="rate-desc">Highest Rate First</option>
            <option value="rate-asc">Lowest Rate First</option>
            <option value="changeDisplay-desc">Biggest Change First</option>
            <option value="changeDisplay-asc">Smallest Change First</option>
            <option value="effectiveDate-desc">Newest First</option>
            <option value="effectiveDate-asc">Oldest First</option>
            {activeTab === "countries" && (
              <>
                <option value="country-asc">Country (A-Z)</option>
                <option value="country-desc">Country (Z-A)</option>
              </>
            )}
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
          {!data.length && !isLoading && (
            <div className="text-center p-4 text-gray-500">(No results found)</div>
          )}
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              {activeTab === "products" ? (
                <tr className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}>
                  <SortableHeader
                    field="commodity"
                    label="COMMODITY"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="tariffOrigin"
                    label="TARIFF FROM"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="to"
                    label="TO"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="rate"
                    label="RATE"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="changeDisplay"
                    label="CHANGE"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="status"
                    label="STATUS"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="nature"
                    label="TYPE"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                    tooltip={TARIFF_TYPE_TOOLTIP}
                  />
                  <SortableHeader
                    field="effectiveDate"
                    label="EFFECTIVE DATE"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                </tr>
              ) : (
                <tr className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-300"}`}>
                  <SortableHeader
                    field="country"
                    label="COUNTRY"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="rateDisplay"
                    label="RATE IMPOSED BY USA"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="status"
                    label="STATUS"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="countrysTariffOnUS"
                    label="RATE IMPOSED ON USA"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="keyAffectedSectors"
                    label="KEY SECTORS"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="marketImpact"
                    label="MARKET IMPACT"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
                  <SortableHeader
                    field="responseType"
                    label="RESPONSE TYPE"
                    activeField={localSortField}
                    direction={localSortDirection}
                    onSort={handleSort}
                    isDarkMode={isDarkMode}
                  />
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
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {entry.commodity}
                    </td>
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {entry.tariffOrigin || "N/A"}
                    </td>
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {entry.to}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                      ${
                        entry.rateDisplay === "N/A"
                          ? "bg-gray-400/10 text-gray-600"
                          : entry.rateDisplay === "Restricted"
                          ? "bg-red-400/10 text-red-600"
                          : entry.rate >= 25
                          ? "bg-red-400/10 text-red-600"
                          : entry.rate >= 15
                          ? "bg-yellow-400/10 text-yellow-600"
                          : "bg-green-400/10 text-green-600"
                      }`}
                      >
                        {entry.rateDisplay || `${entry.rate}%`}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      <div className="flex items-center space-x-1">
                        {entry.changeDisplay &&
                          entry.changeDisplay !== "–" &&
                          !isNaN(Number(entry.changeDisplay.replace("%", ""))) &&
                          (Number(entry.changeDisplay.replace("%", "")) > 0 ? (
                            <ArrowUpIcon
                              className={
                                isDarkMode ? "h-4 w-4 text-green-400" : "h-4 w-4 text-green-600"
                              }
                            />
                          ) : Number(entry.changeDisplay.replace("%", "")) < 0 ? (
                            <ArrowDownIcon
                              className={
                                isDarkMode ? "h-4 w-4 text-red-400" : "h-4 w-4 text-red-600"
                              }
                            />
                          ) : null)}
                        <span
                          className={
                            entry.changeDisplay &&
                            entry.changeDisplay !== "–" &&
                            !isNaN(Number(entry.changeDisplay.replace("%", "")))
                              ? Number(entry.changeDisplay.replace("%", "")) > 0
                                ? isDarkMode
                                  ? "text-green-400"
                                  : "text-green-600"
                                : Number(entry.changeDisplay.replace("%", "")) < 0
                                ? isDarkMode
                                  ? "text-red-400"
                                  : "text-red-600"
                                : isDarkMode
                                ? "text-gray-400"
                                : "text-gray-600"
                              : isDarkMode
                              ? "text-gray-400"
                              : "text-gray-600"
                          }
                        >
                          {entry.changeDisplay || "–"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          entry.status === "Active"
                            ? isDarkMode
                              ? "bg-green-900/50 text-green-300"
                              : "bg-green-100 text-green-800"
                            : entry.status === "Threatened"
                            ? isDarkMode
                              ? "bg-yellow-900/50 text-yellow-300"
                              : "bg-yellow-100 text-yellow-800"
                            : entry.status === "Restricted"
                            ? isDarkMode
                              ? "bg-red-900/50 text-red-300"
                              : "bg-red-100 text-red-800"
                            : entry.status === "Legacy Tariff"
                            ? isDarkMode
                              ? "bg-blue-900/50 text-blue-300"
                              : "bg-blue-100 text-blue-800"
                            : entry.status === "Reciprocal Tariff"
                            ? isDarkMode
                              ? "bg-purple-900/50 text-purple-300"
                              : "bg-purple-100 text-purple-800"
                            : entry.status === "Under Investigation"
                            ? isDarkMode
                              ? "bg-orange-900/50 text-orange-300"
                              : "bg-orange-100 text-orange-800"
                            : isDarkMode
                            ? "bg-gray-700 text-gray-300"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {entry.status || "N/A"}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                      title={TARIFF_TYPE_TOOLTIP}
                    >
                      {entry.nature || "N/A"}
                    </td>
                    <td
                      className={`px-4 py-4 text-sm ${
                        isDarkMode ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {entry.effectiveDate || "N/A"}
                    </td>
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
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                        ${
                          entry.rateDisplay === "N/A" || entry.rateDisplay === "Paused"
                            ? isDarkMode
                              ? "bg-gray-700 text-gray-300"
                              : "bg-gray-100 text-gray-500"
                            : entry.rate >= 25
                            ? isDarkMode
                              ? "bg-red-900/50 text-red-300"
                              : "bg-red-100 text-red-800"
                            : entry.rate >= 15
                            ? isDarkMode
                              ? "bg-yellow-900/50 text-yellow-300"
                              : "bg-yellow-100 text-yellow-800"
                            : isDarkMode
                            ? "bg-green-900/50 text-green-300"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {entry.rateDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          entry.status === "Active"
                            ? isDarkMode
                              ? "bg-green-900/50 text-green-300"
                              : "bg-green-100 text-green-800"
                            : entry.status === "Paused"
                            ? isDarkMode
                              ? "bg-gray-700 text-gray-300"
                              : "bg-gray-100 text-gray-500"
                            : isDarkMode
                            ? "bg-gray-700 text-gray-300"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                        ${
                          !entry.countrysTariffOnUS || entry.countrysTariffOnUS === "N/A"
                            ? isDarkMode
                              ? "bg-gray-700 text-gray-300"
                              : "bg-gray-100 text-gray-500"
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
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium
                        ${
                          entry.marketImpact?.toLowerCase().includes("severe") ||
                          entry.marketImpact?.toLowerCase().includes("significant")
                            ? isDarkMode
                              ? "bg-red-900/50 text-red-300"
                              : "bg-red-100 text-red-800"
                            : entry.marketImpact?.toLowerCase().includes("moderate")
                            ? isDarkMode
                              ? "bg-yellow-900/50 text-yellow-300"
                              : "bg-yellow-100 text-yellow-800"
                            : entry.marketImpact?.toLowerCase().includes("mild") ||
                              entry.marketImpact?.toLowerCase().includes("minimal") ||
                              entry.marketImpact?.toLowerCase().includes("mixed")
                            ? isDarkMode
                              ? "bg-green-900/50 text-green-300"
                              : "bg-green-100 text-green-800"
                            : isDarkMode
                            ? "bg-gray-700 text-gray-300"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
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
        <div className="text-sm text-gray-500">
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
