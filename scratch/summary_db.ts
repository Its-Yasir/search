import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { db } = await import("../db/index");
  const { users, icps, specificIcps, queries } = await import("../db/schema");
  const { count } = await import("drizzle-orm");

  const [usersCount] = await db.select({ val: count() }).from(users);
  const [icpsCount] = await db.select({ val: count() }).from(icps);
  const [specificIcpsCount] = await db.select({ val: count() }).from(specificIcps);
  const [queriesCount] = await db.select({ val: count() }).from(queries);

  console.log("Database Summary:");
  console.log(`- Users: ${usersCount.val}`);
  console.log(`- ICPs: ${icpsCount.val}`);
  console.log(`- Specific ICPs: ${specificIcpsCount.val}`);
  console.log(`- Queries: ${queriesCount.val}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
