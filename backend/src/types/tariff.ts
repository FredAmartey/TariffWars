export interface TariffEntry {
  id: string;
  type: "country" | "product";
  country: string;
  product: string;
  commodity: string;
  status: string;
  rate: number;
  rateDisplay?: string;
  effectiveDate: string;
  tariffOrigin: string;
  to: string;
  isIncrease: boolean;
  change: "increase" | "decrease" | "no-change";
  changeDisplay: string;
  nature: string;
  // `scope`, `additionalInfo`, `impact`, `lastUpdated` and `firstImplemented`
  // used to live here. None came from the CSVs: every row carried the same
  // placeholder, and `lastUpdated` was a copy of the effective date, so an
  // export claimed a 2018 tariff had been updated in 2018.

  // Optional fields for country-specific data (from tariffs_countries.csv)
  countrysTariffOnUS?: string;
  keyAffectedSectors?: string;
  marketImpact?: string;
  responseType?: string;
}

export interface TariffResponse {
  data: TariffEntry[];
  total: number;
  page: number;
  itemsPerPage: number;
  totalPages: number;
}

export interface TariffQueryParams {
  search?: string;
  type?: "country" | "product";
  status?: string;
  country?: string;
  commodity?: string;
  tariffOrigin?: string;
  to?: string;
  nature?: string;
  sortBy?: keyof TariffEntry;
  sortOrder?: "asc" | "desc";
  page?: number;
  itemsPerPage?: number;
  /** Skip this query's cache entry. Does not evict anyone else's. */
  skipCache?: boolean;
}
