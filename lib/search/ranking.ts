/**
 * Query-centric post relevance scoring and ranking algorithm.
 * Ported faithfully from last30days-skill (skills/last30days/scripts/lib/relevance.py).
 *
 * Terms:
 * - Query coverage: overlap / len(q_tokens), weighted exponentially (coverage^1.35)
 * - Informative-token coverage: overlap of high-signal query tokens
 * - Precision penalty: overlap / min(len(t_tokens), len(q_tokens) + 4)
 * - Exact phrase bonus: rewards verbatim query phrase matches
 */

import { UnifiedPost } from "./types";

// Common English function words + Hebrew and Chinese stopwords that dilute token overlap
export const STOPWORDS: Set<string> = new Set([
  "the", "a", "an", "to", "for", "how", "is", "in", "of", "on",
  "and", "with", "from", "by", "at", "this", "that", "it", "my",
  "your", "i", "me", "we", "you", "what", "are", "do", "can",
  "its", "be", "or", "not", "no", "so", "if", "but", "about",
  "all", "just", "get", "has", "have", "was", "will",
  // Hebrew function words
  "את", "של", "על", "עם", "אל", "כי", "לא", "הוא", "היא", "הם",
  "הן", "אנו", "אנחנו", "זה", "זו", "זאת", "כל", "יש", "אין",
  "כבר", "רק", "גם", "כן", "אם", "או", "אבל", "כך", "מה", "מי",
  "איך", "למה", "כמה", "היה", "הייתה", "היו", "יהיה", "יהיו",
  "ה", "ב", "ל", "מ", "כ", "ו", "ש",
  // Chinese stopwords
  "的", "了", "和", "是", "在", "我", "有", "也", "就", "不", "人", "都",
  "一", "一个", "上", "很", "到", "说", "要", "去", "你", "会", "着",
  "没有", "看", "好", "自己", "这", "那", "这个", "那个", "什么", "怎么",
  "为什么", "以及", "或者", "但是", "因为", "所以", "如果", "可以",
  "这样", "那样", "他们", "我们", "你们", "它", "她", "他", "吗", "呢",
  "吧", "啊", "哦", "嗯", "与", "及", "等", "被", "把", "让", "给", "向",
  "还", "再", "又", "从", "对", "为", "以", "之", "其", "中",
]);

// Synonym groups for bidirectional relevance expansion
export const SYNONYMS: Record<string, string[]> = {
  hip: ["rap", "hiphop"],
  hop: ["rap", "hiphop"],
  rap: ["hip", "hop", "hiphop"],
  hiphop: ["rap", "hip", "hop"],
  js: ["javascript"],
  javascript: ["js"],
  ts: ["typescript"],
  typescript: ["ts"],
  ai: ["artificial", "intelligence"],
  ml: ["machine", "learning"],
  react: ["reactjs"],
  reactjs: ["react"],
  svelte: ["sveltejs"],
  sveltejs: ["svelte"],
  vue: ["vuejs"],
  vuejs: ["vue"],
};

// Generic / scaffolding words that carry low topic signal on their own
export const LOW_SIGNAL_QUERY_TOKENS: Set<string> = new Set([
  "advice", "animation", "animations", "best", "chance", "chances",
  "code", "compare", "comparison", "differences", "explain", "guide",
  "guides", "how", "latest", "news", "odds", "opinion", "opinions",
  "prediction", "predictions", "probability", "probabilities", "prompt",
  "prompting", "prompts", "rate", "review", "reviews", "thoughts",
  "tip", "tips", "tutorial", "tutorials", "update", "updates", "use",
  "using", "versus", "vs", "worth",
  // Scaffolding tokens
  "30", "current", "days", "describing", "especially", "evidence", "exist",
  "follow", "hands", "last", "matter", "most", "new", "people", "real",
  "recent", "relevant", "running", "up", "world",
]);

const CJK_CHARS_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;
const CJK_RUN_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]+/g;
const LATIN_REGEX = /\w+/g;

export function hasCjk(text: string): boolean {
  return CJK_CHARS_REGEX.test(text);
}

/**
 * Splits text into maximal CJK and non-CJK runs.
 * Non-CJK runs keep \w+ word behavior. CJK runs use character bigrams for overlap matching.
 */
export function segment(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  if (!hasCjk(lower)) {
    return lower.match(LATIN_REGEX) || [];
  }

  const out: string[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = CJK_RUN_REGEX.exec(lower)) !== null) {
    if (match.index > lastIdx) {
      const nonCjk = lower.slice(lastIdx, match.index).match(LATIN_REGEX);
      if (nonCjk) out.push(...nonCjk);
    }
    const run = match[0];
    if (run.length <= 1) {
      if (run) out.push(run);
    } else {
      for (let i = 0; i < run.length - 1; i++) {
        out.push(run.slice(i, i + 2));
      }
    }
    lastIdx = match.index + run.length;
  }
  if (lastIdx < lower.length) {
    const trailing = lower.slice(lastIdx).match(LATIN_REGEX);
    if (trailing) out.push(...trailing);
  }
  return out;
}

/**
 * Tokenize string: segment, drop stopwords & single-character tokens, and expand synonyms.
 */
export function tokenize(text: string): Set<string> {
  const words = segment(text);
  const tokens = new Set<string>();
  for (const w of words) {
    if (!STOPWORDS.has(w) && w.length > 1) {
      tokens.add(w);
    }
  }
  const expanded = new Set<string>(tokens);
  for (const t of tokens) {
    const syns = SYNONYMS[t];
    if (syns) {
      for (const s of syns) {
        expanded.add(s);
      }
    }
  }
  return expanded;
}

export function normalizePhrase(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").trim().replace(/\s+/g, " ");
}

export class PreparedQuery {
  raw: string;
  qTokens: Set<string>;
  informativeQTokens: Set<string>;
  normalizedPhrase: string;

  constructor(query: string) {
    this.raw = query;
    this.qTokens = tokenize(query);
    const informative = new Set<string>();
    for (const t of this.qTokens) {
      if (!LOW_SIGNAL_QUERY_TOKENS.has(t)) {
        informative.add(t);
      }
    }
    this.informativeQTokens = informative.size > 0 ? informative : this.qTokens;
    this.normalizedPhrase = normalizePhrase(query);
  }
}

export interface ScoreBreakdown {
  coverage: number;
  informativeOverlap: number;
  precision: number;
  phraseBonus: number;
}

export interface RelevanceResult {
  score: number;
  breakdown: ScoreBreakdown;
}

/**
 * Computes a query-centric relevance score between 0.0 and 1.0 (0.5 for empty queries).
 */
export function tokenOverlapRelevance(
  query: string | PreparedQuery,
  text: string,
  hashtags?: string[] | null
): RelevanceResult {
  const prepared = query instanceof PreparedQuery ? query : new PreparedQuery(query);
  const qTokens = prepared.qTokens;

  let combined = text;
  if (hashtags && hashtags.length > 0) {
    combined = `${text} ${hashtags.join(" ")}`;
  }
  const tTokens = tokenize(combined);

  // Split concatenated hashtags (e.g., "claudecode" -> matches "claude", "code")
  if (hashtags && hashtags.length > 0) {
    for (const tag of hashtags) {
      const tagLower = tag.toLowerCase();
      for (const qt of qTokens) {
        if (tagLower.includes(qt) && qt !== tagLower) {
          tTokens.add(qt);
        }
      }
    }
  }

  if (qTokens.size === 0) {
    return {
      score: 0.5,
      breakdown: { coverage: 0.5, informativeOverlap: 0.5, precision: 0.5, phraseBonus: 0 },
    };
  }

  let overlap = 0;
  for (const qt of qTokens) {
    if (tTokens.has(qt)) {
      overlap++;
    }
  }

  if (overlap === 0) {
    return {
      score: 0.0,
      breakdown: { coverage: 0, informativeOverlap: 0, precision: 0, phraseBonus: 0 },
    };
  }

  const informativeQTokens = prepared.informativeQTokens;
  let informativeOverlapCount = 0;
  for (const iqt of informativeQTokens) {
    if (tTokens.has(iqt)) {
      informativeOverlapCount++;
    }
  }

  const coverage = overlap / qTokens.size;
  const informativeOverlap = informativeOverlapCount / (informativeQTokens.size || 1);
  const precisionDenominator = Math.min(tTokens.size, qTokens.size + 4) || 1;
  const precision = overlap / precisionDenominator;

  let phraseBonus = 0.0;
  const normalizedQuery = prepared.normalizedPhrase;
  const normalizedText = normalizePhrase(combined);

  if (normalizedQuery) {
    let contained = normalizedText.includes(normalizedQuery);
    if (!contained && hasCjk(normalizedQuery)) {
      contained = normalizedText.replace(/\s+/g, "").includes(normalizedQuery.replace(/\s+/g, ""));
    }
    if (contained) {
      phraseBonus = normalizedQuery.split(/\s+/).length > 1 ? 0.12 : 0.16;
    }
  }

  const base =
    0.55 * Math.pow(coverage, 1.35) +
    0.25 * informativeOverlap +
    0.20 * precision;

  let finalScore: number;
  if (informativeQTokens.size > 0 && informativeOverlapCount === 0) {
    // If only generic query words matched, cap below relevance threshold
    finalScore = Math.round(Math.min(0.24, base) * 100) / 100;
  } else {
    finalScore = Math.round(Math.min(1.0, base + phraseBonus) * 100) / 100;
  }

  return {
    score: finalScore,
    breakdown: {
      coverage: Math.round(coverage * 100) / 100,
      informativeOverlap: Math.round(informativeOverlap * 100) / 100,
      precision: Math.round(precision * 100) / 100,
      phraseBonus,
    },
  };
}

/**
 * Scores a UnifiedPost by comparing its title and body text against its queryUsed.
 */
export function scorePost(post: UnifiedPost, fallbackQuery?: string): UnifiedPost {
  const content = `${post.title || ""} ${post.text || ""}`.trim();
  const query = (post.queryUsed || fallbackQuery || post.specificIcpName || "").trim();

  // Extract hashtags from content if present
  const extractedHashtags = (content.match(/#(\w+)/g) || []).map((h) => h.replace(/^#/, ""));

  const { score, breakdown } = tokenOverlapRelevance(query, content, extractedHashtags);

  return {
    ...post,
    score,
    scoreBreakdown: breakdown,
  };
}

export interface RankAndFilterResult {
  totalProcessed: number;
  totalAccepted: number;
  acceptanceRate: number; // 0 to 100
  acceptedPosts: UnifiedPost[];
}

/**
 * Applies the ranking algorithm across all posts and filters to only those strictly above the threshold (e.g. > 0.40).
 * Results are sorted in descending order of relevance score.
 */
export function rankAndFilterPosts(
  posts: UnifiedPost[],
  threshold = 0.40
): RankAndFilterResult {
  const scoredPosts = posts.map((p) => scorePost(p));
  const acceptedPosts = scoredPosts
    .filter((p) => (p.score ?? 0) > threshold)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const totalProcessed = posts.length;
  const totalAccepted = acceptedPosts.length;
  const acceptanceRate =
    totalProcessed > 0 ? Math.round((totalAccepted / totalProcessed) * 100) : 0;

  return {
    totalProcessed,
    totalAccepted,
    acceptanceRate,
    acceptedPosts,
  };
}
