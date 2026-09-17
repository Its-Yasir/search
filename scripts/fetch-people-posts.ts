import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface PersonItem {
  object?: string;
  connection_urn?: string;
  created_at?: number;
  first_name?: string;
  last_name?: string;
  member_id: string;
  member_urn?: string;
  headline?: string;
  public_identifier?: string;
  public_profile_url?: string;
  profile_picture_url?: string;
}

interface PeopleJson {
  object?: string;
  items: PersonItem[];
}

interface ProgressAccountRecord {
  member_id: string;
  name: string;
  public_identifier?: string;
  profile_url?: string;
  posts_count: number;
  fetched_at: string;
  status: "success" | "error";
}

interface ProgressState {
  pipeline_status: "in_progress" | "completed" | "stopped_on_error" | "interrupted";
  start_time: string;
  last_updated_at: string;
  total_target_accounts: number;
  accounts_processed_count: number;
  successful_accounts_count: number;
  total_posts_fetched: number;
  last_account_id: string | null;
  last_account_name: string | null;
  last_api_response: unknown | null;
  error: {
    status?: number;
    message: string;
    details?: unknown;
    timestamp: string;
  } | null;
  account_records: ProgressAccountRecord[];
}

const PROGRESS_FILE_PATH = path.resolve(process.cwd(), "posts_fetch_progress.json");
const PEOPLE_FILE_PATH = path.resolve(process.cwd(), "public", "people.json");

function getCredentials() {
  const baseUrl = (process.env.UNIPILE_BASE_URL || "https://api24.unipile.com:15468").trim().replace(/\/+$/, "");
  const apiKey = (process.env.UNIPILE_API_KEY || "").trim();
  const accountId = (process.env.UNIPILE_ACCOUNT_ID || "").trim();

  if (!apiKey) {
    throw new Error("Missing UNIPILE_API_KEY in environment or .env file.");
  }
  if (!accountId) {
    throw new Error("Missing UNIPILE_ACCOUNT_ID in environment or .env file.");
  }

  return { baseUrl, apiKey, accountId };
}

function saveProgress(state: ProgressState) {
  state.last_updated_at = new Date().toISOString();
  try {
    fs.writeFileSync(PROGRESS_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write progress file:", err);
  }
}

function getRandomDelayMs(minSec = 2, maxSec = 10): number {
  return Math.floor(Math.random() * ((maxSec - minSec) * 1000 + 1)) + minSec * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFirstPagePosts(
  memberId: string,
  baseUrl: string,
  apiKey: string,
  accountId: string
): Promise<{ ok: boolean; status: number; data?: unknown; errorText?: string }> {
  // Query 1st page: limit=20 (Unipile max/default first page for posts)
  const endpoint = `${baseUrl}/api/v1/users/${encodeURIComponent(memberId)}/posts?account_id=${encodeURIComponent(
    accountId
  )}&limit=20`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawText = await response.text();
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      // Non-JSON response
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: parsedJson,
        errorText: rawText,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: parsedJson,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 0,
      errorText: (err as Error).message || String(err),
    };
  }
}

async function main() {
  console.log("===============================================================");
  console.log("🚀 Unipile LinkedIn Posts Fetch Pipeline");
  console.log("===============================================================");

  const { baseUrl, apiKey, accountId } = getCredentials();
  console.log(`Connected to Unipile: ${baseUrl}`);
  console.log(`Account ID: ${accountId}`);

  // Load target accounts
  if (!fs.existsSync(PEOPLE_FILE_PATH)) {
    console.error(`❌ Source file not found: ${PEOPLE_FILE_PATH}`);
    process.exit(1);
  }

  const peopleDataRaw = fs.readFileSync(PEOPLE_FILE_PATH, "utf-8");
  const peopleData: PeopleJson = JSON.parse(peopleDataRaw);
  const allPeople = peopleData.items || [];

  console.log(`📋 Total profiles found in people.json: ${allPeople.length}`);

  // Check existing progress
  const isFresh = process.argv.includes("--fresh");
  let state: ProgressState;

  if (!isFresh && fs.existsSync(PROGRESS_FILE_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(PROGRESS_FILE_PATH, "utf-8"));
      state.pipeline_status = "in_progress";
      console.log(`🔄 Resuming from existing progress file.`);
      console.log(`   Previously processed: ${state.accounts_processed_count} accounts`);
      console.log(`   Previously fetched posts: ${state.total_posts_fetched}`);
    } catch {
      state = initEmptyState(allPeople.length);
    }
  } else {
    state = initEmptyState(allPeople.length);
  }

  // Handle graceful interrupts
  const handleInterrupt = () => {
    console.log("\n⚠️ Interrupt received. Saving state and exiting gracefully...");
    state.pipeline_status = "interrupted";
    saveProgress(state);
    process.exit(0);
  };
  process.on("SIGINT", handleInterrupt);
  process.on("SIGTERM", handleInterrupt);

  const alreadyProcessedIds = new Set(state.account_records.map((r) => r.member_id));
  const remainingPeople = allPeople.filter((p) => !alreadyProcessedIds.has(p.member_id));

  console.log(`🎯 Accounts remaining to process: ${remainingPeople.length}`);
  console.log(`⏱️  Random delay policy: 2 to 10 seconds between requests.`);
  console.log(`🛑 Stop condition: Immediately upon any error, rate-limit, or block.\n`);

  saveProgress(state);

  for (let i = 0; i < remainingPeople.length; i++) {
    const person = remainingPeople[i];
    const personName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || person.member_id;
    const accountIndex = state.accounts_processed_count + 1;

    console.log(
      `---------------------------------------------------------------`
    );
    console.log(
      `[#${accountIndex}/${allPeople.length}] Fetching posts for: "${personName}"`
    );
    console.log(`   Member ID: ${person.member_id}`);
    if (person.public_profile_url) {
      console.log(`   Profile: ${person.public_profile_url}`);
    }

    const response = await fetchFirstPagePosts(person.member_id, baseUrl, apiKey, accountId);

    // Track the last account ID attempted
    state.last_account_id = person.member_id;
    state.last_account_name = personName;

    if (!response.ok) {
      console.error(
        `\n🛑 [STOPPING PIPELINE] Encountered error from Unipile/LinkedIn (Status: ${response.status})`
      );
      console.error(`   Error details:`, response.data || response.errorText);

      state.pipeline_status = "stopped_on_error";
      state.last_api_response = response.data || { error: response.errorText, status: response.status };
      state.error = {
        status: response.status,
        message: `Pipeline halted: HTTP ${response.status} error occurred while fetching posts for ${person.member_id}`,
        details: response.data || response.errorText,
        timestamp: new Date().toISOString(),
      };

      state.account_records.push({
        member_id: person.member_id,
        name: personName,
        public_identifier: person.public_identifier,
        profile_url: person.public_profile_url,
        posts_count: 0,
        fetched_at: new Date().toISOString(),
        status: "error",
      });

      saveProgress(state);
      console.log(`\n💾 Saved final state to: ${PROGRESS_FILE_PATH}`);
      console.log(`📊 Summary before halt:`);
      console.log(`   Accounts processed: ${state.accounts_processed_count}`);
      console.log(`   Total posts fetched: ${state.total_posts_fetched}`);
      console.log(`   Last account ID: ${state.last_account_id}`);
      process.exit(1);
    }

    // Success response
    const dataObj = (response.data || {}) as Record<string, unknown>;
    const items = Array.isArray(dataObj.items) ? dataObj.items : [];
    const postsCount = items.length;

    state.accounts_processed_count += 1;
    state.successful_accounts_count += 1;
    state.total_posts_fetched += postsCount;
    // Save the last API response from the API (stores latest response metadata and data)
    state.last_api_response = response.data;
    state.error = null;

    state.account_records.push({
      member_id: person.member_id,
      name: personName,
      public_identifier: person.public_identifier,
      profile_url: person.public_profile_url,
      posts_count: postsCount,
      fetched_at: new Date().toISOString(),
      status: "success",
    });

    saveProgress(state);

    console.log(`   ✅ Success! Found ${postsCount} posts in first page.`);
    console.log(
      `   📊 Running Totals -> Accounts: ${state.accounts_processed_count} | Posts: ${state.total_posts_fetched}`
    );

    // If more accounts remain, wait random delay between 2 and 10 seconds
    if (i < remainingPeople.length - 1) {
      const delayMs = getRandomDelayMs(2, 10);
      const delaySec = (delayMs / 1000).toFixed(1);
      console.log(`   ⏳ Random delay: waiting ${delaySec}s before next request...`);
      await sleep(delayMs);
    }
  }

  state.pipeline_status = "completed";
  saveProgress(state);

  console.log("\n===============================================================");
  console.log("🎉 All accounts processed successfully without blocking!");
  console.log(`   Total Accounts Processed: ${state.accounts_processed_count}`);
  console.log(`   Total Posts Fetched: ${state.total_posts_fetched}`);
  console.log(`   Output Saved: ${PROGRESS_FILE_PATH}`);
  console.log("===============================================================");
}

function initEmptyState(totalAccounts: number): ProgressState {
  return {
    pipeline_status: "in_progress",
    start_time: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    total_target_accounts: totalAccounts,
    accounts_processed_count: 0,
    successful_accounts_count: 0,
    total_posts_fetched: 0,
    last_account_id: null,
    last_account_name: null,
    last_api_response: null,
    error: null,
    account_records: [],
  };
}

main().catch((err) => {
  console.error("Fatal unexpected error:", err);
  process.exit(1);
});
