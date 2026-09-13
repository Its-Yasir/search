/**
 * Script: Enrich Company Events
 *
 * Fetches all company_events from the database and, for each one,
 * sends the event data + associated post + company profile to OpenAI
 * to generate records in: whoToContact, icpInfo, and leadInfo tables.
 *
 * Each event is processed one-by-one in a sequential loop.
 *
 * Usage:
 *   npx tsx scripts/enrich-company-events.ts
 */

// Load env BEFORE any other imports
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // Dynamic imports so dotenv.config() runs first
  const { db } = await import("../db");
  const {
    companyEvents,
    companyPosts,
    companyDetails,
    whoToContact,
    icpInfo,
    leadInfo,
  } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");
  const { enrichCompanyEvent } = await import("../lib/ai/eventEnricher");

  console.log("════════════════════════════════════════════════════════");
  console.log("🧠 Company Event Enrichment Script");
  console.log("   Generates: WhoToContact, ICP Info, Lead Info");
  console.log("════════════════════════════════════════════════════════\n");

  // 1. Fetch all company events
  const events = await db.select().from(companyEvents);

  if (events.length === 0) {
    console.log("ℹ️  No company events found in the database. Nothing to process.");
    process.exit(0);
  }

  console.log(`📋 Found ${events.length} company event(s) to enrich.\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    console.log(`─────────────────────────────────────────────────────`);
    console.log(
      `[${i + 1}/${events.length}] Processing event: "${event.headline}"`
    );
    console.log(`   Type: ${event.eventType} | Confidence: ${event.confidenceScore}`);

    // Check if records already exist for this event (skip if already enriched)
    const existingContact = await db
      .select({ id: whoToContact.id })
      .from(whoToContact)
      .where(eq(whoToContact.eventId, event.id))
      .limit(1);

    if (existingContact.length > 0) {
      console.log(`   ⏭️  Already enriched — skipping.`);
      skipCount++;
      continue;
    }

    // 2. Fetch the associated post (if any)
    let post: {
      text: string | null;
      shareUrl: string | null;
      postedAt: Date | null;
      reactionCounter: number | null;
      commentCounter: number | null;
      repostCounter: number | null;
    } | null = null;

    if (event.postId) {
      const posts = await db
        .select()
        .from(companyPosts)
        .where(eq(companyPosts.id, event.postId))
        .limit(1);

      if (posts.length > 0) {
        const p = posts[0];
        post = {
          text: p.postText,
          shareUrl: p.shareUrl,
          postedAt: p.postedAt,
          reactionCounter: p.reactionCounter,
          commentCounter: p.commentCounter,
          repostCounter: p.repostCounter,
        };
      }
    }

    // 3. Fetch the company profile
    const companies = await db
      .select()
      .from(companyDetails)
      .where(eq(companyDetails.id, event.companyDetailId))
      .limit(1);

    if (companies.length === 0) {
      console.log(`   ⚠️  Company details not found — skipping.`);
      errorCount++;
      continue;
    }

    const company = companies[0];

    // 4. Call OpenAI to enrich
    try {
      console.log(`   🤖 Sending to AI for enrichment...`);

      const result = await enrichCompanyEvent(
        {
          eventType: event.eventType,
          headline: event.headline,
          summary: event.summary,
          targetEntities: event.targetEntities,
          industrySector: event.industrySector,
          leadOpportunity: event.leadOpportunity,
          confidenceScore: event.confidenceScore,
          postUrl: event.postUrl,
          postDate: event.postDate,
        },
        post,
        {
          name: company.name,
          publicIdentifier: company.publicIdentifier,
          description: company.description,
          industry: company.industry,
          websiteUrl: company.websiteUrl,
          employeeCount: company.employeeCount,
          location: company.location,
          followersCount: company.followersCount,
        }
      );

      // 5. Insert records into the three tables
      await db.insert(whoToContact).values({
        eventId: event.id,
        entityType: result.whoToContact.entityType,
        connectMethod: result.whoToContact.connectMethod,
        seniority: result.whoToContact.seniority,
        role: result.whoToContact.role,
        extraInfo: result.whoToContact.extraInfo,
      });

      await db.insert(icpInfo).values({
        eventId: event.id,
        industry: result.icpInfo.industry,
        geography: result.icpInfo.geography,
        type: result.icpInfo.type,
        title: result.icpInfo.title,
        companySize: result.icpInfo.companySize,
      });

      await db.insert(leadInfo).values({
        eventId: event.id,
        industry: result.leadInfo.industry,
        geography: result.leadInfo.geography,
        type: result.leadInfo.type,
        title: result.leadInfo.title,
        companySize: result.leadInfo.companySize,
        didTheyAsk: result.leadInfo.didTheyAsk,
        advantageProviding: result.leadInfo.advantageProviding,
        painPoint: result.leadInfo.painPoint,
        requirements: result.leadInfo.requirements,
        expiration: result.leadInfo.expiration
          ? new Date(result.leadInfo.expiration)
          : null,
        otherUsefulResources: result.leadInfo.otherUsefulResources,
      });

      console.log(`   ✅ Enriched successfully!`);
      console.log(`      Contact: ${result.whoToContact.role.join(", ")} via ${result.whoToContact.connectMethod}`);
      console.log(`      ICP: ${result.icpInfo.industry.join(", ")} | ${result.icpInfo.geography.join(", ")}`);
      console.log(`      Lead Pain: ${result.leadInfo.painPoint?.slice(0, 80) || "N/A"}...`);
      successCount++;

      // Small delay between AI calls (1-2 seconds)
      if (i < events.length - 1) {
        const delay = Math.random() * 1000 + 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`   ❌ Error enriching event: ${errMsg}`);
      errorCount++;

      // If rate limited, stop entirely
      if (errMsg.includes("rate limit")) {
        console.error("\n🚨 Rate limit hit — stopping script to protect API quota.");
        break;
      }
    }
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`🎉 Enrichment complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);
  console.log(`════════════════════════════════════════════════════════`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
