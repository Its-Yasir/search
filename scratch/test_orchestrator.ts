import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { db } = await import("../db/index");
  const { icps } = await import("../db/schema");
  const { signJWT, COOKIE_NAME } = await import("../lib/auth");

  const [icp] = await db.select().from(icps).limit(1);
  if (!icp) {
    console.log("No ICP in DB");
    return;
  }

  console.log("Using ICP:", icp.title, `(${icp.id}) owned by userId:`, icp.userId);

  const token = await signJWT({
    userId: icp.userId,
    name: "Test User",
    email: "test@example.com"
  });

  const { specificIcps: specificIcpsTable, queries: queriesTable } = await import("../db/schema");
  const [specific] = await db
    .select()
    .from(specificIcpsTable)
    .where((await import("drizzle-orm")).eq(specificIcpsTable.icpId, icp.id))
    .limit(1);

  if (specific) {
    console.log("Using Specific ICP:", specific.name, `(${specific.id})`);
    const qList = await db
      .select()
      .from(queriesTable)
      .where((await import("drizzle-orm")).eq(queriesTable.specificIcpId, specific.id));
    console.log(`Saved queries count for this specific ICP: ${qList.length}`);
    for (const q of qList) {
      console.log(`  [${q.platform}] "${q.query}"`);
    }
  }

  const baseUrl = "http://localhost:3000";

  console.log("\nTesting POST /api/search/orchestrate...");
  const res = await fetch(`${baseUrl}/api/search/orchestrate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `${COOKIE_NAME}=${token}`,
    },
    body: JSON.stringify({
      icpId: icp.id,
      specificIcpIds: specific ? [specific.id] : undefined,
      platforms: ["x", "reddit", "hackernews", "linkedin"],
      dateRange: "past 7 days",
      limitPerPlatform: 2,
    }),
  });

  console.log("Status:", res.status, res.statusText);
  const data = await res.json();
  console.log("Success:", data.success);
  console.log("Total Posts:", data.totalPosts);
  console.log("Platform Results Summary:");
  for (const [p, r] of Object.entries(data.platformResults || {})) {
    const resObj = r as import("../lib/search/types").PlatformSearchResult;
    console.log(
      `- ${p}: ${resObj.success ? `${resObj.total} posts` : `FAILED (${resObj.error})`} | Queries executed (${resObj.queriesUsed?.length || 0}): ${JSON.stringify(resObj.queriesUsed)}`
    );
  }

  if (data.posts && data.posts.length > 0) {
    console.log("\nSample unified post:");
    console.log(JSON.stringify(data.posts[0], null, 2));
  }
}

main().catch(console.error);
