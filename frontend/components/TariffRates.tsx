import React, { useMemo, useState, useContext } from "react";
import { ThemeContext } from "../App";
import { TariffTable } from "./dashboard/TariffTable";
import {
  SearchIcon,
  FilterIcon,
  XIcon,
  SlidersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

// Updated FilterOption type
type FilterOption = {
  field: string;
  value: string;
};

// Type for defining filterable fields with optional predefined values
type FilterableField = {
  value: string;
  label: string;
  predefinedValues?: string[];
};

export const TariffRates = () => {
  const { isDarkMode } = useContext(ThemeContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("rate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<FilterOption[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const [tempFilterField, setTempFilterField] = useState<string>("status");
  const [tempFilterValueInput, setTempFilterValueInput] = useState<string>("");

  const filterableFields: FilterableField[] = [
    {
      value: "status",
      // Offered "Paused", which matches no row in the dataset, while hiding the
      // statuses that do. These are the values the data actually carries.
      label: "Status",
      predefinedValues: [
        "Active",
        "Proposed",
        "Suspended",
        "Threatened",
        "Under Investigation",
        "Ended",
        "Withdrawn",
      ],
    },
    {
      value: "country",
      label: "Country",
      predefinedValues: ["China", "Canada", "Mexico", "European Union", "Japan", "United Kingdom"],
    },
    { value: "commodity", label: "Commodity" },
    { value: "tariffOrigin", label: "Tariff From" },
    { value: "to", label: "Tariff To" },
    {
      // Field name stays "nature" to match the API; only the label changes.
      value: "nature",
      label: "Type",
      predefinedValues: ["New", "Additional", "Reciprocal", "Temporary"],
    },
  ];

  const handleAddFilter = (field: string, value: string) => {
    const trimmedValue = value.trim();
    if (field && trimmedValue) {
      if (!filters.some((f) => f.field === field && f.value === trimmedValue)) {
        setFilters([...filters, { field, value: trimmedValue }]);
      }
      setShowFilterModal(false);
      setTempFilterValueInput("");
      setCurrentPage(1);
    }
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split("-");
    setSortField(field);
    setSortDirection(direction as "asc" | "desc");
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTempFilterField(e.target.value);
    setTempFilterValueInput("");
  };

  const selectedFilterFieldData = filterableFields.find((f) => f.value === tempFilterField);

  return (
    <div className="space-y-6">
      <div
        className={`p-6 rounded-xl ${
          isDarkMode
            ? "bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-800/30"
            : "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100"
        }`}
      >
        <h2 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
          Global Tariff Rates
        </h2>
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Comprehensive database of current international trade tariffs and recent changes
        </p>
      </div>
      <div
        className={`rounded-xl overflow-hidden ${
          isDarkMode
            ? "bg-gray-800/80 border border-gray-700"
            : "bg-white border border-gray-200 shadow-sm"
        }`}
      >
        <div className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className={`flex-1 relative ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className={`block w-full pl-10 pr-3 py-2 rounded-md ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 placeholder-gray-400"
                      : "bg-white border-gray-300 placeholder-gray-500"
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Search by commodity, country..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setTempFilterField("status");
                    setTempFilterValueInput("");
                    setShowFilterModal(true);
                  }}
                  className={`px-4 py-2 rounded-md flex items-center ${
                    isDarkMode
                      ? "bg-gray-700 hover:bg-gray-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  <FilterIcon className="h-5 w-5 mr-2" />
                  Add Filter
                </button>
                <div className="relative">
                  <select
                    value={`${sortField}-${sortDirection}`}
                    onChange={handleSortChange}
                    className={`appearance-none px-4 py-2 pl-10 rounded-md ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    } border`}
                  >
                    <option value="rate-desc">Highest Rate First</option>
                    <option value="rate-asc">Lowest Rate First</option>
                    <option value="changeDisplay-desc">Biggest Change First</option>
                    <option value="changeDisplay-asc">Smallest Change First</option>
                    <option value="effectiveDate-desc">Newest First</option>
                    <option value="effectiveDate-asc">Oldest First</option>
                  </select>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SlidersIcon className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                <div className="relative">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className={`appearance-none px-4 py-2 rounded-md ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    } border`}
                  >
                    <option value="5">5 per page</option>
                    <option value="10">10 per page</option>
                    <option value="20">20 per page</option>
                    <option value="50">50 per page</option>
                  </select>
                </div>
              </div>
            </div>
            {filters.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {filters.map((filter, index) => (
                  <div
                    key={index}
                    className={`flex items-center px-3 py-1 rounded-full text-sm transition-shadow duration-300 ease-in-out ${
                      isDarkMode
                        ? "bg-purple-800/50 text-purple-200 border border-purple-700/50 shadow-[0_0_8px_1px_rgba(192,132,252,0.4)] hover:shadow-[0_0_12px_2px_rgba(192,132,252,0.6)]"
                        : "bg-purple-200 text-purple-800 border border-purple-400 shadow-[0_0_8px_1px_rgba(192,132,252,0.3)] hover:shadow-[0_0_12px_2px_rgba(192,132,252,0.4)]"
                    }`}
                  >
                    <span className="capitalize">
                      {filterableFields.find((ff) => ff.value === filter.field)?.label ||
                        filter.field}
                      :{filter.value}
                    </span>
                    <button
                      onClick={() => handleRemoveFilter(index)}
                      className={`ml-2 p-1 rounded-full ${
                        isDarkMode ? "hover:bg-purple-700/70" : "hover:bg-purple-300"
                      }`}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setFilters([]);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center px-3 py-1 rounded-full text-sm ${
                    isDarkMode
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
          <div className="mt-6">
            <TariffTable
              searchTerm={searchTerm}
              sortField={sortField}
              sortDirection={sortDirection}
              filters={filters}
              page={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onTotalPagesChange={setTotalPages}
            />
          </div>
        </div>
      </div>

      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div
            className={`rounded-xl p-6 max-w-md w-full ${
              isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white shadow-xl"
            }`}
          >
            <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Add Filter
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="filterField"
                  className={`block mb-1 text-sm font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Filter By
                </label>
                <select
                  id="filterField"
                  value={tempFilterField}
                  onChange={handleFieldChange}
                  className={`w-full p-2 rounded-md border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  {filterableFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filterValue"
                  className={`block mb-1 text-sm font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Value
                </label>
                {selectedFilterFieldData?.predefinedValues ? (
                  <div className="mt-1 space-y-2 max-h-48 overflow-y-auto p-2 border rounded-md ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">
                    {selectedFilterFieldData.predefinedValues.map((value) => (
                      <button
                        key={value}
                        onClick={() => handleAddFilter(tempFilterField, value)}
                        className={`w-full text-left p-2 rounded-md text-sm ${
                          isDarkMode
                            ? "hover:bg-gray-700 text-gray-300"
                            : "hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    id="filterValue"
                    value={tempFilterValueInput}
                    onChange={(e) => setTempFilterValueInput(e.target.value)}
                    className={`mt-1 w-full p-2 rounded-md border ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    }`}
                    placeholder={`Enter ${selectedFilterFieldData?.label || "value"}...`}
                  />
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowFilterModal(false);
                  setTempFilterValueInput("");
                }}
                className={`px-4 py-2 rounded-md ${
                  isDarkMode
                    ? "bg-gray-600 hover:bg-gray-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                Cancel
              </button>
              {!selectedFilterFieldData?.predefinedValues && (
                <button
                  onClick={() => handleAddFilter(tempFilterField, tempFilterValueInput)}
                  disabled={!tempFilterValueInput.trim()}
                  className={`px-4 py-2 rounded-md flex items-center ${
                    isDarkMode
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-blue-500 hover:bg-blue-600 text-white"
                  } ${!tempFilterValueInput.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Apply Filter
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
