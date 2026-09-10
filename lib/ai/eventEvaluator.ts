import { openai, DEFAULT_MODEL } from "@/lib/ai/openai";
import { RateLimitError, isRateLimitError } from "@/lib/pipeline/errors";

export interface TargetEntity {
  name: string;
  role: string; // e.g., "funded_startup", "partner", "investor", "vendor"
}

export interface B2BEventEvaluation {
  hasEvent: boolean;
  eventType:
    | "funding_given"
    | "funding_received"
    | "investment_mandate"
    | "accelerator_rfp"
    | "partnership"
    | "expansion_hiring"
    | "product_launch"
    | "other";
  headline: string;
  summary: string;
  targetEntities: TargetEntity[];
  industrySector: string;
  leadOpportunity: string;
  confidenceScore: number;
}

const SYSTEM_PROMPT = `You are an elite B2B Sales Intelligence, Market Triggers & Lead Generation AI.
Your job is to analyze an online post published by an organization (company, bank, VC, enterprise) and determine whether it contains an actionable business event or sales trigger signal that our B2B users can leverage for lead generation.

KEY B2B EVENTS & TRIGGERS TO DETECT:
1. funding_given: The organization funded, invested in, or granted capital to a third-party startup or company (e.g., "We just closed a $4M investment in MediCorp" or "Proud to support 5 new startups").
   -> High-value signal: the funded company is a fresh qualified lead with fresh capital to spend on tools, services, hiring, and software!
2. funding_received: The organization itself secured investment, venture debt, or a grant.
3. investment_mandate: The organization announces plans or a fund to invest in or support a specific sector (e.g., "We are deploying €50M into MedTech & Health startups", "Bank launches green transition credit lines").
   -> High-value signal: Startups or service providers in that sector can pitch to them or their portfolio!
4. accelerator_rfp: Call for applications, vendor RFPs, accelerator cohorts, incubation programs (e.g., "Village by CA opens applications for new startups").
5. partnership: Strategic joint venture, co-marketing, or technological integration between two or more companies.
6. expansion_hiring: Opening new offices/regions, aggressive expansion, or hiring key executives (new C-level / VP with new departmental budget).
7. product_launch: Launching a brand new enterprise solution, product line, or business division.
8. other: Any other explicit commercial trigger representing a concrete business opportunity.

NON-EVENTS (hasEvent: false):
- Routine holiday greetings, weekend wishes, employee anniversary reposts, inspirational quotes, vague motivational thoughts, or reposts of general articles without any organizational action or commitment.

OUTPUT FORMAT REQUIREMENTS:
Respond ONLY with valid JSON with these exact fields:
{
  "hasEvent": true or false,
  "eventType": "funding_given" | "funding_received" | "investment_mandate" | "accelerator_rfp" | "partnership" | "expansion_hiring" | "product_launch" | "other",
  "headline": "Concise, punchy title under 15 words highlighting the main event",
  "summary": "2 to 3 clear sentences summarizing what transpired",
  "targetEntities": [
    { "name": "Exact company or organization name", "role": "funded_startup" | "partner" | "applicant" }
  ],
  "industrySector": "Primary sector involved (e.g. MedTech, FinTech, AI, CleanTech, AgriTech, Retail, etc.)",
  "leadOpportunity": "2 sentences explaining exactly how a B2B sales or business development professional can use this event as a direct outreach angle or lead",
  "confidenceScore": 1 to 100
}`;

/**
 * Evaluates a single company post with OpenAI to detect B2B triggers and actionable lead events.
 */
export async function evaluatePostForB2BEvents(
  company: {
    name: string;
    publicIdentifier?: string;
    industry?: string;
    description?: string;
  },
  post: {
    text: string;
    date?: string;
    parsedDatetime?: string;
    shareUrl?: string;
  }
): Promise<B2BEventEvaluation> {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const userPrompt = `=== COMPANY DETAILS ===
Name: ${company.name}
Slug: ${company.publicIdentifier || "N/A"}
Industry: ${company.industry || "N/A"}

=== POST TO ANALYZE ===
Date: ${post.parsedDatetime || post.date || "Recent"}
URL: ${post.shareUrl || "N/A"}
Content:
"""
${post.text || "No post body text."}
"""

Evaluate whether this post represents an actionable B2B event or sales trigger. Return the JSON object.`;

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
        hasEvent: false,
        eventType: "other",
        headline: "No content returned from AI",
        summary: "The AI model returned an empty response.",
        targetEntities: [],
        industrySector: "General",
        leadOpportunity: "None",
        confidenceScore: 0,
      };
    }

    const parsed = JSON.parse(content) as Partial<B2BEventEvaluation>;

    return {
      hasEvent: Boolean(parsed.hasEvent),
      eventType: parsed.eventType || "other",
      headline: parsed.headline || "Unspecified Event",
      summary: parsed.summary || "",
      targetEntities: Array.isArray(parsed.targetEntities) ? parsed.targetEntities : [],
      industrySector: parsed.industrySector || "General",
      leadOpportunity: parsed.leadOpportunity || "",
      confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 50,
    };
  } catch (err) {
    if (isRateLimitError(err)) {
      const errMsg = err instanceof Error ? err.message : "OpenAI rate limit / quota exceeded";
      console.error("[EventEvaluator] OpenAI RATE LIMIT EXCEEDED:", errMsg);
      throw new RateLimitError(`OpenAI rate limit: ${errMsg}`, "openai");
    }
    const errorMsg = err instanceof Error ? err.message : "Unknown AI error";
    console.error("[EventEvaluator] OpenAI evaluation error:", errorMsg);
    return {
      hasEvent: false,
      eventType: "other",
      headline: "AI Evaluation Failed",
      summary: `Encountered an error: ${errorMsg}`,
      targetEntities: [],
      industrySector: "General",
      leadOpportunity: "None",
      confidenceScore: 0,
    };
  }
}
