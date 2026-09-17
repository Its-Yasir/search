import { openai, DEFAULT_MODEL } from "@/lib/ai/openai";
import { RateLimitError, isRateLimitError } from "@/lib/pipeline/errors";

// ─── Output interfaces matching DB schema ────────────────────────────────────

export interface WhoToContactOutput {
  entityType: string | null;
  connectMethod: string | null;
  seniority: string[];
  role: string[];
  extraInfo: string | null;
}

export interface IcpInfoOutput {
  industry: string[];
  geography: string[];
  type: "person" | "company" | null;
  title: string[];
  companySize: number[];
}

export interface LeadInfoOutput {
  industry: string[];
  geography: string[];
  type: "person" | "company" | null;
  title: string[];
  companySize: number[];
  didTheyAsk: string | null;
  advantageProviding: string | null;
  painPoint: string | null;
  requirements: string | null;
  expiration: string | null; // ISO date string or null
  otherUsefulResources: string | null;
}

export interface EventEnrichmentResult {
  whoToContact: WhoToContactOutput;
  icpInfo: IcpInfoOutput;
  leadInfo: LeadInfoOutput;
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert B2B Sales Intelligence & Lead Enrichment AI.

You will receive a company event (a previously-detected business trigger such as a funding round, partnership, product launch, etc.), along with the original post content and the company's profile data.

Your job is to analyze all of this context and produce THREE structured outputs:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. WHO TO CONTACT — Identify the ideal person or entity type to reach out to based on this event.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- entityType: "person" or "company" — who should be contacted.
- connectMethod: How to best approach them (e.g. "LinkedIn InMail", "Cold email", "Warm intro via mutual connection", "Comment on their post", "Direct message").
- seniority: Array of seniority levels to target (e.g. ["C-Level", "VP", "Director", "Manager"]).
- role: Array of specific roles/titles to look for (e.g. ["CTO", "Head of Engineering", "VP Sales", "Procurement Manager"]).
- extraInfo: Any extra context about the contact approach Or anything that was not fitting in the parameters that we gave you, so you can tell it here.(e.g., We are a company that sells HR software, and we noticed that the company just announced a new funding round, so we should target the CFO and the HR department.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ICP INFO — Define the Ideal Customer Profile that this event reveals.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- industry: Array of industries this lead falls into (e.g. ["FinTech", "Banking", "Insurance"]).
- geography: Array of geographic regions relevant (e.g. ["France", "Europe", "EMEA"]). You can also keep this empty if the ICP can be from any geographic region. 
- type: "person" or "company" — whether the ICP is an individual or an organization.
- title: Array of job titles that match this ICP (e.g. ["Startup Founder", "CEO", "CTO"]).
- companySize: It is an array of numbers. You can give two numbers, a minimum value and a maximum value for the number of employees, and you can also give a single value in the array if this ICP requires the exact number of employees. (e.g., If the company has 100 employees, you can give [100], if the company can have 100 to 500 employees, you can give [100, 500], and if the company can have more than 1000 employees, you can give [1000] because the range starts from 1000 and goes up to as large as possible).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. LEAD INFO — Detailed intelligence about the lead opportunity.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- industry: Array of industries (same logic as ICP).
- geography: Array of geographic regions.
- type: "person" or "company".
- title: Array of relevant job titles.
- companySize: Array of approximate employee counts.
- didTheyAsk: What specific need or request did they express? (null if none)
- advantageProviding: What competitive advantage does this event reveal for someone selling to them?
- painPoint: What pain point or challenge does this event suggest they have?
- requirements: What requirements, tools, or services might they need as a result of this event?
- expiration: ISO date string for when this opportunity expires. IMPORTANT: Add an expiry date ONLY if you are sure based on explicit date or deadline data directly stated in the post (e.g. application deadlines, limited-time offers, scheduled event dates, RFP closing dates). If the post does not specify an explicit expiration or deadline, return null. Do NOT guess, estimate, or extrapolate an expiration date.
- otherUsefulResources: Any other relevant links, references, or context that could help with outreach.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond ONLY with valid JSON matching this exact structure:
{
  "whoToContact": {
    "entityType": "person" | "company",
    "connectMethod": "string",
    "seniority": ["string"],
    "role": ["string"],
    "extraInfo": "string or null"
  },
  "icpInfo": {
    "industry": ["string"],
    "geography": ["string"],
    "type": "person" | "company",
    "title": ["string"],
    "companySize": [number]
  },
  "leadInfo": {
    "industry": ["string"],
    "geography": ["string"],
    "type": "person" | "company",
    "title": ["string"],
    "companySize": [number],
    "didTheyAsk": "string or null",
    "advantageProviding": "string",
    "painPoint": "string",
    "requirements": "string",
    "expiration": "ISO date string or null",
    "otherUsefulResources": "string or null"
  }
}`;

// ─── Enrichment Function ─────────────────────────────────────────────────────

/**
 * Takes a single company event along with its source post and company profile,
 * and generates enrichment data for whoToContact, icpInfo, and leadInfo tables.
 */
export async function enrichCompanyEvent(
  event: {
    eventType: string;
    headline: string;
    summary: string;
    targetEntities: unknown;
    industrySector: string | null;
    leadOpportunity: string;
    confidenceScore: number | null;
    postUrl: string | null;
    postDate: Date | null;
  },
  post: {
    text: string | null;
    shareUrl: string | null;
    postedAt: Date | null;
    reactionCounter: number | null;
    commentCounter: number | null;
    repostCounter: number | null;
  } | null,
  company: {
    name: string;
    publicIdentifier: string | null;
    description: string | null;
    industry: string | null;
    websiteUrl: string | null;
    employeeCount: string | null;
    location: string | null;
    followersCount: number | null;
  },
): Promise<EventEnrichmentResult> {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const userPrompt = `=== COMPANY PROFILE ===
Name: ${company.name}
LinkedIn Slug: ${company.publicIdentifier || "N/A"}
Industry: ${company.industry || "N/A"}
Description: ${company.description || "N/A"}
Website: ${company.websiteUrl || "N/A"}
Employee Count: ${company.employeeCount || "N/A"}
Location: ${company.location || "N/A"}
Followers: ${company.followersCount ?? "N/A"}

=== DETECTED EVENT ===
Event Type: ${event.eventType}
Headline: ${event.headline}
Summary: ${event.summary}
Target Entities: ${JSON.stringify(event.targetEntities) || "None"}
Industry Sector: ${event.industrySector || "N/A"}
Lead Opportunity: ${event.leadOpportunity}
Confidence Score: ${event.confidenceScore ?? "N/A"}
Post URL: ${event.postUrl || "N/A"}
Post Date: ${event.postDate?.toISOString() || "N/A"}

=== ORIGINAL POST DATA ===
Post Text:
"""
${post?.text || "No post text available."}
"""
Post URL: ${post?.shareUrl || "N/A"}
Posted At: ${post?.postedAt?.toISOString() || "N/A"}
Reactions: ${post?.reactionCounter ?? 0}
Comments: ${post?.commentCounter ?? 0}
Reposts: ${post?.repostCounter ?? 0}

Based on all of the above, generate the whoToContact, icpInfo, and leadInfo outputs.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AI returned empty response");
    }

    const parsed = JSON.parse(content) as Partial<EventEnrichmentResult>;

    // Normalize and validate the output
    return {
      whoToContact: {
        entityType: parsed.whoToContact?.entityType || null,
        connectMethod: parsed.whoToContact?.connectMethod || null,
        seniority: Array.isArray(parsed.whoToContact?.seniority)
          ? parsed.whoToContact.seniority
          : [],
        role: Array.isArray(parsed.whoToContact?.role)
          ? parsed.whoToContact.role
          : [],
        extraInfo: parsed.whoToContact?.extraInfo || null,
      },
      icpInfo: {
        industry: Array.isArray(parsed.icpInfo?.industry)
          ? parsed.icpInfo.industry
          : [],
        geography: Array.isArray(parsed.icpInfo?.geography)
          ? parsed.icpInfo.geography
          : [],
        type:
          parsed.icpInfo?.type === "person" ||
          parsed.icpInfo?.type === "company"
            ? parsed.icpInfo.type
            : null,
        title: Array.isArray(parsed.icpInfo?.title) ? parsed.icpInfo.title : [],
        companySize: Array.isArray(parsed.icpInfo?.companySize)
          ? parsed.icpInfo.companySize.filter(
              (n): n is number => typeof n === "number",
            )
          : [],
      },
      leadInfo: {
        industry: Array.isArray(parsed.leadInfo?.industry)
          ? parsed.leadInfo.industry
          : [],
        geography: Array.isArray(parsed.leadInfo?.geography)
          ? parsed.leadInfo.geography
          : [],
        type:
          parsed.leadInfo?.type === "person" ||
          parsed.leadInfo?.type === "company"
            ? parsed.leadInfo.type
            : null,
        title: Array.isArray(parsed.leadInfo?.title)
          ? parsed.leadInfo.title
          : [],
        companySize: Array.isArray(parsed.leadInfo?.companySize)
          ? parsed.leadInfo.companySize.filter(
              (n): n is number => typeof n === "number",
            )
          : [],
        didTheyAsk: parsed.leadInfo?.didTheyAsk || null,
        advantageProviding: parsed.leadInfo?.advantageProviding || null,
        painPoint: parsed.leadInfo?.painPoint || null,
        requirements: parsed.leadInfo?.requirements || null,
        expiration: (() => {
          const raw = parsed.leadInfo?.expiration;
          if (!raw || typeof raw !== "string") return null;
          const lower = raw.trim().toLowerCase();
          if (lower === "null" || lower === "none" || lower === "n/a") return null;
          const d = new Date(raw);
          return isNaN(d.getTime()) ? null : d.toISOString();
        })(),
        otherUsefulResources: parsed.leadInfo?.otherUsefulResources || null,
      },
    };
  } catch (err) {
    if (isRateLimitError(err)) {
      const errMsg =
        err instanceof Error ? err.message : "OpenAI rate limit exceeded";
      console.error("[EventEnricher] OpenAI RATE LIMIT:", errMsg);
      throw new RateLimitError(`OpenAI rate limit: ${errMsg}`, "openai");
    }
    throw err;
  }
}
