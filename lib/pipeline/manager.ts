import { db } from "@/db";
import {
  profileUrls,
  companyDetails,
  companyPosts,
  companyEvents,
  whoToContact,
  icpInfo,
  leadInfo,
  CompanyEvent,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  extractCompanyIdentifier,
  fetchCompanyProfileFromUnipile,
  fetchCompanyPostsLastTwoMonths,
} from "@/lib/linkedin/company";
import { evaluatePostForB2BEvents } from "@/lib/ai/eventEvaluator";
import { enrichCompanyEvent } from "@/lib/ai/eventEnricher";
import { isRateLimitError } from "@/lib/pipeline/errors";
import {
  checkLinkedInDailyLimit,
  LinkedInDailyLimitStatus,
} from "@/lib/pipeline/limit";

export interface PipelineLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "event";
  message: string;
}

export interface PipelineState {
  status: "idle" | "running" | "stopping" | "completed";
  startedAt: string | null;
  totalCompanies: number;
  companiesProcessed: number;
  postsRead: number;
  eventsFound: number;
  currentCompany: {
    url?: string;
    identifier?: string;
    name?: string;
    stage?: string;
  } | null;
  countdown: {
    active: boolean;
    remainingSeconds: number;
    reason: string;
  } | null;
  logs: PipelineLogEntry[];
  recentEvents: CompanyEvent[];
  linkedinQuota?: LinkedInDailyLimitStatus | null;
}

class PipelineManager {
  private static instance: PipelineManager;

  private state: PipelineState = {
    status: "idle",
    startedAt: null,
    totalCompanies: 0,
    companiesProcessed: 0,
    postsRead: 0,
    eventsFound: 0,
    currentCompany: null,
    countdown: null,
    logs: [],
    recentEvents: [],
    linkedinQuota: null,
  };

  private abortController: AbortController | null = null;
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): PipelineManager {
    if (!PipelineManager.instance) {
      PipelineManager.instance = new PipelineManager();
    }
    return PipelineManager.instance;
  }

  public getStatus(): PipelineState {
    return { ...this.state };
  }

  private addLog(
    message: string,
    type: PipelineLogEntry["type"] = "info"
  ): void {
    const entry: PipelineLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    // Keep last 150 logs
    this.state.logs = [entry, ...this.state.logs.slice(0, 149)];
    console.log(`[Pipeline ${entry.timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  /**
   * Interruptible sleep with live countdown ticks.
   * Exits immediately if aborted.
   */
  private async delay(
    seconds: number,
    reason: string,
    signal: AbortSignal
  ): Promise<boolean> {
    const end = Date.now() + seconds * 1000;
    this.state.countdown = {
      active: true,
      remainingSeconds: seconds,
      reason,
    };

    while (Date.now() < end) {
      if (signal.aborted) {
        this.state.countdown = null;
        return false;
      }
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      this.state.countdown.remainingSeconds = remaining;
      const sleepSlice = Math.min(1000, end - Date.now());
      await new Promise((r) => setTimeout(r, sleepSlice));
    }

    this.state.countdown = null;
    return !signal.aborted;
  }

  /**
   * Random integer between min and max inclusive.
   */
  private getRandomSeconds(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Starts the background processing pipeline.
   */
  public async start(userId: string): Promise<{ success: boolean; message: string }> {
    if (this.isProcessing || this.state.status === "running") {
      return { success: false, message: "Pipeline is already running." };
    }

    // Pre-flight check: LinkedIn 24h company profile quota (100 per day limit)
    const initialQuota = await checkLinkedInDailyLimit(userId);
    this.state.linkedinQuota = initialQuota;

    if (initialQuota.limitReached) {
      const limitMsg =
        initialQuota.message ||
        "LinkedIn daily limit reached: 100 company profiles have been fetched in the last 24 hours. The pipeline was stopped to protect your LinkedIn account.";
      this.addLog(`🛑 ${limitMsg}`, "warning");
      return { success: false, message: limitMsg };
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.state.status = "running";
    this.state.startedAt = new Date().toISOString();
    this.isProcessing = true;

    // Load initial events and count from DB
    try {
      const existingEvents = await db
        .select()
        .from(companyEvents)
        .where(eq(companyEvents.userId, userId))
        .orderBy(desc(companyEvents.createdAt))
        .limit(150);
      this.state.recentEvents = existingEvents;
    } catch {
      // Ignore initial query error
    }

    this.addLog("🚀 Pipeline initiated by user.", "info");

    // Launch background worker without awaiting it
    this.runWorker(userId, signal).catch((err) => {
      this.addLog(`❌ Fatal worker error: ${(err as Error).message}`, "error");
      this.state.status = "idle";
      this.isProcessing = false;
    });

    return { success: true, message: "Pipeline started successfully." };
  }

  /**
   * Stops the background pipeline gracefully.
   */
  public stop(): { success: boolean; message: string } {
    if (!this.isProcessing && this.state.status === "idle") {
      return { success: false, message: "Pipeline is not running." };
    }

    this.state.status = "stopping";
    this.addLog("🛑 Stopping pipeline requested by user...", "warning");

    if (this.abortController) {
      this.abortController.abort();
    }

    this.state.countdown = null;
    this.state.status = "idle";
    this.isProcessing = false;
    this.addLog("⏹️ Pipeline stopped.", "info");

    return { success: true, message: "Pipeline stopped successfully." };
  }

  /**
   * Core pipeline execution worker.
   */
  private async runWorker(userId: string, signal: AbortSignal): Promise<void> {
    try {
      // 1. Fetch pending profile URLs for user
      const pendingUrls = await db
        .select()
        .from(profileUrls)
        .where(
          and(
            eq(profileUrls.userId, userId),
            eq(profileUrls.status, "pending")
          )
        );

      this.state.totalCompanies = pendingUrls.length;
      this.state.companiesProcessed = 0;

      if (pendingUrls.length === 0) {
        this.addLog(
          "ℹ️ No pending URLs found with status='pending'. Please add profile URLs first.",
          "warning"
        );
        this.state.status = "completed";
        this.isProcessing = false;
        return;
      }

      this.addLog(
        `📋 Loaded ${pendingUrls.length} company profiles to process.`,
        "info"
      );

      for (let i = 0; i < pendingUrls.length; i++) {
        if (signal.aborted) break;

        const row = pendingUrls[i];
        const rawIdentifier = extractCompanyIdentifier(row.url);

        // Check LinkedIn daily quota (100 company profiles in 24h) before fetching profile
        const quotaBefore = await checkLinkedInDailyLimit(userId);
        this.state.linkedinQuota = quotaBefore;

        if (quotaBefore.limitReached) {
          const limitMsg =
            quotaBefore.message ||
            `LinkedIn daily limit reached: ${quotaBefore.used}/100 company profiles fetched in the last 24 hours. Stopping pipeline to protect your account.`;
          this.addLog(`🛑 ${limitMsg}`, "warning");
          this.state.status = "idle";
          this.isProcessing = false;
          break;
        }

        this.state.currentCompany = {
          url: row.url,
          identifier: rawIdentifier,
          stage: "Fetching profile firmographics",
        };

        this.addLog(
          `[${i + 1}/${pendingUrls.length}] Processing "${rawIdentifier}" (${row.url})...`,
          "info"
        );

        // Mark row as processing
        await db
          .update(profileUrls)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(profileUrls.id, row.id));

        try {
          // --- STEP 1: Fetch company profile details via Unipile ---
          const profileData = await fetchCompanyProfileFromUnipile(
            rawIdentifier,
            signal
          );

          if (signal.aborted) break;

          const companyName = profileData?.name || rawIdentifier;
          this.state.currentCompany.name = companyName;

          this.addLog(
            `🏢 Found profile for "${companyName}" (ID: ${profileData?.id || "N/A"})`,
            "info"
          );

          // Upsert into company_details
          let companyDetailId: string;
          const existingCompany = await db
            .select()
            .from(companyDetails)
            .where(eq(companyDetails.profileUrlId, row.id))
            .limit(1);

          if (existingCompany.length > 0) {
            companyDetailId = existingCompany[0].id;
            await db
              .update(companyDetails)
              .set({
                unipileId: profileData?.id,
                entityUrn: profileData?.entity_urn,
                name: companyName,
                publicIdentifier: profileData?.public_identifier || rawIdentifier,
                profileUrl: profileData?.profile_url || row.url,
                description: profileData?.description,
                websiteUrl: profileData?.website_url,
                industry: profileData?.industry,
                followersCount: profileData?.followers_count,
                employeeCount: profileData?.employee_count,
                location: profileData?.location,
                logoUrl: profileData?.logo_url,
                rawProfile: profileData?.raw || {},
                lastFetchedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(companyDetails.id, companyDetailId));
          } else {
            const inserted = await db
              .insert(companyDetails)
              .values({
                profileUrlId: row.id,
                userId,
                unipileId: profileData?.id,
                entityUrn: profileData?.entity_urn,
                name: companyName,
                publicIdentifier: profileData?.public_identifier || rawIdentifier,
                profileUrl: profileData?.profile_url || row.url,
                description: profileData?.description,
                websiteUrl: profileData?.website_url,
                industry: profileData?.industry,
                followersCount: profileData?.followers_count,
                employeeCount: profileData?.employee_count,
                location: profileData?.location,
                logoUrl: profileData?.logo_url,
                rawProfile: profileData?.raw || {},
                lastFetchedAt: new Date(),
              })
              .returning({ id: companyDetails.id });
            companyDetailId = inserted[0].id;
          }

          // Track quota after updating company details
          const quotaAfterFetch = await checkLinkedInDailyLimit(userId);
          this.state.linkedinQuota = quotaAfterFetch;

          // --- STEP 2: Fetch company posts for the last 2 months (60 days) ---
          this.state.currentCompany.stage = "Fetching posts (last 2 months)";
          const entityTargetId = profileData?.id || rawIdentifier;

          const posts = await fetchCompanyPostsLastTwoMonths(
            entityTargetId,
            rawIdentifier,
            {
              abortSignal: signal,
              onPageFetched: (pageNum, count) => {
                this.addLog(
                  `   📄 Page ${pageNum}: retrieved ${count} posts from LinkedIn.`,
                  "info"
                );
              },
            }
          );

          if (signal.aborted) break;

          this.addLog(
            `📥 Retrieved ${posts.length} posts from the last 2 months for "${companyName}".`,
            "info"
          );

          // Save posts into company_posts & evaluate with OpenAI
          for (let p = 0; p < posts.length; p++) {
            if (signal.aborted) break;

            const post = posts[p];
            this.state.postsRead += 1;
            this.state.currentCompany.stage = `Analyzing post ${p + 1}/${posts.length} with AI`;

            // Insert post row
            let companyPostId: string | undefined;
            try {
              const insertedPost = await db
                .insert(companyPosts)
                .values({
                  companyDetailId,
                  socialPostId: post.social_id || post.id,
                  shareUrl: post.share_url,
                  postText: post.text,
                  postedAt: post.parsed_datetime
                    ? new Date(post.parsed_datetime)
                    : new Date(),
                  parsedDatetime: post.parsed_datetime
                    ? new Date(post.parsed_datetime)
                    : null,
                  reactionCounter: post.reaction_counter || 0,
                  commentCounter: post.comment_counter || 0,
                  repostCounter: post.repost_counter || 0,
                  attachments: post.attachments || [],
                  rawPost: post.raw || {},
                  aiEvaluated: true,
                })
                .returning({ id: companyPosts.id });
              companyPostId = insertedPost[0]?.id;
            } catch {
              // Ignore duplicate post inserts
            }

            // OpenAI call (delays in seconds: 1.5s - 3s)
            if (post.text && post.text.trim().length > 20) {
              const evaluation = await evaluatePostForB2BEvents(
                {
                  name: companyName,
                  publicIdentifier: profileData?.public_identifier || rawIdentifier,
                  industry: profileData?.industry,
                  description: profileData?.description,
                },
                {
                  text: post.text,
                  parsedDatetime: post.parsed_datetime,
                  date: post.date,
                  shareUrl: post.share_url,
                }
              );

              if (evaluation.hasEvent) {
                this.state.eventsFound += 1;
                this.addLog(
                  `🎯 B2B EVENT DISCOVERED! [${evaluation.eventType.toUpperCase()}]: "${evaluation.headline}"`,
                  "event"
                );

                // Save event into company_events
                const insertedEvent = await db
                  .insert(companyEvents)
                  .values({
                    companyDetailId,
                    postId: companyPostId,
                    userId,
                    hasEvent: true,
                    eventType: evaluation.eventType,
                    headline: evaluation.headline,
                    summary: evaluation.summary,
                    targetEntities: evaluation.targetEntities,
                    industrySector: evaluation.industrySector,
                    leadOpportunity: evaluation.leadOpportunity,
                    confidenceScore: evaluation.confidenceScore,
                    postUrl: post.share_url,
                    postDate: post.parsed_datetime
                      ? new Date(post.parsed_datetime)
                      : new Date(),
                    rawAiOutput: evaluation as unknown as Record<string, unknown>,
                  })
                  .returning();

                if (insertedEvent[0]) {
                  // --- STEP 2b: Generate whoToContact, icpInfo, and leadInfo ---
                  this.addLog(
                    `🧠 Generating ICP & Lead Intelligence for "${evaluation.headline}"...`,
                    "info"
                  );

                  try {
                    const enrichment = await enrichCompanyEvent(
                      {
                        eventType: evaluation.eventType,
                        headline: evaluation.headline,
                        summary: evaluation.summary,
                        targetEntities: evaluation.targetEntities,
                        industrySector: evaluation.industrySector,
                        leadOpportunity: evaluation.leadOpportunity,
                        confidenceScore: evaluation.confidenceScore,
                        postUrl: post.share_url || null,
                        postDate: post.parsed_datetime
                          ? new Date(post.parsed_datetime)
                          : null,
                      },
                      {
                        text: post.text,
                        shareUrl: post.share_url || null,
                        postedAt: post.parsed_datetime
                          ? new Date(post.parsed_datetime)
                          : null,
                        reactionCounter: post.reaction_counter || 0,
                        commentCounter: post.comment_counter || 0,
                        repostCounter: post.repost_counter || 0,
                      },
                      {
                        name: companyName,
                        publicIdentifier: profileData?.public_identifier || rawIdentifier,
                        description: profileData?.description || null,
                        industry: profileData?.industry || null,
                        websiteUrl: profileData?.website_url || null,
                        employeeCount: profileData?.employee_count || null,
                        location: profileData?.location || null,
                        followersCount: profileData?.followers_count || null,
                      }
                    );

                    // Insert whoToContact
                    await db.insert(whoToContact).values({
                      eventId: insertedEvent[0].id,
                      entityType: enrichment.whoToContact.entityType,
                      connectMethod: enrichment.whoToContact.connectMethod,
                      seniority: enrichment.whoToContact.seniority,
                      role: enrichment.whoToContact.role,
                      extraInfo: enrichment.whoToContact.extraInfo,
                    });

                    // Insert icpInfo
                    await db.insert(icpInfo).values({
                      eventId: insertedEvent[0].id,
                      industry: enrichment.icpInfo.industry,
                      geography: enrichment.icpInfo.geography,
                      type: enrichment.icpInfo.type,
                      title: enrichment.icpInfo.title,
                      companySize: enrichment.icpInfo.companySize,
                    });

                    // Insert leadInfo
                    const parsedExpiration = enrichment.leadInfo.expiration
                      ? new Date(enrichment.leadInfo.expiration)
                      : null;
                    const validExpiration =
                      parsedExpiration && !isNaN(parsedExpiration.getTime())
                        ? parsedExpiration
                        : null;

                    await db.insert(leadInfo).values({
                      eventId: insertedEvent[0].id,
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

                    // Store enrichment inside rawAiOutput so real-time feeds can display it immediately
                    const updatedRawAi = {
                      ...(evaluation as unknown as Record<string, unknown>),
                      enrichment,
                    };
                    await db
                      .update(companyEvents)
                      .set({ rawAiOutput: updatedRawAi })
                      .where(eq(companyEvents.id, insertedEvent[0].id));

                    insertedEvent[0].rawAiOutput = updatedRawAi;

                    const rolesText =
                      enrichment.whoToContact.role.slice(0, 2).join(", ") ||
                      "Decision Maker";
                    const expiryText = validExpiration
                      ? ` | Deadline: ${validExpiration.toLocaleDateString()}`
                      : "";
                    this.addLog(
                      `✨ ICP & Lead Intelligence saved for "${evaluation.headline}" (Contact: ${rolesText}${expiryText})`,
                      "success"
                    );
                  } catch (enrichErr) {
                    if (isRateLimitError(enrichErr)) {
                      throw enrichErr;
                    }
                    this.addLog(
                      `⚠️ Could not generate ICP/Lead info: ${(enrichErr as Error).message}`,
                      "warning"
                    );
                  }

                  this.state.recentEvents = [
                    insertedEvent[0],
                    ...this.state.recentEvents.slice(0, 149),
                  ];
                }
              }

              // Delay between OpenAI calls: 1.5 to 3.5 seconds
              const aiDelaySec = (Math.random() * 2 + 1.5).toFixed(1);
              await new Promise((r) => setTimeout(r, parseFloat(aiDelaySec) * 1000));
            }
          }

          // Mark URL as completed
          await db
            .update(profileUrls)
            .set({
              status: "completed",
              lastProcessedAt: new Date(),
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(profileUrls.id, row.id));

          this.state.companiesProcessed += 1;
          this.addLog(`✅ Completed processing for "${companyName}".`, "success");

          // Stop pipeline if LinkedIn 24h limit of 100 was reached after processing this company
          if (quotaAfterFetch.limitReached) {
            this.addLog(
              `🛑 LinkedIn daily limit reached: ${quotaAfterFetch.used}/100 company profiles fetched in the last 24 hours. Stopping pipeline to protect your LinkedIn account.`,
              "warning"
            );
            this.state.status = "idle";
            this.isProcessing = false;
            break;
          }

          // --- STEP 3: Human-like delay in MINUTES between LinkedIn/Unipile companies ---
          // Requirement: 2 to 3 minutes between tasks (120 to 180 seconds)
          if (i < pendingUrls.length - 1 && !signal.aborted) {
            const delaySeconds = this.getRandomSeconds(120, 180);
            this.addLog(
              `⏳ Human-like interval: pausing for ${Math.floor(
                delaySeconds / 60
              )}m ${delaySeconds % 60}s before next company...`,
              "info"
            );

            const completedWait = await this.delay(
              delaySeconds,
              `Human delay between companies (${Math.floor(delaySeconds / 60)}m ${
                delaySeconds % 60
              }s)`,
              signal
            );

            if (!completedWait || signal.aborted) {
              break;
            }
          }
        } catch (companyError) {
          const errMessage =
            companyError instanceof Error ? companyError.message : "Unknown error";

          if (isRateLimitError(companyError)) {
            this.addLog(
              `🚨 RATE LIMIT / TOO MANY REQUESTS DETECTED: ${errMessage}. Completely stopping pipeline to protect your account and API quota!`,
              "error"
            );

            await db
              .update(profileUrls)
              .set({
                status: "pending",
                lastProcessedAt: new Date(),
                errorMessage: `Stopped due to rate limit: ${errMessage}`,
                updatedAt: new Date(),
              })
              .where(eq(profileUrls.id, row.id));

            if (this.abortController) {
              this.abortController.abort();
            }
            this.state.countdown = null;
            this.state.status = "idle";
            this.isProcessing = false;
            break; // Completely stop pipeline immediately!
          }

          this.addLog(
            `⚠️ Error processing "${rawIdentifier}": ${errMessage}`,
            "error"
          );

          await db
            .update(profileUrls)
            .set({
              status: "failed",
              lastProcessedAt: new Date(),
              errorMessage: errMessage,
              updatedAt: new Date(),
            })
            .where(eq(profileUrls.id, row.id));
        }
      }

      if (signal.aborted) {
        this.addLog("⏹️ Pipeline execution cancelled by user.", "warning");
        this.state.status = "idle";
      } else {
        this.addLog("🎉 All pending company profiles processed!", "success");
        this.state.status = "completed";
      }
    } finally {
      this.isProcessing = false;
      this.state.countdown = null;
      this.state.currentCompany = null;
      try {
        this.state.linkedinQuota = await checkLinkedInDailyLimit(userId);
      } catch {
        // Ignore quota query error in finally
      }
    }
  }
}

export const pipelineManager = PipelineManager.getInstance();
