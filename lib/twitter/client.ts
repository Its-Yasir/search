import * as fs from "fs";
import * as path from "path";
import {
  TweetItem,
  TwitterPostSearchOptions,
  TwitterRawApiResponse,
} from "./types";

const BASE_URL = "https://api.twitterapi.io";

/**
 * Retrieves Twitter API Key from environment or .env fallback.
 */
export function getTwitterApiKey(): string {
  let apiKey = (
    process.env.TWITTER_API_KEY ||
    process.env.TWITTERAPI_KEY ||
    process.env.TWITTER_API_IO_KEY ||
    ""
  ).trim();

  // Fallback: Read from .env file directly if dotenv not yet loaded
  if (!apiKey) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(
          /(?:TWITTER_API_KEY|TWITTERAPI_KEY|TWITTER_API_IO_KEY)\s*=\s*(.*)/
        );
        if (match && match[1]) {
          apiKey = match[1].trim();
        }
      }
    } catch {
      // Ignore filesystem read errors
    }
  }

  if (!apiKey) {
    throw new Error(
      "TWITTER_API_KEY is not defined in environment variables or .env file. Please check your .env configuration."
    );
  }

  return apiKey;
}

/**
 * Converts user-friendly date strings (e.g., "past 7 days", "past 30 days", "24h")
 * to a UTC 'YYYY-MM-DD' string for Twitter's native `since:` search operator.
 */
export function parseDateToSince(dateInput?: string | null): string | undefined {
  if (!dateInput || typeof dateInput !== "string") {
    return undefined;
  }

  const cleaned = dateInput.trim().toLowerCase().replace(/[-_]/g, " ");

  // Direct YYYY-MM-DD pattern
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  const now = new Date();

  // Past 24 hours / 1 day
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
    const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  }

  // Past 7 days / 1 week
  if (
    cleaned === "past week" ||
    cleaned === "week" ||
    cleaned === "7d" ||
    cleaned === "7" ||
    cleaned.includes("7 day") ||
    cleaned.includes("past 7") ||
    cleaned.includes("1 week")
  ) {
    const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  }

  // Past 30 days / 1 month
  if (
    cleaned === "past month" ||
    cleaned === "month" ||
    cleaned === "30d" ||
    cleaned === "30" ||
    cleaned.includes("30 day") ||
    cleaned.includes("past 30") ||
    cleaned.includes("1 month")
  ) {
    const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  }

  // Relative days pattern like "14 days", "3 days"
  const daysMatch = cleaned.match(/^(\d+)\s*(?:d|days)?$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (!isNaN(days) && days > 0) {
      const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return d.toISOString().split("T")[0];
    }
  }

  return undefined;
}

/**
 * Builds the effective Twitter search query combining keywords, username, and since: date.
 */
export function buildTwitterQuery(options: {
  keywords?: string;
  query?: string;
  username?: string;
  sinceDate?: string;
}): string {
  const parts: string[] = [];

  const rawKeywords = (options.keywords || options.query || "").trim();
  if (rawKeywords) {
    parts.push(rawKeywords);
  }

  if (options.username && options.username.trim()) {
    const cleanUser = options.username.trim().replace(/^@/, "");
    // If query does not already specify from:, append from:user
    if (!rawKeywords.toLowerCase().includes(`from:${cleanUser.toLowerCase()}`)) {
      parts.push(`from:${cleanUser}`);
    }
  }

  if (options.sinceDate) {
    // Only append since: if the user query doesn't already have since:
    if (!rawKeywords.toLowerCase().includes("since:")) {
      parts.push(`since:${options.sinceDate}`);
    }
  }

  return parts.join(" ").trim();
}

/**
 * Performs Twitter tweet search using twitterapi.io advanced search.
 */
export async function searchTwitterPosts(options: TwitterPostSearchOptions): Promise<{
  items: TweetItem[];
  total: number;
  cursor?: string | null;
  has_next_page: boolean;
  queryInfo: {
    keywords?: string;
    username?: string;
    date_input?: string;
    since_date?: string;
    final_query: string;
    limit: number;
    queryType: "Latest" | "Top";
  };
}> {
  const apiKey = getTwitterApiKey();
  const sinceDate = parseDateToSince(options.date);

  const finalQuery = buildTwitterQuery({
    keywords: options.keywords,
    query: options.query,
    username: options.username,
    sinceDate,
  });

  if (!finalQuery) {
    throw new Error("Missing search terms: 'keywords', 'query', or 'username' must be provided.");
  }

  const queryType = options.queryType === "Top" ? "Top" : "Latest";
  const limit = options.limit ? Math.max(1, options.limit) : 10;

  const queryParams = new URLSearchParams({
    query: finalQuery,
    queryType,
  });

  if (options.cursor) {
    queryParams.append("cursor", options.cursor);
  }

  const url = `${BASE_URL}/twitter/tweet/advanced_search?${queryParams.toString()}`;
  const timeoutMs = options.timeoutMs || 25000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    // Auto-retry once on 429 (twitterapi.io free-tier has 1 req per 5s limit)
    if (response.status === 429) {
      console.warn("TwitterAPI.io rate limit (429) hit. Waiting 5.2s before automatic retry...");
      await new Promise((resolve) => setTimeout(resolve, 5200));
      response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let parsedMsg = errorText;
      try {
        const parsed = JSON.parse(errorText);
        parsedMsg = parsed.message || parsed.error || errorText;
      } catch {}
      throw new Error(
        `TwitterAPI.io search failed (HTTP ${response.status}): ${parsedMsg}`
      );
    }

    const rawData = (await response.json()) as TwitterRawApiResponse;

    let rawTweets: TweetItem[] = [];
    let hasNextPage = false;
    let nextCursor: string | null = null;

    if (Array.isArray(rawData.tweets)) {
      rawTweets = rawData.tweets;
      hasNextPage = Boolean(rawData.has_next_page);
      nextCursor = rawData.next_cursor || null;
    } else if (rawData.data && Array.isArray(rawData.data.tweets)) {
      rawTweets = rawData.data.tweets;
      hasNextPage = Boolean(rawData.data.has_next_page);
      nextCursor = rawData.data.next_cursor || null;
    }

    // Apply variable post limit slicing if user requested fewer than API returned
    const items = options.limit ? rawTweets.slice(0, limit) : rawTweets;

    return {
      items,
      total: items.length,
      cursor: nextCursor,
      has_next_page: hasNextPage,
      queryInfo: {
        keywords: options.keywords || options.query,
        username: options.username,
        date_input: options.date,
        since_date: sinceDate,
        final_query: finalQuery,
        limit,
        queryType,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}
