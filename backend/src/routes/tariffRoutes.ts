import express from "express";
import fs from "fs/promises";
import path from "path";
import { TariffService } from "../services/tariffService";
import { TariffEntry } from "../types/tariff";
import { TariffQueryParams } from "../types/tariff";

export const tariffRoutes = (tariffService: TariffService) => {
  const router = express.Router();

  router.get("/rates", async (req, res) => {
    try {
      const {
        search,
        type,
        sortBy,
        sortOrder,
        page,
        itemsPerPage,
        bypass_cache,
        status,
        country,
        commodity,
        tariffOrigin,
        to,
        nature,
      } = req.query;

      console.log("Tariff Route - Request query params:", req.query);

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

      const validatedSortField = validSortFields.includes(sortBy as any)
        ? (sortBy as keyof TariffEntry)
        : undefined;

      console.log("Tariff Route - Validated sort params:", {
        sortBy: validatedSortField,
        sortOrder: (sortOrder as "asc" | "desc") || "desc",
      });

      if (bypass_cache) {
        console.log("Tariff Route - Bypassing cache as requested");
        tariffService.clearCache();
      }

      const serviceParams: TariffQueryParams = {
        search: search as string,
        type: type as "country" | "product" | undefined,
        sortBy: validatedSortField,
        sortOrder: (sortOrder as "asc" | "desc") || "desc",
        page: page ? parseInt(page as string) : undefined,
        itemsPerPage: itemsPerPage ? parseInt(itemsPerPage as string) : undefined,
        status: status as string | undefined,
        country: country as string | undefined,
        commodity: commodity as string | undefined,
        tariffOrigin: tariffOrigin as string | undefined,
        to: to as string | undefined,
        nature: nature as string | undefined,
      };

      console.log("Tariff Route - Calling service with params:", serviceParams);

      const result = await tariffService.getTariffRates(serviceParams);

      console.log(
        `Tariff Route - Returning ${result.data.length} results for page ${result.page} (of ${result.totalPages})`
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error in /rates endpoint:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error.message,
      });
    }
  });

  router.get("/export", async (req, res) => {
    const format = req.query.format === "csv" ? "csv" : "json"; // Default to json

    try {
      const { data, contentType, filename } = await tariffService.exportTariffs(format);

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(data);
    } catch (error: any) {
      console.error(`Failed to export data as ${format}:`, error);
      res.status(500).json({
        error: "Export Failed",
        message: error.message || `Could not export data as ${format}.`,
      });
    }
  });

  router.get("/meta", async (_req, res) => {
    try {
      // Same __dirname-relative pattern tariffService uses for the CSVs,
      // so it resolves identically under ts-node-dev, tsc dist, and Vercel.
      const metaPath = path.resolve(__dirname, "../data/meta.json");
      const content = await fs.readFile(metaPath, "utf8");
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("Error in /meta endpoint:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Could not load data metadata",
      });
    }
  });

  return router;
};
