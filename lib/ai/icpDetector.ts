import { openai, DEFAULT_MODEL } from "./openai";

export interface IcpDetectionInput {
  companyName?: string;
  offering: string;
  lookingFor?: string;
  availableTaxonomy?: string[];
}

export interface IcpDetectionResult {
  industryTags: string[];
  targetPersonas: string[];
  valueProposition: string;
  searchKeywords: string[];
  analysisSummary: string;
}

const SYSTEM_PROMPT = `You are a B2B Go-To-Market, ICP Classification, and Sales Intelligence AI.
Given a user's company information, offering/product/service, and what they are looking for, your job is to:
1. Determine the precise industry tags (both specific niche tags and broader parent sectors) that apply to this user's market focus.
   Example: If the user offers solar panels or EV fleet charging software, industry tags could include: "Solar Energy", "Energy Management", "CleanTech", "Commercial Mobility", "Energy Transition", "Renewable Energy".
2. Identify target decision-maker personas / job titles that would purchase or partner with this offering.
3. Formulate a crisp 1-sentence value proposition summary.
4. Extract 4-8 search keywords.
5. Provide a 2-sentence rationale for the chosen industries.

TAXONOMY GUIDANCE:
If a list of known database industries is provided in the prompt, prioritize matching or referencing relevant ones where appropriate, while also adding more granular and complementary industry tags.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object matching this structure:
{
  "industryTags": ["string"],
  "targetPersonas": ["string"],
  "valueProposition": "string",
  "searchKeywords": ["string"],
  "analysisSummary": "string"
}`;

/**
 * Uses OpenAI to analyze user offering and derive target industry tags and ICP personas.
 */
export async function detectIcpIndustriesAndAngles(
  input: IcpDetectionInput
): Promise<IcpDetectionResult> {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const userPrompt = `=== USER / COMPANY PROFILE ===
Company Name: ${input.companyName?.trim() || "Not specified"}
Offering / Product / Service:
"""
${input.offering.trim()}
"""
What they are looking for / Target Goals:
"""
${input.lookingFor?.trim() || "B2B commercial triggers and relevant partners/customers"}
"""

=== KNOWN DATABASE INDUSTRY TAXONOMY (REFERENCE) ===
${
  input.availableTaxonomy && input.availableTaxonomy.length > 0
    ? input.availableTaxonomy.slice(0, 50).join(", ")
    : "Banking, FinTech, CleanTech, Energy Transition, Tourism Technology, Commercial Mobility, Insurance, Retail, Healthcare, Agriculture, Technology"
}

Analyze this company and return the structured JSON object with industryTags, targetPersonas, valueProposition, searchKeywords, and analysisSummary.`;

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
    throw new Error("OpenAI returned an empty response for ICP detection.");
  }

  const parsed = JSON.parse(content) as IcpDetectionResult;

  return {
    industryTags: Array.isArray(parsed.industryTags)
      ? parsed.industryTags.filter((t) => typeof t === "string" && t.trim().length > 0)
      : [],
    targetPersonas: Array.isArray(parsed.targetPersonas)
      ? parsed.targetPersonas.filter((p) => typeof p === "string" && p.trim().length > 0)
      : [],
    valueProposition: typeof parsed.valueProposition === "string" ? parsed.valueProposition : "",
    searchKeywords: Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords : [],
    analysisSummary: typeof parsed.analysisSummary === "string" ? parsed.analysisSummary : "",
  };
}
