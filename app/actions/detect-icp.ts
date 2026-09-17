"use server";

import { db } from "@/db";
import {
  companyEvents,
  companyDetails,
  icpInfo,
  leadInfo,
  whoToContact,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import {
  detectIcpIndustriesAndAngles,
  IcpDetectionResult,
} from "@/lib/ai/icpDetector";

export interface MatchedEventItem {
  eventId: string;
  relevanceScore: number;
  matchingTags: string[];
  whyItIsUseful: string;
  event: {
    id: string;
    eventType: string;
    headline: string;
    summary: string;
    industrySector: string | null;
    leadOpportunity: string;
    confidenceScore: number | null;
    postUrl: string | null;
    postDate: Date | null;
  };
  company: {
    id: string;
    name: string;
    publicIdentifier: string | null;
    profileUrl: string | null;
    description: string | null;
    websiteUrl: string | null;
    industry: string | null;
    followersCount: number | null;
    employeeCount: string | null;
    location: string | null;
    logoUrl: string | null;
  };
  contact: {
    entityType: string | null;
    connectMethod: string | null;
    seniority: string[] | null;
    role: string[] | null;
    extraInfo: string | null;
  } | null;
  icp: {
    industry: string[] | null;
    geography: string[] | null;
    type: string | null;
    title: string[] | null;
    companySize: number[] | null;
  } | null;
  lead: {
    painPoint: string | null;
    advantageProviding: string | null;
    requirements: string | null;
    expiration: Date | null;
  } | null;
}

export interface DetectIcpResponse {
  success: boolean;
  message?: string;
  detection?: IcpDetectionResult;
  matchedEvents: MatchedEventItem[];
  totalEventsAnalyzed: number;
}

export interface IcpPreset {
  title: string;
  category: string;
  companyName: string;
  offering: string;
  lookingFor: string;
}

export async function getIcpPresetsAction(): Promise<IcpPreset[]> {
  return [
    {
      title: "Solar & Clean Energy Solutions",
      category: "CleanTech & Energy",
      companyName: "VoltSun Energy Systems",
      offering:
        "We provide turnkey solar energy installations, commercial battery storage, and EV fleet charging management platforms for businesses and financial institutions looking to decarbonize.",
      lookingFor:
        "Companies, regional banks, and enterprises launching energy transition initiatives, EV charging programs, or green financing projects.",
    },
    {
      title: "FinTech Compliance & AML Software",
      category: "FinTech & Banking",
      companyName: "RegShield AI",
      offering:
        "Enterprise cloud software for automated regulatory compliance, anti-money laundering (AML) detection, and customer onboarding automation for banks and credit unions.",
      lookingFor:
        "Financial institutions, regional banks, and lenders undergoing digital transformation, launching new mobile services, or expanding corporate business centers.",
    },
    {
      title: "Executive Recruitment & Staffing",
      category: "HR & Recruitment",
      companyName: "TalentForge Partners",
      offering:
        "Executive search, technical headhunting, and specialized recruitment for C-level, VP, and Director roles across engineering, sustainability, and digital transformation.",
      lookingFor:
        "Companies announcing aggressive hiring expansions, new department launches, or executive leadership changes.",
    },
    {
      title: "Mobile App & Tourism Tech",
      category: "Digital & Mobile",
      companyName: "AppTerra Studio",
      offering:
        "Custom mobile app engineering, geolocation mapping, UX design, and local merchant onboarding systems for tourism, travel, and regional commerce.",
      lookingFor:
        "Organizations launching regional apps, tourism guides, or local business partnership directories.",
    },
  ];
}

/**
 * Executes AI ICP detection on the user's input and compares the generated
 * industry tags with icp_info, company_events, and company_details to surface useful events.
 */
export async function detectIcpAndMatchEventsAction(params: {
  companyName?: string;
  offering: string;
  lookingFor?: string;
  selectedIndustryFilter?: string;
}): Promise<DetectIcpResponse> {
  try {
    let session = null;
    try {
      session = await getSession();
    } catch {
      // Ignore outside request context
    }

    if (!session?.userId) {
      return {
        success: false,
        message: "You must be signed in to perform ICP detection.",
        matchedEvents: [],
        totalEventsAnalyzed: 0,
      };
    }

    if (!params.offering || params.offering.trim().length < 10) {
      return {
        success: false,
        message: "Please describe your product, service, or offering in more detail (at least 10 characters).",
        matchedEvents: [],
        totalEventsAnalyzed: 0,
      };
    }

    // 1. Gather distinct existing industry taxonomy from DB
    const allIcpRows = await db
      .select({ industry: icpInfo.industry })
      .from(icpInfo);
    const existingIndustriesSet = new Set<string>();
    for (const r of allIcpRows) {
      r.industry?.forEach((ind) => {
        const clean = ind.trim();
        if (clean) existingIndustriesSet.add(clean);
      });
    }

    // 2. Call OpenAI ICP detector
    const detection = await detectIcpIndustriesAndAngles({
      companyName: params.companyName,
      offering: params.offering,
      lookingFor: params.lookingFor,
      availableTaxonomy: Array.from(existingIndustriesSet),
    });

    const predictedPersonas = detection.targetPersonas.map((p) => p.toLowerCase().trim());
    const searchKeywords = detection.searchKeywords.map((k) => k.toLowerCase().trim());

    // 3. Fetch all events with related ICP info, lead info, whoToContact, and companyDetails
    const rows = await db
      .select({
        event: {
          id: companyEvents.id,
          eventType: companyEvents.eventType,
          headline: companyEvents.headline,
          summary: companyEvents.summary,
          industrySector: companyEvents.industrySector,
          leadOpportunity: companyEvents.leadOpportunity,
          confidenceScore: companyEvents.confidenceScore,
          postUrl: companyEvents.postUrl,
          postDate: companyEvents.postDate,
          createdAt: companyEvents.createdAt,
        },
        company: {
          id: companyDetails.id,
          name: companyDetails.name,
          publicIdentifier: companyDetails.publicIdentifier,
          profileUrl: companyDetails.profileUrl,
          description: companyDetails.description,
          websiteUrl: companyDetails.websiteUrl,
          industry: companyDetails.industry,
          followersCount: companyDetails.followersCount,
          employeeCount: companyDetails.employeeCount,
          location: companyDetails.location,
          logoUrl: companyDetails.logoUrl,
        },
        icp: {
          id: icpInfo.id,
          industry: icpInfo.industry,
          geography: icpInfo.geography,
          type: icpInfo.type,
          title: icpInfo.title,
          companySize: icpInfo.companySize,
        },
        lead: {
          id: leadInfo.id,
          industry: leadInfo.industry,
          geography: leadInfo.geography,
          type: leadInfo.type,
          title: leadInfo.title,
          painPoint: leadInfo.painPoint,
          advantageProviding: leadInfo.advantageProviding,
          requirements: leadInfo.requirements,
          expiration: leadInfo.expiration,
        },
        contact: {
          id: whoToContact.id,
          entityType: whoToContact.entityType,
          connectMethod: whoToContact.connectMethod,
          seniority: whoToContact.seniority,
          role: whoToContact.role,
          extraInfo: whoToContact.extraInfo,
        },
      })
      .from(companyEvents)
      .innerJoin(companyDetails, eq(companyEvents.companyDetailId, companyDetails.id))
      .leftJoin(icpInfo, eq(icpInfo.eventId, companyEvents.id))
      .leftJoin(leadInfo, eq(leadInfo.eventId, companyEvents.id))
      .leftJoin(whoToContact, eq(whoToContact.eventId, companyEvents.id))
      .orderBy(desc(companyEvents.createdAt));

    // Deduplicate by event id
    const seenEventIds = new Set<string>();
    const matchedEvents: MatchedEventItem[] = [];

    for (const row of rows) {
      if (!row.event?.id || seenEventIds.has(row.event.id)) continue;
      seenEventIds.add(row.event.id);

      // Collect all industries attached to this event
      const eventIndustries: string[] = [];
      if (row.icp?.industry) eventIndustries.push(...row.icp.industry);
      if (row.lead?.industry) eventIndustries.push(...row.lead.industry);
      if (row.event.industrySector) eventIndustries.push(row.event.industrySector);
      if (row.company.industry) eventIndustries.push(row.company.industry);

      const normalizedEventIndustries = eventIndustries.map((i) => i.toLowerCase().trim());

      // Filter by selected tag if user clicked a specific tag pill
      if (params.selectedIndustryFilter && params.selectedIndustryFilter !== "all") {
        const filterNormalized = params.selectedIndustryFilter.toLowerCase().trim();
        const matchesFilter = normalizedEventIndustries.some(
          (ei) => ei.includes(filterNormalized) || filterNormalized.includes(ei)
        );
        if (!matchesFilter) continue;
      }

      // Check industry matches
      const matchingTagsFound: string[] = [];
      for (const rawTag of detection.industryTags) {
        const tagLower = rawTag.toLowerCase().trim();
        const matched = normalizedEventIndustries.some(
          (ei) => ei.includes(tagLower) || tagLower.includes(ei)
        );
        if (matched) {
          matchingTagsFound.push(rawTag);
        }
      }

      // Persona match bonus
      let personaMatchCount = 0;
      if (row.contact?.role) {
        for (const r of row.contact.role) {
          const roleLower = r.toLowerCase();
          if (predictedPersonas.some((p) => roleLower.includes(p) || p.includes(roleLower))) {
            personaMatchCount++;
          }
        }
      }

      // Keyword match bonus in headline, summary, or opportunity
      const fullText = `${row.event.headline} ${row.event.summary} ${row.event.leadOpportunity}`.toLowerCase();
      let keywordMatches = 0;
      for (const kw of searchKeywords) {
        if (fullText.includes(kw)) keywordMatches++;
      }

      // Calculate weighted relevance score (0 - 100)
      let score = 0;
      if (matchingTagsFound.length > 0) {
        score += Math.min(50, matchingTagsFound.length * 25); // up to 50 pts for industry alignment
      }
      if (personaMatchCount > 0) {
        score += Math.min(25, personaMatchCount * 12); // up to 25 pts for persona alignment
      }
      if (keywordMatches > 0) {
        score += Math.min(25, keywordMatches * 8); // up to 25 pts for semantic keyword signals
      }

      // If at least one matching tag or high keyword match, qualify
      if (score >= 25 || matchingTagsFound.length > 0) {
        const primaryTag = matchingTagsFound[0] || detection.industryTags[0] || "Target Market";
        
        let whyItIsUseful = "";
        if (row.event.leadOpportunity) {
          whyItIsUseful = row.event.leadOpportunity;
        } else if (matchingTagsFound.length > 0) {
          whyItIsUseful = `Aligns directly with your ${matchingTagsFound.join(", ")} market focus. ${row.company.name} announced an active trigger signal in this space.`;
        } else {
          whyItIsUseful = `Contextual fit with your offering. Reaches target decision-makers at ${row.company.name}.`;
        }

        matchedEvents.push({
          eventId: row.event.id,
          relevanceScore: Math.min(100, Math.max(30, score)),
          matchingTags: matchingTagsFound.length > 0 ? matchingTagsFound : [primaryTag],
          whyItIsUseful,
          event: {
            id: row.event.id,
            eventType: row.event.eventType,
            headline: row.event.headline,
            summary: row.event.summary,
            industrySector: row.event.industrySector,
            leadOpportunity: row.event.leadOpportunity,
            confidenceScore: row.event.confidenceScore,
            postUrl: row.event.postUrl,
            postDate: row.event.postDate,
          },
          company: {
            id: row.company.id,
            name: row.company.name,
            publicIdentifier: row.company.publicIdentifier,
            profileUrl: row.company.profileUrl,
            description: row.company.description,
            websiteUrl: row.company.websiteUrl,
            industry: row.company.industry,
            followersCount: row.company.followersCount,
            employeeCount: row.company.employeeCount,
            location: row.company.location,
            logoUrl: row.company.logoUrl,
          },
          contact: row.contact?.id
            ? {
                entityType: row.contact.entityType,
                connectMethod: row.contact.connectMethod,
                seniority: row.contact.seniority,
                role: row.contact.role,
                extraInfo: row.contact.extraInfo,
              }
            : null,
          icp: row.icp?.id
            ? {
                industry: row.icp.industry,
                geography: row.icp.geography,
                type: row.icp.type,
                title: row.icp.title,
                companySize: row.icp.companySize,
              }
            : null,
          lead: row.lead?.id
            ? {
                painPoint: row.lead.painPoint,
                advantageProviding: row.lead.advantageProviding,
                requirements: row.lead.requirements,
                expiration: row.lead.expiration,
              }
            : null,
        });
      }
    }

    // Sort by relevance score descending
    matchedEvents.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      success: true,
      detection,
      matchedEvents,
      totalEventsAnalyzed: seenEventIds.size,
    };
  } catch (err) {
    console.error("[detectIcpAndMatchEventsAction] Error:", err);
    return {
      success: false,
      message: (err as Error)?.message || "Failed to analyze ICP and match events.",
      matchedEvents: [],
      totalEventsAnalyzed: 0,
    };
  }
}
