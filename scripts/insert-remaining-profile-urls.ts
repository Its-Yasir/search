import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db";
import { profileUrls } from "../db/schema";
import { eq } from "drizzle-orm";

interface SearchResultItem {
  index: number;
  company_name: string;
  search_query: string;
  google_search_url: string;
  linkedin_url: string | null;
  title: string | null;
  snippet: string | null;
  status: string;
}

const TARGET_USER_ID = "b5fa37ea-b4d0-4bfe-82cf-8b366b7da128";

async function main() {
  console.log("====================================================");
  console.log("📥 Inserting Remaining 180 LinkedIn Profile URLs into DB");
  console.log("====================================================");

  const jsonPath = path.resolve(__dirname, "../linkedin_search_results.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Error: Could not find ${jsonPath}`);
    process.exit(1);
  }

  const allResults: SearchResultItem[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📄 Loaded ${allResults.length} total items from linkedin_search_results.json`);

  // Remaining 180 items (index 21 to 200)
  const remainingItems = allResults.filter((item) => item.index > 20);
  console.log(`🎯 Remaining items to store: ${remainingItems.length}`);

  // Fetch existing URLs in DB to prevent duplicates
  const existingRecords = await db
    .select({ url: profileUrls.url })
    .from(profileUrls)
    .where(eq(profileUrls.userId, TARGET_USER_ID));

  const existingUrlSet = new Set(existingRecords.map((r) => r.url.trim().toLowerCase()));
  console.log(`💾 Found ${existingUrlSet.size} existing URLs in DB for user ${TARGET_USER_ID}`);

  const rowsToInsert: { url: string; userId: string; status: string }[] = [];
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  for (const item of remainingItems) {
    if (!item.linkedin_url) {
      console.warn(`⚠️ [Item ${item.index}] No LinkedIn URL for ${item.company_name}`);
      skippedInvalid++;
      continue;
    }

    const normalizedUrl = item.linkedin_url.trim();
    if (existingUrlSet.has(normalizedUrl.toLowerCase())) {
      console.log(`⏩ [Item ${item.index}] Already exists in DB: ${normalizedUrl}`);
      skippedDuplicates++;
      continue;
    }

    rowsToInsert.push({
      url: normalizedUrl,
      userId: TARGET_USER_ID,
      status: "pending",
    });
    // Add to set to avoid duplicates within the remaining list itself
    existingUrlSet.add(normalizedUrl.toLowerCase());
  }

  console.log(`\n📦 Ready to insert: ${rowsToInsert.length} rows (Skipped duplicates: ${skippedDuplicates}, Skipped invalid: ${skippedInvalid})`);

  if (rowsToInsert.length === 0) {
    console.log("✨ All URLs are already in the database. Nothing to insert!");
    process.exit(0);
  }

  // Insert in batches of 50 to avoid overly large queries
  const batchSize = 50;
  let totalInserted = 0;

  for (let i = 0; i < rowsToInsert.length; i += batchSize) {
    const batch = rowsToInsert.slice(i, i + batchSize);
    const inserted = await db
      .insert(profileUrls)
      .values(batch)
      .returning({ id: profileUrls.id, url: profileUrls.url });
    totalInserted += inserted.length;
    console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${inserted.length} rows). Total inserted so far: ${totalInserted}`);
  }

  // Final verification count
  const updatedCount = await db.select().from(profileUrls);
  console.log("\n====================================================");
  console.log(`🎉 Done! Successfully inserted ${totalInserted} profile URLs.`);
  console.log(`📊 Total rows in profile_urls table now: ${updatedCount.length}`);
  console.log("====================================================");
}

main().catch((err) => {
  console.error("Fatal error during DB insertion:", err);
  process.exit(1);
});
