"use server";

import { db } from "@/db";
import {
  leadInfo,
  icpInfo,
  companyEvents,
  companyDetails,
  whoToContact,
  LeadInfo,
  IcpInfo,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export interface CleanCompanyData {
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
}

export interface CleanEventData {
  id: string;
  eventType: string;
  headline: string;
  summary: string;
  industrySector: string | null;
  leadOpportunity: string;
  confidenceScore: number | null;
  postUrl: string | null;
  postDate: Date | null;
}

export interface CleanContactData {
  id: string;
  entityType: string | null;
  connectMethod: string | null;
  seniority: string[] | null;
  role: string[] | null;
  extraInfo: string | null;
}

export interface LeadFindItem {
  id: string;
  lead: LeadInfo;
  icp: IcpInfo | null;
  event: CleanEventData;
  company: CleanCompanyData;
  contact: CleanContactData | null;
}

export interface IcpFindItem {
  id: string;
  icp: IcpInfo;
  lead: LeadInfo | null;
  event: CleanEventData;
  company: CleanCompanyData;
  contact: CleanContactData | null;
}

export interface FindFilterParams {
  mode: "leads" | "icp";
  query?: string;
  industry?: string;
  geography?: string;
  entityType?: "all" | "person" | "company";
  title?: string;
  minCompanySize?: number;
  maxCompanySize?: number;
  eventType?: string;
  expirationStatus?: "all" | "active" | "expired";
  sortBy?: "newest" | "confidence" | "size";
  limit?: number;
  offset?: number;
}

export interface FilterOptionSummary {
  industries: { name: string; count: number }[];
  geographies: { name: string; count: number }[];
  eventTypes: { name: string; count: number }[];
  titles: { name: string; count: number }[];
  totalLeads: number;
  totalIcps: number;
}

/**
 * Retrieves aggregate filter options to populate dropdown selectors.
 */
export async function getFindFilterOptionsAction(): Promise<FilterOptionSummary> {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return {
        industries: [],
        geographies: [],
        eventTypes: [],
        titles: [],
        totalLeads: 0,
        totalIcps: 0,
      };
    }

    const allLeads = await db.select().from(leadInfo);
    const allIcps = await db.select().from(icpInfo);
    const allEvents = await db.select({
      id: companyEvents.id,
      eventType: companyEvents.eventType,
    }).from(companyEvents);

    const industryMap: Record<string, number> = {};
    const geoMap: Record<string, number> = {};
    const titleMap: Record<string, number> = {};
    const eventTypeMap: Record<string, number> = {};

    for (const lead of allLeads) {
      lead.industry?.forEach((ind) => {
        const cleaned = ind.trim();
        if (cleaned) industryMap[cleaned] = (industryMap[cleaned] || 0) + 1;
      });
      lead.geography?.forEach((geo) => {
        const cleaned = geo.trim();
        if (cleaned) geoMap[cleaned] = (geoMap[cleaned] || 0) + 1;
      });
      lead.title?.forEach((title) => {
        const cleaned = title.trim();
        if (cleaned) titleMap[cleaned] = (titleMap[cleaned] || 0) + 1;
      });
    }

    for (const icp of allIcps) {
      icp.industry?.forEach((ind) => {
        const cleaned = ind.trim();
        if (cleaned) industryMap[cleaned] = (industryMap[cleaned] || 0) + 1;
      });
      icp.geography?.forEach((geo) => {
        const cleaned = geo.trim();
        if (cleaned) geoMap[cleaned] = (geoMap[cleaned] || 0) + 1;
      });
      icp.title?.forEach((title) => {
        const cleaned = title.trim();
        if (cleaned) titleMap[cleaned] = (titleMap[cleaned] || 0) + 1;
      });
    }

    for (const event of allEvents) {
      if (event.eventType) {
        const cleaned = event.eventType.trim();
        eventTypeMap[cleaned] = (eventTypeMap[cleaned] || 0) + 1;
      }
    }

    const sortMap = (map: Record<string, number>) =>
      Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
      industries: sortMap(industryMap).slice(0, 50),
      geographies: sortMap(geoMap).slice(0, 40),
      eventTypes: sortMap(eventTypeMap),
      titles: sortMap(titleMap).slice(0, 50),
      totalLeads: allLeads.length,
      totalIcps: allIcps.length,
    };
  } catch (err) {
    console.error("Error fetching filter options:", err);
    return {
      industries: [],
      geographies: [],
      eventTypes: [],
      titles: [],
      totalLeads: 0,
      totalIcps: 0,
    };
  }
}

/**
 * Query and filter Leads or ICPs with contextual data from company_details, company_events, and who_to_contact.
 */
export async function findEntitiesAction(params: FindFilterParams) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized", data: [], total: 0 };
    }

    const {
      mode,
      query = "",
      industry,
      geography,
      entityType,
      title,
      minCompanySize,
      maxCompanySize,
      eventType,
      expirationStatus,
      sortBy = "newest",
      limit = 50,
      offset = 0,
    } = params;

    const normalizedQuery = query.toLowerCase().trim();

    if (mode === "leads") {
      // Query leads joined with events, companyDetails, whoToContact, and icpInfo
      const rows = await db
        .select({
          lead: leadInfo,
          icp: icpInfo,
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
          contact: {
            id: whoToContact.id,
            entityType: whoToContact.entityType,
            connectMethod: whoToContact.connectMethod,
            seniority: whoToContact.seniority,
            role: whoToContact.role,
            extraInfo: whoToContact.extraInfo,
          },
        })
        .from(leadInfo)
        .innerJoin(companyEvents, eq(leadInfo.eventId, companyEvents.id))
        .innerJoin(companyDetails, eq(companyEvents.companyDetailId, companyDetails.id))
        .leftJoin(icpInfo, eq(icpInfo.eventId, companyEvents.id))
        .leftJoin(whoToContact, eq(whoToContact.eventId, companyEvents.id))
        .orderBy(desc(companyEvents.createdAt));

      // Deduplicate rows by lead id
      const seenLeadIds = new Set<string>();
      const items: LeadFindItem[] = [];
      for (const row of rows) {
        if (!row.lead?.id || seenLeadIds.has(row.lead.id)) continue;
        seenLeadIds.add(row.lead.id);
        items.push({
          id: row.lead.id,
          lead: row.lead,
          icp: row.icp?.id ? row.icp : null,
          event: row.event,
          company: row.company,
          contact: row.contact?.id ? row.contact : null,
        });
      }

      // In-memory precision filtering across array types and text fields
      const filtered = items.filter((row) => {
        // Keyword Search
        if (normalizedQuery) {
          const leadMatch =
            (row.lead.title &&
              row.lead.title.some((t) =>
                t.toLowerCase().includes(normalizedQuery)
              )) ||
            (row.lead.painPoint &&
              row.lead.painPoint.toLowerCase().includes(normalizedQuery)) ||
            (row.lead.advantageProviding &&
              row.lead.advantageProviding.toLowerCase().includes(normalizedQuery)) ||
            (row.lead.requirements &&
              row.lead.requirements.toLowerCase().includes(normalizedQuery)) ||
            (row.lead.industry &&
              row.lead.industry.some((i) =>
                i.toLowerCase().includes(normalizedQuery)
              )) ||
            (row.lead.geography &&
              row.lead.geography.some((g) =>
                g.toLowerCase().includes(normalizedQuery)
              ));

          const icpMatch =
            (row.icp?.title &&
              row.icp.title.some((t) =>
                t.toLowerCase().includes(normalizedQuery)
              )) ||
            (row.icp?.industry &&
              row.icp.industry.some((i) =>
                i.toLowerCase().includes(normalizedQuery)
              )) ||
            (row.icp?.geography &&
              row.icp.geography.some((g) =>
                g.toLowerCase().includes(normalizedQuery)
              ));

          const eventMatch =
            (row.event.headline &&
              row.event.headline.toLowerCase().includes(normalizedQuery)) ||
            (row.event.summary &&
              row.event.summary.toLowerCase().includes(normalizedQuery)) ||
            (row.event.leadOpportunity &&
              row.event.leadOpportunity.toLowerCase().includes(normalizedQuery));

          const companyMatch =
            (row.company.name &&
              row.company.name.toLowerCase().includes(normalizedQuery)) ||
            (row.company.industry &&
              row.company.industry.toLowerCase().includes(normalizedQuery)) ||
            (row.company.description &&
              row.company.description.toLowerCase().includes(normalizedQuery));

          if (!leadMatch && !icpMatch && !eventMatch && !companyMatch) return false;
        }

        // Industry filter
        if (industry && industry !== "all") {
          const hasIndustry = row.lead.industry?.some(
            (ind) => ind.toLowerCase() === industry.toLowerCase()
          );
          const hasIcpIndustry = row.icp?.industry?.some(
            (ind) => ind.toLowerCase() === industry.toLowerCase()
          );
          const hasCompanyIndustry =
            row.company.industry?.toLowerCase().includes(industry.toLowerCase());
          if (!hasIndustry && !hasIcpIndustry && !hasCompanyIndustry) return false;
        }

        // Geography filter
        if (geography && geography !== "all") {
          const hasGeo = row.lead.geography?.some(
            (geo) => geo.toLowerCase() === geography.toLowerCase()
          );
          const hasIcpGeo = row.icp?.geography?.some(
            (geo) => geo.toLowerCase() === geography.toLowerCase()
          );
          if (!hasGeo && !hasIcpGeo) return false;
        }

        // Entity Type filter
        if (entityType && entityType !== "all") {
          if (row.lead.type !== entityType && row.icp?.type !== entityType) return false;
        }

        // Title / Role filter
        if (title && title !== "all") {
          const hasTitle = row.lead.title?.some((t) =>
            t.toLowerCase().includes(title.toLowerCase())
          );
          const hasIcpTitle = row.icp?.title?.some((t) =>
            t.toLowerCase().includes(title.toLowerCase())
          );
          if (!hasTitle && !hasIcpTitle) return false;
        }

        // Event Type filter
        if (eventType && eventType !== "all") {
          if (
            row.event.eventType?.toLowerCase() !== eventType.toLowerCase()
          ) {
            return false;
          }
        }

        // Expiration status filter
        if (expirationStatus && expirationStatus !== "all") {
          const now = new Date();
          const isExpired =
            row.lead.expiration && new Date(row.lead.expiration) < now;
          if (expirationStatus === "active" && isExpired) return false;
          if (expirationStatus === "expired" && !isExpired) return false;
        }

        // Company Size filter
        if (minCompanySize !== undefined && minCompanySize > 0) {
          const sizes = (row.lead.companySize && row.lead.companySize.length > 0)
            ? row.lead.companySize
            : (row.icp?.companySize || []);
          const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0;
          if (maxSize > 0 && maxSize < minCompanySize) return false;
        }

        if (maxCompanySize !== undefined && maxCompanySize > 0) {
          const sizes = (row.lead.companySize && row.lead.companySize.length > 0)
            ? row.lead.companySize
            : (row.icp?.companySize || []);
          const minSize = sizes.length > 0 ? Math.min(...sizes) : 0;
          if (minSize > 0 && minSize > maxCompanySize) return false;
        }

        return true;
      });

      // Sorting
      if (sortBy === "confidence") {
        filtered.sort(
          (a, b) =>
            (b.event.confidenceScore || 0) - (a.event.confidenceScore || 0)
        );
      } else if (sortBy === "size") {
        filtered.sort((a, b) => {
          const sizeA =
            a.lead.companySize && a.lead.companySize.length > 0
              ? Math.max(...a.lead.companySize)
              : 0;
          const sizeB =
            b.lead.companySize && b.lead.companySize.length > 0
              ? Math.max(...b.lead.companySize)
              : 0;
          return sizeB - sizeA;
        });
      } else {
        // newest by default
        filtered.sort((a, b) => {
          const dateA = a.event.postDate
            ? new Date(a.event.postDate).getTime()
            : 0;
          const dateB = b.event.postDate
            ? new Date(b.event.postDate).getTime()
            : 0;
          return dateB - dateA;
        });
      }

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      return {
        success: true,
        mode: "leads" as const,
        data: paginated as LeadFindItem[],
        total,
      };
    } else {
      // Query ICPs joined with events, companyDetails, whoToContact, and leadInfo
      const rows = await db
        .select({
          icp: icpInfo,
          lead: leadInfo,
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
          contact: {
            id: whoToContact.id,
            entityType: whoToContact.entityType,
            connectMethod: whoToContact.connectMethod,
            seniority: whoToContact.seniority,
            role: whoToContact.role,
            extraInfo: whoToContact.extraInfo,
          },
        })
        .from(icpInfo)
        .innerJoin(companyEvents, eq(icpInfo.eventId, companyEvents.id))
        .innerJoin(companyDetails, eq(companyEvents.companyDetailId, companyDetails.id))
        .leftJoin(leadInfo, eq(leadInfo.eventId, companyEvents.id))
        .leftJoin(whoToContact, eq(whoToContact.eventId, companyEvents.id))
        .orderBy(desc(companyEvents.createdAt));

      // Deduplicate rows by icp id
      const seenIcpIds = new Set<string>();
      const items: IcpFindItem[] = [];
      for (const row of rows) {
        if (!row.icp?.id || seenIcpIds.has(row.icp.id)) continue;
        seenIcpIds.add(row.icp.id);
        items.push({
          id: row.icp.id,
          icp: row.icp,
          lead: row.lead?.id ? row.lead : null,
          event: row.event,
          company: row.company,
          contact: row.contact?.id ? row.contact : null,
        });
      }

      const filtered = items.filter((row) => {
        // Keyword Search
        if (normalizedQuery) {
          const icpMatch =
            (row.icp.title &&
              row.icp.title.some((t) =>
                t.toLowerCase().includes(normalizedQuery)
              )) ||
            (row.icp.industry &&
              row.icp.industry.some((i) =>
                i.toLowerCase().includes(normalizedQuery)
              )) ||
            (row.icp.geography &&
              row.icp.geography.some((g) =>
                g.toLowerCase().includes(normalizedQuery)
              ));

          const leadMatch =
            (row.lead?.title &&
              row.lead.title.some((t) =>
                t.toLowerCase().includes(normalizedQuery)
              )) ||
            (row.lead?.painPoint &&
              row.lead.painPoint.toLowerCase().includes(normalizedQuery)) ||
            (row.lead?.advantageProviding &&
              row.lead.advantageProviding.toLowerCase().includes(normalizedQuery)) ||
            (row.lead?.requirements &&
              row.lead.requirements.toLowerCase().includes(normalizedQuery));

          const eventMatch =
            (row.event.headline &&
              row.event.headline.toLowerCase().includes(normalizedQuery)) ||
            (row.event.summary &&
              row.event.summary.toLowerCase().includes(normalizedQuery)) ||
            (row.event.leadOpportunity &&
              row.event.leadOpportunity.toLowerCase().includes(normalizedQuery));

          const companyMatch =
            (row.company.name &&
              row.company.name.toLowerCase().includes(normalizedQuery)) ||
            (row.company.industry &&
              row.company.industry.toLowerCase().includes(normalizedQuery)) ||
            (row.company.description &&
              row.company.description.toLowerCase().includes(normalizedQuery));

          if (!icpMatch && !leadMatch && !eventMatch && !companyMatch) return false;
        }

        // Industry filter
        if (industry && industry !== "all") {
          const hasIndustry = row.icp.industry?.some(
            (ind) => ind.toLowerCase() === industry.toLowerCase()
          );
          const hasLeadIndustry = row.lead?.industry?.some(
            (ind) => ind.toLowerCase() === industry.toLowerCase()
          );
          const hasCompanyIndustry =
            row.company.industry?.toLowerCase().includes(industry.toLowerCase());
          if (!hasIndustry && !hasLeadIndustry && !hasCompanyIndustry) return false;
        }

        // Geography filter
        if (geography && geography !== "all") {
          const hasGeo = row.icp.geography?.some(
            (geo) => geo.toLowerCase() === geography.toLowerCase()
          );
          const hasLeadGeo = row.lead?.geography?.some(
            (geo) => geo.toLowerCase() === geography.toLowerCase()
          );
          if (!hasGeo && !hasLeadGeo) return false;
        }

        // Entity Type filter
        if (entityType && entityType !== "all") {
          if (row.icp.type !== entityType && row.lead?.type !== entityType) return false;
        }

        // Title / Role filter
        if (title && title !== "all") {
          const hasTitle = row.icp.title?.some((t) =>
            t.toLowerCase().includes(title.toLowerCase())
          );
          const hasLeadTitle = row.lead?.title?.some((t) =>
            t.toLowerCase().includes(title.toLowerCase())
          );
          if (!hasTitle && !hasLeadTitle) return false;
        }

        // Event Type filter
        if (eventType && eventType !== "all") {
          if (
            row.event.eventType?.toLowerCase() !== eventType.toLowerCase()
          ) {
            return false;
          }
        }

        // Company Size filter
        if (minCompanySize !== undefined && minCompanySize > 0) {
          const sizes = (row.icp.companySize && row.icp.companySize.length > 0)
            ? row.icp.companySize
            : (row.lead?.companySize || []);
          const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0;
          if (maxSize > 0 && maxSize < minCompanySize) return false;
        }

        if (maxCompanySize !== undefined && maxCompanySize > 0) {
          const sizes = (row.icp.companySize && row.icp.companySize.length > 0)
            ? row.icp.companySize
            : (row.lead?.companySize || []);
          const minSize = sizes.length > 0 ? Math.min(...sizes) : 0;
          if (minSize > 0 && minSize > maxCompanySize) return false;
        }

        return true;
      });

      // Sorting
      if (sortBy === "confidence") {
        filtered.sort(
          (a, b) =>
            (b.event.confidenceScore || 0) - (a.event.confidenceScore || 0)
        );
      } else if (sortBy === "size") {
        filtered.sort((a, b) => {
          const sizeA =
            a.icp.companySize && a.icp.companySize.length > 0
              ? Math.max(...a.icp.companySize)
              : 0;
          const sizeB =
            b.icp.companySize && b.icp.companySize.length > 0
              ? Math.max(...b.icp.companySize)
              : 0;
          return sizeB - sizeA;
        });
      } else {
        filtered.sort((a, b) => {
          const dateA = a.event.postDate
            ? new Date(a.event.postDate).getTime()
            : 0;
          const dateB = b.event.postDate
            ? new Date(b.event.postDate).getTime()
            : 0;
          return dateB - dateA;
        });
      }

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      return {
        success: true,
        mode: "icp" as const,
        data: paginated as IcpFindItem[],
        total,
      };
    }
  } catch (err) {
    console.error("Error in findEntitiesAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to find entities",
      data: [],
      total: 0,
    };
  }
}
