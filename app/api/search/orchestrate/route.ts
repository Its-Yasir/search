import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getIcpAction,
  getSpecificIcpsForIcpAction,
  getQueriesForSpecificIcpsAction,
} from "@/app/actions/icp";
import { SpecificIcp } from "@/db/schema";
import {
  normalizeDatePosted,
  searchLinkedinPosts,
} from "@/lib/linkedin/client";
import { searchTwitterPosts } from "@/lib/twitter/client";
import { searchRedditPosts } from "@/lib/reddit/client";
import { searchGitHub } from "@/lib/github/client";
import { searchHackerNews } from "@/lib/hackernews/client";
import {
  OrchestrateSearchRequest,
  OrchestrateSearchResponse,
  PlatformSearchResult,
  PlatformType,
  UnifiedPost,
} from "@/lib/search/types";
import { rankAndFilterPosts } from "@/lib/search/ranking";
import { evaluatePostsOneByOne } from "@/lib/ai/leadEvaluator";


const PREFERRED_PLATFORM_CYCLE_ORDER: PlatformType[] = [
  "x",
  "reddit",
  "hackernews",
  "linkedin",
  "github",
];

const ALL_PLATFORMS: PlatformType[] = [
  "linkedin",
  "x",
  "reddit",
  "github",
  "hackernews",
];

interface QueuedSearchJob {
  platform: PlatformType;
  query: string;
  specificIcpName: string;
  specificIcpId: string;
  round: number;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)),
      timeoutMs
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<OrchestrateSearchResponse>> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        {
          success: false,
          totalPosts: 0,
          posts: [],
          platformResults: {} as Record<PlatformType, PlatformSearchResult>,
          error: "Unauthorized. Please log in.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as OrchestrateSearchRequest;
    const { icpId } = body;

    if (!icpId) {
      return NextResponse.json(
        {
          success: false,
          totalPosts: 0,
          posts: [],
          platformResults: {} as Record<PlatformType, PlatformSearchResult>,
          error: "Missing required parameter: 'icpId'.",
        },
        { status: 400 }
      );
    }

    // 1. Fetch current ICP and specific ICPs for this ICP
    const [currentIcp, allSpecific] = await Promise.all([
      getIcpAction(icpId),
      getSpecificIcpsForIcpAction(icpId),
    ]);

    if (allSpecific.length === 0) {
      return NextResponse.json({
        success: true,
        totalPosts: 0,
        posts: [],
        platformResults: {} as Record<PlatformType, PlatformSearchResult>,
      });
    }


    // 2. Filter to requested specific ICP IDs or use all
    const requestedSpecificIds =
      Array.isArray(body.specificIcpIds) && body.specificIcpIds.length > 0
        ? body.specificIcpIds
        : allSpecific.map((s) => s.id);

    const targetSpecificIcps = allSpecific.filter((s) =>
      requestedSpecificIds.includes(s.id)
    );

    // 3. Determine target platforms and order them in the preferred round-robin cycle:
    // x -> reddit -> hackernews -> linkedin -> github
    const requestedPlatforms: PlatformType[] =
      Array.isArray(body.platforms) && body.platforms.length > 0
        ? (body.platforms.filter((p) =>
            ALL_PLATFORMS.includes(p)
          ) as PlatformType[])
        : ALL_PLATFORMS;

    const orderedPlatforms: PlatformType[] = PREFERRED_PLATFORM_CYCLE_ORDER.filter(
      (p) => requestedPlatforms.includes(p)
    );
    for (const p of requestedPlatforms) {
      if (!orderedPlatforms.includes(p)) {
        orderedPlatforms.push(p);
      }
    }

    const dateRange = body.dateRange || "past 7 days";
    const limitPerPlatform = Math.min(
      Math.max(1, body.limitPerPlatform || 5),
      20
    );

    // 4. Fetch pre-generated queries from DB for all selected specific ICPs
    const savedQueries = await getQueriesForSpecificIcpsAction(
      targetSpecificIcps.map((s) => s.id)
    );

    // 5. Group queries by platform, clean and deduplicate per platform
    const platformQueriesMap: Record<
      PlatformType,
      Array<{
        query: string;
        specificIcpName: string;
        specificIcpId: string;
      }>
    > = {} as Record<
      PlatformType,
      Array<{
        query: string;
        specificIcpName: string;
        specificIcpId: string;
      }>
    >;

    for (const platform of orderedPlatforms) {
      platformQueriesMap[platform] = [];
      const seenCleaned = new Set<string>();

      // Collect all matching queries for this platform across selected specific ICPs
      const matching = savedQueries.filter(
        (q) => q.platform === platform && q.query && q.query.trim().length > 0
      );

      for (const m of matching) {
        const cleaned = cleanQueryForPlatform(m.query, platform);
        if (!cleaned) continue;
        const lowerKey = cleaned.toLowerCase();
        if (seenCleaned.has(lowerKey)) continue;
        seenCleaned.add(lowerKey);

        const spec = targetSpecificIcps.find((s) => s.id === m.specificIcpId);
        platformQueriesMap[platform].push({
          query: cleaned,
          specificIcpName: spec ? spec.name : "Target Audience",
          specificIcpId: m.specificIcpId,
        });
      }

      // Fallback if no saved query exists for this platform
      if (platformQueriesMap[platform].length === 0) {
        const firstSpec = targetSpecificIcps[0];
        const fallbackQuery =
          firstSpec.name || firstSpec.whatToSearch?.slice(0, 50) || "startup";
        platformQueriesMap[platform].push({
          query: cleanQueryForPlatform(fallbackQuery, platform),
          specificIcpName: firstSpec.name,
          specificIcpId: firstSpec.id,
        });
      }
    }

    // 6. Build the round-robin interleaved queue:
    // Round 1: X (Q1) -> Reddit (Q1) -> HN (Q1) -> LinkedIn (Q1) -> GitHub (Q1)
    // Round 2: X (Q2) -> Reddit (Q2) -> HN (Q2) -> LinkedIn (Q2) -> GitHub (Q2)
    // Round 3: X (Q3) -> Reddit (Q3) -> ...
    const maxRounds = Math.max(
      ...orderedPlatforms.map((p) => platformQueriesMap[p]?.length || 0)
    );

    const searchQueue: QueuedSearchJob[] = [];
    for (let round = 0; round < maxRounds; round++) {
      for (const platform of orderedPlatforms) {
        const jobs = platformQueriesMap[platform];
        if (jobs && round < jobs.length) {
          searchQueue.push({
            platform,
            query: jobs[round].query,
            specificIcpName: jobs[round].specificIcpName,
            specificIcpId: jobs[round].specificIcpId,
            round: round + 1,
          });
        }
      }
    }

    console.log(
      `\n[Search Orchestrator] =======================================`
    );
    console.log(
      `[Search Orchestrator] 🚀 Queued ${searchQueue.length} jobs across ${orderedPlatforms.length} channels (Up to ${maxRounds} rounds)`
    );
    console.log(
      `[Search Orchestrator] Execution order: ${searchQueue
        .map((j) => `${j.platform.toUpperCase()} [R${j.round}]`)
        .join(" -> ")}`
    );

    // 7. Data structures for aggregating results per platform and globally
    const platformResultsData: Record<
      PlatformType,
      {
        posts: UnifiedPost[];
        queriesUsed: string[];
        errors: string[];
        totalExecutionTimeMs: number;
        lastDirectApiUrl?: string;
        successCount: number;
      }
    > = {} as Record<
      PlatformType,
      {
        posts: UnifiedPost[];
        queriesUsed: string[];
        errors: string[];
        totalExecutionTimeMs: number;
        lastDirectApiUrl?: string;
        successCount: number;
      }
    >;

    for (const p of orderedPlatforms) {
      platformResultsData[p] = {
        posts: [],
        queriesUsed: [],
        errors: [],
        totalExecutionTimeMs: 0,
        successCount: 0,
      };
    }

    const seenGlobalPostIds = new Set<string>();
    const aggregatedPosts: UnifiedPost[] = [];

    // 8. Sequentially execute each job in round-robin order
    for (let i = 0; i < searchQueue.length; i++) {
      const job = searchQueue[i];
      const { platform, query, specificIcpName, specificIcpId, round } = job;
      const startTime = Date.now();
      const endpointName = platform === "x" ? "twitter" : platform;
      const directApiUrl = `/api/${endpointName}/posts?keywords=${encodeURIComponent(
        query
      )}&date=${encodeURIComponent(dateRange)}&limit=${limitPerPlatform}`;

      platformResultsData[platform].lastDirectApiUrl = directApiUrl;
      if (!platformResultsData[platform].queriesUsed.includes(query)) {
        platformResultsData[platform].queriesUsed.push(query);
      }

      console.log(
        `\n[Search Orchestrator] [Job ${i + 1}/${searchQueue.length} | Round ${round}] Platform: [${platform.toUpperCase()}]`
      );
      console.log(`[Search Orchestrator]   Query: ${query}`);
      console.log(`[Search Orchestrator]   Audience: "${specificIcpName}"`);

      try {
        let posts: UnifiedPost[] = [];

        switch (platform) {
          case "linkedin": {
            const res = await withTimeout(
              searchLinkedinPosts({
                keywords: query,
                date_posted: normalizeDatePosted(dateRange),
                limit: limitPerPlatform,
              }),
              15000,
              "LinkedIn search"
            );
            const rawItems = Array.isArray(res.items) ? res.items : [];
            posts = rawItems.map((item) => ({
              id: String(item.id),
              platform: "linkedin" as const,
              title: undefined,
              text: item.text || "",
              url:
                item.share_url ||
                (item.social_id
                  ? `https://www.linkedin.com/feed/update/${item.social_id}`
                  : "https://www.linkedin.com"),
              author: {
                name: item.author?.name || "LinkedIn User",
                handle: item.author?.headline,
                profileUrl: item.author?.public_identifier
                  ? `https://www.linkedin.com/in/${item.author.public_identifier}`
                  : undefined,
                avatarUrl: item.author?.profile_picture_url,
              },
              createdAt: item.date,
              metrics: {
                likes: Number(item.reaction_counter || 0),
                comments: Number(item.comment_counter || 0),
                shares: Number(item.repost_counter || 0),
              },
              queryUsed: query,
              specificIcpId,
              specificIcpName,
              raw: item,
            }));
            break;
          }

          case "x": {
            const res = await withTimeout(
              searchTwitterPosts({
                keywords: query,
                date: dateRange,
                limit: limitPerPlatform,
              }),
              15000,
              "X (Twitter) search"
            );
            posts = res.items.map((item) => ({
              id: item.id,
              platform: "x" as const,
              title: undefined,
              text: item.text || "",
              url:
                item.url ||
                (item.id ? `https://x.com/i/status/${item.id}` : "https://x.com"),
              author: {
                name: item.author?.name || "X User",
                handle: item.author?.userName
                  ? `@${item.author.userName}`
                  : undefined,
                profileUrl: item.author?.url,
                avatarUrl: item.author?.profilePicture,
              },
              createdAt: item.createdAt,
              metrics: {
                likes: Number(item.likes || 0),
                comments: Number(item.replies || 0),
                shares: Number(item.retweets || 0),
              },
              queryUsed: query,
              specificIcpId,
              specificIcpName,
              raw: item,
            }));
            break;
          }

          case "reddit": {
            const res = await withTimeout(
              searchRedditPosts({
                keywords: query,
                date: dateRange,
                limit: limitPerPlatform,
              }),
              15000,
              "Reddit search"
            );
            posts = res.items.map((item) => ({
              id: item.id,
              platform: "reddit",
              title: item.title,
              text: item.text,
              url: item.url,
              author: {
                name: item.author.name
                  ? `u/${item.author.name}`
                  : "u/reddit_user",
                profileUrl: item.author.profileUrl,
              },
              createdAt: item.createdAt,
              metrics: {
                likes: 0,
                comments: 0,
              },
              queryUsed: query,
              specificIcpId,
              specificIcpName,
              raw: item,
            }));
            break;
          }

          case "github": {
            const res = await withTimeout(
              searchGitHub({
                keywords: query,
                type: "repositories",
                date: dateRange,
                limit: limitPerPlatform,
              }),
              15000,
              "GitHub search"
            );
            posts = res.items.map((item) => ({
              id: String(item.id),
              platform: "github",
              title: item.title,
              text: item.text || "No description provided.",
              url: item.url,
              author: {
                name: item.author.name,
                profileUrl: item.author.profileUrl,
                avatarUrl: item.author.avatarUrl,
              },
              createdAt: item.createdAt,
              metrics: {
                stars: "stars" in item ? (item.stars as number) : 0,
                forks: "forks" in item ? (item.forks as number) : 0,
                comments:
                  "commentsCount" in item
                    ? (item.commentsCount as number)
                    : 0,
              },
              queryUsed: query,
              specificIcpId,
              specificIcpName,
              raw: item,
            }));
            break;
          }

          case "hackernews": {
            const res = await withTimeout(
              searchHackerNews({
                keywords: query,
                date: dateRange,
                tag: "story",
                limit: limitPerPlatform,
              }),
              15000,
              "Hacker News search"
            );
            posts = res.items.map((item) => ({
              id: item.id,
              platform: "hackernews",
              title: item.title,
              text: item.text || item.title,
              url: item.url,
              author: {
                name: item.author.name,
                profileUrl: item.author.profileUrl,
              },
              createdAt: item.createdAt,
              metrics: {
                points: item.points,
                comments: item.commentsCount,
              },
              queryUsed: query,
              specificIcpId,
              specificIcpName,
              raw: item,
            }));
            break;
          }
        }

        const elapsed = Date.now() - startTime;
        platformResultsData[platform].totalExecutionTimeMs += elapsed;
        platformResultsData[platform].successCount++;

        // Deduplicate posts globally across queries and platforms
        let newPostsCount = 0;
        for (const post of posts) {
          const postKey = `${post.platform}:${post.id || post.url}`;
          if (!seenGlobalPostIds.has(postKey)) {
            seenGlobalPostIds.add(postKey);
            platformResultsData[platform].posts.push(post);
            aggregatedPosts.push(post);
            newPostsCount++;
          }
        }

        console.log(
          `[Search Orchestrator]   ✅ Succeeded in ${elapsed}ms -> Returned ${posts.length} posts (${newPostsCount} new unique)`
        );
      } catch (err: unknown) {
        const elapsed = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : "Search failed";
        platformResultsData[platform].totalExecutionTimeMs += elapsed;
        platformResultsData[platform].errors.push(
          `"${query}": ${errMsg}`
        );
        console.error(
          `[Search Orchestrator]   ❌ FAILED in ${elapsed}ms: ${errMsg}`
        );
      }
    }

    // 9. Apply post ranking algorithm (from last30days-skill) with > 40% threshold
    const {
      totalProcessed,
      totalAccepted,
      acceptanceRate,
      acceptedPosts,
    } = rankAndFilterPosts(aggregatedPosts, 0.40);

    console.log(
      `\n[Search Orchestrator] 🎯 Relevance Ranking Complete:`
    );
    console.log(
      `[Search Orchestrator]    Evaluated: ${totalProcessed} posts`
    );
    console.log(
      `[Search Orchestrator]    Accepted (>40% score): ${totalAccepted} posts (${acceptanceRate}% pass rate)`
    );
    console.log(
      `[Search Orchestrator]    Filtered out by ranking: ${totalProcessed - totalAccepted} posts`
    );

    // 10. Send ranked posts (> 40% score) one-by-one to AI for Lead Evaluation
    const specificIcpsMap = new Map<string, SpecificIcp>();
    for (const spec of allSpecific) {
      specificIcpsMap.set(spec.id, spec);
    }

    const parentIcpInfo = {
      name: currentIcp?.name || "Business Solution",
      title: currentIcp?.title || "Target Audience",
      description: currentIcp?.description || "B2B product solving operational challenges.",
    };

    const aiEvaluatedPosts = await evaluatePostsOneByOne(
      acceptedPosts,
      parentIcpInfo,
      specificIcpsMap
    );

    const totalLeads = aiEvaluatedPosts.filter(
      (p) => p.aiEvaluation?.isLead
    ).length;

    console.log(
      `\n[Search Orchestrator] 🤖 AI Lead Evaluation Complete:`
    );
    console.log(
      `[Search Orchestrator]    Total AI Evaluated: ${aiEvaluatedPosts.length} posts`
    );
    console.log(
      `[Search Orchestrator]    Qualified Leads: ${totalLeads} posts`
    );
    console.log(
      `[Search Orchestrator]    Rejected by AI: ${aiEvaluatedPosts.length - totalLeads} posts (reasons preserved)`
    );

    // Map AI evaluations by post key for platform grouping
    const platformEvaluatedMap = new Map<string, UnifiedPost>();
    for (const post of aiEvaluatedPosts) {
      platformEvaluatedMap.set(`${post.platform}:${post.id || post.url}`, post);
    }

    // 11. Build final platformResults with ranked and AI-evaluated posts
    const platformResults: Record<PlatformType, PlatformSearchResult> = {} as Record<
      PlatformType,
      PlatformSearchResult
    >;

    for (const platform of orderedPlatforms) {
      const data = platformResultsData[platform];
      const platformRankResult = rankAndFilterPosts(data.posts, 0.40);
      const evaluatedPlatformPosts = platformRankResult.acceptedPosts.map((p) => {
        const key = `${p.platform}:${p.id || p.url}`;
        return platformEvaluatedMap.get(key) || p;
      });
      const platformLeadsCount = evaluatedPlatformPosts.filter(
        (p) => p.aiEvaluation?.isLead
      ).length;
      const postsCount = evaluatedPlatformPosts.length;
      const queryList = data.queriesUsed;
      const isSuccess =
        data.successCount > 0 || platformRankResult.totalProcessed > 0;
      const hasErrors = data.errors.length > 0;

      let status: "success" | "empty" | "error" = "empty";
      if (isSuccess) {
        status = postsCount > 0 ? "success" : "empty";
      } else if (hasErrors) {
        status = "error";
      }

      platformResults[platform] = {
        platform,
        success: isSuccess || !hasErrors,
        total: postsCount,
        processedCount: platformRankResult.totalProcessed,
        acceptedCount: platformRankResult.totalAccepted,
        leadsCount: platformLeadsCount,
        items: evaluatedPlatformPosts,
        queryUsed: queryList.join(" | "),
        queriesUsed: queryList,
        executionTimeMs: data.totalExecutionTimeMs,
        status,
        error: hasErrors ? data.errors.join("; ") : undefined,
        directApiUrl: data.lastDirectApiUrl,
      };
    }

    return NextResponse.json({
      success: true,
      totalPosts: totalAccepted,
      totalProcessed,
      totalAccepted,
      totalLeads,
      acceptanceRate,
      posts: aiEvaluatedPosts,
      platformResults,
    });


  } catch (error: unknown) {
    console.error("Orchestrator error:", error);
    return NextResponse.json(
      {
        success: false,
        totalPosts: 0,
        posts: [],
        platformResults: {} as Record<PlatformType, PlatformSearchResult>,
        error:
          error instanceof Error ? error.message : "Failed to orchestrate search",
      },
      { status: 500 }
    );
  }
}

/**
 * Normalizes double quotes and balances any unpaired quotes.
 */
function balanceQuotes(str: string): string {
  // Convert curved/smart quotes to standard double and single quotes
  let s = str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Collapse consecutive double quotes like `""` into a single `"`
  s = s.replace(/"+/g, '"');

  // Count total double quotes
  const quoteCount = (s.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // If odd number of quotes, fix the dangling/unclosed quote
    if (s.endsWith('"') && quoteCount > 1) {
      // e.g. `"startup banking" referrals"` -> remove trailing stray quote
      s = s.slice(0, -1).trim();
    } else if (s.startsWith('"') && quoteCount === 1) {
      // e.g. `"startup banking referrals` -> remove leading unclosed quote
      s = s.slice(1).trim();
    } else {
      // Stray unclosed quote inside string, remove quotes to avoid API syntax errors
      s = s.replace(/"/g, "");
    }
  }

  return s;
}

/**
 * Simplifies queries with advanced field operators for search engines that only accept simple keyword strings.
 */
function cleanQueryForPlatform(rawQuery: string, platform: PlatformType): string {
  let q = rawQuery.trim();

  // Normalize quotes and fix unbalanced/stray quotes without stripping valid phrase quotes
  q = balanceQuotes(q);

  // For Hacker News (Algolia), quotes in search queries are not supported and break matching
  if (platform === "hackernews") {
    q = q.replace(/"/g, " ");
  }

  // Strip complex boolean parentheses and field selectors for platforms that don't support them
  if (platform === "reddit" || platform === "hackernews" || platform === "linkedin" || platform === "x") {
    q = q.replace(/title:|selftext:|-is:retweet|lang:\w+|in:readme|in:name/gi, " ");
    q = q.replace(/[()]/g, " ").replace(/\s+OR\s+/gi, " ");
  }

  // Clean excessive double spaces
  return q.replace(/\s+/g, " ").trim();
}

