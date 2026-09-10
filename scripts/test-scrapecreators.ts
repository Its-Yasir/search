import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.SCRAPE_CREATORS_KEY || "";
const TARGET_URL = "https://www.linkedin.com/company/cr%C3%A9dit-agricole-de-lorraine";

if (!API_KEY) {
  console.error("❌ Error: SCRAPE_CREATORS_KEY is not defined in .env");
  process.exit(1);
}

async function getCreditBalance(): Promise<any> {
  try {
    const res = await fetch("https://api.scrapecreators.com/v1/account/credit-balance", {
      method: "GET",
      headers: { "x-api-key": API_KEY },
    });
    return await res.json();
  } catch (err: any) {
    return { error: err.message };
  }
}

async function fetchCompanyPostsPage(companyUrl: string, pageNum: number = 1): Promise<any> {
  const endpoint = `https://api.scrapecreators.com/v1/linkedin/company/posts?url=${encodeURIComponent(companyUrl)}&page=${pageNum}`;
  console.log(`\n📡 Fetching page ${pageNum}...`);
  console.log(`   Endpoint: GET ${endpoint}`);

  const startTime = Date.now();
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
  });
  const durationMs = Date.now() - startTime;

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }

  return {
    status: res.status,
    durationMs,
    headers: Object.fromEntries(res.headers.entries()),
    data,
  };
}

async function main() {
  console.log("==================================================");
  console.log("ScrapeCreators LinkedIn Company Posts Fetcher");
  console.log(`Target: ${TARGET_URL}`);
  console.log("==================================================");

  const startBalance = await getCreditBalance();
  console.log(`\n💳 Starting Balance: ${startBalance.creditCount} credits (${startBalance.message})`);

  const allPages: any[] = [];
  const allPosts: any[] = [];
  const maxPages = 7; // ScrapeCreators maximum allowed pages for LinkedIn company posts
  let totalCreditsConsumed = 0;

  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchCompanyPostsPage(TARGET_URL, page);
    allPages.push({ page, ...result });

    if (result.status !== 200) {
      console.error(`❌ Request failed with HTTP ${result.status}:`, result.data);
      break;
    }

    const posts = result.data?.posts || [];
    const creditsCharged = result.data?.credits_charged ?? 1;
    const creditsRemaining = result.data?.credits_remaining ?? (startBalance.creditCount - totalCreditsConsumed - creditsCharged);

    totalCreditsConsumed += creditsCharged;

    console.log(`   ✅ Status: 200 OK (${result.durationMs}ms)`);
    console.log(`   📦 Posts on this page: ${posts.length}`);
    console.log(`   💳 Credits charged: ${creditsCharged} (Remaining: ${creditsRemaining})`);

    if (posts.length > 0) {
      allPosts.push(...posts);
    } else {
      console.log(`   ℹ️ No posts returned on page ${page}. Ending pagination.`);
      break;
    }
  }

  const endBalance = await getCreditBalance();
  console.log("\n==================================================");
  console.log("📊 Summary & Credit Consumption");
  console.log("==================================================");
  console.log(`Initial Credits : ${startBalance.creditCount}`);
  console.log(`Final Credits   : ${endBalance.creditCount}`);
  console.log(`Total Consumed  : ${startBalance.creditCount - endBalance.creditCount} credits`);
  console.log(`Pages Fetched   : ${allPages.length}`);
  console.log(`Total Posts     : ${allPosts.length}`);
  console.log(`Cost Per Page   : 1 credit (returns 10 posts per page)`);
  console.log(`Cost Per Post   : 0.10 credits (~10 posts / 1 credit)`);
  console.log("==================================================");

  // Save complete consolidated data
  const consolidatedOutput = {
    metadata: {
      target_url: TARGET_URL,
      fetched_at: new Date().toISOString(),
      starting_credits: startBalance.creditCount,
      ending_credits: endBalance.creditCount,
      credits_consumed: startBalance.creditCount - endBalance.creditCount,
      cost_per_request: "1 credit per page request",
      pages_fetched: allPages.length,
      total_posts: allPosts.length,
    },
    posts: allPosts,
    pages_raw: allPages,
  };

  const outputPath = path.resolve(process.cwd(), "scrapecreators_credit_agricole_lorraine.json");
  fs.writeFileSync(outputPath, JSON.stringify(consolidatedOutput, null, 2), "utf-8");
  console.log(`\n💾 Saved consolidated JSON (${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB) to:\n   ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
