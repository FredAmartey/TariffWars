import { TariffEntry, TariffResponse, TariffQueryParams } from "../types/tariff";
import { promises as fs } from "fs";
import path from "path";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";
import { effectiveStatus } from "../utils/effectiveStatus";

export class TariffService {
  private cache: Map<string, { data: TariffEntry[]; timestamp: number }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // cache expires after 5 mins
  private csvFilePath: string;
  private countryCsvFilePath: string;

  constructor() {
    this.csvFilePath = path.resolve(__dirname, "../data/tariffs_commodities.csv");
    this.countryCsvFilePath = path.resolve(__dirname, "../data/tariffs_countries.csv");
  }

  public clearCache(): void {
    console.log("Clearing tariff data cache...");
    this.cache.clear();
  }

  private async loadDataFromCSV(): Promise<TariffEntry[]> {
    console.log(`Attempting to read tariff data from ${this.csvFilePath}`);
    try {
      const fileContent = await fs.readFile(this.csvFilePath, { encoding: "utf8" });
      const records = await new Promise<any[]>((resolve, reject) => {
        parse(
          fileContent,
          {
            columns: true,
            skip_empty_lines: true,
            cast: (value, context) => {
              if (context.column === "Rate" && typeof value === "string") {
                const trimmedValue = value.trim();
                // "Exempt" was missing here, so Russia's exemption fell through
                // to parseFloat, became null, and rendered as "N/A".
                if (["N/A", "Restricted", "Exempt", "-", "–", "Banned"].includes(trimmedValue)) {
                  return trimmedValue;
                }
                if (trimmedValue.endsWith("%")) {
                  const num = parseFloat(trimmedValue.replace("%", ""));
                  return isNaN(num) ? null : num;
                }
                const num = parseFloat(trimmedValue);
                return isNaN(num) ? null : num;
              }
              return value;
            },
          },
          (err: any, output: any[]) => (err ? reject(err) : resolve(output))
        );
      });

      const formattedRecords: TariffEntry[] = records.map((record, index) => {
        let rateNum = 0;
        let rateDisplayStr = "N/A";

        if (typeof record.Rate === "number") {
          rateNum = record.Rate;
          rateDisplayStr = `${rateNum}%`;
        } else if (typeof record.Rate === "string") {
          rateDisplayStr = record.Rate;
          if (record.Rate === "Restricted" || record.Rate === "Banned") {
            rateNum = -1;
          } else {
            rateNum = 0;
          }
        } else {
          rateNum = 0;
          rateDisplayStr = "N/A";
        }

        const changeStr = String(record.Change || "–");
        let isIncrease = false;
        let changeType: "increase" | "decrease" | "no-change" = "no-change";
        if (changeStr.startsWith("+")) {
          isIncrease = true;
          changeType = "increase";
        } else if (changeStr.startsWith("-")) {
          isIncrease = false;
          changeType = "decrease";
        }

        return {
          id: record.id || `csv-${index}`,
          type: record.Commodity ? "product" : "country",
          country: record.To || "N/A",
          product: record.Commodity || "N/A",
          commodity: record.Commodity || "N/A",
          // Promotes a Proposed row once its start date has passed, so the
          // dashboard does not keep calling a tariff upcoming while it is
          // being collected. See utils/effectiveStatus.
          status: effectiveStatus(record.Status || "Unknown", record["Effective Date"] || ""),
          rate: rateNum,
          rateDisplay: rateDisplayStr,
          effectiveDate: record["Effective Date"] || "N/A",
          tariffOrigin: record.From || "N/A",
          to: record.To || "N/A",
          isIncrease: isIncrease,
          change: changeType,
          changeDisplay: changeStr,
          nature: record.Nature || "N/A",
        };
      });

      return formattedRecords;
    } catch (readError: any) {
      // Returning [] here turned a missing or corrupt dataset into a page that
      // cheerfully reported zero tariffs. An outage should read as an outage.
      console.error(`Error reading tariff CSV at ${this.csvFilePath}:`, readError);
      throw new Error("Tariff commodity data is unavailable");
    }
  }

  // NEW method to load data specifically from tariffs_countries.csv
  private async loadCountryDataFromCSV(): Promise<TariffEntry[]> {
    try {
      const fileContent = await fs.readFile(this.countryCsvFilePath, { encoding: "utf8" });
      const records = await new Promise<any[]>((resolve, reject) => {
        parse(
          fileContent,
          {
            columns: true,
            skip_empty_lines: true,
            cast: (value, context) => {
              // Use the exact header name from the CSV
              if (context.column === "Rate Imposed By USA" && typeof value === "string") {
                const trimmedValue = value.trim();
                // "Exempt" was missing here, so Russia's exemption fell through
                // to parseFloat, became null, and rendered as "N/A".
                if (["N/A", "Restricted", "Exempt", "-", "–", "Banned"].includes(trimmedValue)) {
                  return trimmedValue;
                }
                // Handle percentages
                if (trimmedValue.endsWith("%")) {
                  const num = parseFloat(trimmedValue.replace("%", ""));
                  return isNaN(num) ? null : num;
                }
                const num = parseFloat(trimmedValue);
                return isNaN(num) ? null : num;
              }
              return value;
            },
          },
          (err: any, output: any[]) => (err ? reject(err) : resolve(output))
        );
      });

      const formattedRecords: TariffEntry[] = records.map((record, index) => {
        let rateNum = 0;
        let rateDisplayStr = "N/A";

        // Use the exact header name from the CSV
        const rawRate = record["Rate Imposed By USA"];

        if (typeof rawRate === "string") {
          const rateStr = rawRate.trim();
          if (rateStr.endsWith("%")) {
            const parsed = parseFloat(rateStr.replace("%", ""));
            if (!isNaN(parsed)) {
              rateNum = parsed;
              rateDisplayStr = `${parsed}%`;
            }
          } else if (!isNaN(parseFloat(rateStr))) {
            rateNum = parseFloat(rateStr);
            rateDisplayStr = `${rateNum}%`;
          } else {
            // Keep the label, and flag it as non-numeric with the same -1
            // sentinel the commodity loader uses so sorting does not read an
            // exemption as a 0% tariff.
            rateDisplayStr = rateStr;
            rateNum = -1;
          }
        } else if (typeof rawRate === "number" && !isNaN(rawRate)) {
          rateNum = rawRate;
          rateDisplayStr = `${rawRate}%`;
        }

        return {
          id: `country-${index}`,
          type: "country",
          // Use exact header names from CSV
          country: record.Country || "N/A",
          product: "N/A",
          commodity: "N/A",
          status: record.Status || "Unknown",
          rate: rateNum,
          rateDisplay: rateDisplayStr,
          effectiveDate: "N/A",
          tariffOrigin: "USA",
          to: record.Country || "N/A",
          isIncrease: false,
          change: "no-change",
          changeDisplay: "–",
          nature: "N/A",
          // Use exact header names from CSV
          countrysTariffOnUS: record["Rate Imposed on USA"] || "N/A",
          keyAffectedSectors: record["Key Sectors"] || "N/A",
          marketImpact: record["Market Impact"] || "N/A",
          responseType: record["Response Type"] || "N/A",
        };
      });

      return formattedRecords;
    } catch (readError: any) {
      console.error("Error reading country CSV:", readError);
      throw new Error("Tariff country data is unavailable");
    }
  }

  async getTariffRates(params: TariffQueryParams): Promise<TariffResponse> {
    try {
      const {
        search = "",
        type,
        status,
        country,
        commodity,
        tariffOrigin,
        to,
        nature,
        sortBy,
        sortOrder = "asc",
        page = 1,
        itemsPerPage = 10,
        skipCache = false,
      } = params;

      const validSortFields = [
        "commodity",
        "from",
        "to",
        "rate",
        "effectiveDate",
        "tariffOrigin",
        "change",
        "status",
        "nature",
        "country",
        "rateDisplay",
        "changeDisplay",
        "countrysTariffOnUS",
        "keyAffectedSectors",
        "marketImpact",
        "responseType",
      ] as const;

      const cacheKeyParams: Partial<TariffQueryParams> = { search, type, sortBy, sortOrder };
      if (status) cacheKeyParams.status = status;
      if (country) cacheKeyParams.country = country;
      if (commodity) cacheKeyParams.commodity = commodity;
      if (tariffOrigin) cacheKeyParams.tariffOrigin = tariffOrigin;
      if (to) cacheKeyParams.to = to;
      if (nature) cacheKeyParams.nature = nature;
      const cacheKey = JSON.stringify(cacheKeyParams);

      const now = Date.now();
      const cachedData = this.cache.get(cacheKey);
      let data: TariffEntry[] = [];

      if (!skipCache && cachedData && now - cachedData.timestamp < this.cacheTimeout) {
        console.log(`Using cached tariff data for key: ${cacheKey}`);
        data = cachedData.data;
      } else {
        console.log(`[getTariffRates] No valid cache found for key: ${cacheKey}, loading data...`);
        // --- Load base data based on type ---
        if (type === "country") {
          console.log("[getTariffRates] Loading country data...");
          data = await this.loadCountryDataFromCSV();
        } else {
          console.log("[getTariffRates] Loading product/commodity data...");
          data = await this.loadDataFromCSV();
        }

        let filteredData = data;

        if (type) {
          filteredData = filteredData.filter((entry) => entry.type === type);
        }

        if (search) {
          const lowerSearch = search.toLowerCase();
          // Search every column the user can see. The country table shows Key
          // Sectors, Market Impact and Response Type, so searching "Steel"
          // used to miss Canada even though Steel is listed on its row.
          filteredData = filteredData.filter((entry) =>
            [
              entry.commodity,
              entry.country,
              entry.status,
              entry.tariffOrigin,
              entry.to,
              entry.nature,
              entry.rateDisplay,
              entry.countrysTariffOnUS,
              entry.keyAffectedSectors,
              entry.marketImpact,
              entry.responseType,
            ].some((field) => String(field ?? "").toLowerCase().includes(lowerSearch))
          );
        }

        if (status) {
          filteredData = filteredData.filter(
            (entry) => entry.status?.toLowerCase() === status.toLowerCase()
          );
        }

        if (country) {
          filteredData = filteredData.filter(
            (entry) => entry.country?.toLowerCase() === country.toLowerCase()
          );
        }

        if (commodity) {
          filteredData = filteredData.filter(
            (entry) => entry.commodity?.toLowerCase() === commodity.toLowerCase()
          );
        }

        if (tariffOrigin) {
          filteredData = filteredData.filter(
            (entry) => entry.tariffOrigin?.toLowerCase() === tariffOrigin.toLowerCase()
          );
        }

        if (to) {
          filteredData = filteredData.filter(
            (entry) => entry.to?.toLowerCase() === to.toLowerCase()
          );
        }

        if (nature) {
          filteredData = filteredData.filter(
            (entry) => entry.nature?.toLowerCase() === nature.toLowerCase()
          );
        }

        this.cache.set(cacheKey, {
          data: filteredData,
          timestamp: now,
        });
        data = filteredData;
      }

      // --- Use the dedicated sortRates method ---
      let sortedData = data; // Use 'data' which contains either cached or newly filtered data
      if (sortBy && validSortFields.includes(sortBy as any)) {
        console.log(
          `[getTariffRates] Sorting data by ${sortBy} (${sortOrder}) using sortRates method.`
        );
        sortedData = this.sortRates(data, sortBy, sortOrder); // Pass 'data', not 'sortedData' initially
      } else {
        // If no sort is specified, maybe keep original order or default sort?
        // For now, let's assume we use the data as is if no sorting is requested.
        console.log(
          "[getTariffRates] No valid sort field provided, skipping dedicated sort method."
        );
      }
      // --- End of using dedicated sortRates method ---

      const totalItems = sortedData.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const currentPage = Math.max(1, Math.min(page || 1, totalPages || 1));
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

      const paginatedData = sortedData.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        total: totalItems,
        page: currentPage,
        itemsPerPage,
        totalPages,
      };
    } catch (error) {
      console.error("Error in getTariffRates:", error);
      return {
        data: [],
        total: 0,
        page: params.page || 1,
        itemsPerPage: params.itemsPerPage || 10,
        totalPages: 0,
      };
    }
  }

  private sortRates(
    rates: TariffEntry[],
    sortField: string,
    sortDirection: "asc" | "desc"
  ): TariffEntry[] {
    const sortedRates = [...rates];

    sortedRates.sort((a, b) => {
      const typedSortField = sortField as keyof TariffEntry;

      if (typedSortField === "change" || typedSortField === "changeDisplay") {
        const aVal = a[typedSortField];
        const bVal = b[typedSortField];
        if (
          (typeof aVal !== "string" && typeof aVal !== "number") ||
          (typeof bVal !== "string" && typeof bVal !== "number")
        ) {
          try {
            return String(aVal).localeCompare(String(bVal)) * (sortDirection === "desc" ? -1 : 1);
          } catch {
            return 0;
          }
        }

        const aParsed = this.parseChangeValue(aVal);
        const bParsed = this.parseChangeValue(bVal);
        const result = sortDirection === "asc" ? aParsed - bParsed : bParsed - aParsed;
        return result;
      } else if (typedSortField === "rate" || typedSortField === "rateDisplay") {
        // Always use the numeric 'rate' field for comparison
        const aNum = a.rate ?? 0;
        const bNum = b.rate ?? 0;
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      } else if (typedSortField === "effectiveDate") {
        const parseDate = (dateStr: string): number | null => {
          if (!dateStr || dateStr === "N/A" || dateStr === "TBD") {
            return null; // Treat invalid/TBD dates consistently
          }
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? null : date.getTime();
        };

        const aTime = parseDate(a.effectiveDate);
        const bTime = parseDate(b.effectiveDate);

        // Handle nulls (place them at the end regardless of sort order)
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1; // a is null, put it after b
        if (bTime === null) return -1; // b is null, put it after a

        // Compare valid dates
        return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
      } else if (typedSortField === "countrysTariffOnUS") {
        const parsePercentage = (val: string | number | undefined | null): number => {
          if (typeof val === "number") return val;
          if (typeof val !== "string" || !val || val === "N/A" || val === "–" || val === "-")
            return 0;
          try {
            const numStr = val.replace(/%$/, "").trim();
            const num = parseFloat(numStr);
            return isNaN(num) ? 0 : num;
          } catch {
            return 0;
          }
        };
        const aNum = parsePercentage(a.countrysTariffOnUS);
        const bNum = parsePercentage(b.countrysTariffOnUS);
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

      const aValue = a[typedSortField];
      const bValue = b[typedSortField];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === "desc" ? -1 : 1;
      if (bValue == null) return sortDirection === "desc" ? 1 : -1;

      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return (aValue === bValue ? 0 : aValue ? 1 : -1) * (sortDirection === "desc" ? -1 : 1);
      }
      if (typeof aValue === "boolean") return -1;
      if (typeof bValue === "boolean") return 1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortDirection === "asc") {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return sortedRates;
  }

  private parseChangeValue(changeStr: string | number): number {
    if (typeof changeStr === "number") {
      return changeStr;
    }

    if (!changeStr || typeof changeStr !== "string") {
      return 0;
    }

    try {
      if (changeStr === "–" || changeStr === "-" || changeStr.toLowerCase() === "no change") {
        return 0;
      }

      if (changeStr.includes("or")) {
        const firstPart = changeStr.split("or")[0].trim();
        if (firstPart.includes("%") || /^[-+]?\d*\.?\d+$/.test(firstPart)) {
          changeStr = firstPart;
        } else {
          return 0;
        }
      }

      const numStr = changeStr.replace(/%$/, "").trim();
      const result = parseFloat(numStr);

      if (isNaN(result)) {
        return 0;
      }

      return result;
    } catch (error) {
      console.error(`Error parsing change value: ${changeStr}`, error);
      return 0;
    }
  }

  async exportTariffs(
    format: "csv" | "json",
    dataset: "product" | "country" = "product",
    search?: string
  ): Promise<{ data: string; contentType: string; filename: string }> {
    try {
      const { data: rows } = await this.getTariffRates({
        type: dataset,
        search,
        // One page holding everything: the export is the whole selection, not
        // whatever page the table happens to be showing.
        page: 1,
        itemsPerPage: 100000,
      });

      // The old export shipped 19 columns carrying 12 columns of information:
      // `type`, `scope`, `additionalInfo` and `impact` were identical in every
      // row, and country/to, product/commodity and effectiveDate/lastUpdated
      // were exact duplicates of each other.
      // Declared explicitly rather than inferred from the first row: a search
      // matching nothing produces an empty array, and csv-stringify cannot
      // infer a schema from that. It emitted a zero-byte file with no header,
      // so a legitimate "no results" export downloaded as an empty document.
      const columns =
        dataset === "country"
          ? [
              "country",
              "rateImposedByUSA",
              "status",
              "rateImposedOnUSA",
              "keySectors",
              "marketImpact",
              "responseType",
            ]
          : [
              "commodity",
              "tariffFrom",
              "tariffTo",
              "rate",
              "change",
              "status",
              "type",
              "effectiveDate",
            ];

      const shaped =
        dataset === "country"
          ? rows.map((r) => ({
              country: r.country,
              rateImposedByUSA: r.rateDisplay,
              status: r.status,
              rateImposedOnUSA: r.countrysTariffOnUS ?? "",
              keySectors: r.keyAffectedSectors ?? "",
              marketImpact: r.marketImpact ?? "",
              responseType: r.responseType ?? "",
            }))
          : rows.map((r) => ({
              commodity: r.commodity,
              tariffFrom: r.tariffOrigin,
              tariffTo: r.to,
              rate: r.rateDisplay,
              change: r.changeDisplay,
              status: r.status,
              type: r.nature,
              effectiveDate: r.effectiveDate,
            }));

      const stamp = new Date().toISOString().split("T")[0];
      const name = `tariff_${dataset === "country" ? "countries" : "commodities"}_${stamp}`;

      if (format === "csv") {
        return {
          data: stringify(shaped, { header: true, columns }),
          contentType: "text/csv",
          filename: `${name}.csv`,
        };
      }

      return {
        data: JSON.stringify(shaped, null, 2),
        contentType: "application/json",
        filename: `${name}.json`,
      };
    } catch (error) {
      console.error(`Error exporting tariffs as ${format}:`, error);
      throw new Error(`Failed to export data as ${format}.`);
    }
  }
}
