import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import { companyDetails, profileUrls } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("====================================================");
  console.log("📦 Exporting All Company Profiles from Database");
  console.log("====================================================");

  const rows = await db
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

  console.log(`📊 Found ${rows.length} company profiles in database.`);

  const outputPath = path.resolve(__dirname, "../company_profiles_report.json");
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2), "utf-8");

  console.log(`✅ Successfully exported ${rows.length} company profiles to:`);
  console.log(`   📁 ${outputPath}`);
  console.log("====================================================");
}

main().catch((err) => {
  console.error("Export error:", err);
  process.exit(1);
});
