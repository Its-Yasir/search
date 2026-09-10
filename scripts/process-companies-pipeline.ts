import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../db";
import { users } from "../db/schema";
import { pipelineManager } from "../lib/pipeline/manager";

async function main() {
  console.log("====================================================");
  console.log("🚀 B2B Company Intelligence & Lead Event Pipeline");
  console.log("====================================================");

  // Find first user to bind processing context if run via CLI
  const firstUser = await db.select().from(users).limit(1);
  if (firstUser.length === 0) {
    console.error("❌ No users found in database. Please register a user first.");
    process.exit(1);
  }

  const userId = firstUser[0].id;
  console.log(`👤 Running pipeline for user: ${firstUser[0].name} (${firstUser[0].email})`);

  const result = await pipelineManager.start(userId);
  console.log(`Status: ${result.message}`);

  // Monitor progress until completed or idle
  const interval = setInterval(() => {
    const status = pipelineManager.getStatus();
    if (status.countdown?.active) {
      process.stdout.write(
        `\r⏳ [Delay] ${status.countdown.reason}: ${status.countdown.remainingSeconds}s remaining...    `
      );
    }

    if (status.status === "completed" || status.status === "idle") {
      clearInterval(interval);
      console.log(`\n\n🎉 Pipeline finished! Total events found: ${status.eventsFound}`);
      process.exit(0);
    }
  }, 1000);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
