import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { db } = await import("../db/index");
  const { icps, specificIcps, queries } = await import("../db/schema");
  const icpList = await db.select().from(icps).limit(5);
  console.log("Total ICPs:", icpList.length);
  for (const icp of icpList) {
    console.log(`- ICP: ${icp.title} (${icp.id})`);
  }

  const specList = await db.select().from(specificIcps).limit(5);
  console.log("\nTotal Specific ICPs:", specList.length);
  for (const s of specList) {
    console.log(`- Specific ICP: ${s.name} (ICP: ${s.icpId}, whatToSearch: ${s.whatToSearch})`);
  }

  const queryList = await db.select().from(queries).limit(10);
  console.log("\nTotal Queries:", queryList.length);
  for (const q of queryList) {
    console.log(`- Query: [${q.platform}] "${q.query}" (specificIcpId: ${q.specificIcpId})`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
