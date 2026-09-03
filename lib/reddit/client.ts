import {
  RedditPostItem,
  RedditSearchOptions,
  RedditSort,
  RedditTimeframe,
} from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Normalizes user-friendly date strings (e.g., "past 7 days", "past 30 days", "24h")
 * to the timeframe expected by Reddit's search feed (t=hour|day|week|month|year|all).
 */
export function normalizeRedditTimeframe(
  dateInput?: string | null
): RedditTimeframe {
  if (!dateInput || typeof dateInput !== "string") {
    return "month"; // Default to month
  }

  const cleaned = dateInput.trim().toLowerCase().replace(/[-_]/g, " ");

  // Hour
  if (cleaned.includes("hour") || cleaned === "1h") {
    return "hour";
  }

  // Day / 24 hours
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
    return "day";
  }

  // Week / 7 days
  if (
    cleaned === "past week" ||
    cleaned === "week" ||
    cleaned === "7d" ||
    cleaned === "7" ||
    cleaned.includes("7 day") ||
    cleaned.includes("past 7") ||
    cleaned.includes("1 week")
  ) {
    return "week";
  }

  // Month / 30 days
  if (
    cleaned === "past month" ||
    cleaned === "month" ||
    cleaned === "30d" ||
    cleaned === "30" ||
    cleaned.includes("30 day") ||
    cleaned.includes("past 30") ||
    cleaned.includes("1 month")
  ) {
    return "month";
  }

  // Year
  if (cleaned.includes("year") || cleaned === "1y") {
    return "year";
  }

  // All time
  if (cleaned === "all" || cleaned.includes("all time")) {
    return "all";
  }

  return "month";
}

/**
 * Normalizes sort parameter to relevance, top, new, or comments.
 */
export function normalizeRedditSort(sortInput?: string | null): RedditSort {
  if (!sortInput || typeof sortInput !== "string") {
    return "new"; // Default to new for latest posts
  }

  const cleaned = sortInput.trim().toLowerCase();
  if (cleaned === "top" || cleaned === "best") return "top";
  if (cleaned === "comments") return "comments";
  if (cleaned === "relevance" || cleaned === "rel") return "relevance";
  return "new";
}

/**
 * Decodes common HTML entities found in RSS feeds.
 */
export function decodeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#32;/g, " ");
}

/**
 * Strips HTML tags and clean Reddit footer from feed content.
 */
export function cleanPostContent(rawHtml: string): string {
  if (!rawHtml) return "";
  let text = decodeHtml(rawHtml);

  // Remove HTML markup
  text = text.replace(/<[^>]*>/g, " ");

  // Strip standard Reddit RSS footer: "submitted by /u/user to r/subreddit [link] [comments]"
  text = text
    .replace(
      /submitted by\s+\/?u?\/?\S+\s+to\s+r\/\S+(\s*\[link\])?(\s*\[comments\])?/i,
      ""
    )
    .replace(/\[link\]/gi, "")
    .replace(/\[comments\]/gi, "");

  // Collapse excess whitespace
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Parses Reddit Atom XML feed into structured post items.
 */
export function parseRedditAtomFeed(xml: string): RedditPostItem[] {
  const items: RedditPostItem[] = [];
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(entryXml);
    const linkMatch = /<link\b[^>]*href=["']([^"']+)["']/i.exec(entryXml);
    const authorMatch =
      /<author>[\s\S]*?<name>([\s\S]*?)<\/name>/i.exec(entryXml);
    const idMatch = /<id\b[^>]*>([\s\S]*?)<\/id>/i.exec(entryXml);
    const categoryMatch =
      /<category\b[^>]*term=["']([^"']+)["']/i.exec(entryXml);
    const updatedMatch =
      /<updated\b[^>]*>([\s\S]*?)<\/updated>/i.exec(entryXml);
    const publishedMatch =
      /<published\b[^>]*>([\s\S]*?)<\/published>/i.exec(entryXml);
    const contentMatch =
      /<content\b[^>]*>([\s\S]*?)<\/content>/i.exec(entryXml);

    const title = titleMatch ? decodeHtml(titleMatch[1].trim()) : "";
    const url = linkMatch ? decodeHtml(linkMatch[1].trim()) : "";
    const rawAuthor = authorMatch ? decodeHtml(authorMatch[1].trim()) : "";
    const author = rawAuthor.replace(/^\/?u\//, "").trim();
    const id = idMatch ? idMatch[1].trim() : "";
    const subreddit = categoryMatch
      ? categoryMatch[1].trim().replace(/^r\//, "").trim()
      : "";
    const createdAt = publishedMatch
      ? publishedMatch[1].trim()
      : updatedMatch
      ? updatedMatch[1].trim()
      : "";
    const rawContent = contentMatch ? contentMatch[1] : "";
    const text = cleanPostContent(rawContent);

    // Filter out pure subreddit discovery entries (t5_ is subreddit ID prefix, t3_ is submission)
    const isSubredditMeta =
      id.startsWith("t5_") ||
      (Boolean(subreddit) && url.endsWith(`/r/${subreddit}/`));

    items.push({
      id,
      title,
      text,
      url,
      subreddit,
      author: {
        name: author,
        profileUrl: author
          ? `https://www.reddit.com/user/${author}`
          : undefined,
      },
      createdAt,
      type: isSubredditMeta ? "subreddit" : "post",
    });
  }

  // Filter out any non-post metadata entries
  return items.filter((item) => item.type === "post");
}

// In-memory cache to prevent 429 rate limiting on repeated or rapid queries
interface RedditCacheEntry {
  items: RedditPostItem[];
  timestamp: number;
}
const redditFeedCache = new Map<string, RedditCacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Searches Reddit posts via public keyless Atom/RSS feed.
 */
export async function searchRedditPosts(options: RedditSearchOptions): Promise<{
  items: RedditPostItem[];
  total: number;
  queryInfo: {
    keywords: string;
    subreddit?: string;
    date_input?: string;
    timeframe: RedditTimeframe;
    sort: RedditSort;
    limit: number;
    feed_url: string;
  };
}> {
  const keywords = (options.keywords || "").trim();
  if (!keywords) {
    throw new Error("Missing required parameter: 'keywords' or 'query'.");
  }

  const timeframe =
    options.timeframe || normalizeRedditTimeframe(options.date);
  const sort = normalizeRedditSort(options.sort);
  const limit = options.limit ? Math.max(1, options.limit) : 10;

  // Clean subreddit if user provided e.g. "r/LocalLLaMA" -> "LocalLLaMA"
  const cleanSubreddit = options.subreddit
    ? options.subreddit.trim().replace(/^r\//, "")
    : undefined;

  let feedUrl: string;

  if (cleanSubreddit) {
    const queryParams = new URLSearchParams({
      q: keywords,
      restrict_sr: "on",
      sort,
      t: timeframe,
    });
    feedUrl = `https://www.reddit.com/r/${encodeURIComponent(cleanSubreddit)}/search.rss?${queryParams.toString()}`;
  } else {
    const queryParams = new URLSearchParams({
      q: keywords,
      sort,
      t: timeframe,
    });
    feedUrl = `https://www.reddit.com/search.rss?${queryParams.toString()}`;
  }

  // Check cache first
  const cached = redditFeedCache.get(feedUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const items = options.limit ? cached.items.slice(0, limit) : cached.items;
    return {
      items,
      total: items.length,
      queryInfo: {
        keywords,
        subreddit: cleanSubreddit,
        date_input: options.date,
        timeframe,
        sort,
        limit,
        feed_url: feedUrl,
      },
    };
  }

  const timeoutMs = options.timeoutMs || 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(feedUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    // Auto-retry once on 429 with 5.2s backoff
    if (response.status === 429) {
      console.warn("Reddit RSS rate limit (429) hit. Waiting 5.2s before automatic retry...");
      await new Promise((resolve) => setTimeout(resolve, 5200));
      response = await fetch(feedUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
          Accept:
            "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "Reddit rate limit reached on public RSS feed. Please wait 5 seconds before making another search request."
        );
      }
      const errorText = await response.text();
      throw new Error(
        `Reddit RSS search failed (HTTP ${response.status}): ${errorText.substring(0, 300)}`
      );
    }

    const xml = await response.text();
    const allPosts = parseRedditAtomFeed(xml);

    // Cache successful results for 60 seconds
    if (allPosts.length > 0) {
      redditFeedCache.set(feedUrl, { items: allPosts, timestamp: Date.now() });
    }

    // Apply variable post limit slicing
    const items = options.limit ? allPosts.slice(0, limit) : allPosts;

    return {
      items,
      total: items.length,
      queryInfo: {
        keywords,
        subreddit: cleanSubreddit,
        date_input: options.date,
        timeframe,
        sort,
        limit,
        feed_url: feedUrl,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}
