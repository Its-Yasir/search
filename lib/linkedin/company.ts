import { getUnipileConfig } from "./client";
import { RateLimitError, isRateLimitError } from "@/lib/pipeline/errors";

export interface CompanyProfileData {
  id?: string;
  entity_urn?: string;
  name?: string;
  public_identifier?: string;
  profile_url?: string;
  description?: string;
  website_url?: string;
  industry?: string;
  followers_count?: number;
  employee_count?: string;
  location?: string;
  logo_url?: string;
  raw: Record<string, unknown>;
}

export interface CompanyPostItem {
  id?: string;
  social_id?: string;
  share_url?: string;
  text?: string;
  date?: string;
  parsed_datetime?: string;
  reaction_counter?: number;
  comment_counter?: number;
  repost_counter?: number;
  attachments?: unknown[];
  raw: Record<string, unknown>;
}

export interface PostListApiResponse {
  items?: Record<string, unknown>[];
  cursor?: string | null;
  paging?: {
    page_count?: number;
    [key: string]: unknown;
  };
}

/**
 * Extracts company slug/identifier from a LinkedIn URL or raw identifier string.
 * Example: https://fr.linkedin.com/company/cr%C3%A9dit-agricole-normandie -> crédit-agricole-normandie
 */
export function extractCompanyIdentifier(input: string): string {
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const compIndex = parts.findIndex(
        (p) => p.toLowerCase() === "company" || p.toLowerCase() === "school"
      );
      if (compIndex !== -1 && parts[compIndex + 1]) {
        return decodeURIComponent(parts[compIndex + 1]);
      }
      return decodeURIComponent(parts[parts.length - 1]);
    }
  } catch {
    // If URL parsing fails, continue to raw string handling
  }
  return decodeURIComponent(trimmed);
}

/**
 * Fetches company profile details from Unipile.
 */
export async function fetchCompanyProfileFromUnipile(
  identifier: string,
  abortSignal?: AbortSignal
): Promise<CompanyProfileData | null> {
  const config = getUnipileConfig();
  const encodedIdentifier = encodeURIComponent(identifier);
  const endpoint = `${config.baseUrl}/api/v1/linkedin/company/${encodedIdentifier}?account_id=${encodeURIComponent(
    config.accountId
  )}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  const combinedSignal = abortSignal
    ? anySignal([controller.signal, abortSignal])
    : controller.signal;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-KEY": config.apiKey,
      },
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(
        `[Unipile] Company profile endpoint returned HTTP ${response.status}: ${errBody}`
      );
      if (
        response.status === 429 ||
        isRateLimitError(errBody) ||
        isRateLimitError({ status: response.status })
      ) {
        throw new RateLimitError(
          `Unipile rate limit exceeded (HTTP ${response.status}): ${errBody}`,
          "unipile"
        );
      }
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      id: typeof data.id === "string" ? data.id : String(data.id || ""),
      entity_urn: (data.entity_urn as string) || undefined,
      name: (data.name as string) || identifier,
      public_identifier: (data.public_identifier as string) || identifier,
      profile_url: (data.profile_url as string) || undefined,
      description: (data.description as string) || undefined,
      website_url: (data.website_url as string) || (data.website as string) || undefined,
      industry: (data.industry as string) || undefined,
      followers_count: typeof data.followers_count === "number" ? data.followers_count : undefined,
      employee_count: (data.employee_count as string) || (data.company_size as string) || undefined,
      location: (data.location as string) || (data.headquarters as string) || undefined,
      logo_url: (data.logo_url as string) || (data.logo as string) || undefined,
      raw: data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (isRateLimitError(err)) {
      throw err;
    }
    if ((err as Error)?.name === "AbortError" && abortSignal?.aborted) {
      throw err;
    }
    console.warn(`[Unipile] Failed to fetch company profile: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Fetches a single page of posts for a company entity.
 */
async function fetchCompanyPostsPage(
  entityId: string,
  cursor?: string | null,
  limit: number = 20,
  abortSignal?: AbortSignal
): Promise<PostListApiResponse> {
  const config = getUnipileConfig();
  const queryParams = new URLSearchParams({
    account_id: config.accountId,
    is_company: "true",
    limit: limit.toString(),
  });

  if (cursor) {
    queryParams.append("cursor", cursor);
  }

  const endpoint = `${config.baseUrl}/api/v1/users/${encodeURIComponent(
    entityId
  )}/posts?${queryParams.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  const combinedSignal = abortSignal
    ? anySignal([controller.signal, abortSignal])
    : controller.signal;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-KEY": config.apiKey,
      },
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      if (
        response.status === 429 ||
        isRateLimitError(errText) ||
        isRateLimitError({ status: response.status })
      ) {
        throw new RateLimitError(
          `Unipile Posts API rate limit exceeded (HTTP ${response.status}): ${errText}`,
          "unipile"
        );
      }
      throw new Error(`Unipile Posts API HTTP ${response.status}: ${errText}`);
    }

    return (await response.json()) as PostListApiResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Fetches company posts published within the last 2 months (60 days).
 * Stops paginating immediately once older posts are encountered.
 */
export async function fetchCompanyPostsLastTwoMonths(
  entityId: string,
  fallbackSlug?: string,
  options?: {
    abortSignal?: AbortSignal;
    onPageFetched?: (pageNumber: number, count: number) => void;
  }
): Promise<CompanyPostItem[]> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const cutoffTimestamp = sixtyDaysAgo.getTime();

  const matchingPosts: CompanyPostItem[] = [];
  let cursor: string | null = null;
  let page = 1;
  const maxPages = 8; // Safety ceiling (~160 posts)

  let targetId = entityId;

  while (page <= maxPages) {
    if (options?.abortSignal?.aborted) {
      throw new Error("Pipeline aborted by user");
    }

    let pageData: PostListApiResponse;
    try {
      pageData = await fetchCompanyPostsPage(targetId, cursor, 20, options?.abortSignal);
    } catch (err) {
      if (fallbackSlug && targetId !== fallbackSlug && page === 1) {
        console.warn(`[Unipile] Retrying posts page 1 with raw slug "${fallbackSlug}"...`);
        targetId = fallbackSlug;
        pageData = await fetchCompanyPostsPage(targetId, cursor, 20, options?.abortSignal);
      } else {
        throw err;
      }
    }

    const rawItems = pageData.items || [];
    options?.onPageFetched?.(page, rawItems.length);

    if (rawItems.length === 0) {
      break;
    }

    let reachedOlderPosts = false;

    for (const item of rawItems) {
      let isWithin60Days = false;
      let postTimestamp: number | null = null;

      const parsedDatetime = (item.parsed_datetime as string) || (item.date_posted as string);
      const relativeDate = (item.date as string) || "";

      if (parsedDatetime) {
        const parsedDate = new Date(parsedDatetime);
        if (!isNaN(parsedDate.getTime())) {
          postTimestamp = parsedDate.getTime();
          isWithin60Days = postTimestamp >= cutoffTimestamp;
        }
      } else if (relativeDate) {
        const lower = relativeDate.toLowerCase().trim();
        // Keep hours, days, weeks, 1 month. Reject 2+ months, years
        if (
          lower.includes("h") ||
          lower.includes("d") ||
          lower.includes("w") ||
          lower === "past_day" ||
          lower === "past_week" ||
          lower === "1mo" ||
          lower === "1 month"
        ) {
          isWithin60Days = true;
        } else if (
          lower.includes("2mo") ||
          lower.includes("3mo") ||
          lower.includes("mo") ||
          lower.includes("y")
        ) {
          isWithin60Days = false;
        }
      }

      if (isWithin60Days) {
        matchingPosts.push({
          id: (item.id as string) || undefined,
          social_id: (item.social_id as string) || (item.id as string) || undefined,
          share_url: (item.share_url as string) || undefined,
          text: (item.text as string) || "",
          date: relativeDate || undefined,
          parsed_datetime: parsedDatetime || undefined,
          reaction_counter:
            typeof item.reaction_counter === "number" ? item.reaction_counter : 0,
          comment_counter:
            typeof item.comment_counter === "number" ? item.comment_counter : 0,
          repost_counter:
            typeof item.repost_counter === "number" ? item.repost_counter : 0,
          attachments: Array.isArray(item.attachments) ? item.attachments : [],
          raw: item,
        });
      } else if (postTimestamp && postTimestamp < cutoffTimestamp) {
        // LinkedIn posts are chronologically reverse. Once we encounter posts older than cutoff, stop pagination.
        reachedOlderPosts = true;
      }
    }

    if (reachedOlderPosts) {
      break;
    }

    if (!pageData.cursor || pageData.cursor === cursor) {
      break;
    }

    cursor = pageData.cursor;
    page++;
  }

  return matchingPosts;
}

/**
 * Combines multiple AbortSignals into one.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      return controller.signal;
    }
    sig.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}
