import * as fs from "fs";
import * as path from "path";
import {
  GitHubItem,
  GitHubRepoItem,
  GitHubIssueItem,
  GitHubSearchOptions,
  GitHubSearchType,
} from "./types";

const BASE_URL = "https://api.github.com";

/**
 * Retrieves GitHub Token from environment or .env fallback.
 */
export function getGitHubToken(): string {
  let token = (process.env.GITHUB_TOKEN || "").trim();

  if (!token) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/GITHUB_TOKEN\s*=\s*(.*)/);
        if (match && match[1]) {
          token = match[1].trim();
        }
      }
    } catch {
      // Ignore filesystem read error
    }
  }

  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not defined in environment variables or .env file. Please check your .env configuration."
    );
  }

  return token;
}

/**
 * Converts user-friendly date strings (e.g., "past 7 days", "past 30 days", "24h")
 * to a UTC 'YYYY-MM-DD' string for GitHub search operators (e.g., created:>YYYY-MM-DD).
 */
export function parseDateToGitHubSince(dateInput?: string | null): string | undefined {
  if (!dateInput || typeof dateInput !== "string") {
    return undefined;
  }

  const cleaned = dateInput.trim().toLowerCase().replace(/[-_]/g, " ");

  // Direct YYYY-MM-DD format
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

  return undefined;
}

/**
 * Builds the effective GitHub search query combining keywords and created:> date filter.
 */
export function buildGitHubQuery(keywords: string, sinceDate?: string): string {
  const cleanKw = keywords.trim();
  if (!sinceDate) return cleanKw;

  // Don't duplicate if already present
  if (
    cleanKw.includes("created:") ||
    cleanKw.includes("pushed:") ||
    cleanKw.includes("updated:")
  ) {
    return cleanKw;
  }

  return `${cleanKw} created:>${sinceDate}`.trim();
}

/**
 * Executes a GitHub search for repositories or issues/discussions.
 */
export async function searchGitHub(options: GitHubSearchOptions): Promise<{
  items: GitHubItem[];
  total: number;
  queryInfo: {
    keywords: string;
    final_query: string;
    type: GitHubSearchType;
    date_input?: string;
    since_date?: string;
    sort: string;
    limit: number;
  };
}> {
  const token = getGitHubToken();
  const keywords = (options.keywords || "").trim();
  if (!keywords) {
    throw new Error("Missing required parameter: 'keywords' or 'query'.");
  }

  const rawType = (options.type || "repositories").toLowerCase();
  const searchType: GitHubSearchType =
    rawType === "issues" || rawType === "issue" || rawType === "discussions"
      ? "issues"
      : "repositories";

  const sinceDate = parseDateToGitHubSince(options.date);
  const finalQuery = buildGitHubQuery(keywords, sinceDate);

  const limit = options.limit ? Math.min(Math.max(1, options.limit), 100) : 10;
  const sort = options.sort || (searchType === "repositories" ? "updated" : "created");
  const order = options.order || "desc";

  const queryParams = new URLSearchParams({
    q: finalQuery,
    sort,
    order,
    per_page: limit.toString(),
  });

  const url = `${BASE_URL}/search/${searchType}?${queryParams.toString()}`;
  const timeoutMs = options.timeoutMs || 25000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "alpha-search-application",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let parsedMsg = errorText;
      try {
        const parsed = JSON.parse(errorText);
        parsedMsg = parsed.message || errorText;
      } catch {}
      throw new Error(`GitHub search failed (HTTP ${response.status}): ${parsedMsg}`);
    }

    const data = (await response.json()) as {
      total_count: number;
      items?: Record<string, unknown>[];
    };

    const rawItems = Array.isArray(data.items) ? data.items : [];

    let items: GitHubItem[] = [];

    if (searchType === "repositories") {
      items = rawItems.map((r): GitHubRepoItem => {
        const owner = (r.owner || {}) as Record<string, string>;
        return {
          id: Number(r.id),
          name: String(r.name || ""),
          fullName: String(r.full_name || ""),
          title: String(r.full_name || ""),
          text: String(r.description || ""),
          url: String(r.html_url || ""),
          author: {
            name: owner.login || "",
            profileUrl: owner.html_url || "",
            avatarUrl: owner.avatar_url,
          },
          stars: Number(r.stargazers_count || 0),
          forks: Number(r.forks_count || 0),
          language: (r.language as string) || null,
          topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
          createdAt: String(r.created_at || ""),
          updatedAt: String(r.updated_at || ""),
          type: "repository",
        };
      });
    } else {
      items = rawItems.map((i): GitHubIssueItem => {
        const user = (i.user || {}) as Record<string, string>;
        return {
          id: Number(i.id),
          title: String(i.title || ""),
          text: String(i.body || ""),
          url: String(i.html_url || ""),
          author: {
            name: user.login || "",
            profileUrl: user.html_url || "",
            avatarUrl: user.avatar_url,
          },
          state: String(i.state || ""),
          commentsCount: Number(i.comments || 0),
          createdAt: String(i.created_at || ""),
          updatedAt: String(i.updated_at || ""),
          type: "issue",
        };
      });
    }

    return {
      items,
      total: data.total_count || items.length,
      queryInfo: {
        keywords,
        final_query: finalQuery,
        type: searchType,
        date_input: options.date,
        since_date: sinceDate,
        sort,
        limit,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}
