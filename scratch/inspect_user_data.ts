import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { db } = await import("../db/index");
  const { users, icps, specificIcps, queries } = await import("../db/schema");
  const { eq, ilike } = await import("drizzle-orm");

  const matchedUsers = await db.select().from(users).where(ilike(users.email, "%iamyasirtariq1%"));
  console.log("Matched Users:", matchedUsers);

  if (matchedUsers.length === 0) {
    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    console.log("All users:", allUsers);
    return;
  }

  for (const user of matchedUsers) {
    console.log(`\n================ USER: ${user.email} (${user.id}) ================`);
    const userIcps = await db.select().from(icps).where(eq(icps.userId, user.id));
    console.log(`User ICPs count: ${userIcps.length}`);
    for (const icp of userIcps) {
      console.log(`\n--- ICP [${icp.id}] ---`);
      console.log(`Title: ${icp.title}`);
      console.log(`Name: ${icp.name}`);
      console.log(`Description: ${icp.description}`);

      const specList = await db.select().from(specificIcps).where(eq(specificIcps.icpId, icp.id));
      console.log(`\nSpecific ICPs count for this ICP: ${specList.length}`);
      for (const s of specList) {
        console.log(`\n  Specific ICP [${s.id}]: ${s.name}`);
        console.log(`  Description: ${s.description}`);
        console.log(`  WhatToSearch: ${s.whatToSearch}`);

        const qList = await db.select().from(queries).where(eq(queries.specificIcpId, s.id));
        console.log(`  Queries count: ${qList.length}`);
        for (const q of qList) {
          console.log(`    [${q.platform}] "${q.query}" (rating: ${q.rating}, must: ${JSON.stringify(q.must)}, optional: ${JSON.stringify(q.optional)}, neg: ${JSON.stringify(q.negativeKeywords)})`);
        }
      }
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
