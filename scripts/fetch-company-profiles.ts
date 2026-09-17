import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import { profileUrls, companyDetails, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getUnipileConfig } from "../lib/linkedin/client";
import { extractCompanyIdentifier, CompanyProfileData } from "../lib/linkedin/company";

// Generate random integer between min and max inclusive
function getRandomDelay(min = 5, max = 30): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fetch single company profile directly from Unipile with strict error detection
async function fetchCompanyProfileStrict(
  identifier: string,
  config: { baseUrl: string; apiKey: string; accountId: string }
): Promise<{ profile: CompanyProfileData | null; status: number; errorBody?: string }> {
  const encodedIdentifier = encodeURIComponent(identifier);
  const endpoint = `${config.baseUrl}/api/v1/linkedin/company/${encodedIdentifier}?account_id=${encodeURIComponent(
    config.accountId
  )}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-KEY": config.apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      profile: null,
      status: response.status,
      errorBody: errorText,
    };
  }

  const data = (await response.json()) as Record<string, unknown>;

  // Detect any Unipile or LinkedIn error objects even if HTTP 200 was returned
  if (
    data.error ||
    (typeof data.status === "string" && data.status.toLowerCase() === "error") ||
    data.checkpoint ||
    data.disconnected
  ) {
    const errMsg =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
        ? data.message
        : JSON.stringify(data);

    return {
      profile: null,
      status: typeof data.status === "number" ? data.status : 400,
      errorBody: errMsg,
    };
  }

  const profile: CompanyProfileData = {
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

  return { profile, status: response.status };
}

async function main() {
  console.log("====================================================");
  console.log("🏢 Fast Company Profile Fetching Pipeline");
  console.log("====================================================");

  const config = getUnipileConfig();
  if (!config.apiKey || !config.accountId) {
    console.error("❌ Error: UNIPILE_API_KEY and UNIPILE_ACCOUNT_ID must be set in .env");
    process.exit(1);
  }

  // Resolve target user with pending profiles
  const pendingWithUser = await db
    .select({ userId: profileUrls.userId })
    .from(profileUrls)
    .where(eq(profileUrls.status, "pending"))
    .limit(1);

  let targetUserId: string;
  if (pendingWithUser.length > 0) {
    targetUserId = pendingWithUser[0].userId;
  } else {
    const firstUser = await db.select().from(users).limit(1);
    if (firstUser.length === 0) {
      console.error("❌ Error: No users found in database.");
      process.exit(1);
    }
    targetUserId = firstUser[0].id;
  }

  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  const userName = userRecord[0] ? `${userRecord[0].name} (${userRecord[0].email})` : targetUserId;

  console.log(`👤 Target User: ${userName}`);

  // Fetch all unprocessed pending profile URLs
  const pendingUrls = await db
    .select()
    .from(profileUrls)
    .where(
      and(
        eq(profileUrls.userId, targetUserId),
        eq(profileUrls.status, "pending")
      )
    );

  const totalInDb = await db
    .select()
    .from(profileUrls)
    .where(eq(profileUrls.userId, targetUserId));

  const alreadyCompleted = totalInDb.filter((r) => r.status === "completed").length;
  const alreadyFailed = totalInDb.filter((r) => r.status === "failed").length;

  console.log(`📊 Total in database: ${totalInDb.length}`);
  console.log(`   - Already completed: ${alreadyCompleted}`);
  console.log(`   - Already failed: ${alreadyFailed}`);
  console.log(`   - Unprocessed pending URLs to fetch: ${pendingUrls.length}`);
  console.log(`⏱️ Configured delay: Random 5 to 30 seconds between profiles`);

  if (pendingUrls.length === 0) {
    console.log("\n🎉 No unprocessed pending companies found. All profiles are up to date!");
    process.exit(0);
  }

  console.log(`\n🚀 Starting pipeline for all ${pendingUrls.length} unprocessed profiles...\n`);

  let successCount = 0;

  for (let i = 0; i < pendingUrls.length; i++) {
    const row = pendingUrls[i];
    const currentOverall = alreadyCompleted + successCount + 1;
    const identifier = extractCompanyIdentifier(row.url);

    console.log(`----------------------------------------------------`);
    console.log(`[${i + 1}/${pendingUrls.length}] (Overall ~${currentOverall}/${totalInDb.length}) 🔎 Fetching "${identifier}"...`);
    console.log(`   URL: ${row.url}`);

    // Mark current row as processing
    await db
      .update(profileUrls)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(profileUrls.id, row.id));

    try {
      const result = await fetchCompanyProfileStrict(identifier, config);

      // Check if Unipile or LinkedIn returned an error
      if (result.status >= 400 || !result.profile) {
        const errorMsg = result.errorBody || `HTTP ${result.status} error`;
        console.error(`\n🛑 Error from Unipile / LinkedIn! (Status: ${result.status})`);
        console.error(`   Details: ${errorMsg}`);

        // Mark row as failed
        await db
          .update(profileUrls)
          .set({
            status: "failed",
            errorMessage: `HTTP ${result.status}: ${errorMsg.slice(0, 500)}`,
            lastProcessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(profileUrls.id, row.id));

        console.error("\n====================================================");
        console.error(`🚨 STOPPING PIPELINE due to Unipile / LinkedIn error.`);
        console.error(`   - Companies processed this run: ${successCount}`);
        console.error(`   - Failed company: "${identifier}"`);
        console.error(`   - Error: ${errorMsg}`);
        console.error("====================================================");

        // Immediate stop
        process.exit(1);
      }

      const profile = result.profile;
      const companyName = profile.name || identifier;

      // Upsert into companyDetails table
      const existingCompany = await db
        .select()
        .from(companyDetails)
        .where(eq(companyDetails.profileUrlId, row.id))
        .limit(1);

      let companyDetailId: string;
      if (existingCompany.length > 0) {
        companyDetailId = existingCompany[0].id;
        await db
          .update(companyDetails)
          .set({
            unipileId: profile.id,
            entityUrn: profile.entity_urn,
            name: companyName,
            publicIdentifier: profile.public_identifier || identifier,
            profileUrl: profile.profile_url || row.url,
            description: profile.description,
            websiteUrl: profile.website_url,
            industry: profile.industry,
            followersCount: profile.followers_count,
            employeeCount: profile.employee_count,
            location: profile.location,
            logoUrl: profile.logo_url,
            rawProfile: profile.raw || {},
            lastFetchedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(companyDetails.id, companyDetailId));
      } else {
        const inserted = await db
          .insert(companyDetails)
          .values({
            profileUrlId: row.id,
            userId: targetUserId,
            unipileId: profile.id,
            entityUrn: profile.entity_urn,
            name: companyName,
            publicIdentifier: profile.public_identifier || identifier,
            profileUrl: profile.profile_url || row.url,
            description: profile.description,
            websiteUrl: profile.website_url,
            industry: profile.industry,
            followersCount: profile.followers_count,
            employeeCount: profile.employee_count,
            location: profile.location,
            logoUrl: profile.logo_url,
            rawProfile: profile.raw || {},
            lastFetchedAt: new Date(),
          })
          .returning({ id: companyDetails.id });
        companyDetailId = inserted[0].id;
      }

      // Mark profileUrls as completed
      await db
        .update(profileUrls)
        .set({
          status: "completed",
          lastProcessedAt: new Date(),
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(profileUrls.id, row.id));

      successCount++;
      console.log(`   ✅ Successfully saved profile: "${companyName}"`);
      console.log(`      Industry: ${profile.industry ?? "N/A"} | Followers: ${profile.followers_count ?? "N/A"}`);
      console.log(`      Database company_details ID: ${companyDetailId}`);

      // Apply random delay from 5 to 30 seconds before next fetch
      if (i < pendingUrls.length - 1) {
        const delaySeconds = getRandomDelay(5, 30);
        console.log(`   ⏳ Pausing for ${delaySeconds}s (random interval 5-30s) before next profile...`);
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Network or runtime error: ${errMsg}`);

      await db
        .update(profileUrls)
        .set({
          status: "failed",
          errorMessage: errMsg,
          lastProcessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profileUrls.id, row.id));

      console.error("\n====================================================");
      console.error("🚨 STOPPING PIPELINE due to unexpected error.");
      console.error(`   - Companies processed this run: ${successCount}`);
      console.error(`   - Error: ${errMsg}`);
      console.error("====================================================");

      process.exit(1);
    }
  }

  console.log("\n====================================================");
  console.log("🎉 All unprocessed company profiles have been fetched & saved!");
  console.log(`📊 Summary:`);
  console.log(`   - Total processed in this run: ${successCount}`);

  // Automatically export latest report to JSON file
  try {
    const allCompanies = await db
      .select({
        id: companyDetails.id,
        name: companyDetails.name,
        publicIdentifier: companyDetails.publicIdentifier,
        profileUrl: companyDetails.profileUrl,
        inputUrl: profileUrls.url,
        unipileId: companyDetails.unipileId,
        entityUrn: companyDetails.entityUrn,
        industry: companyDetails.industry,
        followersCount: companyDetails.followersCount,
        employeeCount: companyDetails.employeeCount,
        location: companyDetails.location,
        websiteUrl: companyDetails.websiteUrl,
        description: companyDetails.description,
        logoUrl: companyDetails.logoUrl,
        lastFetchedAt: companyDetails.lastFetchedAt,
        rawProfile: companyDetails.rawProfile,
      })
      .from(companyDetails)
      .leftJoin(profileUrls, eq(companyDetails.profileUrlId, profileUrls.id));

    const reportFile = path.resolve(__dirname, "../company_profiles_report.json");
    fs.writeFileSync(reportFile, JSON.stringify(allCompanies, null, 2), "utf-8");
    console.log(`📁 Complete report saved to: ${reportFile} (${allCompanies.length} profiles)`);
  } catch (exportErr) {
    console.warn("⚠️ Warning: Could not write company_profiles_report.json:", exportErr);
  }

  console.log("====================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
