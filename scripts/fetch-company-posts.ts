import * as fs from "fs";
import * as path from "path";
import { getUnipileConfig } from "../lib/linkedin/client";

interface CompanyProfileResponse {
  object?: string;
  id?: string;
  name?: string;
  public_identifier?: string;
  entity_urn?: string;
  profile_url?: string;
  description?: string;
  followers_count?: number;
  [key: string]: unknown;
}

interface PostItem {
  id?: string;
  social_id?: string;
  share_url?: string;
  text?: string;
  date?: string;
  parsed_datetime?: string;
  reaction_counter?: number;
  comment_counter?: number;
  repost_counter?: number;
  impressions_counter?: number;
  author?: {
    name?: string;
    public_identifier?: string;
    is_company?: boolean;
    [key: string]: unknown;
  };
  attachments?: unknown[];
  [key: string]: unknown;
}

interface PostListResponse {
  object?: string;
  items?: PostItem[];
  cursor?: string | null;
  paging?: {
    page_count?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Extracts the company identifier from a LinkedIn URL or returns the identifier string directly.
 * Example: https://fr.linkedin.com/company/cr%C3%A9dit-agricole-normandie -> crédit-agricole-normandie
 */
export function extractCompanyIdentifier(input: string): string {
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      // Expected path: /company/<slug> or /school/<slug>
      const compIndex = parts.findIndex((p) => p.toLowerCase() === "company" || p.toLowerCase() === "school");
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
 * Fetches company profile to retrieve internal numeric ID and company details.
 */
async function getCompanyProfile(
  identifier: string,
  baseUrl: string,
  apiKey: string,
  accountId: string
): Promise<CompanyProfileResponse | null> {
  const encodedIdentifier = encodeURIComponent(identifier);
  const endpoint = `${baseUrl}/api/v1/linkedin/company/${encodedIdentifier}?account_id=${encodeURIComponent(accountId)}`;

  console.log(`\n🔍 Fetching company profile for "${identifier}"...`);
  console.log(`   Endpoint: GET ${baseUrl}/api/v1/linkedin/company/${encodedIdentifier}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`⚠️ Warning: Company profile endpoint returned HTTP ${response.status}: ${errBody}`);
      return null;
    }

    const data = (await response.json()) as CompanyProfileResponse;
    console.log(`✅ Found company: "${data.name}" (ID: ${data.id || "N/A"}, URN: ${data.entity_urn || "N/A"})`);
    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.warn(`⚠️ Warning: Failed to fetch company profile: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Fetches a single page of posts for an entity.
 */
async function fetchPostsPage(
  entityId: string,
  baseUrl: string,
  apiKey: string,
  accountId: string,
  cursor?: string | null,
  limit: number = 20
): Promise<PostListResponse> {
  const queryParams = new URLSearchParams({
    account_id: accountId,
    is_company: "true",
    limit: limit.toString(),
  });

  if (cursor) {
    queryParams.append("cursor", cursor);
  }

  const endpoint = `${baseUrl}/api/v1/users/${encodeURIComponent(entityId)}/posts?${queryParams.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Unipile API returned HTTP ${response.status}: ${errText}`);
    }

    return (await response.json()) as PostListResponse;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Main execution function
 */
export async function fetchCompanyPostsLast30Days(
  targetUrlOrIdentifier: string,
  outputFilePath?: string
) {
  const config = getUnipileConfig();
  const rawIdentifier = extractCompanyIdentifier(targetUrlOrIdentifier);
  console.log(`====================================================`);
  console.log(`Unipile LinkedIn Company Posts (Last 30 Days)`);
  console.log(`Target: ${targetUrlOrIdentifier}`);
  console.log(`Identifier: ${rawIdentifier}`);
  console.log(`====================================================`);

  // 1. Try to resolve company profile to get internal ID
  const profile = await getCompanyProfile(
    rawIdentifier,
    config.baseUrl,
    config.apiKey,
    config.accountId
  );

  // Use internal ID if available, otherwise try the raw identifier slug
  const targetId = profile?.id || rawIdentifier;
  console.log(`\n📥 Fetching posts for target ID: "${targetId}" (is_company=true)...`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffTimestamp = thirtyDaysAgo.getTime();
  console.log(`📅 Cutoff date: ${thirtyDaysAgo.toISOString()} (${thirtyDaysAgo.toLocaleDateString()})`);

  const matchingPosts: PostItem[] = [];
  const allFetchedPosts: PostItem[] = [];
  const rawResponses: PostListResponse[] = [];

  let cursor: string | null = null;
  let page = 1;
  let reachedOlderPosts = false;
  const maxPages = 10; // safety ceiling: up to ~200 posts

  while (page <= maxPages) {
    console.log(`\n⏳ Fetching page ${page}${cursor ? ` (cursor: ${cursor.slice(0, 20)}...)` : ""}...`);

    let pageData: PostListResponse;
    try {
      pageData = await fetchPostsPage(
        targetId,
        config.baseUrl,
        config.apiKey,
        config.accountId,
        cursor,
        20
      );
    } catch (err: unknown) {
      // If using profile.id failed and targetId was different from rawIdentifier, attempt fallback with rawIdentifier
      if (profile?.id && targetId === profile.id && page === 1) {
        console.warn(`Retrying page 1 with raw identifier slug "${rawIdentifier}"...`);
        pageData = await fetchPostsPage(
          rawIdentifier,
          config.baseUrl,
          config.apiKey,
          config.accountId,
          cursor,
          20
        );
      } else {
        throw err;
      }
    }

    rawResponses.push(pageData);
    const items = pageData.items || [];
    console.log(`   Retrieved ${items.length} posts on page ${page}.`);

    if (items.length === 0) {
      console.log(`ℹ️ No more posts returned.`);
      break;
    }

    for (const post of items) {
      allFetchedPosts.push(post);

      // Check date
      let isWithin30Days = false;
      let postTimestamp: number | null = null;

      if (post.parsed_datetime) {
        const parsedDate = new Date(post.parsed_datetime);
        if (!isNaN(parsedDate.getTime())) {
          postTimestamp = parsedDate.getTime();
          isWithin30Days = postTimestamp >= cutoffTimestamp;
        }
      } else if (post.date) {
        // Fallback relative date check (e.g. "2d", "1w", "3w", "1mo", "2mo")
        const lowerDate = post.date.toLowerCase().trim();
        if (
          lowerDate.includes("h") ||
          lowerDate.includes("d") ||
          lowerDate.includes("w") ||
          lowerDate === "past_day" ||
          lowerDate === "past_week"
        ) {
          isWithin30Days = true;
        } else if (lowerDate.includes("mo") || lowerDate.includes("y")) {
          isWithin30Days = false;
        }
      }

      if (isWithin30Days) {
        matchingPosts.push(post);
      } else if (postTimestamp && postTimestamp < cutoffTimestamp) {
        // Since LinkedIn posts are in reverse chronological order, once we hit a post older than 30 days, we can stop
        reachedOlderPosts = true;
      }
    }

    if (reachedOlderPosts) {
      console.log(`🛑 Encountered posts older than 30 days. Stopping pagination.`);
      break;
    }

    if (!pageData.cursor || pageData.cursor === cursor) {
      console.log(`ℹ️ No next cursor available.`);
      break;
    }

    cursor = pageData.cursor;
    page++;
  }

  // Generate output payload
  const resultPayload = {
    metadata: {
      query: targetUrlOrIdentifier,
      extracted_identifier: rawIdentifier,
      company_profile: profile,
      target_id_used: targetId,
      fetched_at: new Date().toISOString(),
      filter_days: 30,
      cutoff_date: thirtyDaysAgo.toISOString(),
      total_pages_fetched: rawResponses.length,
      total_posts_retrieved: allFetchedPosts.length,
      matching_posts_count: matchingPosts.length,
    },
    posts: matchingPosts,
    raw_api_responses: rawResponses,
  };

  // Determine save path
  const sanitizedSlug = rawIdentifier.replace(/[^a-zA-Z0-9_-]/g, "_");
  const defaultOutputFile = path.resolve(
    process.cwd(),
    outputFilePath || `${sanitizedSlug}_posts_last30days.json`
  );

  fs.writeFileSync(defaultOutputFile, JSON.stringify(resultPayload, null, 2), "utf-8");

  console.log(`\n====================================================`);
  console.log(`🎉 SUCCESS!`);
  console.log(`Total posts within last 30 days: ${matchingPosts.length}`);
  console.log(`Output saved to: ${defaultOutputFile}`);
  console.log(`====================================================\n`);

  // Print a summary of matching posts
  if (matchingPosts.length > 0) {
    console.log(`--- Summary of Posts (Last 30 Days) ---`);
    matchingPosts.forEach((p, idx) => {
      const textPreview = (p.text || "(No text)").replace(/\s+/g, " ").slice(0, 100);
      const dateStr = p.parsed_datetime || p.date || "Unknown date";
      console.log(
        `${idx + 1}. [${dateStr}] Likes: ${p.reaction_counter ?? 0}, Comments: ${p.comment_counter ?? 0}`
      );
      console.log(`   "${textPreview}..."`);
      if (p.share_url) {
        console.log(`   Link: ${p.share_url}`);
      }
      console.log("");
    });
  } else {
    console.log(`No posts found within the last 30 days.`);
  }

  return { resultPayload, defaultOutputFile };
}

// Allow direct execution: npx tsx scripts/fetch-company-posts.ts [URL_OR_IDENTIFIER] [OUTPUT_FILE]
if (require.main === module || process.argv[1]?.includes("fetch-company-posts")) {
  const target =
    process.argv[2] ||
    "https://fr.linkedin.com/company/cr%C3%A9dit-agricole-normandie";
  const output = process.argv[3];

  fetchCompanyPostsLast30Days(target, output).catch((err) => {
    console.error(`\n❌ Execution Error:`, err);
    process.exit(1);
  });
}
