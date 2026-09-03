import { openai, DEFAULT_MODEL } from "@/lib/ai/openai";
import { UnifiedPost } from "@/lib/search/types";
import { Icp, SpecificIcp } from "@/db/schema";

export interface AiLeadEvaluation {
  isLead: boolean;
  reason: string;
}

const SYSTEM_PROMPT = `You are an elite B2B Lead Qualification & Sales Intelligence AI.
Your task is to analyze an online post and determine whether it represents a prospective lead for the user's business offering.

You will be given:
1. The User's Business Offering (their initial input, problem they solve, and solution).
2. The Target Specific ICP Persona details.
3. The Post Content (platform, author, title, text, query used, relevance score).

EVALUATION CRITERIA:
- QUALIFIED LEAD (isLead: true):
  • The post author or discussion is actively expressing a pain point, problem, bottleneck, or need that the user's offering solves.
  • Or the author is asking for tool/software/agency recommendations, alternatives, or reviews in this space.
  • Or the author represents the target persona and is facing a concrete challenge relevant to the offering.

- NOT A LEAD (isLead: false):
  • The post is promotional marketing, link spam, a generic announcement, a job post, or a general tutorial.
  • The author is advertising or selling their own service rather than having a need.
  • The post merely mentions keywords casually without real problem expression, curiosity, or buying intent.

OUTPUT REQUIREMENTS:
Respond ONLY with valid JSON in this exact structure:
{
  "isLead": boolean,
  "reason": "2 to 3 concise, clear sentences explaining specifically why this post is or is not a qualified lead based on the user's offering and target persona."
}`;

/**
 * Evaluates a single post using the OpenAI model specified in .env.
 */
export async function evaluateSinglePostLead(
  post: UnifiedPost,
  icp: { name: string; title: string; description?: string | null },
  specificIcp?: { name: string; description?: string | null; whatToSearch?: string | null }
): Promise<AiLeadEvaluation> {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const userPrompt = `=== USER'S OFFERING (1st Input / Problem Solved) ===
- Solution Name: ${icp.name}
- ICP Title: ${icp.title}
- Description & Offering: ${icp.description || "N/A"}

=== TARGET SPECIFIC ICP PERSONA ===
- Persona Name: ${specificIcp?.name || post.specificIcpName || "Target Persona"}
- Persona Description: ${specificIcp?.description || "N/A"}
- Problem / Context Guidance: ${specificIcp?.whatToSearch || "N/A"}

=== POST CONTENT TO EVALUATE ===
- Platform: ${post.platform.toUpperCase()}
- Author: ${post.author.name || "Anonymous"}${post.author.handle ? ` (${post.author.handle})` : ""}
- Post Title: ${post.title || "N/A"}
- Content:
"""
${post.text || "No text provided"}
"""
- Original URL: ${post.url}
- Search Query Used: "${post.queryUsed || "N/A"}"
- Relevance Ranking Score: ${Math.round((post.score ?? 0) * 100)}%

Is this post a qualified lead for the user? Provide isLead (boolean) and a 2-3 sentence reason explaining why or why not.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      reasoning_effort: "none",
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        isLead: false,
        reason: "AI evaluation did not return content.",
      };
    }

    const parsed = JSON.parse(content) as { isLead?: boolean; reason?: string };
    return {
      isLead: Boolean(parsed.isLead),
      reason:
        parsed.reason ||
        (parsed.isLead
          ? "The post matches the target ICP and expresses a relevant problem."
          : "The post does not exhibit active purchasing intent or target problem expression."),
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown AI error";
    console.error(`[LeadEvaluator] Error evaluating post ${post.id}:`, errMsg);
    return {
      isLead: false,
      reason: `AI evaluation encountered an error: ${errMsg}`,
    };
  }
}

/**
 * Evaluates posts one-by-one with the AI model.
 * Only posts passed in (which have score > 40%) are evaluated.
 * Returns all evaluated posts with their aiEvaluation attached.
 */
export async function evaluatePostsOneByOne(
  posts: UnifiedPost[],
  icp: Icp | { name: string; title: string; description?: string | null },
  specificIcpsMap: Map<string, SpecificIcp>
): Promise<UnifiedPost[]> {
  const evaluatedPosts: UnifiedPost[] = [];

  console.log(
    `\n[LeadEvaluator] 🤖 Evaluating ${posts.length} ranked posts one-by-one with AI model: ${process.env.OPENAI_MODEL || DEFAULT_MODEL}...`
  );

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const specificIcp = post.specificIcpId
      ? specificIcpsMap.get(post.specificIcpId)
      : undefined;

    console.log(
      `[LeadEvaluator] [${i + 1}/${posts.length}] Evaluating post on ${post.platform.toUpperCase()} by "${post.author.name}"...`
    );

    const evaluation = await evaluateSinglePostLead(post, icp, specificIcp);

    console.log(
      `[LeadEvaluator]    -> Lead: ${evaluation.isLead ? "✅ YES" : "❌ NO"} | Reason: "${evaluation.reason.slice(0, 70)}..."`
    );

    evaluatedPosts.push({
      ...post,
      aiEvaluation: evaluation,
    });
  }

  return evaluatedPosts;
}
