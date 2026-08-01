import { useState } from "react";
import { TariffTable, sortOptionsFor } from "./dashboard/TariffTable";
import { Modal } from "./Modal";
import { DialogFooter } from "@/components/ui/dialog";
import { SearchIcon, FilterIcon, XIcon, SlidersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Updated FilterOption type
/**
 * The classes SelectTrigger applies, on the two plain inputs.
 *
 * No Input primitive is installed, and the search box sits directly beside two
 * Selects; without this they disagreed on height, radius, border token and
 * focus ring.
 */
const FIELD =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none " +
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 " +
  "focus-visible:ring-ring/50 dark:bg-input/30";

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

  const handleSortChange = (value: string) => {
    const [field, direction] = value.split("-");
    setSortField(field);
    setSortDirection(direction as "asc" | "desc");
    setCurrentPage(1);
  };

  const handleFieldChange = (value: string) => {
    setTempFilterField(value);
    setTempFilterValueInput("");
  };

  const selectedFilterFieldData = filterableFields.find((f) => f.value === tempFilterField);

  return (
    <div className="space-y-6">
      {/* `bg-transparent` before the gradient is load-bearing: Card's `bg-card`
          is a background-COLOR and the gradient a background-IMAGE, so without
          it the dark theme's translucent stops composite over an opaque card
          instead of the page. */}
      <Card className="[--card-spacing:--spacing(6)] bg-transparent bg-linear-to-r from-blue-50 to-indigo-50 ring-1 ring-blue-200 dark:from-blue-900/30 dark:to-indigo-900/30 dark:ring-blue-800/30">
        <CardContent>
          <h1 className="text-2xl font-bold text-foreground">Global Tariff Rates</h1>
          <p className="mt-1 text-muted-foreground">
            Comprehensive database of current international trade tariffs and recent changes
          </p>
        </CardContent>
      </Card>
      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative text-foreground">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  type="search"
                  className={`${FIELD} pl-10`}
                  placeholder="Search by commodity, country..."
                  aria-label="Search tariffs by commodity or country"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setTempFilterField("status");
                    setTempFilterValueInput("");
                    setShowFilterModal(true);
                  }}
                >
                  <FilterIcon />
                  Add Filter
                </Button>
                <Select value={`${sortField}-${sortDirection}`} onValueChange={handleSortChange}>
                  <SelectTrigger id="tariffSort" className="h-9" aria-label="Sort tariffs by">
                    <SlidersIcon className="text-muted-foreground" aria-hidden="true" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptionsFor(sortField, sortDirection).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(value) => {
                    setItemsPerPage(parseInt(value, 10));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} per page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filters.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {filters.map((filter, index) => (
                  <Badge
                    key={index}
                    className="h-7 gap-1 border-purple-400 bg-purple-100 pr-1 pl-3 text-sm text-purple-900 dark:border-purple-700/50 dark:bg-purple-800/50 dark:text-purple-100"
                  >
                    <span className="capitalize">
                      {filterableFields.find((ff) => ff.value === filter.field)?.label ||
                        filter.field}
                      :{filter.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveFilter(index)}
                      aria-label={`Remove filter ${filter.field}: ${filter.value}`}
                      className="rounded-full hover:bg-purple-300 dark:hover:bg-purple-700/70"
                    >
                      <XIcon />
                    </Button>
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters([]);
                    setCurrentPage(1);
                  }}
                  className="rounded-full text-muted-foreground"
                >
                  Clear All
                </Button>
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
              // Column-header sorting used to write only to the table's own
              // state, leaving the dropdown above announcing the previous order.
              onSortChange={(field, direction) => {
                setSortField(field);
                setSortDirection(direction);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

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
        <div className="space-y-4">
          <div>
            <label
              htmlFor="filterField"
              className="block mb-1 text-sm font-medium text-muted-foreground"
            >
              Filter By
            </label>
            <Select value={tempFilterField} onValueChange={handleFieldChange}>
              <SelectTrigger id="filterField" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterableFields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {selectedFilterFieldData.predefinedValues.map((value) => (
                  <Button
                    key={value}
                    variant="ghost"
                    onClick={() => handleAddFilter(tempFilterField, value)}
                    className="w-full justify-start text-muted-foreground"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                id="filterValue"
                value={tempFilterValueInput}
                onChange={(e) => setTempFilterValueInput(e.target.value)}
                className={`${FIELD} mt-1`}
                placeholder={`Enter ${selectedFilterFieldData?.label || "value"}...`}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setShowFilterModal(false);
              setTempFilterValueInput("");
            }}
          >
            Cancel
          </Button>
          {!selectedFilterFieldData?.predefinedValues && (
            <Button
              size="lg"
              onClick={() => handleAddFilter(tempFilterField, tempFilterValueInput)}
              disabled={!tempFilterValueInput.trim()}
            >
              Apply Filter
            </Button>
          )}
        </DialogFooter>
      </Modal>
    </div>
  );
};
