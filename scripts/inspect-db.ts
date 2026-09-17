import "dotenv/config";

import { db } from "../db";
import { users, profileUrls } from "../db/schema";

async function main() {
  const allUsers = await db.select().from(users);
  console.log("Users in DB:", allUsers.map(u => ({ id: u.id, email: u.email, name: u.name })));

  const allProfileUrls = await db.select().from(profileUrls);
  console.log(`Total profileUrls in DB: ${allProfileUrls.length}`);
  allProfileUrls.forEach((p, idx) => {
    console.log(`${idx + 1}: [userId: ${p.userId}] ${p.url}`);
  });
}

main().catch(console.error);
