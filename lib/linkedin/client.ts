import * as fs from "fs";
import * as path from "path";
import {
  LinkedinPostSearchOptions,
  UnipileDatePosted,
  UnipileSearchResponse,
} from "./types";

export interface UnipileConfig {
  baseUrl: string;
  apiKey: string;
  accountId: string;
}

/**
 * Normalizes user-friendly date inputs (e.g., "past 7 days", "past 30 days", "24h")
 * to the Unipile API supported date_posted values: "past_day" | "past_week" | "past_month".
 */
export function normalizeDatePosted(
  dateInput?: string | null
): UnipileDatePosted | undefined {
  if (!dateInput || typeof dateInput !== "string") {
    return undefined;
  }

  const cleaned = dateInput.trim().toLowerCase().replace(/[-_]/g, " ");

  // Past Day (24 hours)
  if (
    cleaned === "past day" ||
    cleaned === "day" ||
    cleaned === "today" ||
    cleaned === "24h" ||
    cleaned === "1d" ||
    cleaned === "1" ||
    cleaned.includes("24 hour") ||
    cleaned.includes("1 day") ||
    cleaned.includes("past 24")
  ) {
    return "past_day";
  }

  // Past Week (7 days)
  if (
    cleaned === "past week" ||
    cleaned === "week" ||
    cleaned === "7d" ||
    cleaned === "7" ||
    cleaned.includes("7 day") ||
    cleaned.includes("past 7") ||
    cleaned.includes("1 week")
  ) {
    return "past_week";
  }

  // Past Month (30 days)
  if (
    cleaned === "past month" ||
    cleaned === "month" ||
    cleaned === "30d" ||
    cleaned === "30" ||
    cleaned.includes("30 day") ||
    cleaned.includes("past 30") ||
    cleaned.includes("1 month")
  ) {
    return "past_month";
  }

  // Fallback direct check if valid enum was passed directly
  if (
    dateInput === "past_day" ||
    dateInput === "past_week" ||
    dateInput === "past_month"
  ) {
    return dateInput;
  }

  return undefined;
}

/**
 * Retrieves and cleans Unipile configuration from environment variables or .env fallback.
 */
export function getUnipileConfig(): UnipileConfig {
  let baseUrl = (process.env.UNIPILE_BASE_URL || "").trim();
  let apiKey = (process.env.UNIPILE_API_KEY || "").trim();
  let accountId = (process.env.UNIPILE_ACCOUNT_ID || "").trim();

  // Fallback: Read directly from .env file if running in an environment where dotenv hasn't loaded yet
  if (!apiKey || !accountId) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
          const [rawKey, ...valParts] = trimmed.split("=");
          const key = rawKey.trim();
          const val = valParts.join("=").trim();

          if (key === "UNIPILE_BASE_URL" && !baseUrl) {
            baseUrl = val;
          } else if (key === "UNIPILE_API_KEY" && !apiKey) {
            apiKey = val;
          } else if (key === "UNIPILE_ACCOUNT_ID" && !accountId) {
            accountId = val;
          }
        }
      }
    } catch {
      // Ignore filesystem read errors in restricted contexts
    }
  }

  if (!baseUrl) {
    baseUrl = "https://api24.unipile.com:15468";
  }
  baseUrl = baseUrl.replace(/\/+$/, "");

  if (!apiKey) {
    throw new Error(
      "UNIPILE_API_KEY is not defined in environment variables. Please check your .env file."
    );
  }

  if (!accountId) {
    throw new Error(
      "UNIPILE_ACCOUNT_ID is not defined in environment variables. Please check your .env file."
    );
  }

  return {
    baseUrl,
    apiKey,
    accountId,
  };
}

/**
 * Performs a LinkedIn Post Search via Unipile API.
 */
export async function searchLinkedinPosts(
  options: LinkedinPostSearchOptions
): Promise<UnipileSearchResponse> {
  const config = getUnipileConfig();

  // LinkedIn classic post search defaults to 10, clamp between 1 and 50
  const rawLimit = options.limit ?? 10;
  const limit = Math.min(Math.max(rawLimit, 1), 50);

  const queryParams = new URLSearchParams({
    account_id: config.accountId,
    limit: limit.toString(),
  });

  if (options.cursor) {
    queryParams.append("cursor", options.cursor);
  }

  const endpoint = `${config.baseUrl}/api/v1/linkedin/search?${queryParams.toString()}`;

  const bodyPayload: Record<string, unknown> = {
    api: "classic",
    category: "posts",
    keywords: options.keywords.trim(),
    sort_by: options.sort_by || "date",
  };

  if (options.date_posted) {
    bodyPayload.date_posted = options.date_posted;
  }

  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": config.apiKey,
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError: Record<string, unknown> | null = null;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        // Not JSON
      }

      const detail =
        (parsedError?.detail as string) ||
        (parsedError?.title as string) ||
        (parsedError?.message as string) ||
        errorText;

      throw new Error(
        `Unipile LinkedIn Search failed (HTTP ${response.status}): ${detail}`
      );
    }

    return (await response.json()) as UnipileSearchResponse;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}
