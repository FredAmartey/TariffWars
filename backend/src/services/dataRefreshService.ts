import cron from "node-cron";
import { promises as fs } from "fs";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import path from "path";
import OpenAI from "openai";
import { config } from "../config";

interface TariffCsvRow {
  Commodity: string;
  From: string;
  To: string;
  Rate: string;
  Change: string;
  Status: string;
  Nature: string;
  "Effective Date": string;
}

// Update AI Suggestion to match required CSV columns ONLY
interface AISuggestion {
  Commodity: string;
  From: string;
  To: string;
  Rate: string;
  Change: string;
  Status: string;
  Nature: string;
  "Effective Date": string;
}

export class DataRefreshService {
  private openai: OpenAI;
  private csvFilePath: string;
  private isRunning = false;
  private cronTask: cron.ScheduledTask | null = null;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.csvFilePath = path.resolve(__dirname, "../data/tariffs_commodities.csv");
  }

  private async generateTariffUpdates(existingData: TariffCsvRow[]): Promise<AISuggestion[]> {
    const chinaRows = existingData.filter(
      (row) =>
        (row.From === "USA" && row.To === "China") || (row.From === "China" && row.To === "USA")
    );
    const otherRows = existingData.filter(
      (row) =>
        !((row.From === "USA" && row.To === "China") || (row.From === "China" && row.To === "USA"))
    );
    const sampleData = [...chinaRows, ...otherRows.slice(0, 15 - chinaRows.length)];

    const contextSummary = sampleData
      .map(
        (row) =>
          `- ${row.Commodity} (${row.From} -> ${row.To}): Rate ${row.Rate}, Status ${row.Status}, Effective ${row["Effective Date"]}`
      )
      .join("\n");

    const prompt = `You are a global trade and tariff expert. Review the following sample of existing tariff data. Search reliable sources (official announcements, major financial news) for significant tariff developments reported *within the last 2-3 days*.

    Prioritize finding:
    1. Updates (Rate, Status, Effective Date, Change, Nature) to major existing tariffs, ESPECIALLY concerning US-China trade.
    2. Newly announced or **threatened** tariffs, particularly for major economies or key sectors.

    Existing Data Sample (Focus on US-China):
    ${contextSummary}

    Also, specifically verify any recent reports (last 2-3 days) regarding a potential additional 50% tariff threatened by the USA on Chinese Goods, potentially bringing the total rate to around 104%.

    For each significant development found, provide the details. If updating an existing item, ensure the effective date reflects the latest information. Determine the Nature field - it MUST be one of: "New", "Pre-existing", "Reciprocal", "Retaliation", or "Unknown". Do NOT return an empty string for Nature.

    Format the response STRICTLY as a JSON array of objects. Each object must contain EXACTLY these 8 fields in any order:
    Array<{
      Commodity: string;
      From: string;
      To: string;
      Rate: string; // e.g., "104%", "25%", "N/A"
      Change: string; // e.g., "+50%", "-5%", "New Status", "–"
      Status: string; // e.g., "Active", "Threatened", "Restricted"
      Nature: string; // MUST be "New", "Pre-existing", "Reciprocal", "Retaliation", or "Unknown"
      "Effective Date": string; // e.g., "April 15, 2025", "TBD"
    }>

    If no significant recent developments are found, return an empty array []. DO NOT include a Source or any fields other than the 8 specified.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant designed to find recent tariff information (updates and threats) based on news/official sources and output it as structured JSON with exactly 8 specified fields (Commodity, From, To, Rate, Change, Status, Nature, Effective Date).", // Updated system prompt
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        console.warn("OpenAI returned empty content for tariff updates.");
        return [];
      }

      let jsonString = content.trim();
      const startIndex = jsonString.indexOf("[");
      const endIndex = jsonString.lastIndexOf("]");
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        jsonString = jsonString.substring(startIndex, endIndex + 1);
      } else {
        jsonString = jsonString
          .replace(/^```json\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
      }
      console.log("Attempting to parse JSON content:", jsonString);

      try {
        const suggestions: AISuggestion[] = JSON.parse(jsonString);

        // Updated Validation for stricter format
        if (
          Array.isArray(suggestions) &&
          suggestions.every(
            (s) =>
              typeof s.Commodity === "string" &&
              typeof s.From === "string" &&
              typeof s.To === "string" &&
              typeof s.Rate === "string" &&
              typeof s.Change === "string" &&
              typeof s.Status === "string" &&
              typeof s.Nature === "string" &&
              typeof s["Effective Date"] === "string" &&
              Object.keys(s).length === 8 // Ensure exactly 8 keys
          )
        ) {
          console.log(`Received ${suggestions.length} potential updates from AI.`);
          return suggestions;
        } else {
          console.warn("AI response did not match the required 8-field structure:", jsonString);
          return [];
        }
      } catch (parseError) {
        console.error(
          "Failed to parse OpenAI response for tariff updates:",
          parseError,
          "\nContent Before Parse Attempt:",
          jsonString
        );
        return [];
      }
    } catch (apiError) {
      console.error("Error calling OpenAI for tariff updates:", apiError);
      return [];
    }
  }

  // Function to compare dates (simple string comparison assuming YYYY-MM-DD or consistent format)
  // A more robust solution would parse dates properly.
  private isNewerDate(date1: string, date2: string): boolean {
    // Basic check: TBD/Pending are considered older than concrete dates
    if (date1.match(/TBD|Pending/i) && !date2.match(/TBD|Pending/i)) return false;
    if (!date1.match(/TBD|Pending/i) && date2.match(/TBD|Pending/i)) return true;
    if (date1.match(/TBD|Pending/i) && date2.match(/TBD|Pending/i)) return false; // Treat as same if both pending

    try {
      const d1 = new Date(date1).toISOString();
      const d2 = new Date(date2).toISOString();
      return d1 > d2;
    } catch {
      return date1 > date2;
    }
  }

  async updateTariffCSV(): Promise<void> {
    if (this.isRunning) {
      console.log("Data refresh job already running. Skipping this run.");
      return;
    }
    this.isRunning = true;
    console.log(`[${new Date().toISOString()}] Starting tariff CSV update job...`);

    const currentDate = new Date("2025-04-09");

    try {
      let existingData: TariffCsvRow[] = [];
      try {
        const fileContent = await fs.readFile(this.csvFilePath, { encoding: "utf8" });
        const records = await new Promise<TariffCsvRow[]>((resolve, reject) => {
          parse(fileContent, { columns: true, skip_empty_lines: true }, (err: any, output: any) =>
            err ? reject(err) : resolve(output)
          );
        });
        existingData = records;
        console.log(`Read ${existingData.length} records from ${this.csvFilePath}`);
      } catch (readError: any) {
        if (readError.code === "ENOENT") {
          console.log("CSV file not found, will create a new one if AI provides data.");
        } else {
          throw readError;
        }
      }

      const aiSuggestionsRaw = await this.generateTariffUpdates(existingData);

      // ** Process AI suggestions for status consistency **
      const aiSuggestions = aiSuggestionsRaw.map((suggestion) => {
        const effectiveDateStr = suggestion["Effective Date"];
        let suggestionStatus = suggestion.Status;
        try {
          const effectiveDate = new Date(effectiveDateStr);
          // Check if date is valid and in the past or present
          if (!isNaN(effectiveDate.getTime()) && effectiveDate <= currentDate) {
            // If date passed, status should be Active (unless already something else considered final?)
            // For simplicity, we override typical pending/threatened statuses.
            if (
              ["Threatened", "Pending", "TBD", "Under Investigation"].includes(suggestionStatus)
            ) {
              console.log(
                `Updating status for ${suggestion.Commodity} (${suggestion.From}->${suggestion.To}) to Active based on effective date ${effectiveDateStr}`
              );
              suggestionStatus = "Active";
            }
          }
        } catch (dateError) {
          console.warn(`Could not parse effective date '${effectiveDateStr}' for status check.`);
        }
        // Return a new object with potentially updated status
        return { ...suggestion, Status: suggestionStatus };
      });

      if (aiSuggestions.length === 0) {
        console.log("No valid updates suggested by AI (after processing). CSV remains unchanged.");
        this.isRunning = false;
        return;
      }

      // 3. Merge Data (Update existing, Add new, Avoid duplicates)
      const updatedDataMap = new Map<string, TariffCsvRow>();

      // Add existing data to map, keyed by Commodity|From|To
      existingData.forEach((row) => {
        const key = `${row.Commodity}|${row.From}|${row.To}`.toLowerCase();
        updatedDataMap.set(key, row);
      });

      let updatedCount = 0;
      let addedCount = 0;

      aiSuggestions.forEach((suggestion) => {
        const key = `${suggestion.Commodity}|${suggestion.From}|${suggestion.To}`.toLowerCase();
        const existingRow = updatedDataMap.get(key);
        const effectiveDate = suggestion["Effective Date"];
        const nature = suggestion.Nature;

        if (existingRow) {
          const existingEffectiveDate = existingRow["Effective Date"];
          if (
            existingRow.Rate !== suggestion.Rate ||
            existingRow.Status !== suggestion.Status ||
            existingRow.Change !== suggestion.Change ||
            existingRow.Nature !== suggestion.Nature ||
            effectiveDate !== existingEffectiveDate
          ) {
            if (this.isNewerDate(effectiveDate, existingEffectiveDate)) {
              console.log(
                `Updating existing row: ${key} (New Date: ${effectiveDate}, Status: ${suggestion.Status}, Nature: ${nature})`
              );
              updatedDataMap.set(key, {
                Commodity: suggestion.Commodity,
                From: suggestion.From,
                To: suggestion.To,
                Rate: suggestion.Rate,
                Change: suggestion.Change,
                Status: suggestion.Status,
                Nature: nature,
                "Effective Date": effectiveDate,
              });
              updatedCount++;
            } else if (effectiveDate === existingEffectiveDate) {
              console.log(
                `Updating existing row (Data change, same date): ${key} Status: ${suggestion.Status}, Nature: ${nature})`
              );
              updatedDataMap.set(key, {
                Commodity: suggestion.Commodity,
                From: suggestion.From,
                To: suggestion.To,
                Rate: suggestion.Rate,
                Change: suggestion.Change,
                Status: suggestion.Status,
                Nature: nature,
                "Effective Date": effectiveDate,
              });
              updatedCount++;
            }
          }
        } else {
          console.log(`Adding new row: ${key} (Status: ${suggestion.Status}, Nature: ${nature})`);
          updatedDataMap.set(key, {
            Commodity: suggestion.Commodity,
            From: suggestion.From,
            To: suggestion.To,
            Rate: suggestion.Rate,
            Change: suggestion.Change,
            Status: suggestion.Status,
            Nature: nature,
            "Effective Date": effectiveDate,
          });
          addedCount++;
        }
      });

      // 4. Prepare final data and Stringify with explicit columns
      const finalData = Array.from(updatedDataMap.values());
      const columns = [
        "Commodity",
        "From",
        "To",
        "Rate",
        "Change",
        "Status",
        "Nature",
        "Effective Date",
      ];
      const csvString = await new Promise<string>((resolve, reject) => {
        stringify(
          finalData,
          {
            header: true,
            columns: columns, // Enforce column order and inclusion
          },
          (err: any, output: any) => (err ? reject(err) : resolve(output))
        );
      });

      // 5. Write back to CSV
      await fs.writeFile(this.csvFilePath, csvString, { encoding: "utf8" });
      console.log(
        `Successfully updated ${this.csvFilePath}. Updates: ${updatedCount}, Added: ${addedCount}. Total records: ${finalData.length}`
      );
    } catch (error) {
      console.error(`Error during tariff CSV update job:`, error);
    } finally {
      this.isRunning = false;
      console.log(`[${new Date().toISOString()}] Finished tariff CSV update job.`);
    }
  }

  startScheduling(): void {
    if (this.cronTask) {
      console.log("Tariff data refresh job already scheduled.");
      // If already scheduled, maybe still run once if requested immediately?
      // For now, just return if task exists.
      // If you want immediate run even if scheduled, call updateTariffCSV() here.
      return;
    }
    console.log("Scheduling tariff data refresh job (runs at 00:00 and 12:00 UTC)...");
    // Schedule to run twice a day (at minute 0 past hour 0 and 12)
    this.cronTask = cron.schedule(
      "0 0,12 * * *",
      () => {
        this.updateTariffCSV();
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    // Run once immediately on start
    console.log("Running initial tariff data refresh...");
    this.updateTariffCSV();
  }

  // Method to stop the scheduled task
  stopScheduling(): void {
    if (this.cronTask) {
      console.log("Stopping scheduled tariff data refresh job...");
      this.cronTask.stop();
      this.cronTask = null;
      console.log("Tariff data refresh job stopped.");
    } else {
      console.log("No tariff data refresh job is currently scheduled.");
    }
  }
}
