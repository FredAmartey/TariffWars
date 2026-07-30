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

      const validatedSortField = validSortFields.includes(sortBy as any)
        ? (sortBy as keyof TariffEntry)
        : undefined;

      console.log("Tariff Route - Validated sort params:", {
        sortBy: validatedSortField,
        sortOrder: (sortOrder as "asc" | "desc") || "desc",
      });

      // `bypass_cache` used to call clearCache(), flushing every cached query
      // for every visitor on this instance. Skipping the cache for this one
      // request gives the caller what they asked for without the side effect.
      const skipCache = bypass_cache === "true" || bypass_cache === "1";

      // Unbounded values reached the slicer and produced nonsense:
      // itemsPerPage=-5 returned 32 rows with totalPages -7, and a
      // non-numeric value returned totalPages null.
      const parsePositiveInt = (raw: unknown, max: number): number | undefined | null => {
        if (raw === undefined) return undefined;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > max) return null;
        return n;
      };

      const parsedPage = parsePositiveInt(page, 100000);
      const parsedItemsPerPage = parsePositiveInt(itemsPerPage, 10000);
      if (parsedPage === null || parsedItemsPerPage === null) {
        return res.status(400).json({
          error: "Bad Request",
          message: "page and itemsPerPage must be positive integers.",
        });
      }

      const serviceParams: TariffQueryParams = {
        search: search as string,
        type: type as "country" | "product" | undefined,
        sortBy: validatedSortField,
        sortOrder: (sortOrder as "asc" | "desc") || "desc",
        page: parsedPage,
        itemsPerPage: parsedItemsPerPage,
        skipCache,
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
        // Every other route guards this; this one returned raw internals,
        // including filesystem paths, to any caller in production.
        message:
          process.env.NODE_ENV === "production"
            ? "Could not load tariff data"
            : error.message,
      });
    }
  });

  router.get("/export", async (req, res) => {
    const format = req.query.format === "csv" ? "csv" : "json"; // Default to json
    // The modal offers to export "the current tariff data", so honour which
    // table the user is looking at. It always shipped commodities before, so
    // exporting from the Countries tab silently gave you the wrong dataset.
    const dataset = req.query.dataset === "country" ? "country" : "product";
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    try {
      const { data, contentType, filename } = await tariffService.exportTariffs(
        format,
        dataset,
        search
      );

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(data);
    } catch (error: any) {
      console.error(`Failed to export data as ${format}:`, error);
      res.status(500).json({
        error: "Export Failed",
        message:
          process.env.NODE_ENV === "production"
            ? `Could not export data as ${format}.`
            : error.message,
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
