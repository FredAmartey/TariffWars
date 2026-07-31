// Mirrors backend/src/types/tariff.ts. It had drifted: `scope`,
// `additionalInfo`, `lastUpdated` and `impact` were dropped from the API
// payload but kept here, so the compiler promised four fields that no response
// has carried since. `product` and `isIncrease` are still sent but nothing
// renders them.
export interface TariffEntry {
  id: string;
  type: "country" | "product";
  country: string;
  commodity: string;
  status: string;
  rate: number;
  rateDisplay?: string;
  effectiveDate: string;
  tariffOrigin: string;
  to: string;
  change: "increase" | "decrease" | "no-change";
  changeDisplay: string;
  nature?: string;

  // Optional fields for country-specific data (from tariffs_countries.csv)
  countrysTariffOnUS?: string;
  keyAffectedSectors?: string;
  marketImpact?: string;
  responseType?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  source: { name: string };
  url?: string;
  imageUrl?: string;
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
  sortBy?: keyof TariffEntry;
  sortOrder?: "asc" | "desc";
  page?: number;
  itemsPerPage?: number;
}
