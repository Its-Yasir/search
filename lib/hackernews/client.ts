import {
  HnAlgoliaResponse,
  HnSearchOptions,
  HnSort,
  HnStoryItem,
  HnTag,
} from "./types";

const BASE_URL = "https://hn.algolia.com/api/v1";

/**
 * Translates human date inputs (e.g., "past 7 days", "past 30 days", "24h")
 * to a Unix timestamp in seconds for Algolia numericFilters (created_at_i > X).
 */
export function parseDateToTimestamp(
  dateInput?: string | null
): number | undefined {
  if (!dateInput || typeof dateInput !== "string") {
    return undefined;
  }

  const cleaned = dateInput.trim().toLowerCase().replace(/[-_]/g, " ");

  // Direct YYYY-MM-DD pattern
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const ts = Math.floor(new Date(dateInput.trim()).getTime() / 1000);
    return isNaN(ts) ? undefined : ts;
  }

  const nowMs = Date.now();

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
    return Math.floor((nowMs - 24 * 60 * 60 * 1000) / 1000);
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
    return Math.floor((nowMs - 7 * 24 * 60 * 60 * 1000) / 1000);
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
    return Math.floor((nowMs - 30 * 24 * 60 * 60 * 1000) / 1000);
  }

  // Past year
  if (cleaned.includes("year") || cleaned === "1y") {
    return Math.floor((nowMs - 365 * 24 * 60 * 60 * 1000) / 1000);
  }

  return undefined;
}

/**
 * Normalizes Hacker News tag filters.
 */
export function normalizeHnTag(tagInput?: string | null): HnTag {
  if (!tagInput || typeof tagInput !== "string") {
    return "story"; // Default to story
  }

  const cleaned = tagInput.trim().toLowerCase();
  if (cleaned === "comment" || cleaned === "comments") return "comment";
  if (cleaned === "show_hn" || cleaned === "showhn" || cleaned === "show")
    return "show_hn";
  if (cleaned === "ask_hn" || cleaned === "askhn" || cleaned === "ask")
    return "ask_hn";
  if (cleaned === "poll") return "poll";
  if (cleaned === "all") return "all";

  return "story";
}

/**
 * Decodes HTML entities and clean HTML tags.
 */
export function cleanHnText(rawHtml?: string | null): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Executes a search on Hacker News via the official public Algolia Search API.
 */
export async function searchHackerNews(options: HnSearchOptions): Promise<{
  items: HnStoryItem[];
  total: number;
  queryInfo: {
    keywords: string;
    date_input?: string;
    since_timestamp?: number;
    tag: HnTag;
    sort: HnSort;
    limit: number;
    page: number;
  };
}> {
  const keywords = (options.keywords || "").trim();
  if (!keywords) {
    throw new Error("Missing required parameter: 'keywords' or 'query'.");
  }

  const tag = normalizeHnTag(options.tag);
  const sort: HnSort = options.sort === "relevance" ? "relevance" : "date";
  const limit = options.limit ? Math.min(Math.max(1, options.limit), 100) : 10;
  const page = options.page ? Math.max(0, options.page) : 0;

  const sinceTimestamp = parseDateToTimestamp(options.date);

  const queryParams = new URLSearchParams({
    query: keywords,
    hitsPerPage: limit.toString(),
    page: page.toString(),
  });

  if (tag !== "all") {
    queryParams.append("tags", tag);
  }

  const numericFilters: string[] = [];
  if (sinceTimestamp) {
    numericFilters.push(`created_at_i>${sinceTimestamp}`);
  }
  if (options.minPoints && options.minPoints > 0) {
    numericFilters.push(`points>=${options.minPoints}`);
  }
  if (options.minComments && options.minComments > 0) {
    numericFilters.push(`num_comments>=${options.minComments}`);
  }

  if (numericFilters.length > 0) {
    queryParams.append("numericFilters", numericFilters.join(","));
  }

  // search_by_date sorts by recent first; search sorts by relevance
  const endpoint = sort === "date" ? "search_by_date" : "search";
  const url = `${BASE_URL}/${endpoint}?${queryParams.toString()}`;

  const timeoutMs = options.timeoutMs || 20000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "alpha-search-application",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Hacker News API search failed (HTTP ${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as HnAlgoliaResponse;
    const hits = Array.isArray(data.hits) ? data.hits : [];

    const items: HnStoryItem[] = hits.map((hit) => {
      const title = hit.title || hit.story_title || "Untitled";
      const rawText = hit.story_text || hit.comment_text || "";
      const text = cleanHnText(rawText);
      const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const url = hit.url || hit.story_url || hnUrl;

      // Determine item category
      let itemType: "story" | "comment" | "show_hn" | "ask_hn" | "poll" =
        "story";
      const tags = hit._tags || [];
      if (tags.includes("comment")) itemType = "comment";
      else if (tags.includes("show_hn") || title.startsWith("Show HN:"))
        itemType = "show_hn";
      else if (tags.includes("ask_hn") || title.startsWith("Ask HN:"))
        itemType = "ask_hn";
      else if (tags.includes("poll")) itemType = "poll";

      return {
        id: hit.objectID,
        title,
        text,
        url,
        hnUrl,
        author: {
          name: hit.author || "anonymous",
          profileUrl: `https://news.ycombinator.com/user?id=${hit.author}`,
        },
        points: Number(hit.points || 0),
        commentsCount: Number(hit.num_comments || 0),
        createdAt: hit.created_at,
        createdAtTimestamp: hit.created_at_i,
        type: itemType,
      };
    });

    return {
      items,
      total: data.nbHits || items.length,
      queryInfo: {
        keywords,
        date_input: options.date,
        since_timestamp: sinceTimestamp,
        tag,
        sort,
        limit,
        page,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}
