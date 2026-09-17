import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const SERPER_API_KEY = process.env.SERPER_API_KEY || "";
const DEFAULT_INPUT_FILE = path.resolve(__dirname, "../column.txt");
const DEFAULT_OUTPUT_FILE = path.resolve(__dirname, "../linkedin_search_results.json");

interface SearchResultItem {
  index: number;
  company_name: string;
  search_query: string;
  google_search_url: string;
  linkedin_url: string | null;
  title: string | null;
  snippet: string | null;
  status: "success" | "not_found" | "error";
  error_message?: string;
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let concurrency = 3;
  let outputFile = DEFAULT_OUTPUT_FILE;
  let inputFile = DEFAULT_INPUT_FILE;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      outputFile = path.resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (args[i] === "--input" && args[i + 1]) {
      inputFile = path.resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (args[i] === "--force") {
      force = true;
    }
  }

  return { limit, concurrency, outputFile, inputFile, force };
}

// Extract search query and clean company name
function extractQueryInfo(rawUrl: string): { query: string; companyName: string } {
  try {
    const parsed = new URL(rawUrl.trim());
    const q = parsed.searchParams.get("q") || "";
    const cleanCompany = q
      .replace(/^site:linkedin\.com\/(company|in)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    return { query: q, companyName: cleanCompany || "Unknown" };
  } catch {
    // Fallback if URL constructor fails
    const match = rawUrl.match(/[?&]q=([^&]+)/);
    const decoded = match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : rawUrl;
    const cleanCompany = decoded
      .replace(/^site:linkedin\.com\/(company|in)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    return { query: decoded, companyName: cleanCompany || "Unknown" };
  }
}

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

interface SerperResponse {
  searchParameters?: Record<string, unknown>;
  organic?: SerperOrganicResult[];
  knowledgeGraph?: Record<string, unknown>;
}

// Call Serper API with retry logic
async function querySerper(query: string, retries = 2): Promise<SerperResponse> {
  const url = "https://google.serper.dev/search";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: 5,
        }),
      });

      if (response.status === 429) {
        console.warn(`⚠️ Rate limited (429). Backing off for 3 seconds (attempt ${attempt + 1}/${retries + 1})...`);
        await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API error (HTTP ${response.status}): ${errorText}`);
      }

      return (await response.json()) as SerperResponse;
    } catch (err: unknown) {
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
  throw new Error("Failed to query Serper after retries");
}

// Pick the best LinkedIn URL from Serper organic search results
function extractLinkedInResult(organicResults: SerperOrganicResult[] = []): {
  linkedinUrl: string | null;
  title: string | null;
  snippet: string | null;
} {
  if (!organicResults || organicResults.length === 0) {
    return { linkedinUrl: null, title: null, snippet: null };
  }

  // Priority 1: linkedin.com/company/ or linkedin.com/in/
  const profileOrCompany = organicResults.find(
    (item) =>
      typeof item.link === "string" &&
      (item.link.includes("linkedin.com/company/") || item.link.includes("linkedin.com/in/"))
  );

  if (profileOrCompany) {
    return {
      linkedinUrl: profileOrCompany.link || null,
      title: profileOrCompany.title || null,
      snippet: profileOrCompany.snippet || null,
    };
  }

  // Priority 2: Any linkedin.com domain result
  const anyLinkedin = organicResults.find(
    (item) => typeof item.link === "string" && item.link.includes("linkedin.com")
  );

  if (anyLinkedin) {
    return {
      linkedinUrl: anyLinkedin.link || null,
      title: anyLinkedin.title || null,
      snippet: anyLinkedin.snippet || null,
    };
  }

  // Fallback: Top organic result
  const topResult = organicResults[0];
  return {
    linkedinUrl: topResult?.link || null,
    title: topResult?.title || null,
    snippet: topResult?.snippet || null,
  };
}

async function main() {
  const { limit, concurrency, outputFile, inputFile, force } = parseArgs();

  console.log("====================================================");
  console.log("🔍 Serper Google Search to LinkedIn Profile Extractor");
  console.log("====================================================");

  if (!SERPER_API_KEY) {
    console.error("❌ Error: SERPER_API_KEY is not defined in your .env file.");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: Input file not found at: ${inputFile}`);
    process.exit(1);
  }

  // Read input file
  const rawLines = fs.readFileSync(inputFile, "utf-8").split(/\r?\n/);
  const searchUrls = rawLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("http://") || line.startsWith("https://"));

  console.log(`📄 Loaded ${searchUrls.length} Google search URLs from: ${path.basename(inputFile)}`);

  const urlsToProcess = limit ? searchUrls.slice(0, limit) : searchUrls;
  console.log(`🎯 Targets to process: ${urlsToProcess.length} (Concurrency: ${concurrency})`);

  // Load existing results for checkpointing / resume capability
  const existingResultsMap = new Map<string, SearchResultItem>();
  if (!force && fs.existsSync(outputFile)) {
    try {
      const existingData: SearchResultItem[] = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
      if (Array.isArray(existingData)) {
        for (const item of existingData) {
          if (item.status === "success" && item.google_search_url) {
            existingResultsMap.set(item.google_search_url, item);
          }
        }
        console.log(`💾 Found ${existingResultsMap.size} previously cached successful results in ${path.basename(outputFile)}`);
      }
    } catch {
      console.warn("⚠️ Could not read existing output file; starting fresh.");
    }
  }

  const results: SearchResultItem[] = [];

  // Helper to persist current results incrementally
  const saveResults = () => {
    fs.writeFileSync(outputFile, JSON.stringify(results.filter(Boolean), null, 2), "utf-8");
  };

  // Concurrency pool runner
  let currentIndex = 0;
  async function worker() {
    while (currentIndex < urlsToProcess.length) {
      const itemIndex = currentIndex++;
      const targetUrl = urlsToProcess[itemIndex];
      const displayIndex = itemIndex + 1;
      const { query, companyName } = extractQueryInfo(targetUrl);

      // Check if already cached
      if (!force && existingResultsMap.has(targetUrl)) {
        const cached = existingResultsMap.get(targetUrl)!;
        cached.index = displayIndex;
        results[itemIndex] = cached;
        console.log(`[${displayIndex}/${urlsToProcess.length}] ⏩ Skipped (already cached): ${companyName} -> ${cached.linkedin_url}`);
        continue;
      }

      console.log(`[${displayIndex}/${urlsToProcess.length}] 🔎 Searching: "${companyName}"...`);

      try {
        const serperData = await querySerper(query);
        const { linkedinUrl, title, snippet } = extractLinkedInResult(serperData?.organic);

        const status = linkedinUrl ? "success" : "not_found";
        const resultItem: SearchResultItem = {
          index: displayIndex,
          company_name: companyName,
          search_query: query,
          google_search_url: targetUrl,
          linkedin_url: linkedinUrl,
          title,
          snippet,
          status,
        };

        results[itemIndex] = resultItem;

        if (linkedinUrl) {
          console.log(`[${displayIndex}/${urlsToProcess.length}] ✅ Found: ${linkedinUrl}`);
        } else {
          console.log(`[${displayIndex}/${urlsToProcess.length}] ⚠️ No LinkedIn URL found in top results.`);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[${displayIndex}/${urlsToProcess.length}] ❌ Error for "${companyName}": ${errorMessage}`);
        results[itemIndex] = {
          index: displayIndex,
          company_name: companyName,
          search_query: query,
          google_search_url: targetUrl,
          linkedin_url: null,
          title: null,
          snippet: null,
          status: "error",
          error_message: errorMessage,
        };
      }

      // Small delay between calls to maintain polite spacing
      await new Promise((res) => setTimeout(res, 120));

      // Incremental checkpoint save
      saveResults();
    }
  }

  // Launch concurrency workers
  const actualWorkers = Math.min(concurrency, urlsToProcess.length);
  const workers = Array.from({ length: actualWorkers }, () => worker());
  await Promise.all(workers);

  // Final filtered & formatted save (sorted by original index)
  const sortedResults = results.filter(Boolean).sort((a, b) => a.index - b.index);
  fs.writeFileSync(outputFile, JSON.stringify(sortedResults, null, 2), "utf-8");

  const successCount = sortedResults.filter((r) => r.status === "success").length;
  const notFoundCount = sortedResults.filter((r) => r.status === "not_found").length;
  const errorCount = sortedResults.filter((r) => r.status === "error").length;

  console.log("\n====================================================");
  console.log("🎉 Search Extraction Completed!");
  console.log(`📊 Summary:`);
  console.log(`   - Total Processed: ${sortedResults.length}`);
  console.log(`   - Successfully Found: ${successCount}`);
  console.log(`   - Not Found: ${notFoundCount}`);
  console.log(`   - Errors: ${errorCount}`);
  console.log(`📁 Results saved to: ${outputFile}`);
  console.log("====================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
