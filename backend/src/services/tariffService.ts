import { TariffEntry, TariffResponse, TariffQueryParams } from "../types/tariff";
import { promises as fs } from "fs";
import path from "path";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";

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
                if (["N/A", "Restricted", "-", "–", "Banned"].includes(trimmedValue)) {
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
          status: record.Status || "Unknown",
          rate: rateNum,
          rateDisplay: rateDisplayStr,
          scope: record.Scope || "N/A",
          additionalInfo: record.AdditionalInfo || "",
          effectiveDate: record["Effective Date"] || "N/A",
          lastUpdated: record["Effective Date"] || new Date().toISOString().split("T")[0],
          impact: (record.Impact?.toLowerCase() as "low" | "medium" | "high") || "low",
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
      if (readError.code === "ENOENT") {
        console.error(`Error: CSV file not found at ${this.csvFilePath}`);
        return [];
      } else {
        console.error(`Error reading or parsing CSV file at ${this.csvFilePath}:`, readError);
        return [];
      }
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
                if (["N/A", "Restricted", "-", "–", "Banned"].includes(trimmedValue)) {
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
            rateDisplayStr = rateStr;
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
          scope: "N/A",
          additionalInfo: "",
          effectiveDate: "N/A",
          lastUpdated: new Date().toISOString().split("T")[0],
          impact: "low",
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
      return [];
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
      } = params;

      const validSortFields = [
        "commodity",
        "from",
        "to",
        "rate",
        "effectiveDate",
        "impact",
        "firstImplemented",
        "tariffOrigin",
        "change",
        "status",
        "nature",
        "country",
        "scope",
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

      if (cachedData && now - cachedData.timestamp < this.cacheTimeout) {
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
          filteredData = filteredData.filter(
            (entry) =>
              entry.commodity?.toLowerCase().includes(lowerSearch) ||
              entry.country?.toLowerCase().includes(lowerSearch) ||
              entry.status?.toLowerCase().includes(lowerSearch) ||
              entry.tariffOrigin?.toLowerCase().includes(lowerSearch) ||
              entry.to?.toLowerCase().includes(lowerSearch) ||
              entry.nature?.toLowerCase().includes(lowerSearch)
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

      const sortedData = [...data];

      if (sortBy && validSortFields.includes(sortBy as any)) {
        const typedSortBy = sortBy as keyof TariffEntry;
        sortedData.sort((a, b) => {
          const aValue = a[typedSortBy];
          const bValue = b[typedSortBy];

          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return sortOrder === "desc" ? -1 : 1;
          if (bValue == null) return sortOrder === "desc" ? 1 : -1;

          if (typeof aValue === "boolean" && typeof bValue === "boolean") {
            return (aValue === bValue ? 0 : aValue ? 1 : -1) * (sortOrder === "desc" ? -1 : 1);
          }
          if (typeof aValue === "boolean") return -1;
          if (typeof bValue === "boolean") return 1;

          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
          }

          const aStr = String(aValue).toLowerCase();
          const bStr = String(bValue).toLowerCase();

          if (sortOrder === "asc") {
            return aStr.localeCompare(bStr);
          } else {
            return bStr.localeCompare(aStr);
          }
        });
      }

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
    format: "csv" | "json"
  ): Promise<{ data: string; contentType: string; filename: string }> {
    try {
      const allTariffs = await this.loadDataFromCSV();

      if (format === "csv") {
        const columns = [
          "id",
          "type",
          "country",
          "product",
          "commodity",
          "status",
          "rate",
          "rateDisplay",
          "scope",
          "additionalInfo",
          "effectiveDate",
          "lastUpdated",
          "impact",
          "tariffOrigin",
          "to",
          "isIncrease",
          "change",
          "changeDisplay",
          "nature",
        ];
        const csvData = stringify(allTariffs, { header: true, columns: columns });
        return {
          data: csvData,
          contentType: "text/csv",
          filename: `tariff_data_${new Date().toISOString().split("T")[0]}.csv`,
        };
      } else {
        const jsonData = JSON.stringify(allTariffs, null, 2);
        return {
          data: jsonData,
          contentType: "application/json",
          filename: `tariff_data_${new Date().toISOString().split("T")[0]}.json`,
        };
      }
    } catch (error) {
      console.error(`Error exporting tariffs as ${format}:`, error);
      throw new Error(`Failed to export data as ${format}.`);
    }
  }
}
