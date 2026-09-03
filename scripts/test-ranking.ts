import {
  tokenize,
  tokenOverlapRelevance,
  rankAndFilterPosts,
  scorePost,
} from "../lib/search/ranking";
import { UnifiedPost } from "../lib/search/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log("=== Testing Post Ranking Algorithm ===\n");

// 1. Tokenize tests
const tokens = tokenize("How to use JS for hip hop apps");
assert(tokens.has("js"), "Tokens should include 'js'");
assert(tokens.has("javascript"), "Tokens should include synonym 'javascript'");
assert(tokens.has("hiphop"), "Tokens should include synonym 'hiphop'");
assert(!tokens.has("how"), "Tokens should remove stopword 'how'");
assert(!tokens.has("to"), "Tokens should remove stopword 'to'");

// 2. Neutral fallback for stopword-only or empty query
const stopwordOnly = tokenOverlapRelevance("how to", "anything at all");
assert(stopwordOnly.score === 0.5, `Stopword-only query returns 0.5 (got ${stopwordOnly.score})`);

const emptyQuery = tokenOverlapRelevance("", "anything at all");
assert(emptyQuery.score === 0.5, `Empty query returns 0.5 (got ${emptyQuery.score})`);

// 3. Zero overlap
const noOverlap = tokenOverlapRelevance("openclaw", "corsair gaming mouse");
assert(noOverlap.score === 0.0, `No overlap returns 0.0 (got ${noOverlap.score})`);

// 4. Exact phrase bonus
const phraseResult = tokenOverlapRelevance(
  "openclaw nanoclaw",
  "A detailed openclaw nanoclaw comparison for agents."
);
const partialResult = tokenOverlapRelevance(
  "openclaw nanoclaw",
  "A detailed openclaw comparison for agents."
);
assert(
  phraseResult.score > partialResult.score,
  `Exact phrase match (${phraseResult.score}) scores higher than partial match (${partialResult.score})`
);
assert(phraseResult.breakdown.phraseBonus > 0, "Exact phrase match receives phrase bonus");

// 5. Generic-only match capped <= 0.24 (stays below 0.40 filter threshold)
const genericOnly = tokenOverlapRelevance(
  "anthropic odds",
  "Latest odds and prediction updates for markets"
);
assert(
  genericOnly.score <= 0.24,
  `Generic-only match capped at <= 0.24 (got ${genericOnly.score})`
);

// 6. Informative match scores higher than generic-only
const informative = tokenOverlapRelevance(
  "anthropic odds",
  "Anthropic valuation market and funding details"
);
assert(
  informative.score > genericOnly.score,
  `Informative match (${informative.score}) scores higher than generic-only match (${genericOnly.score})`
);

// 7. Concatenated hashtags splitting
const hashtagResult = tokenOverlapRelevance(
  "claude code",
  "Agent workflow discussion",
  ["ClaudeCode", "BuildInPublic"]
);
assert(
  hashtagResult.score > 0,
  `Concatenated hashtag splitting recognized tokens (got ${hashtagResult.score})`
);

// 8. Full match returns high score
const fullMatch = tokenOverlapRelevance("python tutorial", "Python Tutorial for Beginners");
assert(fullMatch.score >= 0.9, `Full match returns >= 0.9 (got ${fullMatch.score})`);

// 9. rankAndFilterPosts testing with real-world UnifiedPost mocks
const mockPosts: UnifiedPost[] = [
  {
    id: "post-1",
    platform: "x",
    text: "Building an automated cold email sequence with AI agents for B2B SaaS founders. Here is what we learned.",
    queryUsed: "b2b saas cold email",
    url: "https://x.com/post1",
    author: { name: "Founder 1" },
  },
  {
    id: "post-2",
    platform: "reddit",
    text: "Review of latest headphones and odds of shipping delays for black friday.",
    queryUsed: "b2b saas cold email",
    url: "https://reddit.com/post2",
    author: { name: "Redditor 1" },
  },
  {
    id: "post-3",
    platform: "hackernews",
    title: "Cold email strategies that actually convert for B2B SaaS in 2025",
    text: "Detailed breakdown of outbound email deliverability, list building, and personalization for SaaS.",
    queryUsed: "b2b saas cold email",
    url: "https://news.ycombinator.com/post3",
    author: { name: "HN User" },
  },
  {
    id: "post-4",
    platform: "linkedin",
    text: "Random update about cooking pasta with olive oil.",
    queryUsed: "b2b saas cold email",
    url: "https://linkedin.com/post4",
    author: { name: "Chef" },
  },
];

console.log("\n--- Testing rankAndFilterPosts ---");
const rankResult = rankAndFilterPosts(mockPosts, 0.40);

console.log(`Total processed: ${rankResult.totalProcessed}`);
console.log(`Total accepted: ${rankResult.totalAccepted}`);
console.log(`Acceptance rate: ${rankResult.acceptanceRate}%`);
console.log(
  "Accepted posts:",
  rankResult.acceptedPosts.map((p) => ({
    id: p.id,
    score: `${Math.round((p.score ?? 0) * 100)}%`,
    breakdown: p.scoreBreakdown,
  }))
);

assert(rankResult.totalProcessed === 4, "Processed count should equal 4");
assert(rankResult.totalAccepted === 2, "Accepted count should equal 2 (only relevant posts)");
assert(
  rankResult.acceptedPosts.every((p) => (p.score ?? 0) > 0.40),
  "All accepted posts must have score > 0.40"
);
assert(
  (rankResult.acceptedPosts[0].score ?? 0) >= (rankResult.acceptedPosts[1].score ?? 0),
  "Accepted posts must be sorted descending by relevance score"
);
assert(
  !rankResult.acceptedPosts.some((p) => p.id === "post-4"),
  "Zero-overlap post-4 should be filtered out"
);
assert(
  !rankResult.acceptedPosts.some((p) => p.id === "post-2"),
  "Off-topic post-2 should be filtered out"
);

console.log("\n🎉 ALL RANKING ALGORITHM TESTS PASSED SUCCESSFULLY!");
