import React, { useState } from "react";
import { TariffTable, sortOptionsFor } from "./dashboard/TariffTable";
import { Modal } from "./Modal";
import { SearchIcon, FilterIcon, XIcon, SlidersIcon } from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("rate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<FilterOption[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // Kept only to satisfy TariffTable's callback; the table renders its own
  // pager, so nothing here reads the count.
  const [, setTotalPages] = useState(0);

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
      // One filter per field. The API takes a single value per field, so adding
      // "Status: Active" and then "Status: Threatened" showed two chips while
      // only the last one was ever sent: the UI claimed a filter that was not
      // being applied. Replacing makes what is shown match what is queried.
      setFilters([...filters.filter((f) => f.field !== field), { field, value: trimmedValue }]);
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

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTempFilterField(e.target.value);
    setTempFilterValueInput("");
  };

  const selectedFilterFieldData = filterableFields.find((f) => f.value === tempFilterField);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100 dark:from-blue-900/30 dark:to-indigo-900/30 dark:border-blue-800/30">
        <h1 className="text-2xl font-bold text-foreground">Global Tariff Rates</h1>
        <p className="mt-1 text-muted-foreground">
          Comprehensive database of current international trade tariffs and recent changes
        </p>
      </div>
      <div className="rounded-xl overflow-hidden bg-card border border-border shadow-xs dark:shadow-none">
        <div className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative text-foreground">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 rounded-md bg-transparent border border-input placeholder:text-muted-foreground dark:bg-input/30 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                  className="px-4 py-2 rounded-md flex items-center bg-muted hover:bg-accent text-foreground"
                >
                  <FilterIcon className="h-5 w-5 mr-2" />
                  Add Filter
                </button>
                <div className="relative">
                  <label htmlFor="tariffSort" className="sr-only">
                    Sort tariffs by
                  </label>
                  <select
                    id="tariffSort"
                    value={`${sortField}-${sortDirection}`}
                    onChange={handleSortChange}
                    className="appearance-none px-4 py-2 pl-10 rounded-md bg-transparent border border-input text-foreground dark:bg-input/30"
                  >
                    {sortOptionsFor(sortField, sortDirection).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SlidersIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </div>
                </div>
                <div className="relative">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="appearance-none px-4 py-2 rounded-md bg-transparent border border-input text-foreground dark:bg-input/30"
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
                    className="flex items-center px-3 py-1 rounded-full text-sm transition-shadow duration-300 ease-in-out bg-purple-200 text-purple-800 border border-purple-400 shadow-[0_0_8px_1px_rgba(192,132,252,0.3)] hover:shadow-[0_0_12px_2px_rgba(192,132,252,0.4)] dark:bg-purple-800/50 dark:text-purple-200 dark:border-purple-700/50 dark:shadow-[0_0_8px_1px_rgba(192,132,252,0.4)] dark:hover:shadow-[0_0_12px_2px_rgba(192,132,252,0.6)]"
                  >
                    <span className="capitalize">
                      {filterableFields.find((ff) => ff.value === filter.field)?.label ||
                        filter.field}
                      :{filter.value}
                    </span>
                    <button
                      onClick={() => handleRemoveFilter(index)}
                      className="ml-2 p-1 rounded-full hover:bg-purple-300 dark:hover:bg-purple-700/70"
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
                  className="flex items-center px-3 py-1 rounded-full text-sm bg-muted text-muted-foreground hover:bg-accent"
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
              handleSortChange={handleSortChange}
              // Column-header sorting used to write only to the table's own
              // state, leaving the dropdown above announcing the previous order.
              onSortChange={(field, direction) => {
                setSortField(field);
                setSortDirection(direction);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* This was the last hand-rolled overlay in the app: a bare div with no
          dialog role, no Escape, no focus trap and nothing returning focus to
          the trigger. The shared Modal supplies all of that. */}
      <Modal
        isOpen={showFilterModal}
        onClose={() => {
          setShowFilterModal(false);
          setTempFilterValueInput("");
        }}
        title="Add Filter"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold mb-4 text-foreground">Add Filter</h3>
          <div className="space-y-4">
              <div>
                <label
                  htmlFor="filterField"
                  className="block mb-1 text-sm font-medium text-muted-foreground"
                >
                  Filter By
                </label>
                <select
                  id="filterField"
                  value={tempFilterField}
                  onChange={handleFieldChange}
                  className="w-full p-2 rounded-md border border-input bg-transparent text-foreground dark:bg-input/30"
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
                  className="block mb-1 text-sm font-medium text-muted-foreground"
                >
                  Value
                </label>
                {/* The className below was a plain double-quoted string holding a
                    literal ${...}, so those characters reached the DOM as class
                    tokens and the border never rendered. */}
                {selectedFilterFieldData?.predefinedValues ? (
                  <div className="mt-1 space-y-2 max-h-48 overflow-y-auto p-2 border border-border rounded-md">
                    {selectedFilterFieldData.predefinedValues.map((value) => (
                      <button
                        key={value}
                        onClick={() => handleAddFilter(tempFilterField, value)}
                        className="w-full text-left p-2 rounded-md text-sm hover:bg-accent text-muted-foreground"
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
                    className="mt-1 w-full p-2 rounded-md border border-input bg-transparent text-foreground placeholder:text-muted-foreground dark:bg-input/30"
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
                className="px-4 py-2 rounded-md bg-muted hover:bg-accent text-foreground"
              >
                Cancel
              </button>
              {!selectedFilterFieldData?.predefinedValues && (
                <button
                  onClick={() => handleAddFilter(tempFilterField, tempFilterValueInput)}
                  disabled={!tempFilterValueInput.trim()}
                  className={`px-4 py-2 rounded-md flex items-center bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700 ${
                    !tempFilterValueInput.trim() ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Apply Filter
                </button>
              )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
