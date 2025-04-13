export interface TariffEntry {
  id: string;
  type: "country" | "product";
  country: string;
  product: string;
  commodity: string;
  status: string;
  rate: number;
  rateDisplay?: string;
  scope: string;
  additionalInfo: string;
  effectiveDate: string;
  lastUpdated: string;
  impact: "low" | "medium" | "high";
  tariffOrigin: string;
  to: string;
  isIncrease: boolean;
  change: "increase" | "decrease" | "no-change";
  changeDisplay: string;
  firstImplemented?: string;
  nature: string;

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
}
