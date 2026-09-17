import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import {
  users,
  companyDetails,
  companyPosts,
  companyEvents,
  whoToContact,
  icpInfo,
  leadInfo,
} from "../db/schema";
import { eq } from "drizzle-orm";
import {
  fetchCompanyPostsLastWeek,
  fetchCompanyProfileFromUnipile,
  CompanyPostItem,
} from "../lib/linkedin/company";
import { evaluatePostForB2BEvents, B2BEventEvaluation } from "../lib/ai/eventEvaluator";
import { enrichCompanyEvent, EventEnrichmentResult } from "../lib/ai/eventEnricher";

// --- Output JSON Interfaces ---

interface EventRecord {
  eventId?: string;
  eventType: string;
  headline: string;
  summary: string;
  industrySector: string;
  leadOpportunity: string;
  confidenceScore: number;
  postUrl: string | null;
  postDate: string | null;
  whoToContact: EventEnrichmentResult["whoToContact"];
  icpInfo: EventEnrichmentResult["icpInfo"];
  leadInfo: EventEnrichmentResult["leadInfo"];
  sourcePost: {
    socialId?: string;
    shareUrl?: string;
    text?: string;
    date?: string;
    parsedDatetime?: string;
    reactions: number;
    comments: number;
  };
}

interface CompanyPipelineReport {
  companyId: string;
  companyName: string;
  publicIdentifier: string | null;
  profileUrl: string | null;
  industry: string | null;
  postsFetchedLastWeekCount: number;
  postsWithEventsCount: number;
  eventsFoundCount: number;
  posts: Array<{
    socialId?: string;
    shareUrl?: string;
    text?: string;
    date?: string;
    parsedDatetime?: string;
    reactions: number;
    comments: number;
  }>;
  events: EventRecord[];
  processedAt: string;
}

interface OverallReport {
  startedAt: string;
  lastUpdatedAt: string;
  summary: {
    totalCompaniesInDb: number;
    totalCompaniesProcessed: number;
    totalPostsFetchedLastWeek: number;
    totalPostsWithEvents: number;
    totalEventsFound: number;
  };
  companies: CompanyPipelineReport[];
}

const REPORT_FILE_PATH = path.resolve(process.cwd(), "pipeline_last_week_stats.json");

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a random integer between min and max (inclusive)
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Executes a database operation with automatic retries on transient network/connection errors (e.g. Neon HTTP connect timeout).
 */
async function withDbRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 2000
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      const errStr = `${String(errObj?.message || "")} ${String((errObj?.cause as Record<string, unknown>)?.message || "")} ${String(errObj?.name || "")}`;
      const isTransient =
        errStr.includes("fetch failed") ||
        errStr.includes("timeout") ||
        errStr.includes("Timeout") ||
        errStr.includes("ConnectTimeoutError") ||
        errObj?.code === "ETIMEDOUT" ||
        errObj?.code === "ECONNRESET" ||
        errObj?.code === "EAI_AGAIN";

      if (attempt < maxRetries && isTransient) {
        console.warn(
          `   ⚠️ [DB Transient Network Error] ${operationName} timed out / failed. Retrying in ${delayMs / 1000}s (attempt ${attempt}/${maxRetries})...`
        );
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Load or initialize report file
 */
function loadReport(totalCompanies: number): OverallReport {
  if (fs.existsSync(REPORT_FILE_PATH)) {
    try {
      const raw = fs.readFileSync(REPORT_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as OverallReport;
      if (parsed && Array.isArray(parsed.companies)) {
        console.log(`📂 Found existing report (${parsed.companies.length} companies previously recorded). Resuming...`);
        parsed.summary.totalCompaniesInDb = totalCompanies;
        return parsed;
      }
    } catch {
      console.warn("⚠️ Could not parse existing report file. Creating new report.");
    }
  }

  return {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    summary: {
      totalCompaniesInDb: totalCompanies,
      totalCompaniesProcessed: 0,
      totalPostsFetchedLastWeek: 0,
      totalPostsWithEvents: 0,
      totalEventsFound: 0,
    },
    companies: [],
  };
}

/**
 * Save report to JSON file
 */
function saveReport(report: OverallReport): void {
  report.lastUpdatedAt = new Date().toISOString();
  // Recalculate summary totals
  report.summary.totalCompaniesProcessed = report.companies.length;
  report.summary.totalPostsFetchedLastWeek = report.companies.reduce(
    (acc, c) => acc + (c.postsFetchedLastWeekCount || 0),
    0
  );
  report.summary.totalPostsWithEvents = report.companies.reduce(
    (acc, c) => acc + (c.postsWithEventsCount || 0),
    0
  );
  report.summary.totalEventsFound = report.companies.reduce(
    (acc, c) => acc + (c.eventsFoundCount || 0),
    0
  );

  fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(report, null, 2), "utf-8");
}

async function main() {
  console.log("================================================================================");
  console.log("🚀 B2B PIPELINE: LAST WEEK'S POSTS & EVENT / ICP / LEAD EXTRACTION");
  console.log("================================================================================");
  console.log("⚙️  Configuration:");
  console.log("   • Timeframe: Last 7 days (last week)");
  console.log("   • Random delay per company: 3 to 10 seconds");
  console.log("   • Error handling: STOP IMMEDIATELY ON ANY ERROR");
  console.log(`   • Output JSON: ${REPORT_FILE_PATH}`);
  console.log("   • Target page: http://localhost:3000/find");
  console.log("================================================================================\n");

  // 1. Get fallback user with retry
  const allUsers = await withDbRetry("fetch users", async () => {
    return db.select().from(users).limit(1);
  });
  if (allUsers.length === 0) {
    throw new Error("No users found in database. Please ensure a user exists.");
  }
  const defaultUserId = allUsers[0].id;

  // 2. Fetch all companies from DB with retry
  const companies = await withDbRetry("fetch companies", async () => {
    return db
      .select({
        id: companyDetails.id,
        userId: companyDetails.userId,
        name: companyDetails.name,
        publicIdentifier: companyDetails.publicIdentifier,
        unipileId: companyDetails.unipileId,
        profileUrl: companyDetails.profileUrl,
        description: companyDetails.description,
        industry: companyDetails.industry,
        employeeCount: companyDetails.employeeCount,
        location: companyDetails.location,
        websiteUrl: companyDetails.websiteUrl,
        followersCount: companyDetails.followersCount,
      })
      .from(companyDetails);
  });

  if (companies.length === 0) {
    console.log("⚠️ No company profiles found in database.");
    return;
  }

  console.log(`📊 Found ${companies.length} companies in database.`);

  // 3. Load report and identify processed companies
  const report = loadReport(companies.length);
  const processedCompanyIds = new Set(report.companies.map((c) => c.companyId));

  const remainingCompanies = companies.filter((c) => !processedCompanyIds.has(c.id));
  console.log(`🎯 ${remainingCompanies.length} companies remaining to process.\n`);

  if (remainingCompanies.length === 0) {
    console.log("✅ All companies have already been processed in the report! Nothing to do.");
    return;
  }

  // 4. Process each company
  for (let idx = 0; idx < remainingCompanies.length; idx++) {
    const company = remainingCompanies[idx];
    const overallIndex = report.companies.length + 1;
    const progressStr = `[${overallIndex}/${companies.length}]`;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`${progressStr} 🏢 Starting: "${company.name}" (Slug: ${company.publicIdentifier || company.unipileId || "N/A"})`);

    // Target identifier for Unipile
    let entityTargetId = company.unipileId;
    if (!entityTargetId && company.publicIdentifier) {
      console.log(`   🔍 Missing numeric ID. Resolving profile via slug "${company.publicIdentifier}"...`);
      try {
        const resolved = await fetchCompanyProfileFromUnipile(company.publicIdentifier);
        if (resolved?.id) {
          entityTargetId = resolved.id;
          company.unipileId = resolved.id;
          if (resolved.name) company.name = resolved.name;

          await withDbRetry("update unipileId", async () => {
            await db
              .update(companyDetails)
              .set({
                unipileId: resolved.id,
                name: resolved.name || company.name,
                entityUrn: resolved.entity_urn || undefined,
                updatedAt: new Date(),
              })
              .where(eq(companyDetails.id, company.id));
          });
          console.log(`   ✅ Successfully resolved to numeric ID: ${resolved.id} (${resolved.name})`);
        }
      } catch (resErr) {
        console.warn(`   ⚠️ Could not resolve profile for slug: ${(resErr as Error).message}`);
      }
    }

    if (!entityTargetId) {
      entityTargetId = company.publicIdentifier || company.name;
    }
    const fallbackSlug = company.publicIdentifier || undefined;

    // A. Random delay between 3 to 10 seconds before fetching posts
    const delaySeconds = getRandomInt(3, 10);
    console.log(`⏳ Waiting random delay of ${delaySeconds}s before fetching posts...`);
    await sleep(delaySeconds * 1000);

    // B. Fetch posts for last 7 days (last week)
    let posts: CompanyPostItem[] = [];
    try {
      console.log(`📡 Fetching LinkedIn posts published within the last 7 days for "${company.name}"...`);
      posts = await fetchCompanyPostsLastWeek(entityTargetId, fallbackSlug, {
        onPageFetched: (pageNum, count) => {
          console.log(`   📄 Page ${pageNum}: checked ${count} posts from LinkedIn.`);
        },
      });
      console.log(`📥 Retrieved ${posts.length} post(s) from the last week.`);
    } catch (fetchErr) {
      console.error("\n❌ [FATAL ERROR] Failed to fetch company posts from Unipile:");
      console.error(fetchErr);
      console.error("🛑 Stopping pipeline immediately as requested.\n");
      saveReport(report);
      process.exit(1);
    }

    const companyReport: CompanyPipelineReport = {
      companyId: company.id,
      companyName: company.name,
      publicIdentifier: company.publicIdentifier,
      profileUrl: company.profileUrl,
      industry: company.industry,
      postsFetchedLastWeekCount: posts.length,
      postsWithEventsCount: 0,
      eventsFoundCount: 0,
      posts: [],
      events: [],
      processedAt: new Date().toISOString(),
    };

    const targetUserId = company.userId || defaultUserId;

    // C. Evaluate each post with AI
    for (let pIdx = 0; pIdx < posts.length; pIdx++) {
      const post = posts[pIdx];
      const postSnippet = (post.text || "").replace(/\n+/g, " ").slice(0, 70);
      console.log(`\n   🔍 Analyzing Post [${pIdx + 1}/${posts.length}]: "${postSnippet}..."`);

      companyReport.posts.push({
        socialId: post.social_id || post.id,
        shareUrl: post.share_url,
        text: post.text,
        date: post.date,
        parsedDatetime: post.parsed_datetime,
        reactions: post.reaction_counter || 0,
        comments: post.comment_counter || 0,
      });

      // Insert/update into company_posts table with retry
      let companyPostId: string | undefined;
      try {
        companyPostId = await withDbRetry("company_posts upsert", async () => {
          try {
            const insertedPost = await db
              .insert(companyPosts)
              .values({
                companyDetailId: company.id,
                socialPostId: post.social_id || post.id,
                shareUrl: post.share_url,
                postText: post.text,
                postedAt: post.parsed_datetime ? new Date(post.parsed_datetime) : new Date(),
                parsedDatetime: post.parsed_datetime ? new Date(post.parsed_datetime) : null,
                reactionCounter: post.reaction_counter || 0,
                commentCounter: post.comment_counter || 0,
                repostCounter: post.repost_counter || 0,
                attachments: post.attachments || [],
                rawPost: post.raw || {},
                aiEvaluated: true,
              })
              .returning({ id: companyPosts.id });
            return insertedPost[0]?.id;
          } catch {
            const existing = await db
              .select({ id: companyPosts.id })
              .from(companyPosts)
              .where(eq(companyPosts.socialPostId, post.social_id || post.id || ""))
              .limit(1);
            return existing[0]?.id;
          }
        });
      } catch (dbPostErr) {
        console.error("❌ [FATAL ERROR] Database error on company_posts:");
        console.error(dbPostErr);
        saveReport(report);
        process.exit(1);
      }

      // Check if text is meaningful for evaluation
      if (!post.text || post.text.trim().length < 20) {
        console.log(`      ⏩ Skipping evaluation: post body is too short.`);
        continue;
      }

      // 1. Evaluate for B2B Events
      let evaluation: B2BEventEvaluation;
      try {
        evaluation = await evaluatePostForB2BEvents(
          {
            name: company.name,
            publicIdentifier: company.publicIdentifier || undefined,
            industry: company.industry || undefined,
            description: company.description || undefined,
          },
          {
            text: post.text,
            parsedDatetime: post.parsed_datetime,
            date: post.date,
            shareUrl: post.share_url,
          }
        );
      } catch (aiEvalErr) {
        console.error("\n❌ [FATAL ERROR] OpenAI evaluation failed:");
        console.error(aiEvalErr);
        console.error("🛑 Stopping pipeline immediately as requested.\n");
        saveReport(report);
        process.exit(1);
      }

      if (!evaluation.hasEvent) {
        console.log(`      ⚪ No actionable B2B trigger event detected.`);
        continue;
      }

      // 2. An event was detected!
      companyReport.postsWithEventsCount += 1;
      companyReport.eventsFoundCount += 1;
      console.log(`      🎯 B2B EVENT DETECTED: [${evaluation.eventType.toUpperCase()}] "${evaluation.headline}" (Confidence: ${evaluation.confidenceScore}%)`);

      // 3. Enrich with Who to Contact, ICP Info, and Lead Info
      console.log(`      🧠 Calling AI Enricher for whoToContact, icpInfo & leadInfo...`);
      let enrichment: EventEnrichmentResult;
      try {
        enrichment = await enrichCompanyEvent(
          {
            eventType: evaluation.eventType,
            headline: evaluation.headline,
            summary: evaluation.summary,
            targetEntities: evaluation.targetEntities,
            industrySector: evaluation.industrySector,
            leadOpportunity: evaluation.leadOpportunity,
            confidenceScore: evaluation.confidenceScore,
            postUrl: post.share_url || null,
            postDate: post.parsed_datetime ? new Date(post.parsed_datetime) : null,
          },
          {
            text: post.text,
            shareUrl: post.share_url || null,
            postedAt: post.parsed_datetime ? new Date(post.parsed_datetime) : null,
            reactionCounter: post.reaction_counter || 0,
            commentCounter: post.comment_counter || 0,
            repostCounter: post.repost_counter || 0,
          },
          {
            name: company.name,
            publicIdentifier: company.publicIdentifier || null,
            description: company.description || null,
            industry: company.industry || null,
            websiteUrl: company.websiteUrl || null,
            employeeCount: company.employeeCount || null,
            location: company.location || null,
            followersCount: company.followersCount || null,
          }
        );
      } catch (aiEnrichErr) {
        console.error("\n❌ [FATAL ERROR] OpenAI enrichment failed:");
        console.error(aiEnrichErr);
        console.error("🛑 Stopping pipeline immediately as requested.\n");
        saveReport(report);
        process.exit(1);
      }

      // 4. Save into Database with retry on transient network errors
      let eventId: string | undefined;
      try {
        const fullRawOutput = {
          ...evaluation,
          enrichment,
        };

        await withDbRetry("event & enrichment insertion", async () => {
          // If eventId wasn't created yet in a prior attempt, insert companyEvents
          if (!eventId) {
            const insertedEvent = await db
              .insert(companyEvents)
              .values({
                companyDetailId: company.id,
                postId: companyPostId,
                userId: targetUserId,
                hasEvent: true,
                eventType: evaluation.eventType,
                headline: evaluation.headline,
                summary: evaluation.summary,
                targetEntities: evaluation.targetEntities,
                industrySector: evaluation.industrySector,
                leadOpportunity: evaluation.leadOpportunity,
                confidenceScore: evaluation.confidenceScore,
                postUrl: post.share_url || null,
                postDate: post.parsed_datetime ? new Date(post.parsed_datetime) : new Date(),
                rawAiOutput: fullRawOutput as unknown as Record<string, unknown>,
              })
              .returning({ id: companyEvents.id });

            eventId = insertedEvent[0]?.id;
          }

          if (eventId) {
            // A. Insert whoToContact if not already present
            const existingContact = await db
              .select({ id: whoToContact.id })
              .from(whoToContact)
              .where(eq(whoToContact.eventId, eventId))
              .limit(1);

            if (existingContact.length === 0) {
              await db.insert(whoToContact).values({
                eventId,
                entityType: enrichment.whoToContact.entityType,
                connectMethod: enrichment.whoToContact.connectMethod,
                seniority: enrichment.whoToContact.seniority,
                role: enrichment.whoToContact.role,
                extraInfo: enrichment.whoToContact.extraInfo,
              });
            }

            // B. Insert icpInfo if not already present
            const existingIcp = await db
              .select({ id: icpInfo.id })
              .from(icpInfo)
              .where(eq(icpInfo.eventId, eventId))
              .limit(1);

            if (existingIcp.length === 0) {
              await db.insert(icpInfo).values({
                eventId,
                industry: enrichment.icpInfo.industry,
                geography: enrichment.icpInfo.geography,
                type: enrichment.icpInfo.type,
                title: enrichment.icpInfo.title,
                companySize: enrichment.icpInfo.companySize,
              });
            }

            // C. Insert leadInfo if not already present
            const existingLead = await db
              .select({ id: leadInfo.id })
              .from(leadInfo)
              .where(eq(leadInfo.eventId, eventId))
              .limit(1);

            if (existingLead.length === 0) {
              const parsedExpiration = enrichment.leadInfo.expiration
                ? new Date(enrichment.leadInfo.expiration)
                : null;
              const validExpiration =
                parsedExpiration && !isNaN(parsedExpiration.getTime())
                  ? parsedExpiration
                  : null;

              await db.insert(leadInfo).values({
                eventId,
                industry: enrichment.leadInfo.industry,
                geography: enrichment.leadInfo.geography,
                type: enrichment.leadInfo.type,
                title: enrichment.leadInfo.title,
                companySize: enrichment.leadInfo.companySize,
                didTheyAsk: enrichment.leadInfo.didTheyAsk,
                advantageProviding: enrichment.leadInfo.advantageProviding,
                painPoint: enrichment.leadInfo.painPoint,
                requirements: enrichment.leadInfo.requirements,
                expiration: validExpiration,
                otherUsefulResources: enrichment.leadInfo.otherUsefulResources,
              });
            }
          }
        }, 4, 2000);
      } catch (dbErr) {
        console.error("\n❌ [FATAL ERROR] Database insertion failed for event / lead / icp after retries:");
        console.error(dbErr);
        console.error("🛑 Stopping pipeline immediately as requested.\n");
        saveReport(report);
        process.exit(1);
      }

      console.log(`      ✨ Saved to DB: Event, Who-To-Contact (${enrichment.whoToContact.role.slice(0, 2).join(", ") || "Decision Maker"}), ICP Info, Lead Info.`);

      // 5. Append to Company Report
      companyReport.events.push({
        eventId,
        eventType: evaluation.eventType,
        headline: evaluation.headline,
        summary: evaluation.summary,
        industrySector: evaluation.industrySector,
        leadOpportunity: evaluation.leadOpportunity,
        confidenceScore: evaluation.confidenceScore,
        postUrl: post.share_url || null,
        postDate: post.parsed_datetime || null,
        whoToContact: enrichment.whoToContact,
        icpInfo: enrichment.icpInfo,
        leadInfo: enrichment.leadInfo,
        sourcePost: {
          socialId: post.social_id || post.id,
          shareUrl: post.share_url,
          text: post.text,
          date: post.date,
          parsedDatetime: post.parsed_datetime,
          reactions: post.reaction_counter || 0,
          comments: post.comment_counter || 0,
        },
      });

      // Brief pause between OpenAI queries (1.5s - 2.5s) to stay well below rate limits
      await sleep(getRandomInt(1500, 2500));
    }

    // D. Add to overall report and write to JSON file immediately
    report.companies.push(companyReport);
    saveReport(report);

    console.log(`\n✅ Finished "${company.name}": ${companyReport.postsFetchedLastWeekCount} posts fetched, ${companyReport.postsWithEventsCount} with events (${companyReport.eventsFoundCount} total events).`);
    console.log(`💾 Progress saved to ${REPORT_FILE_PATH}`);
  }

  console.log("\n================================================================================");
  console.log("🎉 ALL COMPANIES PROCESSED SUCCESSFULLY!");
  console.log("================================================================================");
  console.log(`Total Companies Processed: ${report.summary.totalCompaniesProcessed}`);
  console.log(`Total Posts from Last Week: ${report.summary.totalPostsFetchedLastWeek}`);
  console.log(`Total Posts with Events:   ${report.summary.totalPostsWithEvents}`);
  console.log(`Total Events Extracted:    ${report.summary.totalEventsFound}`);
  console.log(`📁 Complete Report File:   ${REPORT_FILE_PATH}`);
  console.log("🌐 View results live on:   http://localhost:3000/find");
  console.log("================================================================================\n");
}

main().catch((fatalErr) => {
  console.error("💥 Unhandled fatal error:", fatalErr);
  process.exit(1);
});
